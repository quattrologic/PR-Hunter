// Phase 4: device-only Instagram link intake and local data backups.
// Does not access Instagram, enumerate followers, log in, or post comments.
import { safeExternalUrl, normalizeBrand, validAccountLabel } from './ultimate-core.mjs';
import { normalizeAlertsState } from './phase6-core.mjs';
import { normalizeDisplayPrefs } from './phase7-core.mjs';

const MAX_BATCH = 40;
const MAX_BACKUP_BYTES = 2_000_000;
const IG_HOSTS = new Set(['instagram.com','www.instagram.com','m.instagram.com']);
const IG_TYPES = new Set(['p','reel','tv']);

export function canonicalOpportunityUrl(input) {
  const safe = safeExternalUrl(input);
  if (!safe) return null;
  const u = new URL(safe);
  const host = u.hostname.toLowerCase();
  // Prevent lookalike links such as www.instagram.com.evil.test from
  // masquerading as Instagram while still allowing unrelated HTTPS sites.
  if (!IG_HOSTS.has(host) && /(?:^|\.)instagram\.com(?:\.|$)/.test(host)) return null;
  if (IG_HOSTS.has(host)) {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length !== 2 || !IG_TYPES.has(parts[0]) || !/^[A-Za-z0-9_-]{5,50}$/.test(parts[1])) return null;
    return 'https://www.instagram.com/' + parts[0] + '/' + parts[1] + '/';
  }
  // For a non-Instagram website, retain the exact link except tracking fragments.
  u.hash = '';
  if (!u.search) return u.href;
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|igsh$|igshid$)/i.test(key)) u.searchParams.delete(key);
  }
  return u.href;
}
export function extractOpportunityLinks(text, limit = MAX_BATCH) {
  if (typeof text !== 'string' || text.length > 20_000) return [];
  const candidates = text.match(/https:\/\/[^\s<>"'()[\]{}]+/gi) || [];
  const seen = new Set();
  const links = [];
  for (const raw of candidates) {
    const normalized = canonicalOpportunityUrl(raw.replace(/[.,;!?]+$/g,''));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    links.push(normalized);
    if (links.length >= Math.min(MAX_BATCH,Math.max(1,limit))) break;
  }
  return links;
}
export function makeImportedOffers(links, existing = [], brandName = '', now = new Date()) {
  const already = new Set(existing.map(x => canonicalOpportunityUrl(x.url)).filter(Boolean));
  const label = String(brandName || '').trim().slice(0,80);
  const imported = [];
  for (const url of links) {
    const normalized = canonicalOpportunityUrl(url);
    if (!normalized || already.has(normalized)) continue;
    already.add(normalized);
    const isInstagram = normalized.startsWith('https://www.instagram.com/');
    imported.push({
      id: 'manual-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + imported.length),
      title: isInstagram ? 'Instagram-Beitrag – Gewinnspiel selbst prüfen' : 'Externe Aktion – Regeln selbst prüfen',
      brand: label || (isInstagram ? 'Instagram (Brand ungeprüft)' : 'Externe Quelle'),
      url: normalized,
      category: 'Mode',
      description: 'Per Link gespeichert. Ob ein Gewinnspiel stattfindet, wer teilnehmen darf und ob Kosten anfallen, ist ungeprüft.',
      source: 'Manueller Link-Import',
      offerType: 'Noch nicht geprüft',
      sourceType: 'manual',
      published: now.toISOString(),
      manual: true
    });
  }
  return imported;
}
export function normalizeAccountLabel(value) {
  const text = String(value || '').trim();
  if (!validAccountLabel(text) || !text) return null;
  return text.replace(/^@/,'').toLowerCase();
}
export function accountLabels(raw) {
  const normalized = Array.isArray(raw) ? raw.map(normalizeAccountLabel).filter(Boolean) : [];
  return [...new Set(normalized)].slice(0,20);
}
export function addAccountLabel(current, value) {
  const name = normalizeAccountLabel(value);
  if (!name) return { accounts:accountLabels(current), added:false, reason:'Ungültiger Instagram-Name' };
  const list = accountLabels(current);
  if (list.includes(name)) return { accounts:list, added:false, reason:'Bereits vorhanden' };
  if (list.length >= 20) return { accounts:list, added:false, reason:'Maximal 20 Account-Labels' };
  return { accounts:[...list,name], added:true, reason:null };
}
function safeActivity(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (!['prepared','entered','won','received'].includes(entry.type)) return null;
  const offerId = String(entry.offerId || '').slice(0,120);
  if (!offerId) return null;
  const account = entry.account ? normalizeAccountLabel(entry.account) : '';
  if (entry.account && !account) return null;
  const evidenceUrl = entry.evidenceUrl ? safeExternalUrl(entry.evidenceUrl) : null;
  if (entry.evidenceUrl && !evidenceUrl) return null;
  return {
    id:String(entry.id || '').slice(0,140),
    offerId,type:entry.type,account:account || '',
    note:String(entry.note || '').slice(0,500),
    evidenceUrl,
    createdAt:String(entry.createdAt || '').slice(0,40),
    offerTitle:String(entry.offerTitle || '').slice(0,130),
    offerUrl:entry.offerUrl ? safeExternalUrl(entry.offerUrl) : null
  };
}
function safeOffer(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const url = canonicalOpportunityUrl(entry.url);
  if (!url) return null;
  return {
    id:String(entry.id || '').slice(0,120),
    title:String(entry.title || '').slice(0,130),
    brand:String(entry.brand || '').slice(0,80),
    source:String(entry.source || '').slice(0,80),
    url, category:['Mode','Technik','Beauty','Lifestyle','Sonstiges'].includes(entry.category) ? entry.category : 'Mode',
    description:String(entry.description || '').slice(0,300),
    published:String(entry.published || '').slice(0,40),
    offerType:String(entry.offerType || '').slice(0,60),
    termsUrl:entry.termsUrl ? safeExternalUrl(entry.termsUrl) : null,
    deadline:String(entry.deadline || '').slice(0,50),
    sourceType:String(entry.sourceType || '').slice(0,30),
    checkedOn:String(entry.checkedOn || '').slice(0,40),
    shippingStatus:String(entry.shippingStatus || '').slice(0,150),
    costStatus:String(entry.costStatus || '').slice(0,150),
    participation:String(entry.participation || '').slice(0,150),
    manual:entry.manual === true
  };
}
export function backupDocument(state, now = new Date()) {
  return JSON.stringify({
    format:'pr-hunter-local-backup',
    version:1,
    exportedAt:now.toISOString(),
    state
  },null,2);
}
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) throw Error('Sicherung ist zu groß (max. 2 MB)');
  let document;
  try { document = JSON.parse(text); } catch { throw Error('Keine gültige JSON-Sicherung'); }
  if (!document || document.format !== 'pr-hunter-local-backup' || document.version !== 1)
    throw Error('Nicht unterstütztes Sicherungsformat');
  const raw = document.state;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Ungültige Sicherungsdaten');
  const manual = Array.isArray(raw.manual) ? raw.manual.slice(0,500).map(safeOffer).filter(x => x?.id && x.title && x.url) : [];
  const saved = Array.isArray(raw.saved) ? [...new Set(raw.saved.filter(x => typeof x === 'string' && x.length <= 120))].slice(0,1000) : [];
  const savedDetails = {};
  if (raw.savedDetails && typeof raw.savedDetails === 'object' && !Array.isArray(raw.savedDetails)) {
    for (const [id,value] of Object.entries(raw.savedDetails).slice(0,1000)) {
      const offer = safeOffer(value);
      if (id.length <= 120 && offer?.id === id) Object.defineProperty(savedDetails,id,{value:offer,enumerable:true,writable:true,configurable:true});
    }
  }
  const brands = Array.isArray(raw.brands) ? raw.brands.slice(0,100).map(x => normalizeBrand(x?.name,x?.url)).filter(Boolean) : [];
  const tracked = {};
  if (raw.tracked && typeof raw.tracked === 'object' && !Array.isArray(raw.tracked)) {
    for(const [id,status] of Object.entries(raw.tracked).slice(0,1000))
      if(id.length <= 120 && ['applied','accepted','received'].includes(status))
        Object.defineProperty(tracked,id,{value:status,enumerable:true,writable:true,configurable:true});
  }
  const checklists = {};
  if (raw.checklists && typeof raw.checklists === 'object' && !Array.isArray(raw.checklists)) {
    const allowed = new Set(['rules','eligibility','follow','like','comment','tag','story','newsletter','email','whatsapp','form']);
    for (const [id,value] of Object.entries(raw.checklists).slice(0,1000)) {
      if(id.length > 120 || !value || typeof value !== 'object') continue;
      Object.defineProperty(checklists,id,{value:{
        selected:Array.isArray(value.selected) ? [...new Set(value.selected.filter(x => allowed.has(x)))].slice(0,11) : [],
        completed:Array.isArray(value.completed) ? [...new Set(value.completed.filter(x => allowed.has(x)))].slice(0,11) : [],
        updatedAt:String(value.updatedAt || '').slice(0,40)
      },enumerable:true,writable:true,configurable:true});
    }
  }
  return {
    saved,tracked,manual,brands,
    activity:Array.isArray(raw.activity) ? raw.activity.slice(0,1000).map(safeActivity).filter(Boolean) : [],
    savedDetails,checklists,
    accounts:accountLabels(raw.accounts),
    integration:{
      mode:raw.integration?.mode === 'facebook_login' ? 'facebook_login' : 'instagram_login',
      checked:Array.isArray(raw.integration?.checked) ?
        [...new Set(raw.integration.checked.filter(x=>['professional','app','backend','permissions'].includes(x)))] : []
    },
    alerts:normalizeAlertsState(raw.alerts),
    display:normalizeDisplayPrefs(raw.display)
  };
}
