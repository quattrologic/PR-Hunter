// Public, permissioned signals + user-saved links for the home Video-DM scout.
// Never invent live offers or claim an unverified brand is currently gifting items.
import {normalizeDmHandle,normalizeReelUrl} from './dm-assistant.mjs';

const REQUEST_RE=/(?:send|share|forward|dm|message|schick|sende|teile|schreib).{0,52}(?:reel|video|post|beitrag|clip)|(?:reel|video|post).{0,44}(?:dm|send|share|sende|schick)/i;
const FREE_RE=/(?:\bfree\b|gratis|kostenlos|giveaway|give\s?away|gewinnspiel|verlosung|win(?:ning)?|pr\s?(?:package|box|paket|set)|gift(?:ing|ed)?)/i;
const STYLE_RE=/(?:streetwear|hoodie|puffer|tracksuit|shirt|jacke|jacket|sneaker|fashion|clothing|mode|kleidung|outfit|pants|sweatshirt|trousers)/i;
const TECH_RE=/(?:tech|headphones|earbuds|smartphone|laptop|gadgets|gaming|elektronik)/i;
export const PUBLIC_SMALL_BRAND_WATCH=Object.freeze([
 {handle:'brkdwn.studios',source:'Von dir genannte Streetwear-Marke'},
 {handle:'lucidclub',source:'Von dir genannte Streetwear-Marke'},
 {handle:'anora.thelabel',source:'Öffentlicher älterer Hinweis – aktuellen Stand prüfen'}
]);
export function dmScoutSignal(text){
  const caption=String(text||'').slice(0,500);
  const request=REQUEST_RE.test(caption),free=FREE_RE.test(caption);
  return request&&free?'invitation':request?'send-request':free?'free-mention':'none';
}
export function instagramDmLink(raw){
  const brand=normalizeDmHandle(raw);
  return brand?'https://ig.me/m/'+brand:null;
}
export function dmScoutText(item,language='en'){
  const handle=normalizeDmHandle(item?.brand);
  const link=normalizeReelUrl(item?.reelUrl);
  if(!handle||!link)return null;
  const strong=item.signal==='invitation';
  // No identity/creator misrepresentation; unverified leads must not assert a live offer.
  if(language==='de'){
    return strong
      ? 'Hey @'+handle+'! Ich habe euren Beitrag gesehen und mag euren Style. Ich bin kein Content Creator, sondern einfach ein Fan. Gilt die Aktion auch für normale Follower? Danke! 🙌\n\n'+link
      : 'Hey @'+handle+'! Ich mag euren Style und habe diesen Beitrag gesehen. Bietet ihr aktuell auch kostenlose PR-Teile oder Gewinnspiele für normale Follower an? Ich bin kein Creator. Danke! 🙌\n\n'+link;
  }
  return strong
    ? 'Hey @'+handle+'! I saw your video and love your pieces. I’m not a content creator, just a fan. Is the offer open to regular followers too? Thank you! 🙌\n\n'+link
    : 'Hey @'+handle+'! I came across this post and really like your style. Are you offering any free pieces or giveaways for regular followers? I’m not a creator. Thanks! 🙌\n\n'+link;
}
function category(caption){
  const text=String(caption||'');
  return TECH_RE.test(text)&&!STYLE_RE.test(text)?'Technik':'Kleidung';
}
export function dmScoutCandidates({officialReels=[],savedReels=[],drafts=[],publicOffers=[]}={},now=Date.now()){
  const map=new Map();
  const append=(raw,source,order)=>{
    const brand=normalizeDmHandle(raw?.brand || raw?.username);
    const reelUrl=normalizeReelUrl(raw?.reelUrl || raw?.url);
    if(!brand||!reelUrl)return;
    const caption=source==='meta'?String(raw.caption||'').slice(0,250):'';
    const timestamp=Date.parse(raw.publishedAt||'');
    if(source==='meta'&&(!Number.isFinite(timestamp)||timestamp>now||now-timestamp>30*86400000))return;
    const key=reelUrl;
    const signal=source==='meta'?dmScoutSignal(caption):'unverified';
    const item={
      id:key,brand,reelUrl,signal,
      source,category:category(caption),
      publishedAt:source==='meta'?new Date(timestamp).toISOString():null,
      // Only a verified caption may be used to assert the presence of public invitation text.
      caption:source==='meta'?caption:'',
      confidence:signal==='invitation'?'Textsignal · Bedingungen prüfen':
        source==='meta'?'Kein bestätigter Gratisaufruf':'Von dir gespeichert · Aktion ungeprüft',
      rank:(signal==='invitation'?100:signal==='send-request'?70:signal==='free-mention'?40:10)+order
    };
    if(!map.has(key)||item.rank>map.get(key).rank)map.set(key,item);
  };
  for(const item of Array.isArray(officialReels)?officialReels:[])append(item,'meta',8);
  for(const item of Array.isArray(savedReels)?savedReels:[])append(item,'saved',5);
  for(const item of Array.isArray(drafts)?drafts:[])append(item,'draft',4);
  for(const item of Array.isArray(publicOffers)?publicOffers:[]){
    // A generic RSS/web link does not count as an Instagram posting or DM action.
    if(normalizeReelUrl(item?.url))append({
      brand:item.brand,url:item.url
    },'public-link',2);
  }
  // Mode is prioritized at 90%; technology appears when actual data supports it.
  return [...map.values()].sort((a,b)=>{
    const rank=b.rank-a.rank;
    if(rank!==0)return rank;
    if(a.category!==b.category)return a.category==='Kleidung'?-1:1;
    return String(b.publishedAt||'').localeCompare(String(a.publishedAt||''));
  }).slice(0,40);
}
export function dmScoutProspects(watchedBrands=[],limit=8){
  const map=new Map();
  for(const entry of PUBLIC_SMALL_BRAND_WATCH){
    map.set(entry.handle,{...entry,verifiedOffer:false});
  }
  for(const brand of Array.isArray(watchedBrands)?watchedBrands:[]){
    const handle=normalizeDmHandle(brand?.handle);
    if(handle&&!map.has(handle))map.set(handle,{
      handle,source:'Beobachtete Marke · Aktion noch nicht bestätigt',verifiedOffer:false
    });
  }
  return [...map.values()].slice(0,Math.min(20,Math.max(0,Math.trunc(limit)||8)));
}
