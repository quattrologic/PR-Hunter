// Phase 16 – quality ranking and transparent feedback for real public Instagram Reels.
// Operates only on validated public Reel metadata returned by the official sources.
// Preferences stay in the user's local data/backups, not in the GitHub scanner.
import {normalizeReelUrl,normalizeDmHandle} from './dm-assistant.mjs';
import {rankSimilarVideos,rankSimilarBrands} from './similar-reels.mjs';

export const SCOUT_VIEWS=Object.freeze(['all','dm','free','new']);
const MAX_HIDDEN_REELS=150,MAX_HIDDEN_BRANDS=80;
const FREE=/\b(?:free|gratis|kostenlos|gift(?:ing|ed)?|give[\s-]?away|gewinnspiel|verlosung|pr[\s-]?(?:package|box|paket)|win)\b/i;
const DM=/\b(?:send|share|forward|dm|message|schick|sende|teile|schreib)\b/i;
const PAYMENT=/\b(?:pay\s+(?:for|to\s+enter)|purchase\s+required|buy\s+(?:to\s+enter|first)|shipping\s+fee|entry\s+fee|deposit\s+required|kostenpflichtig|kaufpflicht|versandgebühr|versandkosten|gebühr)\b/i;
const CREATORS=/\b(?:creators?\s+only|influencers?\s+only|nur\s+(?:für\s+)?(?:creator|influencer)|only\s+(?:for\s+)?(?:content\s+creators?|ambassadors?))\b/i;
const ENDED=/\b(?:giveaway\s+(?:is\s+)?(?:over|closed|ended)|entries?\s+closed|gewinnspiel\s+(?:beendet|vorbei)|verlosung\s+beendet)\b/i;
const RESTRICTED=/\b(?:us\s+only|usa\s+only|uk\s+only|only\s+(?:in|for)\s+(?:the\s+)?(?:us|usa|uk)|nur\s+(?:in|für)\s+(?:usa|uk))\b/i;
const STYLE=/\b(?:streetwear|hoodies?|puffer|jackets?|sneakers?|tracksuits?|oversized|baggy|skate|denim|graphic|shirts?|kleidung|jacken?)\b/i;

