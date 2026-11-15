// iPad DM-preparation assistant: one-tap text/link preparation, never transmission.
// Instagram's official business messaging API cannot start arbitrary cold DMs.
const INSTAGRAM_HOSTS=new Set(['instagram.com','www.instagram.com','m.instagram.com']);
const TYPES=new Set(['reel','p','tv']);
const MAX_ITEMS=120;
const STATUSES=new Set(['prepared','sent','replied']);

export function normalizeDmHandle(input){
  const handle=String(input??'').trim().replace(/^@/,'').toLowerCase();
  if(!/^[a-z0-9._]{1,30}$/.test(handle) || handle.startsWith('.') ||
     handle.endsWith('.') || handle.includes('..'))return null;
  return handle;
}
export function normalizeReelUrl(input){
  try{
    const url=new URL(String(input||'').trim());
    if(url.protocol!=='https:' || url.username || url.password ||
       !INSTAGRAM_HOSTS.has(url.hostname.toLowerCase()) || url.port)return null;
    const parts=url.pathname.split('/').filter(Boolean);
    if(parts.length!==2 || !TYPES.has(parts[0]) || !/^[A-Za-z0-9_-]{5,50}$/.test(parts[1]))return null;
    return 'https://www.instagram.com/'+parts[0]+'/'+parts[1]+'/';
  }catch{return null;}
}
export function dmBrandProfile(handle) {
  const normalized=normalizeDmHandle(handle);
  return normalized ? 'https://www.instagram.com/'+normalized+'/' : null;
}
export function dmCopyText({brand='',language='en',kind='generic',includeLink=false,reelUrl=''}={}){
  const handle=normalizeDmHandle(brand);
  if(!handle)return null;
  const prize=kind==='shirt'?'a shirt':kind==='tracksuit'?'a tracksuit':'one of your pieces';
  const germanPrize=kind==='shirt'?'ein Shirt':kind==='tracksuit'?'einen Trainingsanzug':'eines eurer Teile';
  // Don't pretend to be an influencer, promise promotional content, or claim eligibility.
  const en='Hey @'+handle+'! I saw your video and really like your style. I’m not a content creator or brand ambassador, just someone who likes your brand. Is your offer to possibly receive '+prize+' also open to regular followers? Thanks for considering me! 🙌';
  const de='Hey @'+handle+'! Ich habe euer Video gesehen und mag euren Style sehr. Ich bin kein Content Creator oder Markenbotschafter, sondern einfach ein Fan eurer Marke. Gilt eure Aktion, bei der man vielleicht '+germanPrize+' bekommt, auch für normale Follower? Danke euch! 🙌';
  const body=language==='de'?de:en;
  const link=normalizeReelUrl(reelUrl);
  return includeLink && link?body+'\n\n'+link:body;
}
export function normalizeDmDrafts(raw){
  if(!Array.isArray(raw))return [];
  const seen=new Set(), items=[];
  for(const original of raw){
    if(!original || typeof original!=='object')continue;
    const brand=normalizeDmHandle(original.brand);
    const reelUrl=normalizeReelUrl(original.reelUrl);
    if(!brand || !reelUrl)continue;
    const id=brand+'|'+reelUrl;
    if(seen.has(id))continue;
    seen.add(id);
    items.push({
      id,brand,reelUrl,
      message:normalizeDmMessage(original.message),
      sentMessage:normalizeDmMessage(original.sentMessage,2400),
      sentAt:validDate(original.sentAt),
      pendingMessage:normalizeDmMessage(original.pendingMessage,2400),
      pendingAt:validDate(original.pendingAt),
      shippingEUR:typeof original.shippingEUR==='number' && Number.isFinite(original.shippingEUR) && original.shippingEUR>=0 && original.shippingEUR<=1000?Math.round(original.shippingEUR*100)/100:null,
      language:original.language==='de'?'de':'en',
      kind:['shirt','tracksuit'].includes(original.kind)?original.kind:'generic',
      status:STATUSES.has(original.status)?original.status:'prepared',
      createdAt:validDate(original.createdAt),
      updatedAt:validDate(original.updatedAt)
    });
    if(items.length>=MAX_ITEMS)break;
  }
  return items;
}
function validDate(input){
  return typeof input==='string' && input.length<=40 &&
    Number.isFinite(Date.parse(input))?new Date(input).toISOString():'';
}
export function addDmDraft(current,input,now=new Date()){
  const brand=normalizeDmHandle(input?.brand);
  const reelUrl=normalizeReelUrl(input?.reelUrl);
  const existing=normalizeDmDrafts(current);
  if(!brand || !reelUrl)return {drafts:existing,added:false,reason:'Bitte einen gültigen Instagram-Beitrag und einen echten @Markennamen eingeben.'};
  const id=brand+'|'+reelUrl;
  if(existing.some(x=>x.id===id))return {drafts:existing,added:false,reason:'Dieses Video ist für diese Marke schon in deiner Liste.'};
  if(existing.length>=MAX_ITEMS)return {drafts:existing,added:false,reason:'Maximal 120 gespeicherte DM-Vorlagen.'};
  const stamp=now instanceof Date && Number.isFinite(now.getTime())?now.toISOString():new Date().toISOString();
  const item={
    id,brand,reelUrl,message:normalizeDmMessage(input.message),language:input.language==='de'?'de':'en',
    kind:['shirt','tracksuit'].includes(input.kind)?input.kind:'generic',
    status:'prepared',createdAt:stamp,updatedAt:stamp
  };
  return {drafts:normalizeDmDrafts([item,...existing]),added:true,reason:null};
}
export function updateDmStatus(current,id,status,now=new Date()){
  if(!STATUSES.has(status))return normalizeDmDrafts(current);
  const stamp=now instanceof Date && Number.isFinite(now.getTime())?now.toISOString():new Date().toISOString();
  return normalizeDmDrafts(current).map(x=>x.id===id?{...x,status,updatedAt:stamp}:x);
}
export function dmStats(current){
  const list=normalizeDmDrafts(current);
  return {
    prepared:list.filter(x=>x.status==='prepared').length,
    sent:list.filter(x=>x.status==='sent' || x.status==='replied').length,
    replied:list.filter(x=>x.status==='replied').length,
    total:list.length
  };
}

