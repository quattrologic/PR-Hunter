// Personalized, non-scraping Reel discovery for the iPad feed.
// Public profiles here are grounded by the named brand's site or public brand records.
// No follower numbers or active PR campaigns are inferred from this directory.
import {normalizeDmHandle,normalizeReelUrl} from './dm-assistant.mjs';
import {dmScoutSignal} from './dm-scout.mjs';

export const STYLE_TOKENS=Object.freeze([
 'streetwear','hoodie','hoodies','puffer','tracksuit','oversized','baggy',
 'graphic','essentials','premium','drops','sneaker','skate','vintage','denim',
 'unisex','shirt','technical','jacket'
]);
export const VERIFIED_STREETWEAR_ACCOUNTS=Object.freeze([
 {handle:'suvene.de',tags:['streetwear','hoodie','puffer','tracksuit','premium','oversized'],tier:'seed',source:'user'},
 {handle:'ranya.owt',tags:['streetwear','graphic','oversized','hoodie','drops'],tier:'seed',source:'user'},
 {handle:'6pm.update',tags:['streetwear','drops','tracksuit','hoodie','oversized'],tier:'seed',source:'user'},
 {handle:'moremoneymorelove.de',tags:['streetwear','premium','hoodie','graphic','drops'],tier:'seed',source:'user'},
 {handle:'deputydepartment',tags:['streetwear','hoodie','graphic','oversized'],tier:'seed',source:'user'},
 {handle:'lucidclub',tags:['streetwear','tracksuit','oversized','hoodie'],tier:'user',source:'user'},
 {handle:'brkdwn.studios',tags:['streetwear','shirt','graphic','skate'],tier:'user',source:'user'},
 {handle:'anora.thelabel',tags:['streetwear','hoodie','drops','oversized'],tier:'user',source:'previous'},
 {handle:'lowlightsstudios',tags:['streetwear','premium','hoodie','essentials','drops','oversized'],tier:'indie',
  source:'https://lowlightsclothing.de/about-us/'},
 {handle:'prohibitedclo',tags:['streetwear','graphic','oversized','drops'],tier:'indie',
  source:'https://www.prohibited.shop/pages/about'},
 {handle:'reternity',tags:['streetwear','premium','vintage','jacket','denim'],tier:'indie',
  source:'https://reternity.de/'},
 {handle:'vicinity_de',tags:['streetwear','sneaker','drops','oversized'],tier:'established',
  source:'https://influ.site/archive/instagram/creator/vicinity_de'}
]);
const accountMap=new Map(VERIFIED_STREETWEAR_ACCOUNTS.map(x=>[x.handle,x]));
export const SEARCH_HASHTAGS=Object.freeze([
 'streetweargiveaway','hoodiegiveaway','streetweardrop',
 'independentstreetwear','streetwearbrand','prpackage'
]);
export function currentSavedBrandHandles({savedBrands=[],savedReels=[],drafts=[]}={}){
  const out=new Set();
  for(const x of savedBrands){
    const n=normalizeDmHandle(typeof x==='string'?x:x?.handle);
    if(n)out.add(n);
  }
  for(const x of savedReels){
    const n=normalizeDmHandle(x?.brand);
    if(n)out.add(n);
  }
  for(const x of drafts){
    const n=normalizeDmHandle(x?.brand);
    if(n)out.add(n);
  }
  // The five original user-selected favorite brands are the initial seed.
  if(out.size===0)for(const x of VERIFIED_STREETWEAR_ACCOUNTS.filter(x=>x.tier==='seed'))out.add(x.handle);
  return [...out].slice(0,50);
}
function interests(handles){
  const weights=new Map([['streetwear',1]]);
  for(const handle of handles){
    const tags=accountMap.get(handle)?.tags||['streetwear','hoodie','oversized'];
    for(const tag of tags)weights.set(tag,(weights.get(tag)||0)+1);
  }
  return weights;
}
export function rankSimilarBrands(input={},limit=8){
  const handles=currentSavedBrandHandles(input),seen=new Set(handles),interest=interests(handles);
  return VERIFIED_STREETWEAR_ACCOUNTS.filter(x=>!seen.has(x.handle))
    .map(x=>({...x,score:x.tags.reduce((n,tag)=>n+(interest.get(tag)||0),0)*4+
      (x.tier==='indie'?12:x.tier==='user'?8:x.tier==='established'?0:3)}))
    .sort((a,b)=>b.score-a.score||a.handle.localeCompare(b.handle))
    .slice(0,Math.max(0,Math.min(20,Math.trunc(limit)||8)));
}
function safePublicVideo(raw,now){
  if(!raw||typeof raw!=='object')return null;
  const url=normalizeReelUrl(raw.url||raw.permalink||raw.reelUrl);
  if(!url||!url.includes('/reel/'))return null;
  const date=Date.parse(raw.publishedAt||raw.timestamp||'');
  if(!Number.isFinite(date)||date>now||now-date>30*86400000)return null;
  const brand=normalizeDmHandle(raw.brand||raw.username);
  const tag=typeof raw.hashtag==='string'&&SEARCH_HASHTAGS.includes(raw.hashtag)?raw.hashtag:null;
  if(!brand&&!tag)return null;
  const source=brand?'business-discovery':'hashtag-search';
  const caption=String(raw.caption||'').slice(0,250);
  return {url,brand,hashtag:tag,source,caption,publishedAt:new Date(date).toISOString(),
    thumbnailUrl:typeof raw.thumbnailUrl==='string'?raw.thumbnailUrl:null};
}
export function rankSimilarVideos({
  reels=[],discoveries=[],savedBrands=[],savedReels=[],drafts=[]
}={},now=Date.now()){
  const handles=currentSavedBrandHandles({savedBrands,savedReels,drafts});
  const interest=interests(handles),saved=new Set(
    savedReels.map(x=>normalizeReelUrl(x?.url)).filter(Boolean));
  const known=new Set(),output=[];
  for(const raw of [...reels,...discoveries]){
    const item=safePublicVideo(raw,now);
    if(!item||known.has(item.url)||saved.has(item.url))continue;
    known.add(item.url);
    const brandProfile=item.brand?accountMap.get(item.brand):null;
    const tags=brandProfile?.tags||STYLE_TOKENS.filter(token=>
      new RegExp('\\b'+token+'\\b','i').test(item.caption.toLowerCase()));
    const isTech=/\b(headphones|smartphone|earbuds|tech gadgets|gaming laptop)\b/i.test(item.caption)
      && !/\b(hoodie|shirt|jacket|streetwear|clothing|outfit|puffer)\b/i.test(item.caption);
    const signal=dmScoutSignal(item.caption);
    const matched=tags.reduce((sum,tag)=>sum+(interest.get(tag)||0),0);
    // Known independent brands first. Anonymous hashtag results remain view-only.
    const score=matched*4+(brandProfile?.tier==='indie'?25:0)+
      (item.brand&&!handles.includes(item.brand)?10:0)+
      (signal==='invitation'?75:signal==='send-request'?36:signal==='free-mention'?20:0)+
      (isTech?-40:12)+
      Math.round((now-Date.parse(item.publishedAt)<3*86400000)?7:0);
    output.push({...item,signal,category:isTech?'Technik':'Kleidung',score});
  }
  output.sort((a,b)=>b.score-a.score||b.publishedAt.localeCompare(a.publishedAt));
  // Keep 90% clothing among the highlighted results, if the real inventory permits.
  const clothes=output.filter(x=>x.category==='Kleidung'),tech=output.filter(x=>x.category==='Technik');
  if(clothes.length>=9)return [...clothes.slice(0,18),...tech.slice(0,2)].slice(0,20);
  return [...clothes,...tech].sort((a,b)=>b.score-a.score).slice(0,20);
}
