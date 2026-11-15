// Phase 20: device-local Smart Inbox. No Instagram inbox access, web scraping,
// unattended DMs, remote data uploads, or claimed background push.
import { normalizeReelUrl, normalizeDmHandle } from './dm-assistant.mjs';

const MAX_INBOX=120;
const MAX_SEEN=900;
const MAX_KNOWN=500;
const KINDS=new Set(['reel','drop','reply']);

function validHttps(value){
  try{
    const u=new URL(String(value||''));
    if(u.protocol!=='https:' || u.username || u.password || u.port || !u.hostname.includes('.'))return null;
    return u.href;
  }catch{return null;}
}
export function normalizePhase20Prefs(raw){
  const x=raw && typeof raw==='object' && !Array.isArray(raw)?raw:{};
  return {
    newReels:x.newReels!==false,
    newDrops:x.newDrops!==false,
    manualReplies:x.manualReplies!==false,
    autoRefresh:x.autoRefresh!==false,
    deviceNotices:x.deviceNotices===true
  };
}
export function normalizePhase20State(raw){
  const x=raw && typeof raw==='object' && !Array.isArray(raw)?raw:{};
  const capKeys=(arr,max)=>Array.isArray(arr)?[...new Set(arr.filter(y=>typeof y==='string'&&y.length>0&&y.length<=180))].slice(-max):[];
  const inbox=Array.isArray(x.inbox)?x.inbox.slice(0,MAX_INBOX).flatMap(entry=>{
    if(!entry || typeof entry!=='object'||!KINDS.has(entry.kind)||
       typeof entry.id!=='string'||entry.id.length>180||
       typeof entry.offerId!=='string'||entry.offerId.length>120)return [];
    const url=entry.kind==='reel'?normalizeReelUrl(entry.url||entry.offerId):
      entry.kind==='drop'?validHttps(entry.url):null;
    if(entry.kind==='reel'&&!url)return [];
    return [{
      id:entry.id,kind:entry.kind,offerId:entry.offerId,url,
      title:String(entry.title||'').slice(0,130),
      message:String(entry.message||'').slice(0,180),
      createdAt:Number.isFinite(Date.parse(entry.createdAt))?new Date(entry.createdAt).toISOString():'',
      read:entry.read===true
    }];
  }):[];
  return {
    prefs:normalizePhase20Prefs(x.prefs),
    reelsInitialized:x.reelsInitialized===true,
    dropsInitialized:x.dropsInitialized===true,
    knownReels:capKeys(x.knownReels,MAX_KNOWN),
    knownDrops:capKeys(x.knownDrops,MAX_KNOWN),
    seenNoticeIds:capKeys([...(Array.isArray(x.seenNoticeIds)?x.seenNoticeIds:[]),...inbox.map(n=>n.id)],MAX_SEEN),
    inbox
  };
}
function push(state,entry,added){
  if(state.seenNoticeIds.includes(entry.id))return;
  state.inbox.unshift(entry);
  state.inbox=state.inbox.slice(0,MAX_INBOX);
  state.seenNoticeIds=[...state.seenNoticeIds,entry.id].slice(-MAX_SEEN);
  added.push(entry);
}
export function buildPhase20Notices(current,{reels=[],drops=[],reelsAuthorized=false,dropsLoaded=false}={},now=new Date()){
  const state=normalizePhase20State(current);
  const timestamp=now instanceof Date?now.getTime():Number(now);
  if(!Number.isFinite(timestamp))throw Error('Invalid notice clock');
  const at=new Date(timestamp).toISOString();
  const added=[];
  if(dropsLoaded){
    const known=new Set(state.knownDrops);
    const seen=new Set();
    for(const raw of Array.isArray(drops)?drops.slice(0,200):[]){
      // Only curated source-reviewed giveaways or independently priced drops;
      // RSS keyword matches alone must not generate "verified free" notices.
      if(!raw?.curated || !validHttps(raw.url))continue;
      if(raw.deadline && (!Number.isFinite(Date.parse(raw.deadline))||
        Date.parse(raw.deadline)<=timestamp))continue;
      const key=String(raw.id||'').slice(0,120);
      if(!key||seen.has(key))continue;
      seen.add(key);
      if(state.dropsInitialized&&!known.has(key)&&state.prefs.newDrops){
        push(state,{
          id:'drop:'+key,kind:'drop',offerId:key,url:validHttps(raw.url),
          title:String(raw.title||'Neuer Free-Drops-Fund').slice(0,130),
          message:'Neue redaktionell geprüfte Aktion. Preis, Versand und Bedingungen am Original prüfen.',
          createdAt:at,read:false
        },added);
      }
      known.add(key);
    }
    state.knownDrops=[...known].slice(-MAX_KNOWN);
    state.dropsInitialized=true;
  }
  if(reelsAuthorized){
    const known=new Set(state.knownReels);
    const seen=new Set();
    for(const raw of Array.isArray(reels)?reels.slice(0,300):[]){
      const url=normalizeReelUrl(raw?.url||raw?.permalink);
      if(!url || seen.has(url))continue;
      seen.add(url);
      if(state.reelsInitialized&&!known.has(url)&&state.prefs.newReels){
        const brand=normalizeDmHandle(raw?.brand||raw?.username);
        push(state,{
          id:'reel:'+url,kind:'reel',offerId:url,url,
          title:brand?'Neues Reel von @'+brand:'Neues öffentliches Reel',
          message:'Originalvideo über eine freigegebene öffentliche Quelle entdeckt. PR-Angebot nicht garantiert.',
          createdAt:at,read:false
        },added);
      }
      known.add(url);
    }
    state.knownReels=[...known].slice(-MAX_KNOWN);
    state.reelsInitialized=true;
  }
  return {state,added:added.length,notices:added};
}
export function recordConfirmedReply(current,draft,now=new Date()){
  const state=normalizePhase20State(current);
  const at=now instanceof Date?now.getTime():Number(now);
  if(!Number.isFinite(at))throw Error('Invalid notice clock');
  const url=normalizeReelUrl(draft?.reelUrl);
  const brand=normalizeDmHandle(draft?.brand);
  const id=String(draft?.id||'');
  if(!url||!brand||!id||id.length>120||!state.prefs.manualReplies)
    return {state,added:0,notices:[]};
  const added=[];
  push(state,{
    id:'reply:'+id,kind:'reply',offerId:id,url:null,
    title:'Antwort von @'+brand+' selbst bestätigt',
    message:'Du hast diese Antwort in Instagram selbst bestätigt. PR-Hunter hat keine Nachrichten automatisch gelesen.',
    createdAt:new Date(at).toISOString(),read:false
  },added);
  return {state,added:added.length,notices:added};
}
export function phase20Unread(current){
  return normalizePhase20State(current).inbox.filter(x=>!x.read).length;
}
export function markPhase20Read(current,id=null){
  const state=normalizePhase20State(current);
  state.inbox=state.inbox.map(n=>id===null||n.id===id?{...n,read:true}:n);
  return state;
}
export function clearPhase20Read(current){
  const state=normalizePhase20State(current);
  state.inbox=state.inbox.filter(x=>!x.read);
  return state;
}
export const AUTO_REFRESH_MS=10*60*1000;
export function shouldRefreshPhase20({enabled=true,visible=true,online=true,lastAt=0,now=Date.now(),inFlight=false}={}){
  return enabled===true&&visible===true&&online===true&&!inFlight&&
    Number.isFinite(now)&&Number.isFinite(lastAt)&&now-lastAt>=AUTO_REFRESH_MS;
}
