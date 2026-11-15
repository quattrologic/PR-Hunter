// Meta Instagram hashtag discovery (official public-content API only).
// Never scrape Instagram, infer usernames, or manufacture a DM recipient.
// Requires Instagram Public Content Access approval in addition to FB Login.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {normalizeReelUrl} from '../docs/dm-assistant.mjs';
import {trustedMetaThumbnail} from '../docs/instagram-brand-core.mjs';
import {SEARCH_HASHTAGS} from '../docs/similar-reels.mjs';

const GRAPH='https://graph.facebook.com',VERSION='v27.0',MAX_TAGS=6;
const ALLOW=new Set(SEARCH_HASHTAGS);
function report(status,now=new Date()){
  return {version:1,source:'Meta public hashtag media',
    status,generatedAt:now.toISOString(),
    tagsChecked:0,tagsUnsupported:0,discovered:[],
    note:'Hashtag-Medien liefern keinen zuverlässig zuordenbaren Absender. Originalprofil vor einer DM selbst prüfen.'};
}
export function hashtagLookupUrl(id,tag){
  if(!/^\d{8,30}$/.test(String(id)))throw Error('Valid professional IG ID required');
  if(!ALLOW.has(tag))throw Error('Unapproved hashtag');
  const u=new URL('/'+VERSION+'/ig_hashtag_search',GRAPH);
  u.searchParams.set('user_id',String(id));
  u.searchParams.set('q',tag);
  return u.href;
}
export function recentHashtagUrl(id,hashtagId){
  if(!/^\d{8,30}$/.test(String(id))||!/^\d{8,30}$/.test(String(hashtagId)))
    throw Error('Valid Instagram IDs required');
  const u=new URL('/'+VERSION+'/'+hashtagId+'/recent_media',GRAPH);
  u.searchParams.set('user_id',String(id));
  u.searchParams.set('fields','id,caption,media_type,permalink,timestamp');
  u.searchParams.set('limit','20');
  return u.href;
}
async function safeGet(url,token,fetchImpl){
  const response=await fetchImpl(url,{
    headers:{Authorization:'Bearer '+token,Accept:'application/json'},
    method:'GET',signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw Error('Unavailable public permission');
  return response.json();
}
export function normalizeHashtagVideo(raw,tag,now=Date.now()){
  if(!ALLOW.has(tag)||!raw||raw.media_type!=='VIDEO')return null;
  const link=normalizeReelUrl(raw.permalink);
  const time=Date.parse(raw.timestamp||'');
  if(!link||!link.includes('/reel/')||!Number.isFinite(time)||time>now||
    now-time>48*3600000)return null;
  return {url:link,hashtag:tag,brand:null,
    caption:String(raw.caption||'').slice(0,250),
    publishedAt:new Date(time).toISOString(),
    thumbnailUrl:trustedMetaThumbnail(raw.thumbnail_url),
    source:'public-hashtag'};
}
export async function scanPublicHashtagVideos({
  userId,accessToken,tags=SEARCH_HASHTAGS,fetchImpl=fetch,now=new Date()
}={}){
  const timestamp=now instanceof Date&&Number.isFinite(now.getTime())?now:new Date();
  if(!userId||!accessToken)return report('not-configured',timestamp);
  if(!/^\d{8,30}$/.test(String(userId))||!/^[A-Za-z0-9_-]{20,}$/.test(String(accessToken)))
    return report('unavailable',timestamp);
  const out=report('unavailable',timestamp),seen=new Set();
  const chosen=[...new Set((Array.isArray(tags)?tags:[]).filter(x=>ALLOW.has(x)))].slice(0,MAX_TAGS);
  for(const tag of chosen){
    try{
      const lookup=await safeGet(hashtagLookupUrl(userId,tag),accessToken,fetchImpl);
      const hashtagId=lookup?.data?.[0]?.id;
      if(!/^\d{8,30}$/.test(String(hashtagId||'')))throw Error('Hashtag unavailable');
      const page=await safeGet(recentHashtagUrl(userId,hashtagId),accessToken,fetchImpl);
      if(!Array.isArray(page?.data))throw Error('Public hashtag media unavailable');
      out.tagsChecked++;
      for(const raw of page.data){
        const video=normalizeHashtagVideo(raw,tag,timestamp.getTime());
        if(!video||seen.has(video.url))continue;
        seen.add(video.url);out.discovered.push(video);
      }
    }catch{
      // Do not log request URLs, tokens, response bodies or private user details.
      out.tagsUnsupported++;
    }
  }
  out.status=out.tagsChecked
    ?out.tagsUnsupported?'partial':'active'
    :'unavailable';
  out.discovered.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  out.discovered=out.discovered.slice(0,100);
  return out;
}
async function main(){
  const previous=JSON.parse(await readFile(new URL('../docs/similar-reels.json',import.meta.url),'utf8'));
  const current=await scanPublicHashtagVideos({
    userId:process.env.META_IG_USER_ID,
    accessToken:process.env.META_USER_ACCESS_TOKEN
  });
  // Do not label stale results as "live" without fresh permissions.
  if(current.status==='active'||current.status==='partial'){
    const now=Date.now(),seen=new Set(current.discovered.map(x=>x.url));
    for(const item of Array.isArray(previous.discovered)?previous.discovered:[]){
      if(!item||seen.has(item.url))continue;
      const created=Date.parse(item.publishedAt||'');
      if(!Number.isFinite(created)||created>now||now-created>7*86400000)continue;
      const url=normalizeReelUrl(item.url);
      if(!url||!url.includes('/reel/')||!ALLOW.has(item.hashtag))continue;
      current.discovered.push({...item,url,brand:null});
      seen.add(url);
      if(current.discovered.length>=100)break;
    }
    current.discovered.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  }
  await writeFile(new URL('../docs/similar-reels.json',import.meta.url),
    JSON.stringify(current,null,2)+'\n');
  console.log('Similar Instagram video scan:',current.status,', tags:',current.tagsChecked,
    ', inaccessible:',current.tagsUnsupported,', public videos:',current.discovered.length);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===fileURLToPath(new URL('file://'+process.argv[1])))
  main().catch(error=>{console.error('Similar video scan failed:',error.name);process.exitCode=1;});
