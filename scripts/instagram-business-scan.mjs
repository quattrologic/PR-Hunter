// Permissioned Instagram Business Discovery: server-side only, no personal scraping.
// Requires an Instagram Professional/Business account connected to a Facebook Page
// and a Meta app authorized for business discovery. Secrets stay in Actions secrets.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {normalizeBrandReel} from '../docs/instagram-brand-core.mjs';
import {normalizeDmHandle} from '../docs/dm-assistant.mjs';

const GRAPH_VERSION='v27.0';
const GRAPH_ORIGIN='https://graph.facebook.com';
const MAX_ACCOUNTS=20;
const MAX_PER_ACCOUNT=12;
function emptyReport(status='not-configured',now=new Date()){
  return {version:1,source:'Meta Instagram Business Discovery',
    status,generatedAt:now.toISOString(),brandsChecked:0,
    brandsUnsupported:0,reels:[],note:status==='not-configured'
      ? 'Keine offizielle Meta-Verbindung eingerichtet. Reels können weiterhin manuell importiert werden.'
      : 'Meta-Abfrage unvollständig oder nicht verfügbar. Keine Aktivitäten wurden automatisiert.'};
}
export function buildDiscoveryUrl(igUserId,handle,version=GRAPH_VERSION){
  if(!/^\d{8,30}$/.test(String(igUserId||'')))throw Error('Missing verified IG Professional ID');
  const name=normalizeDmHandle(handle);
  if(!name)throw Error('Invalid public brand handle');
  if(!/^v\d{2}\.\d$/.test(version))throw Error('Invalid Graph API version');
  const url=new URL('/'+version+'/'+igUserId,GRAPH_ORIGIN);
  url.searchParams.set('fields','business_discovery.username('+name+
    '){username,followers_count,media.limit('+MAX_PER_ACCOUNT+
    '){id,media_type,permalink,thumbnail_url,caption,timestamp}}');
  return url.href;
}
export async function scanOfficialBrandReels({
  userId,accessToken,handles,fetchImpl=fetch,now=new Date()
}){
  const timestamp=now instanceof Date && Number.isFinite(now.getTime())?now:new Date();
  if(!userId || !accessToken) return emptyReport('not-configured',timestamp);
  if(!/^[A-Za-z0-9_-]{20,}$/.test(String(accessToken)))
    return emptyReport('unavailable',timestamp);
  const list=[...new Set((Array.isArray(handles)?handles:[])
    .map(normalizeDmHandle).filter(Boolean))].slice(0,MAX_ACCOUNTS);
  const seen=new Set(),reels=[];
  let checked=0,unsupported=0;
  for(const handle of list){
    try{
      const url=buildDiscoveryUrl(userId,handle);
      const response=await fetchImpl(url,{
        method:'GET',headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'},
        signal:AbortSignal.timeout(12000)
      });
      if(!response.ok){unsupported++;continue;}
      const raw=await response.json();
      const business=raw?.business_discovery;
      if(!business || !Array.isArray(business.media?.data)){unsupported++;continue;}
      checked++;
      // Always use the returned owner handle rather than a label supplied by a client.
      const brand=normalizeDmHandle(business.username);
      if(!brand || brand!==handle){unsupported++;continue;}
      for(const media of business.media.data){
        const reel=normalizeBrandReel({
          brand,followersCount:business.followers_count,permalink:media?.permalink,mediaType:media?.media_type,
          caption:media?.caption,thumbnailUrl:media?.thumbnail_url,
          publishedAt:media?.timestamp
        },timestamp.getTime());
        if(reel && !seen.has(reel.url)){seen.add(reel.url);reels.push(reel);}
      }
    } catch {
      // Never log requests, response headers, access tokens or private identities.
      unsupported++;
    }
  }
  reels.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  const report=emptyReport(checked>0?(unsupported>0?'partial':'active'):'unavailable',timestamp);
  report.brandsChecked=checked;
  report.brandsUnsupported=unsupported;
  report.reels=reels.slice(0,200);
  report.note='Nur öffentliche Reels professioneller Accounts. Nicht als Gewinnspiele oder Zusendungen verifiziert.';
  return report;
}
async function main(){
  const config=JSON.parse(await readFile(new URL('../config/instagram-brands.json',import.meta.url),'utf8'));
  const result=await scanOfficialBrandReels({
    userId:process.env.META_IG_USER_ID,
    accessToken:process.env.META_USER_ACCESS_TOKEN,
    handles:config.brands
  });
  await writeFile(new URL('../docs/instagram-reels.json',import.meta.url),
    JSON.stringify(result,null,2)+'\n');
  console.log('Brand-Reels scan:',result.status,', brands:',result.brandsChecked,
    ', unsupported:',result.brandsUnsupported,', real reels:',result.reels.length);
}
if(process.argv[1] && fileURLToPath(import.meta.url)===fileURLToPath(new URL('file://'+process.argv[1])))
  main().catch(error=>{console.error('Brand-Reels scan failed:',error.name);process.exitCode=1;});
