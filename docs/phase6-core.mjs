// Phase 6: local notifications + passphrase-encrypted portable backups.
// No server/cloud account, no background push, no plaintext secret storage.
const MAX_NOTICES = 120;
const MAX_SEEN = 600;
const MIN_PASSWORD_LENGTH = 12;
const ITERATIONS = 250_000;
const MAX_INPUT = 2_000_000;
const KDF = 'PBKDF2-SHA256';
const CIPHER = 'AES-256-GCM';

export function alertPrefs(input) {
  const object = input && typeof input === 'object' ? input : {};
  return {
    newOffers: object.newOffers !== false,
    expiring: object.expiring !== false
  };
}
export function normalizeAlertsState(input) {
  const data = input && typeof input === 'object' ? input : {};
  const inbox = Array.isArray(data.inbox) ? data.inbox.slice(0,MAX_NOTICES).filter(alert =>
    alert && typeof alert.id === 'string' && alert.id.length <= 180 &&
    ['new','deadline'].includes(alert.kind) &&
    typeof alert.offerId === 'string' && alert.offerId.length <= 120
  ).map(alert=>({
    id:alert.id,kind:alert.kind,offerId:alert.offerId,
    title:String(alert.title || '').slice(0,130),
    message:String(alert.message || '').slice(0,180),
    createdAt:String(alert.createdAt || '').slice(0,40),
    read:alert.read === true
  })) : [];
  return {
    initialized:data.initialized === true,
    knownIds:Array.isArray(data.knownIds) ? [...new Set(data.knownIds.filter(id=>typeof id==='string' && id.length<=120))].slice(-MAX_SEEN) : [],
    inbox,
    prefs:alertPrefs(data.prefs)
  };
}
export function buildAlerts(catalog, current, now = new Date()) {
  const state = normalizeAlertsState(current);
  const time = now instanceof Date ? now.getTime() : Number(now);
  if(!Number.isFinite(time)) throw Error('Invalid clock');
  const known = new Set(state.knownIds);
  const existing = new Set(state.inbox.map(x=>x.id));
  const additions = [];
  const validOffers = Array.isArray(catalog) ? catalog.filter(offer=>
    offer && typeof offer.id === 'string' && offer.id.length<=120 &&
    typeof offer.title === 'string' && typeof offer.url === 'string' &&
    (!offer.deadline || (!Number.isNaN(Date.parse(offer.deadline)) && Date.parse(offer.deadline)>time))
  ) : [];
  for (const item of validOffers) {
    if (state.initialized && !known.has(item.id) && state.prefs.newOffers) {
      const id = 'new:'+item.id;
      if (!existing.has(id)) {
        additions.push({
          id,kind:'new',offerId:item.id,
          title:String(item.title).slice(0,130),
          message:'Neuer öffentlicher Fundhinweis – Bedingungen vor Teilnahme prüfen.',
          createdAt:new Date(time).toISOString(),read:false
        });
        existing.add(id);
      }
    }
    if (state.prefs.expiring && item.deadline) {
      const expires=Date.parse(item.deadline);
      const hours=Math.ceil((expires-time)/3600000);
      if (hours>0 && hours<=72) {
        const id='deadline:'+item.id;
        if(!existing.has(id)){
          additions.push({
            id,kind:'deadline',offerId:item.id,title:String(item.title).slice(0,130),
            message:hours<=24?'Teilnahme endet in höchstens 24 Stunden.':'Teilnahme endet in höchstens 72 Stunden.',
            createdAt:new Date(time).toISOString(),read:false
          });
          existing.add(id);
        }
      }
    }
    known.add(item.id);
  }
  const next = {
    initialized:true,
    knownIds:[...known].slice(-MAX_SEEN),
    inbox:[...additions.reverse(),...state.inbox].slice(0,MAX_NOTICES),
    prefs:state.prefs
  };
  return {state:next,added:additions.length};
}
export function unreadCount(input) {
  const state=normalizeAlertsState(input);
  return state.inbox.filter(x=>!x.read).length;
}
export function markAlertsRead(input, alertId = null) {
  const state=normalizeAlertsState(input);
  state.inbox=state.inbox.map(x=>alertId===null || x.id===alertId ? {...x,read:true} : x);
  return state;
}
export function clearReadAlerts(input) {
  const state=normalizeAlertsState(input);
  state.inbox=state.inbox.filter(x=>!x.read);
  return state;
}
function encodeBase64(bytes) {
  let parts=[];
  for(let i=0;i<bytes.length;i+=16384)
    parts.push(String.fromCharCode(...bytes.slice(i,i+16384)));
  return btoa(parts.join(''));
}
function decodeBase64(value,maxBytes=MAX_INPUT){
  if(typeof value!=='string' || value.length>Math.ceil(maxBytes/3)*4+8 ||
     !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
    throw Error('Ungültige verschlüsselte Sicherung');
  const decoded=atob(value);
  if(decoded.length>maxBytes)throw Error('Sicherung zu groß');
  return Uint8Array.from(decoded,ch=>ch.charCodeAt(0));
}
async function deriveKey(passphrase,salt,api,usage){
  const passwordBytes=new TextEncoder().encode(passphrase);
  const material=await api.subtle.importKey('raw',passwordBytes,'PBKDF2',false,['deriveKey']);
  return api.subtle.deriveKey(
    {name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},
    material,{name:'AES-GCM',length:256},false,[usage]
  );
}
export function isEncryptedBackup(text) {
  try { const obj=JSON.parse(text);return obj?.format==='pr-hunter-encrypted-backup'; }
  catch{return false;}
}
export async function encryptBackup(plain,passphrase,api=globalThis.crypto){
  if(typeof plain!=='string' || new TextEncoder().encode(plain).length>MAX_INPUT)
    throw Error('Sicherung zu groß (max. 2 MB)');
  if(typeof passphrase!=='string' || passphrase.length<MIN_PASSWORD_LENGTH || passphrase.length>256)
    throw Error('Passwort benötigt mindestens 12 Zeichen');
  if(!api?.subtle || !api.getRandomValues)
    throw Error('Dieses Gerät unterstützt keine sichere Verschlüsselung');
  const salt=api.getRandomValues(new Uint8Array(16));
  const iv=api.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(passphrase,salt,api,'encrypt');
  const encrypted=await api.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(plain));
  return JSON.stringify({
    format:'pr-hunter-encrypted-backup',version:1,
    cipher:CIPHER,kdf:KDF,iterations:ITERATIONS,
    salt:encodeBase64(salt),iv:encodeBase64(iv),
    data:encodeBase64(new Uint8Array(encrypted))
  },null,2);
}
export async function decryptBackup(text,passphrase,api=globalThis.crypto) {
  if(typeof text!=='string' || text.length>MAX_INPUT*2)
    throw Error('Sicherung zu groß');
  let payload;try{payload=JSON.parse(text);}catch{throw Error('Ungültiges Sicherungsformat');}
  if(payload?.format!=='pr-hunter-encrypted-backup' ||
     payload.version!==1 || payload.kdf!==KDF ||
     payload.cipher!==CIPHER || payload.iterations!==ITERATIONS)
    throw Error('Unbekanntes Verschlüsselungsformat');
  if(typeof passphrase!=='string' || passphrase.length<MIN_PASSWORD_LENGTH)
    throw Error('Passwort mit mindestens 12 Zeichen erforderlich');
  if(!api?.subtle) throw Error('Dieses Gerät unterstützt keine Entschlüsselung');
  const salt=decodeBase64(payload.salt,16);
  const iv=decodeBase64(payload.iv,12);
  if(salt.length!==16 || iv.length!==12) throw Error('Ungültige verschlüsselte Sicherung');
  const data=decodeBase64(payload.data,MAX_INPUT);
  try{
    const key=await deriveKey(passphrase,salt,api,'decrypt');
    const plain=await api.subtle.decrypt({name:'AES-GCM',iv},key,data);
    return new TextDecoder('utf-8',{fatal:true}).decode(plain);
  }catch{throw Error('Falsches Passwort oder beschädigte Sicherung');}
}
