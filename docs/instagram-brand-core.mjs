// Phase 13 – public Brand Reels only from an official, permissioned Meta data source.
// No login or user secrets in this static web app. No generic following feed.
import { reelUrl } from './discovery-grid.mjs';
import { normalizeDmHandle } from './dm-assistant.mjs';

const META_IMAGE_DOMAINS=['cdninstagram.com','fbcdn.net','instagram.com'];
const MAX_REELS=200;
const MAX_AGE_MS=30*86400000;

export function trustedMetaThumbnail(value){
  try{
    const url=new URL(String(value||''));
    if(url.protocol!=='https:' || url.username || url.password || url.port) return null;
    const host=url.hostname.toLowerCase();
    if(!META_IMAGE_DOMAINS.some(base=>host===base || host.endsWith('.'+base)))return null;
    return url.href;
  }catch{return null;}
}
export function normalizeBrandReel(raw,now=Date.now()){
  if(!raw || typeof raw!=='object')return null;
  const handle=normalizeDmHandle(raw.brand || raw.username);
  const canonical=reelUrl(raw.permalink||raw.url);
  if(!handle || !canonical || !canonical.includes('/reel/'))return null;
  if(raw.mediaType && raw.mediaType!=='VIDEO')return null;
  const posted=Date.parse(raw.publishedAt||raw.timestamp||'');
  if(!Number.isFinite(posted) || posted>now || now-posted>MAX_AGE_MS)return null;
  const caption=String(raw.caption||'').trim().slice(0,250);
  return {
    brand:handle,
    url:canonical,
    caption,
    publishedAt:new Date(posted).toISOString(),
    thumbnailUrl:trustedMetaThumbnail(raw.thumbnailUrl || raw.thumbnail_url),
    source:'official-business-discovery'
  };
}
export function normalizeInstagramReelsReport(raw,now=Date.now()){
  const status=['not-configured','active','partial','unavailable'].includes(raw?.status)?raw.status:'unavailable';
  const seen=new Set(),reels=[];
  for(const item of Array.isArray(raw?.reels)?raw.reels:[]){
    const normalized=normalizeBrandReel(item,now);
    if(!normalized||seen.has(normalized.url))continue;
    seen.add(normalized.url);reels.push(normalized);
    if(reels.length>=MAX_REELS)break;
  }
  reels.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  const when=Date.parse(raw?.generatedAt||'');
  return {
    status,
    generatedAt:Number.isFinite(when) ? new Date(when).toISOString():null,
    brandsChecked:Number.isInteger(raw?.brandsChecked)&&raw.brandsChecked>=0?raw.brandsChecked:0,
    brandsUnsupported:Number.isInteger(raw?.brandsUnsupported)&&raw.brandsUnsupported>=0?raw.brandsUnsupported:0,
    reels:status==='not-configured'?[]:reels
  };
}
export function reelFeedStatusText(report){
  if(report.status==='active')return 'Offizielle Marken-Reels · '+report.reels.length+' aktuelle Videos';
  if(report.status==='partial')return 'Offizielle Marken-Reels teilweise verfügbar · '+report.reels.length+' Videos';
  if(report.status==='not-configured')return 'Automatischer Instagram-Import noch nicht verbunden · eigene Reels per Link hinzufügen';
  return 'Offizielle Instagram-Markenabfrage zurzeit nicht verfügbar';
}


// Private saved Reel links on this device; saving does not create/send a DM.
export function normalizeSavedReels(raw){
  const seen=new Set(),result=[];
  for(const value of Array.isArray(raw)?raw:[]){
    const brand=normalizeDmHandle(value?.brand);
    const url=reelUrl(value?.url);
    if(!brand||!url||seen.has(url))continue;
    seen.add(url);
    result.push({brand,url,source:'user-saved'});
    if(result.length>=100)break;
  }
  return result;
}
export function addSavedReel(existing,brand,url){
  const list=normalizeSavedReels(existing);
  const handle=normalizeDmHandle(brand);
  const canonical=reelUrl(url);
  if(!handle||!canonical)
    return {added:false,reels:list,reason:'Gültiger Instagram-Reel- oder Beitragslink und @Markenname nötig.'};
  if(list.some(x=>x.url===canonical))
    return {added:false,reels:list,reason:'Dieser Instagram-Beitrag ist bereits gespeichert.'};
  if(list.length>=100)return {added:false,reels:list,reason:'Maximal 100 private Instagram-Links.'};
  return {added:true,reels:[{brand:handle,url:canonical,source:'user-saved'},...list],reason:null};
}