export function normalizeScoutPrefs(raw){
  const src=raw && typeof raw==='object' && !Array.isArray(raw)?raw:{};
  const view=SCOUT_VIEWS.includes(src.view)?src.view:'all';
  const hiddenReels=[],rSeen=new Set();
  for(const value of Array.isArray(src.hiddenReels)?src.hiddenReels:[]){
    const url=normalizeReelUrl(value);
    if(!url||rSeen.has(url))continue;
    rSeen.add(url);hiddenReels.push(url);
    if(hiddenReels.length>=MAX_HIDDEN_REELS)break;
  }
  const hiddenBrands=[],bSeen=new Set();
  for(const value of Array.isArray(src.hiddenBrands)?src.hiddenBrands:[]){
    const handle=normalizeDmHandle(value);
    if(!handle||bSeen.has(handle))continue;
    bSeen.add(handle);hiddenBrands.push(handle);
    if(hiddenBrands.length>=MAX_HIDDEN_BRANDS)break;
  }
  return {view,hiddenReels,hiddenBrands};
}
export function setScoutView(existing,view){
  return normalizeScoutPrefs({...normalizeScoutPrefs(existing),view});
}
export function dismissScoutReel(existing,url){
  const prefs=normalizeScoutPrefs(existing),normalized=normalizeReelUrl(url);
  if(!normalized)return prefs;
  return normalizeScoutPrefs({...prefs,
    hiddenReels:[normalized,...prefs.hiddenReels.filter(item=>item!==normalized)].slice(0,MAX_HIDDEN_REELS)});
}
export function dismissScoutBrand(existing,handle){
  const prefs=normalizeScoutPrefs(existing),normalized=normalizeDmHandle(handle);
  if(!normalized)return prefs;
  return normalizeScoutPrefs({...prefs,
    hiddenBrands:[normalized,...prefs.hiddenBrands.filter(item=>item!==normalized)].slice(0,MAX_HIDDEN_BRANDS)});
}
export function inspectScoutCaption(text){
  const caption=String(text||'').slice(0,500);
  return {
    mentionsFree:FREE.test(caption),
    mentionsDm:DM.test(caption),
    asksForPayment:PAYMENT.test(caption),
    creatorsOnly:CREATORS.test(caption),
    explicitEnded:ENDED.test(caption),
    limitedRegion:RESTRICTED.test(caption),
    mentionsClothes:STYLE.test(caption)
  };
}
export function assessScoutReel(item,seedHandles=[]){
  const flags=inspectScoutCaption(item?.caption);
  const handle=normalizeDmHandle(item?.brand);
  const isNew=Boolean(handle&&!seedHandles.includes(handle));
  const hasPrompt=['invitation','send-request'].includes(item?.signal)&&flags.mentionsDm;
  // "DM" in caption by itself is not a verified send-us-this-video call.
  const kind=hasPrompt?'dm':flags.mentionsFree?'free':'style';
  const warnings=[];
  if(flags.asksForPayment)warnings.push('Mögliche Kosten – nicht als kostenlos werten');
  if(flags.creatorsOnly)warnings.push('Möglicherweise nur für Creator');
  if(flags.explicitEnded)warnings.push('Aktion laut Text beendet');
  if(flags.limitedRegion)warnings.push('Teilnahmegebiet möglicherweise eingeschränkt');
  const reasons=[];
  if(kind==='dm')reasons.push('Video-DM-Hinweis');
  else if(kind==='free')reasons.push('Gratis-Stichwort');
  if(item?.category==='Kleidung')reasons.push('Streetwear');
  if(isNew)reasons.push('Neue Marke');
  if(warnings.length)reasons.push('Bedingungen prüfen');
  const score=Number(item?.score||0)+(kind==='dm'?35:kind==='free'?12:0)
    +(isNew?8:0)-(flags.asksForPayment?60:0)
    -(flags.creatorsOnly?55:0)-(flags.explicitEnded?100:0)
    -(flags.limitedRegion?30:0);
  return {...item,kind,isNew,score,warnings,reasons:reasons.slice(0,3),
    // A keyword match is never proof of an offer, eligibility, or a free shipment.
    confirmedFree:false,eligibleForUser:false};
}
export function buildSmartScout({
  reels=[],discoveries=[],savedBrands=[],savedReels=[],drafts=[],prefs={},now=Date.now()
}={}){
  const norm=normalizeScoutPrefs(prefs);
  const handles=savedBrands.map(x=>normalizeDmHandle(typeof x==='string'?x:x?.handle))
    .filter(Boolean);
  const ranking=rankSimilarVideos({reels,discoveries,savedBrands,savedReels,drafts},now);
  const savedSet=new Set([...handles,...savedReels.map(x=>normalizeDmHandle(x?.brand)).filter(Boolean),
    ...drafts.map(x=>normalizeDmHandle(x?.brand)).filter(Boolean)]);
  const hiddenUrls=new Set(norm.hiddenReels),hiddenBrands=new Set(norm.hiddenBrands);
  const items=ranking.map(item=>assessScoutReel(item,[...savedSet]))
    .filter(item=>!hiddenUrls.has(item.url)&&(!item.brand||!hiddenBrands.has(item.brand)))
    .sort((a,b)=>b.score-a.score||b.publishedAt.localeCompare(a.publishedAt));
  const counts={
    all:items.length,
    dm:items.filter(item=>item.kind==='dm'&&!item.warnings.some(x=>x.includes('beendet'))).length,
    free:items.filter(item=>['dm','free'].includes(item.kind)&&!item.warnings.some(x=>x.includes('beendet'))).length,
    new:items.filter(item=>item.isNew).length
  };
  let visible=items.filter(item=>{
    if(norm.view==='all')return true;
    if(norm.view==='dm')return item.kind==='dm'&&!item.warnings.some(x=>x.includes('beendet'));
    if(norm.view==='free')return ['dm','free'].includes(item.kind)&&
      !item.warnings.some(x=>x.includes('beendet'));
    return item.isNew;
  });
  // Keep a clothing-heavy front page when the real results allow it.
  // If fewer than 9 clothing Reels exist, do not fabricate extra items.
  if(visible.length>=10){
    const clothing=visible.filter(x=>x.category==='Kleidung');
    const tech=visible.filter(x=>x.category==='Technik');
    if(clothing.length>=9)visible=[...clothing.slice(0,18),...tech.slice(0,2)];
  }
  return {items:visible.slice(0,20),counts,hidden:norm.hiddenReels.length};
}
export function smartBrandSuggestions({
  savedBrands=[],savedReels=[],drafts=[],prefs={}
}={},limit=8){
  const norm=normalizeScoutPrefs(prefs),hidden=new Set(norm.hiddenBrands);
  return rankSimilarBrands({savedBrands,savedReels,drafts},20)
    .filter(brand=>!hidden.has(brand.handle))
    .slice(0,Math.max(0,Math.min(20,Math.trunc(limit)||8)));
}