// Bound private edited text; old drafts still resolve to their original template.
export function normalizeDmMessage(value,limit=2000){
  return typeof value==='string'?value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,limit).trim():'';
}
export function dmDraftText(draft,includeLink=false){
  const body=normalizeDmMessage(draft?.message)||dmCopyText(draft);
  const link=normalizeReelUrl(draft?.reelUrl);
  return body && includeLink && link && !body.includes(link)?body+'\n\n'+link:body;
}
export function editDmDraft(current,id,message,now=new Date()){
  const text=normalizeDmMessage(message);
  return normalizeDmDrafts(current).map(draft=>draft.id===id && text
    ? {...draft,message:text,updatedAt:validDate(now.toISOString())}:draft);
}
export function filterDmDrafts(current,status='all'){
  return normalizeDmDrafts(current).filter(d=>!STATUSES.has(status)||d.status===status)
    .sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

// Snapshot the exact copied text. Only an explicit confirmation records a send.
export function prepareDmHandoff(current,id,message,now=new Date()){
  const text=normalizeDmMessage(message,2400);
  return normalizeDmDrafts(current).map(d=>({...d,pendingMessage:d.id===id&&d.status==='prepared'?text:'',pendingAt:d.id===id&&d.status==='prepared'&&text?now.toISOString():''}));
}
export function resolveDmHandoff(current,id,sent,now=new Date()){
  return normalizeDmDrafts(current).map(d=>d.id!==id?d:{...d,
    ...(sent && d.status==='prepared' && d.pendingMessage?{status:'sent',sentMessage:d.pendingMessage,sentAt:now.toISOString(),updatedAt:now.toISOString()}:{}),
    pendingMessage:'',pendingAt:''});
}
export function confirmDmSent(current,id,now=new Date()){
  const draft=normalizeDmDrafts(current).find(d=>d.id===id);
  if(!draft||draft.status!=='prepared')return normalizeDmDrafts(current);
  return resolveDmHandoff(prepareDmHandoff(current,id,dmDraftText(draft,true),now),id,true,now);
}
export function setDmShipping(current,id,value){
  const cost=value===null?null:typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1000?Math.round(value*100)/100:undefined;
  return normalizeDmDrafts(current).map(d=>d.id===id&&cost!==undefined?{...d,shippingEUR:cost}:d);
}
