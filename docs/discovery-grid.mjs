// Instagram-like discovery presentation: real local/public records only.
// A public Reel can be embedded on user gesture; a preview is not guaranteed.
// Offers are not verified from Reel URLs and the page never creates fake posts.
const IG_HOSTS=new Set(['instagram.com','www.instagram.com','m.instagram.com']);
export const DISCOVERY_FILTERS=Object.freeze(['for-you','reels','pr','giveaways','drops','deals','black-friday']);
export function reelUrl(value){
  try {
    const u=new URL(String(value||'').trim());
    const parts=u.pathname.split('/').filter(Boolean);
    if(u.protocol!=='https:' || !IG_HOSTS.has(u.hostname.toLowerCase()) || u.port ||
       u.username || u.password || parts.length!==2 ||
       !['reel','p','tv'].includes(parts[0]) || !/^[A-Za-z0-9_-]{5,50}$/.test(parts[1]))return null;
    return 'https://www.instagram.com/'+parts[0]+'/'+parts[1]+'/';
  }catch{return null;}
}
export function publicEmbedUrl(value){
  const canonical=reelUrl(value);
  if(!canonical)return null;
  return canonical+'embed/';
}
export function verifiedDealPrice(offer,now=Date.now()){
  const price=offer?.dealPriceEUR;
  const checked=Date.parse(offer?.priceCheckedAt);
  if(typeof price!=='number' || !Number.isFinite(price) || price<0 || price>100000 ||
     typeof offer?.priceSourceUrl!=='string' || !/^https:\/\//.test(offer.priceSourceUrl) ||
     !Number.isFinite(checked) || checked>now || now-checked>7*86400000) return null;
  try{
    const u=new URL(offer.priceSourceUrl);
    const original=new URL(offer.url);
    if(u.hostname!==original.hostname || u.username || u.password) return null;
  }catch{return null;}
  return price;
}
export function isBlackFridayLead(offer){
  return offer?.blackFriday===true ||
    /black\s*(?:friday|week)|blackweek|cyber\s*monday/i.test(
      String(offer?.title||'')+' '+String(offer?.offerType||'')
    );
}
export function classifyDisplayKind(offer){
  const ig=reelUrl(offer?.url);
  if(ig)return ig.includes('/p/')?'post':'reel';
  if(/giveaway|gewinnspiel|verlosung|gewinnen/i.test(
    String(offer?.title||'')+' '+String(offer?.offerType||'')
  ))return 'giveaway';
  if(/(?:\bdrop\b)|release|launch|restock/i.test(
    String(offer?.title||'')+' '+String(offer?.offerType||'')
  ))return 'drop';
  if(/creator|ambassador|pr.paket|kooperation|ugc/i.test(
    String(offer?.title||'')+' '+String(offer?.offerType||'')
  ))return 'pr';
  return 'offer';
}
export function matchesDiscoveryMode(offer,mode='for-you',now=Date.now()){
  const kind=classifyDisplayKind(offer);
  if(mode==='for-you')return true;
  if(mode==='reels')return kind==='reel'||kind==='post';
  if(mode==='giveaways')return kind==='giveaway';
  if(mode==='pr')return kind==='pr' || kind==='reel' || kind==='post';
  if(mode==='drops')return kind==='drop';
  if(mode==='deals') {
    const price=verifiedDealPrice(offer,now);
    return price!==null && price>=1 && price<=10;
  }
  if(mode==='black-friday')return isBlackFridayLead(offer);
  return false;
}
export function discoveryCards(offers,reelDrafts,options={}){
  const seen=new Set(),cards=[];
  const mode=DISCOVERY_FILTERS.includes(options.mode)?options.mode:'for-you';
  const now=Number.isFinite(options.now)?options.now:Date.now();
  const query=String(options.query||'').trim().toLocaleLowerCase('de-DE');
  const add=(offer,draft=null)=>{
    if(!offer || typeof offer!=='object' || !offer.url)return;
    const key=reelUrl(offer.url) || offer.url;
    if(seen.has(key) || !matchesDiscoveryMode(offer,mode,now))return;
    if(offer.deadline && Number.isFinite(Date.parse(offer.deadline)) &&
       Date.parse(offer.deadline)<now)return;
    if(query && ![
      offer.brand,offer.title,offer.description,offer.offerType,offer.source
    ].some(value=>String(value||'').toLocaleLowerCase('de-DE').includes(query)))return;
    seen.add(key);cards.push({
      offerId:String(offer.id||''),title:String(offer.title||'').slice(0,130),
      brand:String(offer.brand||offer.source||'Originalquelle').slice(0,90),
      url:key,kind:classifyDisplayKind(offer),verifiedPrice:verifiedDealPrice(offer,now),
      sourceType:String(offer.sourceType||'manual'),fromDraft:Boolean(draft),
      status:draft?.status||null,category:offer.category||'Mode',
      thumbnailUrl:offer.sourceType==='instagram-professional' ? (offer.thumbnailUrl||null):null,
      publishedAt:offer.publishedAt||null,
      caption:offer.sourceType==='instagram-professional' ? String(offer.caption||'').slice(0,250):null
    });
  };
  // Saved Reels are real user-supplied links. No invented views/likes/thumbnail.
  for(const draft of (Array.isArray(reelDrafts)?reelDrafts:[])){
    if(!reelUrl(draft?.reelUrl))continue;
    add({
      id:'dm:'+draft.id,url:draft.reelUrl,title:'Instagram-Reel · Original ansehen',
      brand:'@'+String(draft.brand||'').replace(/^@/,''),category:'Mode',
      source:'Video-DM · selbst gespeichert',sourceType:'manual'
    },draft);
  }
  for(const reel of (Array.isArray(options.savedReels)?options.savedReels:[])){
    if(!reelUrl(reel?.url))continue;
    add({
      id:'saved:'+reel.url,url:reel.url,title:'Reel von @'+reel.brand,
      brand:'@'+reel.brand,category:'Mode',source:'Eigener Reel-Link',
      sourceType:'manual-reel'
    });
  }
  for(const reel of (Array.isArray(options.brandReels)?options.brandReels:[])){
    if(!reelUrl(reel?.url) || !String(reel.url).includes('/reel/'))continue;
    add({
      id:'ig:'+reel.url,url:reel.url,
      title:'Reel von @'+reel.brand,
      brand:'@'+reel.brand,category:'Mode',source:'Offizielle Meta Business Discovery',
      sourceType:'instagram-professional',
      thumbnailUrl:reel.thumbnailUrl,caption:reel.caption,publishedAt:reel.publishedAt
    });
  }
  for(const offer of (Array.isArray(offers)?offers:[]))add(offer);
  return cards.slice(0,1000);
}
export function filterEmptyMessage(mode){
  if(mode==='deals')return 'Noch keine nachweislich verfügbaren Streetwear-Drops für 1–10 € gefunden.';
  if(mode==='reels')return 'Noch keine Instagram-Reel-Links oder Beiträge vorhanden. Du kannst oben einen Link hinzufügen.';
  if(mode==='black-friday')return 'Aktuell keine Black-Friday-Hinweise im öffentlichen Katalog.';
  if(mode==='drops')return 'Derzeit keine bestätigten Drops in den verfügbaren Quellen.';
  if(mode==='pr')return 'Noch keine passenden PR-Reels oder öffentlichen Kooperationen in deiner Liste.';
  if(mode==='giveaways')return 'Momentan keine passenden Gewinnspielhinweise.';
  return 'Noch keine passenden Inhalte. Ändere die Suche oder füge einen Original-Link hinzu.';
}
