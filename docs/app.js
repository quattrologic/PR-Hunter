import {
  SEED_BRANDS, ACTIVITY_TYPES, safeExternalUrl, normalizeBrand,
  makeActivity, rankFeed, activitySummary, isExpired
} from './ultimate-core.mjs';
import {
  CHECKLIST_TASKS, requiredSteps, normalizeSelectedSteps, stepDefinitions,
  checklistProgress, offerWarnings, isConfirmedParticipation,
  canConfirmEntry, timeUntilDeadline, urgentOffers, suggestedComments, safeTaskSelection
} from './participation.mjs';
import {
  extractOpportunityLinks, makeImportedOffers, accountLabels, addAccountLabel,
  backupDocument, parseBackup
} from './phase4-core.mjs';
import {
  META_OPTIONS, INTEGRATION_STEPS, normalizeIntegrationSetup, integrationStatus,
  matchedPublicOffers, buildBrandSearchLink, sourceHealthSummary
 } from './integrations.mjs';
import {
  normalizeAlertsState, buildAlerts, unreadCount, markAlertsRead, clearReadAlerts,
  encryptBackup, decryptBackup, isEncryptedBackup
} from './phase6-core.mjs';
import {
  FEED_PAGE_SIZE, normalizeDisplayPrefs, getVisibleSlice, offerVerification
} from './phase7-core.mjs';
import { autoHunterReport, normalizeAutoPrefs } from './auto-hunter-core.mjs';
import {
  OFFICIAL_PROGRAMS, PROGRAM_STATES, PROGRAM_STATE_LABELS,
  normalizeFreeProductPrefs, normalizeProgramProgress, programWarnings,
  rankPrograms, classifyPublicLeads, programMessage, programStats
} from './free-products.mjs';
import {
  normalizeDmDrafts, addDmDraft, updateDmStatus, dmStats,
  normalizeDmHandle, normalizeReelUrl, dmBrandProfile, dmDraftText, editDmDraft, filterDmDrafts, prepareDmHandoff, resolveDmHandoff, confirmDmSent, setDmShipping
} from './dm-assistant.mjs';
import {
  OFFER_STATUSES, OFFER_STATUS_LABELS, normalizeBrandOffers, createBrandOffer,
  updateBrandOffer, offerWarnings as brandOfferWarnings, offerStats, offerReplyTemplate
} from './brand-offers.mjs';
import {
  DISCOVERY_FILTERS, reelUrl, publicEmbedUrl, discoveryCards,
  filterEmptyMessage
} from './discovery-grid.mjs';
import {
  trustedMetaThumbnail, normalizeInstagramReelsReport, reelFeedStatusText,
  normalizeSavedReels, addSavedReel
} from './instagram-brand-core.mjs';
import {
  dmScoutCandidates, dmScoutProspects, dmScoutText, instagramDmLink
} from './dm-scout.mjs';
import {
  inspectScoutCaption, normalizeScoutPrefs, setScoutView, dismissScoutReel, dismissScoutBrand,
  buildSmartScout, smartBrandSuggestions, SCOUT_VIEWS
} from './smart-scout.mjs';
import {knownBrandLogo} from './brand-logos.mjs';
import {
  normalizePhase20State, normalizePhase20Prefs, buildPhase20Notices,
  recordConfirmedReply, phase20Unread, markPhase20Read, clearPhase20Read,
  shouldRefreshPhase20, AUTO_REFRESH_MS
} from './phase20-core.mjs';
import { FREE_DROP_VIEWS, normalizeFreeDropPrefs, freeDropDiscovery } from './free-drops.mjs';

const STORE = 'pr-hunter-state-v1'; // Preserve the existing iPad user's saved data.
const $ = selector => document.querySelector(selector);
const ui = {
  tab:'discover', category:'focus', query:'', catalog:[], generatedAt:null,
  assistantOfferId:null, verifiedOnly:false, endingSoonOnly:false, accountQuery:'',
  brandFilter:null, sourceStatus:[], visibleFeed:FEED_PAGE_SIZE, visibleSaved:FEED_PAGE_SIZE,
  discoveryMode:'for-you', galleryItems:[], activeGalleryItem:null,
  instagramReport:normalizeInstagramReelsReport({status:'not-configured'}), dmScoutItems:[],
  similarReport:{status:'not-configured',discovered:[]},similarItems:[]
};
const empty = { saved:[], tracked:{}, manual:[], brands:[], activity:[], savedDetails:{}, checklists:{}, accounts:[], integration:{}, alerts:{}, phase20:{}, display:{}, autoPrefs:{}, freePrefs:{}, freeDropPrefs:{}, programProgress:{}, dmDrafts:[], brandOffers:[], savedReels:[], scoutPrefs:{} };
let state;
try { state = { ...empty, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; }
catch { state = { ...empty }; }
if (!Array.isArray(state.saved)) state.saved = [];
if (!Array.isArray(state.manual)) state.manual = [];
if (!Array.isArray(state.brands)) state.brands = [];
if (!Array.isArray(state.activity)) state.activity = [];
if (!state.tracked || typeof state.tracked !== 'object') state.tracked = {};
if (!state.savedDetails || typeof state.savedDetails !== 'object') state.savedDetails = {};
if (!state.checklists || typeof state.checklists !== 'object' || Array.isArray(state.checklists)) state.checklists = {};
state.accounts = accountLabels(state.accounts);
state.integration = normalizeIntegrationSetup(state.integration);
state.alerts = normalizeAlertsState(state.alerts);
state.phase20 = normalizePhase20State(state.phase20);
state.display = normalizeDisplayPrefs(state.display);
state.autoPrefs = normalizeAutoPrefs(state.autoPrefs);
state.freePrefs = normalizeFreeProductPrefs(state.freePrefs);
state.freeDropPrefs = normalizeFreeDropPrefs(state.freeDropPrefs);
state.programProgress = normalizeProgramProgress(state.programProgress);
state.dmDrafts = normalizeDmDrafts(state.dmDrafts);
state.savedReels = normalizeSavedReels(state.savedReels);
state.scoutPrefs = normalizeScoutPrefs(state.scoutPrefs);
state.brandOffers = normalizeBrandOffers(state.brandOffers);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clean = value => String(value ?? '').trim();
const asDate = value => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.valueOf()) ? date.toLocaleDateString('de-DE') : '';
};
const iconText = category => category === 'Mode' ? 'STREETWEAR' : category === 'Technik' ? 'TECH DROP' : 'DISCOVERY';
const save = () => {
  try { localStorage.setItem(STORE, JSON.stringify(state)); return true; }
  catch { toast('Speichern nicht möglich. Bitte Safari-Speicher prüfen.'); return false; }
};
let toastHandle;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastHandle);
  toastHandle = setTimeout(() => el.classList.remove('visible'), 3000);
}
function all() {
  const map = new Map();
  [...state.manual, ...ui.catalog].forEach(item => {
    if (item && item.id && safeExternalUrl(item.url)) map.set(item.id, item);
  });
  return [...map.values()];
}
const byId = id => all().find(item => item.id === id) || state.savedDetails[id];
function watchedBrands() {
  const map = new Map(SEED_BRANDS.map(brand => [brand.handle.toLowerCase(), brand]));
  state.brands.forEach(raw => {
    const brand = normalizeBrand(raw.name, raw.url);
    if (brand && !map.has(brand.handle.toLowerCase())) map.set(brand.handle.toLowerCase(), brand);
  });
  return [...map.values()];
}
function checklistFor(item) {
  const raw = state.checklists[item.id] || {};
  return {
    selected: safeTaskSelection(raw.selected),
    completed: Array.isArray(raw.completed) ? raw.completed.filter(id => CHECKLIST_TASKS.some(t => t.id === id)) : []
  };
}
function storeChecklist(item, data) {
  state.checklists[item.id] = {
    selected: safeTaskSelection(data.selected),
    completed: [...new Set(data.completed)].filter(id => CHECKLIST_TASKS.some(task => task.id === id)),
    updatedAt: new Date().toISOString()
  };
  save();
}
function getSaved() {
  return state.saved.map(id => byId(id)).filter(item => item && safeExternalUrl(item.url));
}
function getStatusCounts() {
  const entered = new Set();
  const wins = new Set();
  Object.entries(state.tracked).forEach(([id, status]) => {
    if (['applied','accepted','received'].includes(status)) entered.add(id);
    if (['accepted','received'].includes(status)) wins.add(id);
  });
  state.activity.forEach(x => {
    if (['entered','won','received'].includes(x.type)) entered.add(x.offerId);
    if (['won','received'].includes(x.type)) wins.add(x.offerId);
  });
  return { entered:entered.size, wins:wins.size };
}
function updateStats() {
  const count = getStatusCounts();
  const stats = {
    totalCount: all().length,
    savedCount: getSaved().length,
    appliedCount: count.entered,
    acceptedCount: count.wins
  };
  Object.entries(stats).forEach(([id,value]) => { const el = $('#' + id); if (el) el.textContent = String(value); });
}
function brandLogoInner(brand){
  const initials=brand.name.split(/\s+/).slice(0,2).map(x=>x.slice(0,1)).join('')
    .toUpperCase().slice(0,2);
  const logo=knownBrandLogo(brand.handle);
  // Label text is always present for offline/non-image use.
  const mark='<span class="story-logo-fallback">'+esc(initials)+'</span>';
  if(!logo)return mark;
  return mark+'<img class="story-logo-image" loading="eager" decoding="async" referrerpolicy="no-referrer"'+
    ' src="'+esc(logo.primary)+'"'+(logo.fallback?' data-logo-fallback="'+esc(logo.fallback)+'"':'')+
    ' alt="">';
}
function brandAvatar(brand){
  return '<span class="brand-avatar brand-logo-avatar" aria-hidden="true">'+brandLogoInner(brand)+'</span>';
}
// Image error/load are captured even for brand rows added after startup.
// On a failed source try only the brand's actual official website favicon, then show initials.
document.addEventListener('load',event=>{
  const img=event.target;
  if(!(img instanceof HTMLImageElement)||!img.classList.contains('story-logo-image'))return;
  img.classList.add('is-loaded');
  img.parentElement?.classList.add('has-loaded-logo');
},true);
document.addEventListener('error',event=>{
  const img=event.target;
  if(!(img instanceof HTMLImageElement)||!img.classList.contains('story-logo-image'))return;
  img.classList.remove('is-loaded');
  img.parentElement?.classList.remove('has-loaded-logo');
  const next=img.dataset.logoFallback;
  if(next && img.dataset.logoRetried!=='1'){
    img.dataset.logoRetried='1';
    img.src=next;
  }else img.remove();
},true);
function renderAccounts() {
  const container = $('#accountLabels');
  const suggestions = $('#accountLabelSuggestions');
  if (suggestions) suggestions.innerHTML = state.accounts.map(account => '<option value="' + esc(account) + '"></option>').join('');
  if (!container) return;
  container.innerHTML = state.accounts.length ? state.accounts.map(account =>
    '<span class="account-tag">@' + esc(account) +
    ' <button type="button" data-action="remove-account" data-account="' + esc(account) +
    '" aria-label="Account-Label entfernen: ' + esc(account) + '">×</button></span>'
  ).join('') : '<p class="helper">Noch keine Account-Labels gespeichert.</p>';
  const count = $('#accountLabelCount');
  if (count) count.textContent = state.accounts.length + '/20';
}
function renderBrands() {
  const brands = watchedBrands();
  $('#brandCount').textContent = brands.length + ' Marken';
  $('#brandStrip').innerHTML = brands.map(brand =>
    '<button class="story-entry story-brand" type="button" data-action="story-brand" data-brand-id="' + esc(brand.id) +
    '" aria-label="Marke ' + esc(brand.name) + ' anzeigen">' +
    '<span class="story-ring"><span class="story-ring-inner">'+
    brandLogoInner(brand)+
    '</span></span><span class="story-name">' + esc(brand.handle) + '</span></button>'
  ).join('');
  $('#brandCards').innerHTML = brands.map(brand => {
    const custom = brand.id.startsWith('custom-');
    const matched = matchedPublicOffers(brand,ui.catalog);
    const discover = buildBrandSearchLink(brand);
    return '<article class="brand-card"><div class="brand-card-top">' + brandAvatar(brand) +
      '<div><strong>' + esc(brand.name) + '</strong><br><small>@' + esc(brand.handle) + '</small></div></div>' +
      '<p>' + (matched.length
        ? '<strong>' + matched.length + ' öffentliche/r Fundhinweis/e</strong> anhand von Brandname/Titel – Fristen und Teilnahme separat prüfen.'
        : 'Noch keine passenden Fundhinweise in den öffentlichen Quellen. Instagram wird nicht automatisch durchsucht.') + '</p>' +
      '<div class="brand-card-actions"><a href="' + esc(brand.url) + '" target="_blank" rel="noopener noreferrer">Profil ansehen ↗</a>' +
      (matched.length ? '<button type="button" data-action="brand-offers" data-brand-id="' + esc(brand.id) + '">Funde (' + matched.length + ')</button>' : '') +
      (discover ? '<a href="' + esc(discover) + '" target="_blank" rel="noopener noreferrer" title="Externe Suchmaschine, keine direkte Instagram-Anbindung">Extern suchen ↗</a>' : '') +
      (custom ? '<button type="button" data-action="remove-brand" data-handle="' + esc(brand.handle) + '" aria-label="Marke entfernen">Entfernen</button>' : '') + '</div></article>';
  }).join('');
}
function renderOffer(item) {
  const url = safeExternalUrl(item.url);
  if (!url) return '';
  const saved = state.saved.includes(item.id);
  const category = ['Mode','Technik'].includes(item.category) ? item.category : 'Sonstiges';
  const visualClass = category === 'Mode' ? '' : category === 'Technik' ? ' tech' : ' other';
  const offerName = clean(item.title).slice(0, 130);
  const titlePreview = offerName.length > 53 ? offerName.slice(0, 50) + '…' : offerName;
  const type = clean(item.offerType || 'Öffentliche Aktion');
  const socialPost = /^https:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\//i.test(url);
  const brand = clean(item.brand || item.source || 'Originalquelle');
  const desc = clean(item.description || 'Bedingungen vor der Teilnahme beim Veranstalter prüfen.').slice(0, 200);
  const fromSource = item.manual ? 'Selbst gespeichert' : item.sourceType === 'curated'
    ? 'Offizielle Bedingungen geprüft' : 'Öffentlicher Feed';
  const id = esc(item.id);
  const checklist = checklistFor(item);
  const progress = checklistProgress(item, checklist.selected, checklist.completed);
  const remaining = timeUntilDeadline(item);
  const entered = isConfirmedParticipation(state.activity, item.id) ||
    ['applied','accepted','received'].includes(state.tracked[item.id]);
  const deadline = item.deadline ? asDate(item.deadline) : null;
  const ended = isExpired(item);
  const terms = safeExternalUrl(item.termsUrl);
  const verification = offerVerification(item);
  const verificationInfo = '<div class="verification-meta ' + esc(verification.status) +
    '"><strong>' + esc(verification.label) + '</strong>' +
    (verification.problems.length ? '<span> · ' + esc(verification.problems[0]) + '</span>' : '') +
    '</div>';
  const sourceInfo = item.sourceType === 'curated' ? '<div class="offer-proof">' +
    '<strong>✓ Bedingungen gelesen am ' + esc(item.checkedOn || '–') + '</strong>' +
    (deadline ? '<span>Frist: ' + esc(deadline) + '</span>' : '') +
    (item.shippingStatus ? '<span>' + esc(item.shippingStatus) + '</span>' : '') +
    (item.costStatus ? '<span>⚠ ' + esc(item.costStatus) + '</span>' : '') +
    (item.participation ? '<span>Teilnahme: ' + esc(item.participation) + '</span>' : '') +
    (terms ? '<a href="' + esc(terms) + '" target="_blank" rel="noopener noreferrer">Bedingungen lesen ↗</a>' : '') +
    '</div>' : '';
  return '<article class="opportunity"><div class="card-visual' + visualClass + '">' +
    '<div class="card-topline"><span class="visual-badge">' + esc(socialPost ? 'INSTAGRAM POST' : iconText(category)) + '</span><span class="visual-type">✧ ' + esc(type) + '</span></div>' +
    '<div class="visual-title">' + esc(titlePreview) + '</div></div>' +
    '<div class="card-content"><div class="card-meta"><span>' + esc(brand) + '</span><span>·</span><span>' + esc(fromSource) + '</span>' +
    (item.published ? '<span>· ' + esc(asDate(item.published)) + '</span>' : '') + '</div>' +
    '<h3>' + esc(offerName) + '</h3><p class="description">' + esc(desc) + '</p>' + verificationInfo + sourceInfo +
    '<div class="card-actions"><a class="open-offer" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Original öffnen ↗</a>' +
    '<button class="icon-btn' + (saved ? ' selected' : '') + '" type="button" data-action="bookmark" data-id="' + id +
    '" aria-label="' + (saved ? 'Aus Merkliste entfernen' : 'Zur Merkliste hinzufügen') + '" title="Merken">' + (saved ? '♥' : '♡') + '</button>' +
    '<button class="icon-btn" type="button" data-action="copy" data-id="' + id + '" title="Kommentar oder Anfrage kopieren">✎</button>' +
    '<button class="icon-btn" type="button" data-action="log" data-id="' + id + '" title="Aktivität dokumentieren">＋</button></div>' +
    '<button class="assist-card-btn" type="button" data-action="assist" data-id="' + id + '">' +
    (entered ? '✓ Teilnahme dokumentiert' : '◎ Teilnahme vorbereiten · ' + progress.finished + '/' + progress.total) +
    (remaining ? ' · ' + esc(remaining.label) : '') + '</button>' +
    '<div class="card-safety">' + (ended ? 'Abgelaufen · nur noch im Verlauf' : 'Originalbedingungen, Versand und Frist vor Teilnahme prüfen') + '</div></div></article>';
}
function emptyMessage(kind) {
  const isFeed = kind === 'feed';
  return '<div class="empty"><div class="symbol">✳</div><strong>' +
    (isFeed ? 'Noch keine passenden Streetwear-Funde.' : 'Hier ist noch nichts gespeichert.') +
    '</strong><p>' + (isFeed
      ? 'Deine fünf Marken sind als Watchlist angelegt. Instagram-Posts werden noch nicht automatisch ausgelesen. Der öffentliche Feed zeigt nur tatsächlich gefundene Hinweise.'
      : 'Du kannst interessante Aktionen mit ♡ merken oder eine Aktion selbst hinzufügen.') +
    '</p><button class="primary-btn" type="button" data-action="add">＋ Aktion hinzufügen</button></div>';
}
function tileTheme(key){
  const styles=['art-ink','art-stone','art-sand','art-ash','art-blue','art-paper'];
  let hash=0;
  for(const char of String(key||'brand')) hash=(hash*31 + char.charCodeAt(0))>>>0;
  return styles[hash%styles.length];
}
// Public Instagram embeds are created only while their tile is near the viewport.
// No Meta token is needed for user-saved public links; Instagram controls playback.
const MAX_AUTO_EMBEDS=3;
let instagramPreviewObserver=null;
const nearbyInstagramTiles=new Set();
function instagramFrame(src,brand){
  // "src" comes exclusively from publicEmbedUrl(), which validates Instagram HTTPS URLs.
  const iframe=document.createElement('iframe');
  iframe.title='Öffentliche Instagram-Vorschau von '+brand;
  iframe.loading='eager'; // observation already defers creation until near the viewport
  iframe.referrerPolicy='strict-origin-when-cross-origin';
  iframe.allow='fullscreen';
  iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  iframe.src=src;
  return iframe;
}
function syncInstagramAutoPreviews(){
  const current=Array.from(document.querySelectorAll('#discoverCards .instagram-auto-preview, #similarReelCards .instagram-auto-preview, #homeDmScoutCards .instagram-auto-preview'));
  const midpoint=window.innerHeight/2;
  const eligible=Array.from(nearbyInstagramTiles)
    .filter(node=>node.isConnected && !node.closest('[hidden]'))
    .sort((a,b)=>{
      const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
      return Math.abs(ar.top+ar.height/2-midpoint)-Math.abs(br.top+br.height/2-midpoint);
    }).slice(0,MAX_AUTO_EMBEDS);
  const active=new Set(eligible);
  for(const node of current){
    const iframe=node.querySelector('iframe');
    if(!active.has(node)){
      if(iframe)iframe.remove(); // avoid off-screen video/audio & unnecessary data
      const placeholder=node.querySelector('.instagram-auto-placeholder');
      if(placeholder)placeholder.hidden=false;
      continue;
    }
    if(iframe)continue;
    const source=node.dataset.embedSrc;
    const brand=node.dataset.brand;
    if(!source || publicEmbedUrl(source.replace(/embed\/$/,''))!==source)continue;
    node.append(instagramFrame(source,brand||'Marke'));
    const placeholder=node.querySelector('.instagram-auto-placeholder');
    if(placeholder)placeholder.hidden=true;
  }
}
function mountInstagramAutoPreviews(){
  if(instagramPreviewObserver)instagramPreviewObserver.disconnect();
  instagramPreviewObserver=null;
  nearbyInstagramTiles.clear();
  if(ui.tab!=='discover')return;
  const tiles=Array.from(document.querySelectorAll('#discoverCards .instagram-auto-preview, #similarReelCards .instagram-auto-preview, #homeDmScoutCards .instagram-auto-preview'));
  if(!tiles.length)return;
  if(typeof IntersectionObserver!=='function'){
    // Older browsers still show automatic previews for the first few cards.
    tiles.slice(0,MAX_AUTO_EMBEDS).forEach(node=>nearbyInstagramTiles.add(node));
    syncInstagramAutoPreviews();
    return;
  }
  instagramPreviewObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(entry.isIntersecting)nearbyInstagramTiles.add(entry.target);
      else nearbyInstagramTiles.delete(entry.target);
    }
    syncInstagramAutoPreviews();
  },{rootMargin:'140px 0px',threshold:0.01});
  tiles.forEach(node=>instagramPreviewObserver.observe(node));
}
function renderDiscoveryTile(item,index) {
  const brand=clean(item.brand).replace(/^@/,'') || 'Originalquelle';
  const title=clean(item.title);
  const kind=item.kind === 'reel' ? 'REEL' : item.kind === 'post' ? 'BEITRAG' :
    item.kind==='giveaway' ? 'GEWINNSPIEL' :
    item.kind==='drop' ? 'DROP' : item.kind==='pr' ? 'PR' : 'FUNDHINWEIS';
  const brandInitials=brand.replace(/[^a-z0-9]+/ig,' ').trim().split(/\s+/).slice(0,2)
    .map(word=>word.slice(0,1)).join('').toUpperCase() || 'PR';
  const instagram=(item.kind==='reel'||item.kind==='post')?publicEmbedUrl(item.url):null;
  if(instagram){
    const thumbnail=trustedMetaThumbnail(item.thumbnailUrl);
    const poster=thumbnail?
      '<img class="instagram-auto-poster" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="'+
      esc(thumbnail)+'" alt="Öffentliches Vorschaubild von '+esc(brand)+'">':
      '<span class="instagram-auto-initials" aria-hidden="true">'+esc(brandInitials)+'</span>';
    return '<article class="discover-tile instagram-live-tile">'+
      '<div class="instagram-auto-preview" data-embed-src="'+esc(instagram)+
      '" data-brand="'+esc(brand)+'" aria-label="'+esc('Instagram-'+kind+' von '+brand)+'">'+
      '<div class="instagram-auto-placeholder"><span class="instagram-auto-tag">'+esc(kind)+'</span>'+
      poster+'<span class="instagram-auto-loading">Instagram-Vorschau wird geladen …</span></div></div>'+
      '<div class="instagram-auto-footer">'+
      '<span class="tile-avatar" aria-hidden="true">'+esc(brandInitials)+'</span>'+
      '<span class="instagram-auto-brand">@'+esc(brand)+'</span>'+
      '<button type="button" data-action="open-discovery" data-tile-index="'+index+'">Details</button>'+
      '<a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer" aria-label="Original bei Instagram öffnen">Instagram ↗</a>'+
      '</div></article>';
  }
  const label=typeof item.verifiedPrice==='number' ?
    item.verifiedPrice.toLocaleString('de-DE',{style:'currency',currency:'EUR'}) : title;
  return '<article class="discover-tile"><button type="button" class="discover-tile-open" data-action="open-discovery" data-tile-index="' + index +
    '" aria-label="' + esc(kind+' von '+brand+': '+title) + '">' +
    '<span class="tile-art ' + esc(tileTheme(brand+title)) + '">' +
    '<span class="tile-category">' + esc(kind) + '</span>' +
    '<span class="tile-mark" aria-hidden="true">' + esc(brandInitials) + '</span>' +
    '<span class="tile-label">' + esc(label.slice(0,45)) + '</span></span>' +
    '<span class="tile-footer"><span class="tile-avatar" aria-hidden="true">' + esc(brandInitials) +
    '</span><span class="tile-brand">' + esc(brand) + '</span><span class="tile-action-icon" aria-hidden="true">↗</span></span>' +
    '</button></article>';
}
function openDiscovery(item){
  if(!item)return;
  ui.activeGalleryItem=item;
  const offer=byId(item.offerId);
  const link=safeExternalUrl(item.url);
  if(!link)return;
  $('#discoveryTitle').textContent=item.title;
  $('#discoveryKind').textContent=item.kind==='reel'?'Instagram Reel':item.kind==='post'?'Instagram-Beitrag':'Öffentliche Fundstelle';
  $('#discoveryBrand').textContent=item.brand;
  const caption=$('#discoveryCaption');
  caption.textContent=item.caption||'';
  caption.hidden=!item.caption;
  const original=$('#discoveryOriginal');
  original.href=link;
  original.textContent=item.kind==='reel'?'Original-Reel öffnen ↗':item.kind==='post'?'Instagram-Beitrag öffnen ↗':'Original-Angebot öffnen ↗';
  const preview=$('#discoveryPreview');
  preview.textContent='';
  const embed=(item.kind==='reel'||item.kind==='post')?publicEmbedUrl(link):null;
  const message=document.createElement('p');
  message.className='preview-placeholder';
  if(embed){
    preview.replaceChildren(instagramFrame(embed,item.brand));
    $('#discoveryDisclaimer').textContent=
      'Öffentliche Instagram-Vorschau wird automatisch geladen. Wenn Instagram die Einbettung sperrt, öffne das Original.';
  }else {
    const heading=document.createElement('strong');
    heading.textContent='Originalquelle ansehen';
    message.append(heading,'Für diesen Web-Fund liegt kein öffentlich freigegebenes Videovorschaubild vor. Prüfe die Bedingungen auf der Originalseite.');
    preview.append(message);
    $('#discoveryDisclaimer').textContent=
      'Ungeprüfte Inhalte werden nicht als echte Deals, Produkte oder Videos ausgegeben.';
  }
  const userOffer=Boolean(offer);
  $('#discoveryBookmark').hidden=!userOffer;
  $('#discoveryChecklist').hidden=!userOffer;
  $('#discoveryDmButton').hidden=!embed;
  $('#discoveryBookmark').textContent=userOffer && state.saved.includes(offer.id) ?
    'Aus Merkliste entfernen' : 'Merken';
  openDialog('discoveryDialog');
}

function renderFeed() {
  let feed = rankFeed(all(), ui.category, ui.query);
  const brandMessage = $('#brandFilterMessage');
  if (ui.brandFilter) {
    const brand = watchedBrands().find(x=>x.id===ui.brandFilter);
    if (brand) {
      const ids = new Set(matchedPublicOffers(brand,ui.catalog).map(x=>x.id));
      feed = feed.filter(item => ids.has(item.id));
      brandMessage.hidden = false;
      brandMessage.innerHTML = 'Öffentliche Treffer für <strong>' + esc(brand.name) + '</strong>' +
        ' <button type="button" data-action="clear-brand-filter">Alle Angebote ↗</button>';
    } else { ui.brandFilter=null; brandMessage.hidden=true; }
  } else brandMessage.hidden = true;
  if (ui.verifiedOnly) feed = feed.filter(item => item.sourceType === 'curated');
  if (ui.endingSoonOnly) feed = feed.filter(item => {
    const d = timeUntilDeadline(item);
    return d && d.status !== 'expired' && d.hours <= 72;
  });
  const verified = $('#verifiedOnlyButton');
  const ending = $('#endingSoonButton');
  if (verified) { verified.classList.toggle('active', ui.verifiedOnly); verified.setAttribute('aria-pressed', String(ui.verifiedOnly)); }
  if (ending) { ending.classList.toggle('active', ui.endingSoonOnly); ending.setAttribute('aria-pressed', String(ui.endingSoonOnly)); }
  const filteredBrand=ui.brandFilter && watchedBrands().find(x=>x.id===ui.brandFilter);
  const matchesBrand=entry=>!filteredBrand ||
    String(entry.brand||'').replace(/^@/,'').toLowerCase()===filteredBrand.handle.toLowerCase();
  const useReels=!ui.verifiedOnly && !ui.endingSoonOnly;
  const candidates=discoveryCards(feed,
    useReels?state.dmDrafts.filter(d=>matchesBrand(d)):[],
    {mode:ui.discoveryMode,query:ui.query,
     savedReels:useReels?state.savedReels.filter(matchesBrand):[],
     brandReels:useReels?ui.instagramReport.reels.filter(matchesBrand):[]});
  const page=getVisibleSlice(candidates,ui.visibleFeed);
  ui.galleryItems=page.items;
  $('#discoverCards').innerHTML=page.total ?
    page.items.map(renderDiscoveryTile).join('') +
    (page.remaining ? '<div class="load-more"><span>' + page.items.length + ' von ' + page.total +
      ' Einträgen</span><button type="button" data-action="load-more" data-target="feed">Mehr anzeigen ↓</button></div>' : '') :
    '<div class="empty"><div class="symbol">⌕</div><strong>Noch keine passenden Einträge</strong><p>' +
      esc(filterEmptyMessage(ui.discoveryMode)) +
      '</p><button class="subtle-btn" type="button" data-tab="inbox">Original-Link hinzufügen</button></div>';
  mountInstagramAutoPreviews();
  const activeFilter=document.querySelector('[data-discovery].active');
  if(activeFilter)activeFilter.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  const reelTools=$('#brandReelsTools');
  reelTools.hidden=ui.discoveryMode!=='reels';
  $('#brandReelsStatus').textContent=reelFeedStatusText(ui.instagramReport);
    const feedCount=$('#feedResultCount');
  if(feedCount)feedCount.textContent=page.total ?
    page.items.length+' von '+page.total+' Einträgen' : '0 Einträge';
  document.querySelectorAll('[data-discovery]').forEach(button=>{
    const active=button.dataset.discovery===ui.discoveryMode;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  const savedPage = getVisibleSlice(getSaved(),ui.visibleSaved);
  $('#savedCards').innerHTML = savedPage.total ?
    savedPage.items.map(renderOffer).join('') +
    (savedPage.remaining ? '<div class="load-more"><span>' + savedPage.items.length +
      ' von ' + savedPage.total + ' gespeichert</span><button type="button" data-action="load-more" data-target="saved">Weitere ' +
      Math.min(FEED_PAGE_SIZE,savedPage.remaining) + ' laden ↓</button></div>' : '') : emptyMessage('saved');
  document.querySelectorAll('[data-category]').forEach(button => {
    const active = button.dataset.category === ui.category;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function renderAssistantQueue() {
  const items = rankFeed(all(), 'focus');
  const urgent = urgentOffers(items);
  const urgentLabel = $('#assistantDeadlineCount');
  if (urgentLabel) urgentLabel.textContent = String(urgent.length);
  const queue = $('#assistantQueue');
  if (!queue) return;
  const ranked = [...items].sort((a,b) => {
    const dateA = timeUntilDeadline(a), dateB = timeUntilDeadline(b);
    const urgency = d => !d ? 3 : d.status === 'urgent' ? 0 : d.status === 'soon' ? 1 : 2;
    return urgency(dateA) - urgency(dateB) ||
      Number(b.sourceType === 'curated') - Number(a.sourceType === 'curated');
  }).slice(0,40);
  queue.innerHTML = ranked.length ? ranked.map(item => {
    const selected = checklistFor(item);
    const progress = checklistProgress(item, selected.selected, selected.completed);
    const remaining = timeUntilDeadline(item);
    const completed = isConfirmedParticipation(state.activity,item.id) ||
      ['applied','accepted','received'].includes(state.tracked[item.id]);
    const label = completed ? '✓ Selbst bestätigt' : progress.complete ? 'Bereit zur Bestätigung' : progress.finished + '/' + progress.total + ' Schritte';
    return '<article class="assistant-queue-item"><div><div class="queue-meta">' +
      esc(item.category || 'Aktion') + ' · ' + esc(item.sourceType === 'curated' ? 'Regeln geprüft' : 'Ungeprüft') +
      (remaining ? ' · ' + esc(remaining.label) : '') +
      '</div><h3>' + esc(item.title) + '</h3><p>' + esc(item.brand || 'Originalquelle') + ' · ' + esc(label) + '</p>' +
      '<div class="queue-progress"><span style="width:' + Math.min(100,Math.round(progress.finished/Math.max(1,progress.total)*100)) + '%"></span></div></div>' +
      '<button class="subtle-btn" data-action="assist" data-id="' + esc(item.id) + '" type="button">Öffnen ↗</button></article>';
  }).join('') : emptyMessage('feed');
}

function renderIntegrations() {
  const meta = integrationStatus(state.integration);
  const option = META_OPTIONS[meta.mode];
  const progress = $('#metaSetupProgress');
  if (!progress) return;
  progress.textContent = meta.checkedCount + ' / ' + meta.total + ' vorbereitet';
  document.querySelectorAll('input[name="metaMode"]').forEach(input => {
    input.checked = input.value === meta.mode;
  });
  $('#metaCapabilities').innerHTML = '<div class="capability-title"><strong>' +
    esc(option.label) + '</strong><small>Vorgesehene Meta-API, nicht aktiviert</small></div>' +
    '<div class="capability-group"><span>Offiziell unterstützte Bereiche</span>' +
    option.capabilities.map(name=>'<p>✓ ' + esc(name) + '</p>').join('') + '</div>' +
    '<div class="capability-group unavailable"><span>Damit nicht möglich</span>' +
    option.unavailable.map(name=>'<p>× ' + esc(name) + '</p>').join('') + '</div>';
  $('#metaSteps').innerHTML = INTEGRATION_STEPS.map(step =>
    '<label class="integration-step"><input type="checkbox" data-meta-step="' + esc(step.id) + '"' +
    (meta.checked.includes(step.id)?' checked':'') + '><span>' + esc(step.label) + '</span></label>'
  ).join('');
  $('#metaGuidance').textContent = meta.configuredForPlanning
    ? 'Checkliste vollständig – aber noch NICHT verbunden. Der sichere OAuth-Server, die App-Freigabe und der echte Tokenaustausch müssen unabhängig geprüft und eingerichtet werden.'
    : 'Offene Vorbereitung: ' + meta.missing.map(x=>x.label).join(' · ') +
      '. Keine Zugangsdaten in dieser App eingeben.';
  const health = sourceHealthSummary(ui.sourceStatus);
  $('#sourceTotals').textContent = ui.generatedAt ?
    health.succeeded + '/' + health.checked + ' erreichbar' : 'Noch kein Live-Status';
  $('#integrationSourceList').innerHTML = health.checked
    ? ui.sourceStatus.map(source =>
      '<div class="integration-source"><span class="' + (source.status === 'ok' ? 'source-ok':'source-bad') +
      '">' + (source.status === 'ok' ? '●':'!') + '</span><div><strong>' + esc(source.name) +
      '</strong><small>' + esc(source.status === 'ok' ? 'Aktiv · '+(source.matching || 0)+' Hinweise im letzten Scan' : 'Nicht erreichbar') +
      '</small></div></div>'
    ).join('')
    : '<p class="helper">Noch kein abrufbarer Quellenstatus. Katalog bei bestehender Internetverbindung aktualisieren.</p>';
}

function renderActivity() {
  const summary = activitySummary(state.activity);
  $('#activityEntered').textContent = String(getStatusCounts().entered);
  $('#activityWon').textContent = String(getStatusCounts().wins);
  $('#activityReceived').textContent = String(summary.received);
  const list = [...state.activity].filter(x => x && ACTIVITY_TYPES[x.type] &&
    (!ui.accountQuery || String(x.account || '').toLocaleLowerCase('de-DE').includes(ui.accountQuery)))
    .sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  $('#activityList').innerHTML = list.length ? list.map(entry => {
    const item = byId(entry.offerId);
    const title = entry.offerTitle || item?.title || 'Frühere Aktion';
    const original = safeExternalUrl(entry.offerUrl || item?.url || '');
    const evidence = safeExternalUrl(entry.evidenceUrl);
    const icon = {prepared:'✎',entered:'✓',won:'★',received:'✳'}[entry.type] || '·';
    return '<article class="timeline-item"><span class="timeline-icon" aria-hidden="true">' + icon + '</span><div class="timeline-main">' +
      '<div class="timeline-top"><strong>' + esc(ACTIVITY_TYPES[entry.type]) + '</strong><span>' + esc(asDate(entry.createdAt)) +
      (entry.account ? ' · @' + esc(entry.account) : '') + '</span></div>' +
      '<div class="timeline-offer">' + esc(title) + '</div>' +
      (entry.note ? '<p>' + esc(entry.note) + '</p>' : '') +
      (evidence ? '<a href="' + esc(evidence) + '" target="_blank" rel="noopener noreferrer">Nachweis öffnen ↗</a>' : '') +
      (original ? '<a href="' + esc(original) + '" target="_blank" rel="noopener noreferrer">Originalaktion öffnen ↗</a>' : '') +
      '</div></article>';
  }).join('') : '<div class="empty"><div class="symbol">▤</div><strong>Dein Logbook ist noch leer.</strong><p>Halte hier fest, wenn du wirklich kommentiert, teilgenommen oder gewonnen hast. Wir senden nichts automatisch.</p><button class="primary-btn" type="button" data-action="add-activity">＋ Erste Aktivität eintragen</button></div>';
}
function renderAlerts() {
  const count = unreadCount(state.alerts);
  const badge = $('#alertCount');
  badge.hidden = count === 0;
  badge.textContent = count > 99 ? '99+' : String(count);
  $('#alertNewPref').checked = state.alerts.prefs.newOffers;
  $('#alertDeadlinePref').checked = state.alerts.prefs.expiring;
  const list = $('#alertList');
  list.innerHTML = state.alerts.inbox.length ? state.alerts.inbox.map(note => {
    const item = byId(note.offerId);
    const readable = note.read ? ' gelesen' : '';
    return '<article class="alert-entry' + readable + '"><span class="alert-glyph">' +
      (note.kind === 'deadline' ? '⏳' : '✳') + '</span><div class="alert-details">' +
      '<div class="alert-metadata">' + (note.kind === 'deadline' ? 'Frist' : 'Neuer Hinweis') +
      ' · ' + esc(asDate(note.createdAt)) + (note.read ? ' · Gelesen' : ' · Neu') + '</div>' +
      '<strong>' + esc(note.title) + '</strong><p>' + esc(note.message) + '</p>' +
      '<div class="alert-actions">' +
      (item ? '<button type="button" data-action="open-alert-offer" data-offer-id="' +
        esc(note.offerId) + '" data-alert-id="' + esc(note.id) + '">Aktion prüfen ↗</button>' :
        '<span>Aktion nicht mehr im aktuellen Katalog</span>') +
      (!note.read ? '<button type="button" data-action="read-alert" data-alert-id="' + esc(note.id) +
        '">Als gelesen markieren</button>' : '') + '</div></div></article>';
  }).join('') : '<div class="empty"><div class="symbol">♧</div><strong>Keine neuen Hinweise.</strong>' +
    '<p>Beim ersten Abgleich merken wir den aktuellen Katalog. Später neu auftauchende öffentliche Fundhinweise und bekannte Fristen erscheinen hier, wenn du die App öffnest.</p></div>';
  // Badges are optional; never imply background delivery on static hosting.
  if (typeof navigator.setAppBadge === 'function' && count)
    navigator.setAppBadge(count).catch(()=>{});
  else if (typeof navigator.clearAppBadge === 'function' && !count)
    navigator.clearAppBadge().catch(()=>{});
}
function renderDisplay() {
  state.display = normalizeDisplayPrefs(state.display);
  document.documentElement.dataset.motion = state.display.motion;
  document.querySelectorAll('input[name="motionMode"]').forEach(input => {
    input.checked = input.value === state.display.motion;
  });
}


function renderBrandOffers(){
  state.brandOffers=normalizeBrandOffers(state.brandOffers);
  const stats=offerStats(state.brandOffers);
  $('#brandOfferAwaiting').textContent=String(stats.awaiting);
  $('#brandOfferConfirmed').textContent=String(stats.confirmed);
  $('#brandOfferReceived').textContent=String(stats.received);
  $('#brandOfferList').innerHTML=state.brandOffers.length ? state.brandOffers.map(offer=>{
    const profile=dmBrandProfile(offer.brand);
    const issues=brandOfferWarnings(offer);
    const statusOptions=OFFER_STATUSES.map(value=>
      '<option value="'+esc(value)+'"'+(offer.status===value?' selected':'')+'>'+
      esc(OFFER_STATUS_LABELS[value])+'</option>').join('');
    const checked=key=>offer[key]?' checked':'';
    const shipping=offer.shippingEUR===null?'':String(offer.shippingEUR);
    return '<article class="brand-offer-card"><div class="brand-offer-card-head">' +
      '<div><span class="brand-offer-overline">DM-ANGEBOT · SELBST ERFASST</span><h3>@'+esc(offer.brand)+
      '</h3><p>'+esc(offer.item)+'</p></div>' +
      '<span class="brand-offer-state">'+esc(OFFER_STATUS_LABELS[offer.status])+'</span></div>' +
      '<div class="brand-offer-checklist">'+
      '<label><input type="checkbox" data-offer-field="productFreeConfirmed" data-offer-id="'+esc(offer.id)+'"'+checked('productFreeConfirmed')+'>Produkt kostenlos bestätigt</label>'+
      '<label><input type="checkbox" data-offer-field="germanyConfirmed" data-offer-id="'+esc(offer.id)+'"'+checked('germanyConfirmed')+'>Deutschlandversand bestätigt</label>'+
      '<label><input type="checkbox" data-offer-field="shippingConfirmed" data-offer-id="'+esc(offer.id)+'"'+checked('shippingConfirmed')+'>Versandkosten bestätigt</label>'+
      '<label class="brand-shipping-price">Versand in €<input type="number" step="0.01" min="0" max="1000" inputmode="decimal" placeholder="Noch offen" data-offer-cost="'+esc(offer.id)+'" value="'+esc(shipping)+'"'+(offer.shippingConfirmed?'':' disabled')+'></label>'+
      '</div>' +
      (issues.length ? '<p class="brand-offer-warning">⚠ '+esc(issues.join(' · '))+'</p>' :
        '<p class="brand-offer-verified">Angaben von dir bestätigt – keine Prüfung durch Instagram oder den Versanddienst.</p>')+
      '<div class="brand-offer-actions">'+
      '<button type="button" data-action="offer-copy" data-offer-id="'+esc(offer.id)+'">Antwort kopieren</button>'+
      '<a href="'+esc(profile)+'" target="_blank" rel="noopener noreferrer">Instagram öffnen ↗</a>'+
      '<label>Status<select data-offer-status="'+esc(offer.id)+'">'+statusOptions+'</select></label>'+
      '<button type="button" data-action="offer-remove" data-offer-id="'+esc(offer.id)+'" aria-label="Angebot von @'+esc(offer.brand)+' entfernen">Entfernen</button></div></article>';
  }).join('') : '<div class="brand-offer-empty">Noch keine Markenangebote eingetragen. Wenn dir eine Marke antwortet, kannst du sie hier aufnehmen.</div>';
}

function renderSimilarVideoDiscovery(){
  const handles=watchedBrands().map(x=>x.handle);
  const seed={savedBrands:handles,savedReels:state.savedReels,drafts:state.dmDrafts};
  const official=ui.instagramReport.status==='active'||ui.instagramReport.status==='partial'
    ?ui.instagramReport.reels:[];
  const hashtags=ui.similarReport.status==='active'||ui.similarReport.status==='partial'
    ?ui.similarReport.discovered:[];
  const result=buildSmartScout({
    ...seed,reels:official,discoveries:hashtags,prefs:state.scoutPrefs
  });
  const videos=result.items;
  ui.similarItems=videos;
  const autoActive=ui.instagramReport.status==='active'||
    ui.instagramReport.status==='partial'||
    ui.similarReport.status==='active'||ui.similarReport.status==='partial';
  $('#similarVideoStatus').textContent=autoActive
    ?result.counts.all+' echte aktuelle Reels · offizielle Quellen'
    :'Instagram-Suche nicht verbunden · 0 automatisch gefundene Videos';
  document.querySelectorAll('[data-scout-view]').forEach(button=>{
    const view=button.dataset.scoutView;
    const active=state.scoutPrefs.view===view;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
    const label={all:'Alle',dm:'Video-DM',free:'Gratis',new:'Neue Marken'}[view];
    if(label)button.textContent=label+' · '+String(result.counts[view]||0);
  });
  const host=$('#similarReelCards');
  if(videos.length){
    host.innerHTML=videos.slice(0,6).map((item,index)=>{
      const brand=item.brand?'@'+item.brand:'#'+item.hashtag;
      const embed=publicEmbedUrl(item.url);
      if(!embed)return '';
      const image=trustedMetaThumbnail(item.thumbnailUrl);
      const poster=image?
        '<img loading="lazy" decoding="async" referrerpolicy="no-referrer" src="'+esc(image)+'" alt="Vorschaubild des Original-Reels">':
        '<span class="similar-video-play" aria-hidden="true">▶</span>';
      const signal=item.kind==='dm'?'Video-DM-Hinweis':
        item.kind==='free'?'Gratis-Stichwort':'Streetwear-Reel';
      const reason=item.reasons.filter(x=>x!=='Bedingungen prüfen').slice(0,2).join(' · ');
      const info=item.warnings.length?'Bedingungen prüfen – keine bestätigte Gratisaktion':
        'Aktion, Versand und Teilnahme noch ungeprüft';
      const action=item.brand?
        '<button type="button" data-action="similar-prepare" data-similar-index="'+index+'">DM vorbereiten</button>':
        '<button type="button" data-action="similar-add" data-similar-index="'+index+'">Marke zuordnen</button>';
      return '<article class="similar-video-card">'+
        '<div class="instagram-auto-preview" data-embed-src="'+esc(embed)+'" data-brand="'+esc(brand)+'">'+
        '<div class="instagram-auto-placeholder">'+poster+
        '<span class="instagram-auto-loading">Original-Vorschau lädt …</span></div></div>'+
        '<div class="similar-video-info"><strong>'+esc(brand)+'</strong>'+
        '<span>'+esc(signal)+(reason?' · '+esc(reason):'')+'</span>'+
        '<p>'+esc(item.caption.slice(0,90)||'Originalpost selbst prüfen')+'</p>'+
        '<small class="smart-scout-note">'+esc(info)+'</small>'+
        '<div class="similar-video-actions">'+action+
        '<a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">Original ↗</a>'+
        '<button type="button" class="smart-scout-dismiss" data-action="scout-hide-reel" data-similar-index="'+index+'" aria-label="Diesen Treffer ausblenden">Ausblenden</button>'+
        '</div></div></article>';
    }).join('');
  }else{
    const hasOther=result.counts.all>0;
    host.innerHTML='<div class="similar-video-empty">'+
      '<strong>'+(hasOther?'Keine Treffer für diesen Filter.':
        'Noch keine neuen Instagram-Videos automatisch gefunden.')+'</strong>'+
      '<p>'+(hasOther?'Wähle „Alle“, um weitere echte Reels zu sehen.':
        'Deine gespeicherten Marken steuern schon die Empfehlungen. Für neue Instagram-Reels muss der Meta-Zugang freigegeben werden.')+'</p>'+
      '</div>';
  }
  const prospects=smartBrandSuggestions({...seed,prefs:state.scoutPrefs},7);
  $('#similarBrandChoices').innerHTML=prospects.length?prospects.map(brand=>{
    const link=dmBrandProfile(brand.handle);
    return '<span class="smart-brand-choice">'+
      '<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer"'+
      ' title="Ähnlicher Streetwear-Stil; aktuelle PR-Aktion ungeprüft">@'+esc(brand.handle)+' ↗</a>'+
      '<button type="button" data-action="scout-save-brand" data-scout-brand="'+esc(brand.handle)+'" aria-label="Marke '+esc(brand.handle)+' als Referenz speichern">Merken</button>'+
      '<button type="button" data-action="scout-hide-brand" data-scout-brand="'+esc(brand.handle)+'" aria-label="Marke '+esc(brand.handle)+' aus Vorschlägen entfernen">×</button>'+
      '</span>';
  }).join(''):
    '<span class="smart-scout-note">Keine weiteren passenden Marken in der geprüften Liste.</span>';
}
function renderHomeDmScout(){
  const official=ui.instagramReport.status==='active' || ui.instagramReport.status==='partial'
    ? ui.instagramReport.reels : [];
  const found=dmScoutCandidates({
    officialReels:official,savedReels:state.savedReels,
    drafts:state.dmDrafts,publicOffers:all()
  });
  // Only caption invitations and explicit user-saved posts enter the main PR feed.
  const prefs=normalizeScoutPrefs(state.scoutPrefs);
  const followers=brand=>official.find(r=>r.brand===brand)?.followersCount;
  const feed=found.filter(x=>!prefs.hiddenReels.includes(x.reelUrl)&&!prefs.hiddenBrands.includes(x.brand)&&!inspectScoutCaption(x.caption).explicitEnded&&(x.signal==='invitation'||['saved','draft'].includes(x.source)))
    .sort((a,b)=>Number(Number.isSafeInteger(followers(b.brand))&&followers(b.brand)<50000)-Number(Number.isSafeInteger(followers(a.brand))&&followers(a.brand)<50000));
  ui.dmScoutItems=feed;
  const confirmed=found.filter(x=>x.signal==='invitation').length;
  const sources=official.length?'Offizielle Marken-Beiträge überprüft':
    'Live-Instagram-Suche nicht verbunden · deine gespeicherten Beiträge';
  $('#homeDmScoutStatus').textContent=found.length
    ? found.length+' Original-Links · '+confirmed+' mögliche DM-Einladungen · '+sources
    : 'Noch keine Original-Links · automatischer Meta-Scan nicht verbunden';
  $('#homeDmScoutCards').innerHTML=feed.length?
    feed.slice(0,12).map((lead,index)=>{
      const verifiedText=lead.signal==='invitation';
      const status=verifiedText?'Möglicher PR-Aufruf im Beitragstext':
        lead.signal==='send-request'?'Video-Versand erwähnt':
        lead.signal==='free-mention'?'Gratis-Hinweis im Beitragstext':'Teilnahme nicht bestätigt';
      const caption=lead.caption?lead.caption.slice(0,88):
        'Originalbeitrag öffnen und Bedingungen selbst prüfen';
      const brand=lead.brand;
      const logo=knownBrandLogo(brand);
      return '<article class="home-dm-card pr-video-card">'+
        '<div class="home-dm-card-brand">'+(logo?'<img class="pr-brand-mark" src="'+esc(logo.primary)+'" alt="" loading="lazy">':'')+
        '<span class="home-dm-card-handle">@'+esc(brand)+'</span></div>'+
        '<div class="pr-video-surface"><div class="instagram-auto-preview" data-embed-src="'+esc(publicEmbedUrl(lead.reelUrl))+'" data-brand="'+esc(brand)+'"><span class="instagram-auto-placeholder">Instagram-Vorschau</span></div>'+
        '<button type="button" class="pr-video-tap" data-action="home-dm-start" data-dm-scout-index="'+index+'" aria-label="Video und Nachricht für @'+esc(brand)+' öffnen"><span>Video &amp; DM ansehen ↗</span></button></div>'+
        '<span class="home-dm-card-signal">'+esc(status)+'</span></article>';
    }).join('') :
    '<div class="home-dm-empty"><strong>Keine bestätigten Video-DM-Funde</strong>'+
    '<p>Füge oben einen echten Markenpost ein. Neue öffentliche Reels werden automatisch geprüft, sobald die offizielle Meta-Anbindung eingerichtet ist.</p>'+
    '</div>';
  const prospects=dmScoutProspects(watchedBrands(),6);
  mountInstagramAutoPreviews();
  $('#homeDmProspects').innerHTML=prospects.map(brand=>{
    const url=dmBrandProfile(brand.handle);
    return '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer" '+
      'title="'+esc(brand.source)+'">@'+esc(brand.handle)+' ↗</a>';
  }).join('');
}
function showHomeDmFallback(message,chatUrl){
  const modal=$('#homeDmCopyDialog');
  $('#homeDmCopyText').value=message;
  $('#homeDmOpenChat').href=chatUrl;
  if(!modal.open)modal.showModal();
}
function startHomeDm(brand,reelUrl,signal='unverified'){
  const url=instagramDmLink(brand);
  const text=dmScoutText({brand,reelUrl,signal});
  if(!url||!text){toast('Bitte einen gültigen Instagram-Link und @Markennamen auswählen.');return;}
  const result=addDmDraft(state.dmDrafts,{brand,reelUrl,language:'en',kind:'generic',message:text});
  if(result.added){state.dmDrafts=result.drafts;save();renderDmDrafts();}
  const draft=state.dmDrafts.find(d=>d.brand===normalizeDmHandle(brand)&&d.reelUrl===normalizeReelUrl(reelUrl));
  if(draft)openDmEditor(draft.id);
  else toast(result.reason);
}

let activeDmId=null;
function openDmEditor(id){
  const draft=state.dmDrafts.find(d=>d.id===id);
  if(!draft)return;
  activeDmId=id;
  $('#dmEditorTitle').textContent='Nachricht an @'+draft.brand;
  $('#dmEditorText').value=draft.status==='prepared'?dmDraftText(draft):(draft.sentMessage||dmDraftText(draft));
  $('#dmEditorText').readOnly=draft.status!=='prepared';
  $('#dmEditorVideoTap').hidden=draft.status!=='prepared';
  $('#dmEditorCopy').hidden=draft.status!=='prepared';
  const brandInfo=ui.instagramReport.reels.find(r=>r.brand===draft.brand);
  const followerText=Number.isSafeInteger(brandInfo?.followersCount)?brandInfo.followersCount.toLocaleString('de-DE')+' Follower (letzter Abruf)':'Followerzahl nicht verfügbar';
  $('#dmEditorFacts').textContent='@'+draft.brand+' · '+followerText+' · Versand: '+(draft.shippingEUR===null?'noch unbekannt':draft.shippingEUR.toFixed(2)+' € (von dir eingetragen)');
  $('#dmEditorOriginal').href=draft.reelUrl;
  $('#dmEditorChat').href=instagramDmLink(draft.brand);
  const lead=ui.dmScoutItems.find(x=>x.brand===draft.brand&&x.reelUrl===draft.reelUrl);
  $('#dmEditorOffer').textContent=lead?.caption||'Von dir gespeicherter Beitrag · PR-Angebot und Bedingungen noch prüfen.';
  $('#dmEditorStatus').textContent=draft.status==='prepared'?'Änderungen werden auf diesem Gerät gespeichert.':'Gesendeter Text · von dir bestätigt';
  const embed=publicEmbedUrl(draft.reelUrl);
  $('#dmEditorPreview').replaceChildren(...(embed?[instagramFrame(embed,draft.brand)]:[]));
  if(!$('#dmEditor').open)$('#dmEditor').showModal();
}
function persistDmEditor(){
  const current=state.dmDrafts.find(d=>d.id===activeDmId);
  if(current?.status!=='prepared')return current;
  const text=$('#dmEditorText').value;
  if(!text.trim()){
    $('#dmEditorStatus').textContent='Bitte einen Nachrichtentext eingeben.';
    return null;
  }
  state.dmDrafts=editDmDraft(state.dmDrafts,activeDmId,text);
  save();
  return state.dmDrafts.find(d=>d.id===activeDmId);
}
$('#dmEditorText').addEventListener('input',()=>{
  if(persistDmEditor())$('#dmEditorStatus').textContent='Auf diesem Gerät gespeichert.';
});
$('#dmEditor').addEventListener('close',()=>{
  $('#dmEditorPreview').replaceChildren();activeDmId=null;renderDmDrafts();
});
$('#dmEditorClose').addEventListener('click',()=>$('#dmEditor').close());
$('#dmEditorCopy').addEventListener('click',async()=>{
  const draft=persistDmEditor();
  if(!draft)return;
  try{
    await navigator.clipboard.writeText(dmDraftText(draft,true));
    $('#dmEditorStatus').textContent='Kopiert. Chat öffnen, Text einfügen und senden.';
  }catch{
    $('#dmEditorText').focus();$('#dmEditorText').select();
    $('#dmEditorStatus').textContent='Bitte den markierten Text manuell kopieren, dann den Chat öffnen.';
  }
});
let returnedFromInstagram=false;
let returnDraftId=null;
function askDmReturn(){
  if(document.visibilityState==='hidden'||$('#dmReturnDialog').open)return;
  const draft=state.dmDrafts.find(d=>d.status==='prepared'&&d.pendingMessage&&d.pendingAt);
  if(!draft)return;
  returnDraftId=draft.id;
  $('#dmReturnBrand').textContent='An @'+draft.brand;
  $('#dmReturnText').value=draft.pendingMessage;
  $('#dmReturnDialog').showModal();
}
$('#dmEditorVideoTap').addEventListener('click',async()=>{
  const draft=persistDmEditor();
  if(!draft||draft.status!=='prepared')return;
  const message=dmDraftText(draft,true);
  try{await navigator.clipboard.writeText(message);}
  catch{$('#dmEditorText').focus();$('#dmEditorText').select();$('#dmEditorStatus').textContent='Kopieren blockiert. Text manuell kopieren und das Original unten öffnen.';return;}
  const previous=state.dmDrafts;
  state.dmDrafts=prepareDmHandoff(state.dmDrafts,draft.id,message);
  if(!save()){state.dmDrafts=previous;return;}
  returnedFromInstagram=false;
  window.location.assign(draft.reelUrl);
});
// Native app switching, back/forward cache, and a full reload are all covered.
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')returnedFromInstagram=true;
  else if(returnedFromInstagram){returnedFromInstagram=false;askDmReturn();}
});
window.addEventListener('pageshow',()=>askDmReturn());
function finishDmReturn(sent){
  const previous=state.dmDrafts;
  if(sent&&!$('#dmReturnText').value.trim())return;
  // User may correct the snapshot if they changed the text inside Instagram.
  if(sent)state.dmDrafts=prepareDmHandoff(state.dmDrafts,returnDraftId,$('#dmReturnText').value);
  state.dmDrafts=resolveDmHandoff(state.dmDrafts,returnDraftId,sent);
  if(!save()){state.dmDrafts=previous;return;}
  $('#dmReturnDialog').close();renderDmDrafts();
  if(sent){if($('#dmEditor').open)$('#dmEditor').close();setTab('dm');toast('Anfrage und gesendeter Text gespeichert.');}
}
$('#dmReturnYes').addEventListener('click',()=>finishDmReturn(true));
$('#dmReturnNo').addEventListener('click',()=>finishDmReturn(false));
$('#dmReturnDialog').addEventListener('cancel',event=>{event.preventDefault();finishDmReturn(false);});
$('#dmDraftList').addEventListener('change',event=>{
  const input=event.target.closest('[data-dm-shipping]');
  if(!input)return;
  if(!input.validity.valid){input.reportValidity();return;}
  state.dmDrafts=setDmShipping(state.dmDrafts,input.dataset.dmShipping,input.value===''?null:Number(input.value));
  save();renderDmDrafts();
});
$('#dmDraftFilter').addEventListener('change',renderDmDrafts);

function renderDmDrafts(){
  state.dmDrafts=normalizeDmDrafts(state.dmDrafts);
  const stats=dmStats(state.dmDrafts);
  $('#dmPreparedCount').textContent=String(stats.prepared);
  $('#dmSentCount').textContent=String(filterDmDrafts(state.dmDrafts,'sent').length);
  $('#dmRepliedCount').textContent=String(stats.replied);
  $('#dmTotalSentCount').textContent=String(stats.sent);
  const drafts=filterDmDrafts(state.dmDrafts,$('#dmDraftFilter').value);
  $('#dmDraftList').innerHTML=drafts.length ? drafts.map(draft=>{
    const name='@'+draft.brand;
    const profile=dmBrandProfile(draft.brand);
    const message=draft.sentMessage||dmDraftText(draft);
    const status=draft.status==='sent'?'Laut dir gesendet':
      draft.status==='replied'?'Antwort laut dir erhalten':'Nur vorbereitet · nicht gesendet';
    return '<article class="dm-card"><div class="dm-card-top"><div><span class="free-kind">INSTAGRAM · PRIVATE NACHRICHT</span>'+
      '<h3>'+esc(name)+'</h3></div><span class="dm-status'+(draft.status==='prepared'?'':' dm-finished')+'">'+esc(status)+'</span></div>'+
      '<div class="dm-card-actions"><button type="button" data-action="dm-edit" data-dm-id="'+esc(draft.id)+'">Video &amp; Nachricht ansehen</button></div><details><summary>Weitere Aktionen</summary>'+
      '<p class="dm-text-preview">'+esc(message)+'</p>'+
      '<div class="dm-card-actions">'+
        '<button type="button" data-action="dm-copy" data-dm-id="'+esc(draft.id)+'">✎ Nachricht kopieren</button>'+
        '<button type="button" data-action="dm-copy-link" data-dm-id="'+esc(draft.id)+'">✎ Text + Link kopieren</button>'+
        '<a href="'+esc(draft.reelUrl)+'" target="_blank" rel="noopener noreferrer">↗ Video öffnen &amp; teilen</a>'+
        '<a href="'+esc(profile)+'" target="_blank" rel="noopener noreferrer">↗ Markenprofil</a>'+
      '</div>'+
      '</details>'+(draft.status!=='prepared'?'<details class="dm-sent-record"><summary>Gesendeter Text &amp; Versand</summary><p class="dm-text-preview">'+esc(draft.sentMessage||'Frühere Anfrage: genauer Versandtext nicht dokumentiert.')+'</p><label>Versandkosten (€) · von dir bestätigt<input type="number" min="0" max="1000" step="0.01" inputmode="decimal" placeholder="Unbekannt" data-dm-shipping="'+esc(draft.id)+'" value="'+(draft.shippingEUR===null?'':draft.shippingEUR)+'"></label><p>'+(draft.shippingEUR===null?'Versand noch unbekannt':draft.shippingEUR>5?'Über deinem Versandlimit von 5 €':'Versand laut deiner Angabe')+'</p></details>':'')+'<div class="dm-card-progress">'+
        (draft.status==='prepared'
          ? '<button type="button" data-action="dm-sent" data-dm-id="'+esc(draft.id)+'">Ich habe es selbst gesendet ✓</button>'
          : draft.status==='sent'
            ? '<button type="button" data-action="dm-replied" data-dm-id="'+esc(draft.id)+'">Marke hat geantwortet ✓</button>'
            : '')+
        (draft.status==='replied' ? '<button type="button" data-action="offer-from-dm" data-dm-id="'+esc(draft.id)+'">Angebot notieren</button>' : '')+
        '<button type="button" data-action="dm-remove" data-dm-id="'+esc(draft.id)+'">Entfernen</button>'+
      '</div></article>';
  }).join('') :
    '<div class="empty"><strong>Keine Anfragen in dieser Ansicht.</strong><p>Füge einen echten Instagram-Reel-Link ein und wähle die Marke. Senden musst du die DM anschließend selbst in Instagram.</p></div>';
}


function renderFreeDropHunter() {
  const prefs=normalizeFreeDropPrefs(state.freeDropPrefs);
  const result=freeDropDiscovery(ui.catalog,prefs);
  $('#freeDropsGermanyOnly').checked=prefs.germanyOnly;
  document.querySelectorAll('[data-free-drop-view]').forEach(button=>{
    const active=prefs.view===button.dataset.freeDropView;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  $('#freeDropsCount').textContent=result.items.length+' Funde';
  $('#freeDropsSummary').textContent=result.counts.germanyConfirmed+
    ' mit bestätigter Deutschland-Teilnahme · '+result.counts.unknownShipping+
    ' mit unbekanntem Versand · max. 5 € Versand empfohlen · '+(ui.generatedAt?'Scan: '+asDate(ui.generatedAt):'Katalog noch nicht geladen');
  const labels={giveaway:'Gewinnspiel',drop:'Belegter Drop',deal:'1–10 €-Angebot',promotion:'Black-Week-Hinweis'};
  $('#freeDropsCards').innerHTML=result.items.length
    ? result.items.slice(0,24).map(item=>{
      const url=safeExternalUrl(item.url);
      const rules=safeExternalUrl(item.termsUrl);
      const date=item.deadline?asDate(item.deadline):'Frist unbekannt';
      const shipping=item.shippingEUR===null?'Versand offen':item.shippingEUR.toFixed(2)+' € Versand';
      const germany=item.germany==='confirmed'?'Deutschland bestätigt':'Deutschland offen';
      const price=item.priceEUR===null?'Kein bestätigter Kaufpreis':item.priceEUR.toFixed(2)+' € Kaufpreis';
      return '<article class="free-drop-card"><div class="free-drop-top">'+
        '<span class="free-drop-type">'+esc(labels[item.kind]||'Fundhinweis')+'</span>'+
        '<span class="free-drop-reviewed">'+(item.curated?'Redaktionell geprüft':'Ungeprüfter Treffer')+'</span></div>'+
        '<h3>'+esc(item.title)+'</h3><span class="free-drop-brand">'+esc(item.brand)+'</span>'+
        '<div class="free-drop-facts"><span>'+esc(date)+'</span><span>'+esc(shipping)+'</span>'+
        '<span>'+esc(germany)+'</span>'+(item.priceEUR!==null?'<span>'+esc(price)+'</span>':'')+'</div>'+
        (item.participation?'<p class="free-drop-action-hint">Teilnahme: '+esc(item.participation)+'</p>':'')+
        (item.costStatus?'<p class="free-drop-action-hint">'+esc(item.costStatus)+'</p>':'')+
        '<div class="free-drop-alerts">'+item.warnings.slice(0,4).map(x=>'<span>⚠ '+esc(x)+'</span>').join('')+'</div>'+
        '<div class="free-drop-actions">'+
        (url?'<a class="free-drop-primary" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Original öffnen ↗</a>':'')+
        (rules?'<a href="'+esc(rules)+'" target="_blank" rel="noopener noreferrer">Bedingungen</a>':'')+
        '<button type="button" data-action="free-drop-review" data-id="'+esc(item.id)+'">Teilnahme prüfen</button>'+
        '</div></article>';
    }).join('')
    : '<div class="free-drop-empty"><strong>Aktuell keine Treffer für diesen Filter.</strong>'+
      '<p>Es erscheinen nur echte öffentliche Aktionen aus dem verfügbaren Katalog. '+(prefs.view==='deals'
        ? 'Für 1–10-€-Drops benötigen wir einen aktuellen, überprüfbaren Originalpreis direkt beim Anbieter.'
        : 'Versandkosten und Teilnahmebedingungen bleiben sichtbar, auch wenn sie noch unbekannt sind.')+
      '</p></div>';
}
$('#freeDropsGermanyOnly').addEventListener('change',event=>{
  state.freeDropPrefs=normalizeFreeDropPrefs({...state.freeDropPrefs,germanyOnly:event.target.checked});
  save();renderFreeDropHunter();
});

function renderFreeProducts() {
  const prefs=normalizeFreeProductPrefs(state.freePrefs);
  const progress=normalizeProgramProgress(state.programProgress);
  const stats=programStats(progress);
  $('#freeProgramCount').textContent=String(stats.programs);
  $('#freeAppliedCount').textContent=String(stats.applied);
  $('#freeAcceptedCount').textContent=String(stats.accepted);
  $('#freeReceivedCount').textContent=String(stats.received);
  $('#freeHideFollower').checked=!prefs.showFollowerRestricted;
  $('#freeProductsSourceUpdated').textContent=ui.generatedAt
    ? 'Öffentlicher Scanner: '+asDate(ui.generatedAt)
    : 'Noch kein Scanner-Katalog geladen';
  document.querySelectorAll('[data-free-filter]').forEach(button=>{
    const active=button.dataset.freeFilter===prefs.view;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  const programs=rankPrograms(OFFICIAL_PROGRAMS,prefs);
  $('#freeProgramSummary').textContent=prefs.view==='giveaway'
    ? 'Gewinnspiele stehen unten im automatischen Fundbereich. Die offiziellen Programme bleiben davon getrennt.'
    : programs.length+' geprüfte offizielle Programmseite(n) · überprüfte Quellenstand-Daten, keine Zusage oder automatische Bewerbung.';
  $('#freeProgramCards').innerHTML=programs.map(program=>{
    const warnings=programWarnings(program);
    const url=safeExternalUrl(program.url);
    const terms=program.termsUrl ? safeExternalUrl(program.termsUrl) : null;
    const status=progress[program.id]?.status || 'interested';
    const badge=program.type==='creator' ? 'PR & Creator' : 'Produkttest';
    const freeClaim=program.freeProducts==='after_selection'
      ? 'Gratisprodukte nach Auswahl möglich'
      : program.freeProducts==='possible' ? 'Gratisprodukte möglich, nicht garantiert' :
      'Angebotsbedingungen prüfen';
    return '<article class="free-program-card">'+
      '<div class="free-program-head"><span class="free-kind">'+esc(badge)+'</span><span class="free-reviewed">Quelle geprüft: '+esc(program.checkedOn)+'</span></div>'+
      '<h3>'+esc(program.name)+'</h3>'+
      '<p class="free-program-focus">'+esc(program.focus)+' · '+esc(program.audience)+'</p>'+
      '<p>'+esc(program.overview)+'</p>'+
      '<div class="free-benefit">'+esc(freeClaim)+'</div>'+
      '<p class="free-requirements">'+esc(program.requirements)+'</p>'+
      '<div class="free-warnings">'+warnings.slice(0,4).map(w=>'<span>⚠ '+esc(w)+'</span>').join('')+'</div>'+
      '<div class="free-card-actions">'+
        (url?'<a class="free-external" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Originalprogramm öffnen ↗</a>':'')+
        (terms?'<a class="free-terms" href="'+esc(terms)+'" target="_blank" rel="noopener noreferrer">Bedingungen ↗</a>':'')+
        (program.type==='creator'?'<button type="button" class="free-draft" data-action="copy-free-draft" data-program-id="'+esc(program.id)+'">Anfrage kopieren</button>':'')+
      '</div>'+
      '<label class="free-progress-label">Mein Status (manuell bestätigt)'+
      '<select data-program-select="'+esc(program.id)+'">'+PROGRAM_STATES.map(value=>
        '<option value="'+esc(value)+'"'+(status===value?' selected':'')+'>'+esc(PROGRAM_STATE_LABELS[value])+'</option>'
      ).join('')+'</select></label></article>';
  }).join('') || '<div class="empty"><strong>In dieser Kategorie keine Programme.</strong><p>Nutze die übrigen Tabs, um weitere offizielle Möglichkeiten zu sehen.</p></div>';
  const leads=classifyPublicLeads(ui.catalog,prefs);
  $('#freeLiveLeads').innerHTML=leads.length?leads.slice(0,24).map(lead=>{
    const kind=lead.leadKind==='product_test'?'Produkttest' :lead.leadKind==='creator'?'PR-Programm':'Gewinnspiel';
    const url=safeExternalUrl(lead.url);
    return '<article class="free-live-card"><div><span class="free-kind">'+esc(kind)+' · '+esc(lead.category)+'</span>'+
      '<strong>'+esc(lead.title)+'</strong><p>Öffentlicher Fundhinweis – Kosten, Teilnahmebedingungen und Bewerbungsfrist am Original prüfen.</p></div>'+
      (url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Original prüfen ↗</a>':'')+
      '</article>';
  }).join(''):'<div class="empty"><strong>Keine aktuellen Fundhinweise dieser Art.</strong>'+
    '<p>PR-Hunter erfindet keine Aktionen. Der öffentliche Scanner prüft weitere Quellen im bestehenden Sechs-Stunden-Rhythmus.</p></div>';
}

function renderAutoHunter() {
  const settings=normalizeAutoPrefs(state.autoPrefs);
  const report=autoHunterReport(ui.catalog,settings);
  $('#autoHunterEnabled').checked=settings.enabled;
  $('#autoHunterTech').checked=settings.includeTech;
  $('#autoScanned').textContent=String(report.counts.found);
  $('#autoReview').textContent=String(report.counts.review);
  $('#autoReadyManual').textContent=String(report.counts.eligibleManual);
  $('#autoSubmitted').textContent='0';
  $('#autoQueueTitle').textContent=report.items.length
    ? 'Website-Kandidaten ('+report.items.length+')'
    : 'Noch keine geeigneten Website-Kandidaten';
  $('#autoSourceLabel').textContent=ui.generatedAt
    ? 'Letzter öffentlicher Katalog: '+asDate(ui.generatedAt)+
      ' · '+(ui.sourceStatus.filter(x=>x.status==='ok').length)+' von '+
      ui.sourceStatus.length+' Quellen erreichbar'
    : 'Noch kein erfolgreich geladener Katalog – keine automatische Einsendung';
  $('#autoHunterList').innerHTML=!settings.enabled
    ? '<div class="empty"><strong>Deine persönliche Vorsortierung ist aus.</strong><p>Der öffentliche Quellen-Scanner arbeitet unabhängig davon im Hintergrund auf GitHub.</p></div>'
    : report.items.length
      ? report.items.slice(0,60).map(entry=>{
          const approved=entry.status==='verified-for-manual-entry';
          const note=approved?'Eckdaten geprüft':'Noch ungeprüfte Bedingungen';
          return '<article class="auto-entry"><div class="auto-entry-info">' +
            '<span class="auto-kind">'+esc(entry.category)+' · '+esc(note)+'</span>' +
            '<strong>'+esc(entry.title)+'</strong><p>'+esc(entry.reason)+'</p>' +
            (entry.warnings.length ? '<small>⚠ '+esc(entry.warnings.slice(0,2).join(' · '))+'</small>' : '') +
            '</div><button type="button" class="subtle-btn" data-action="auto-review" data-id="'+
            esc(entry.id)+'">Regeln prüfen ↗</button></article>';
        }).join('')
      : '<div class="empty"><strong>Derzeit keine passenden Website-Aktionen.</strong><p>Es werden keine Gewinnspiele erfunden. Weitere öffentliche Quellen werden beim nächsten GitHub-Scan geprüft.</p></div>';
}
function render() {
  renderDisplay();
  updateStats();
  renderBrands();
  renderHomeDmScout();
  renderSimilarVideoDiscovery();
  renderFeed();
  renderAssistantQueue();
  renderActivity();
  renderAccounts();
  renderIntegrations();
  renderAlerts();
  renderAutoHunter();
  renderFreeProducts();
  renderFreeDropHunter();
  renderDmDrafts();
  renderBrandOffers();
}
const topTitles = { discover:'DISCOVER', profile:'PROFIL', products:'FREE PRODUCTS', dm:'VIDEO DM', brands:'BRAND RADAR', auto:'AUTO-HUNTER', assistant:'PARTICIPATION', activity:'ACTIVITY LOG', inbox:'SOCIAL INBOX', saved:'SAVED', alerts:'NOTIFICATIONS', info:'INTEGRATIONS' };
function setTab(tab) {
  if (!topTitles[tab]) return;
  ui.tab = tab;
  document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== tab; });
  document.querySelectorAll('.nav-btn').forEach(button => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('#topTitle').textContent = topTitles[tab];
  render();
  window.scrollTo({ top:0, behavior:'auto' });
}
let refreshInFlight=false;
let lastRefreshAt=0;
function renderAutoRefreshStatus(){
  const status=$('#alertAutoRefreshStatus');
  if(!status)return;
  const enabled=state.phase20.prefs.autoRefresh;
  status.textContent=enabled
    ?'Automatischer Abgleich etwa alle 10 Minuten, solange die App sichtbar und online ist. Letzter Abgleich: '+(lastRefreshAt?new Date(lastRefreshAt).toLocaleTimeString('de-DE'):'noch keiner')+'.'
    :'Automatischer Abgleich ausgeschaltet. Manuelle Aktualisierung weiterhin möglich.';
}
function maybeAutoRefresh(){
  if(shouldRefreshPhase20({
    enabled:state.phase20.prefs.autoRefresh,
    visible:document.visibilityState==='visible',
    online:navigator.onLine!==false,
    lastAt:lastRefreshAt,now:Date.now(),inFlight:refreshInFlight
  }))refresh();
}
function showForegroundDeviceNotices(notices){
  if(!state.phase20.prefs.deviceNotices||document.visibilityState!=='visible'||
    typeof window.Notification!=='function'||window.Notification.permission!=='granted'||
    !('serviceWorker' in navigator))return;
  const entries=Array.isArray(notices)?notices.slice(0,3):[];
  if(!entries.length)return;
  navigator.serviceWorker.ready.then(registration=>{
    if(typeof registration.showNotification!=='function')return;
    for(const note of entries)
      registration.showNotification('PR-Hunter',{
        body:String(note.title||'Neue öffentliche Fundstelle').slice(0,130),
        tag:note.id,
        icon:'./icon.svg'
      }).catch(()=>{});
  }).catch(()=>{});
}
async function refresh() {
  if(refreshInFlight||navigator.onLine===false)return;
  refreshInFlight=true;
  let catalogLoaded=false;
  $('#syncLabel').textContent = 'Katalog wird geladen …';
  try {
  try {
    const response = await fetch('./opportunities.json', {cache:'no-store'});
    if (!response.ok) throw Error('HTTP ' + response.status);
    const payload = await response.json();
    ui.catalog = Array.isArray(payload.opportunities) ? payload.opportunities.filter(item =>
      item && typeof item.id === 'string' && safeExternalUrl(item.url)
    ) : [];
    catalogLoaded=true;
    ui.generatedAt = payload.generatedAt || null;
    ui.sourceStatus = Array.isArray(payload.sources) ? payload.sources : [];
    const beforeAlerts = state.alerts;
    const nextAlerts = buildAlerts(ui.catalog, beforeAlerts);
    state.alerts = nextAlerts.state;
    if (nextAlerts.added || !beforeAlerts.initialized) save();
    $('#syncLabel').textContent = ui.generatedAt ? 'Scout: ' + new Date(ui.generatedAt).toLocaleString('de-DE') : 'Noch kein Scan';
    $('#sourceHealth').textContent = 'Öffentliche Feeds: ' + (payload.sourcesSucceeded ?? '?') + '/' + (payload.sourcesChecked ?? '?') +
      ' erreichbar · ' + (payload.curatedActive ?? 0) + ' redaktionell geprüfte Aktionen · ' +
      ui.catalog.length + ' Fundhinweise · offizielle Marken-Reels nur nach Meta-Freigabe';
  } catch {
    ui.sourceStatus = [];
    $('#syncLabel').textContent = 'Katalog offline';
    $('#sourceHealth').textContent = 'Zurzeit keine Verbindung zu den öffentlichen Feeds. Gespeicherte Aktionen bleiben lokal erhalten.';
  }
  try {
    const response=await fetch('./instagram-reels.json',{cache:'no-store'});
    if(!response.ok)throw Error('HTTP '+response.status);
    ui.instagramReport=normalizeInstagramReelsReport(await response.json());
  } catch {
    ui.instagramReport=normalizeInstagramReelsReport({status:'unavailable'});
  }
  try{
    const response=await fetch('./similar-reels.json',{cache:'no-store'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const raw=await response.json();
    const allowed=['not-configured','active','partial','unavailable'];
    ui.similarReport={
      status:allowed.includes(raw?.status)?raw.status:'unavailable',
      discovered:Array.isArray(raw?.discovered)?raw.discovered.slice(0,100):[]
    };
  }catch{
    ui.similarReport={status:'unavailable',discovered:[]};
  }
  const official=ui.instagramReport.status==='active'||ui.instagramReport.status==='partial'
    ?ui.instagramReport.reels:[];
  const hashtag=ui.similarReport.status==='active'||ui.similarReport.status==='partial'
    ?ui.similarReport.discovered:[];
  const smart=buildPhase20Notices(state.phase20,{
    reels:[...official,...hashtag],
    drops:freeDropDiscovery(ui.catalog,{},Date.now()).items,
    reelsAuthorized:ui.instagramReport.status==='active'||ui.instagramReport.status==='partial'||
      ui.similarReport.status==='active'||ui.similarReport.status==='partial',
    dropsLoaded:catalogLoaded
  });
  state.phase20=smart.state;
  // A new reviewed drop belongs in the specific Smart Inbox category, not
  // a second generic "new offer" notice on the same device.
  const highlighted=new Set(smart.notices.filter(n=>n.kind==='drop').map(n=>n.offerId));
  if(highlighted.size)
    state.alerts.inbox=state.alerts.inbox.filter(n=>!(n.kind==='new'&&highlighted.has(n.offerId)));
  save();
  render();
  showForegroundDeviceNotices(smart.notices);
  } finally {
    lastRefreshAt=Date.now();
    refreshInFlight=false;
    renderAutoRefreshStatus();
  }
}
function openDialog(id) {
  const dialog = $('#' + id);
  if (dialog && !dialog.open) dialog.showModal();
}
function openActivityDialog(id, type) {
  const select = $('#activityOffer');
  const items = all();
  if (!items.length) {
    toast('Speichere zuerst eine Aktion oder öffne einen gefundenen Beitrag.');
    return;
  }
  select.innerHTML = items.map(item => '<option value="' + esc(item.id) + '">' + esc(clean(item.title).slice(0, 95)) + '</option>').join('');
  if (id && items.some(item => item.id === id)) select.value = id;
  if (type && ['prepared','entered','won','received'].includes(type))
    $('#activityForm').elements.namedItem('type').value = type;
  openDialog('activityDialog');
}

function showParticipationDialog(item) {
  if (!item) return;
  ui.assistantOfferId = item.id;
  $('#participationTitle').textContent = String(item.title).slice(0,130);
  const url = safeExternalUrl(item.url);
  const original = $('#participationOriginal');
  original.href = url || '#';
  original.textContent = 'Originalbeitrag / Regeln öffnen ↗';
  const terms = $('#participationTerms');
  const termsUrl = safeExternalUrl(item.termsUrl);
  terms.hidden = !termsUrl;
  if (termsUrl) terms.href = termsUrl;
  renderParticipationDialog(item);
  openDialog('participationDialog');
}
function renderParticipationDialog(item) {
  const data = checklistFor(item);
  const definitions = stepDefinitions(item, data.selected);
  const progress = checklistProgress(item, data.selected, data.completed);
  const already = isConfirmedParticipation(state.activity,item.id) ||
    ['applied','accepted','received'].includes(state.tracked[item.id]);
  $('#participationWarnings').innerHTML = offerWarnings(item).map(warning =>
    '<p>⚠ ' + esc(warning) + '</p>').join('') ||
    '<p>✓ Keine offenen Hinweise in den hinterlegten Daten. Originalbedingungen trotzdem prüfen.</p>';
  $('#participationTasks').innerHTML = definitions.map(task =>
    '<label class="participation-task"><input type="checkbox" data-check-step="' + esc(task.id) + '"' +
    (data.completed.includes(task.id) ? ' checked' : '') + '>' + esc(task.label) + '</label>').join('');
  const extra = CHECKLIST_TASKS.filter(task => task.section === 'social');
  $('#participationExtra').innerHTML = extra.map(task =>
    '<label class="participation-extra"><input type="checkbox" data-opt-step="' + esc(task.id) + '"' +
    (data.selected.includes(task.id) ? ' checked' : '') + '>' + esc(task.label) + '</label>').join('');
  $('#participationCounter').textContent =
    progress.finished + ' von ' + progress.total + ' Aufgaben bestätigt · nur auf diesem Gerät';
  const complete = canConfirmEntry(item,data.selected,data.completed,state.activity) &&
    !['applied','accepted','received'].includes(state.tracked[item.id]);
  const confirm = $('#participationConfirm');
  confirm.disabled = !complete || already;
  confirm.textContent = already ? 'Bereits als Teilnahme erfasst' :
    complete ? 'Teilnahme selbst bestätigen ↗' : 'Erst Aufgaben abhaken';
  $('#participationTemplates').innerHTML = suggestedComments(item).map((message,index) =>
    '<div class="comment-choice"><span>' + esc(message) + '</span><button class="icon-btn" data-action="copy-template" data-template="' +
    index + '" type="button" aria-label="Kommentarvorlage kopieren">Kopieren</button></div>').join('');
}

function toggleSaved(item) {
  if (state.saved.includes(item.id)) {
    state.saved = state.saved.filter(id => id !== item.id);
    delete state.savedDetails[item.id];
    toast('Aus der Merkliste entfernt.');
  } else {
    state.saved.unshift(item.id);
    // Snapshot a real offer so a future feed refresh does not erase bookmarks.
    state.savedDetails[item.id] = {
      id:item.id, title:item.title, brand:item.brand, source:item.source,
      url:item.url, description:item.description, category:item.category,
      published:item.published, deadline:item.deadline, offerType:item.offerType,
      sourceType:item.sourceType, termsUrl:item.termsUrl, checkedOn:item.checkedOn,
      shippingStatus:item.shippingStatus, costStatus:item.costStatus,
      participation:item.participation, manual:!!item.manual
    };
    toast('In deiner Merkliste gespeichert.');
  }
  save();render();
}
async function copyText(item) {
  const instagram = /^https:\/\/(?:www\.)?instagram\.com\//i.test(item.url);
  const message = instagram
    ? 'Richtig starkes Piece! Würde mich mega freuen 🔥'
    : 'Hallo ' + clean(item.brand || 'Team') + ', ich habe die Aktion "' + clean(item.title) +
      '" entdeckt und möchte gerne teilnehmen. Wo finde ich die vollständigen Teilnahmebedingungen? Viele Grüße';
  try {
    await navigator.clipboard.writeText(message);
    toast('Text kopiert. Bitte Teilnahmebedingungen prüfen und selbst veröffentlichen.');
  } catch { toast('Kopieren nicht möglich. Prüfe die Safari-Berechtigung.'); }
}
document.addEventListener('click', event => {
  const nav = event.target.closest('[data-tab]');
  if (nav) {
    if(nav.dataset.tab==='discover' && ui.tab==='discover'){
      window.scrollTo({top:0,behavior:'smooth'});
    } else setTab(nav.dataset.tab);
    return;
  }
  const dropsFilter=event.target.closest('[data-free-drop-view]');
  if(dropsFilter && FREE_DROP_VIEWS.includes(dropsFilter.dataset.freeDropView)){
    state.freeDropPrefs=normalizeFreeDropPrefs({...state.freeDropPrefs,view:dropsFilter.dataset.freeDropView});
    save();renderFreeDropHunter();return;
  }
  const smartFilter=event.target.closest('[data-scout-view]');
  if(smartFilter && SCOUT_VIEWS.includes(smartFilter.dataset.scoutView)){
    state.scoutPrefs=setScoutView(state.scoutPrefs,smartFilter.dataset.scoutView);
    save();renderSimilarVideoDiscovery();mountInstagramAutoPreviews();
    return;
  }
  const discoveryFilter=event.target.closest('[data-discovery]');
  if(discoveryFilter && DISCOVERY_FILTERS.includes(discoveryFilter.dataset.discovery)){
    ui.discoveryMode=discoveryFilter.dataset.discovery;
    ui.visibleFeed=FEED_PAGE_SIZE;ui.brandFilter=null;
    ui.category='focus';ui.verifiedOnly=false;ui.endingSoonOnly=false;
    if(ui.tab!=='discover') setTab('discover'); else renderFeed();
    return;
  }
  const filter = event.target.closest('[data-category]');
  if (filter) { ui.category = filter.dataset.category; ui.visibleFeed=FEED_PAGE_SIZE; renderFeed(); return; }
  const dmPreset=event.target.closest('[data-dm-preset]');
  if(dmPreset) {
    $('#dmBrand').value='@'+dmPreset.dataset.dmPreset;
    $('#dmKind').value=dmPreset.dataset.dmPreset==='lucidclub'?'tracksuit':'shirt';
    $('#dmFormStatus').textContent='Marke übernommen. Kopiere jetzt den Original-Reel-Link in das Feld darüber.';
    $('#dmReel').focus();
    return;
  }
  const freeFilter=event.target.closest('[data-free-filter]');
  if (freeFilter) {
    state.freePrefs=normalizeFreeProductPrefs({...state.freePrefs,view:freeFilter.dataset.freeFilter});
    save();renderFreeProducts();return;
  }
  const close = event.target.closest('[data-close]');
  if (close) { $('#' + close.dataset.close)?.close(); return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if(action==='scout-hide-reel'){
    const idx=Number(button.dataset.similarIndex);
    const lead=Number.isInteger(idx)&&idx>=0?ui.similarItems[idx]:null;
    if(!lead)return;
    state.scoutPrefs=dismissScoutReel(state.scoutPrefs,lead.url);
    save();renderSimilarVideoDiscovery();mountInstagramAutoPreviews();
    toast('Reel ausgeblendet – weitere Treffer werden neu sortiert.');
    return;
  }
  if(action==='scout-hide-brand'||action==='scout-save-brand'){
    const handle=button.dataset.scoutBrand;
    const url=dmBrandProfile(handle);
    if(!url)return;
    if(action==='scout-hide-brand'){
      state.scoutPrefs=dismissScoutBrand(state.scoutPrefs,handle);
      save();renderSimilarVideoDiscovery();mountInstagramAutoPreviews();
      toast('Marke aus Empfehlungen ausgeblendet.');
      return;
    }
    if(watchedBrands().some(x=>x.handle.toLowerCase()===handle.toLowerCase())){
      toast('Marke bereits in deiner Referenzliste.');return;
    }
    const brand=normalizeBrand(handle,url);
    if(!brand)return;
    state.brands=[brand,...state.brands].slice(0,100);
    save();renderBrands();renderHomeDmScout();renderSimilarVideoDiscovery();
    mountInstagramAutoPreviews();
    toast('Marke als Referenz gespeichert. Automatischer Instagram-Abruf braucht weiterhin Meta-Zugriff.');
    return;
  }
  if(action==='similar-prepare'||action==='similar-add'){
    const idx=Number(button.dataset.similarIndex);
    const lead=Number.isInteger(idx)&&idx>=0?ui.similarItems[idx]:null;
    if(!lead)return;
    if(action==='similar-prepare'&&lead.brand){
      startHomeDm(lead.brand,lead.url,lead.signal);
    }else{
      $('#homeDmReel').value=lead.url;
      $('#homeDmBrand').value='';
      $('#homeDmBrand').focus();
      toast('Markenprofil aus dem Original-Reel übernehmen, dann DM vorbereiten.');
    }
    return;
  }
  if(action==='home-dm-start'){
    const index=Number(button.dataset.dmScoutIndex);
    if(Number.isInteger(index)&&index>=0&&index<ui.dmScoutItems.length){
      const lead=ui.dmScoutItems[index];
      startHomeDm(lead.brand,lead.reelUrl,lead.signal);
    }
    return;
  }
  if(action==='home-dm-copy-only'){
    const box=$('#homeDmCopyText');
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(box.value)
        .then(()=>toast('Text kopiert. Öffne jetzt den Markenchat.'))
        .catch(()=>{box.focus();box.select();toast('Text markieren und manuell kopieren.');});
    }else{box.focus();box.select();toast('Text markieren und manuell kopieren.');}
    return;
  }
  if (action === 'focus-discovery-search'){
    if(ui.tab!=='discover')setTab('discover');
    $('#search').focus();return;
  }
  if (action === 'story-brand'){
    const brand=watchedBrands().find(x=>x.id===button.dataset.brandId);
    if(!brand)return;
    ui.brandFilter=brand.id;ui.category='all';ui.discoveryMode='for-you';
    ui.verifiedOnly=false;ui.endingSoonOnly=false;ui.visibleFeed=FEED_PAGE_SIZE;
    ui.query='';$('#search').value='';
    setTab('discover');
    if(!ui.galleryItems.length)toast('Für diese Marke sind noch keine öffentlichen Fundhinweise gespeichert. Profil im Brand Radar öffnen.');
    return;
  }
  if (action === 'open-discovery'){
    const index=Number(button.dataset.tileIndex);
    if(Number.isInteger(index) && index>=0 && index<ui.galleryItems.length)openDiscovery(ui.galleryItems[index]);
    return;
  }
  if (action === 'add') return openDialog('addDialog');
  if (action === 'add-activity') return openActivityDialog();
  if(action==='offer-from-dm'){
    const draft=state.dmDrafts.find(x=>x.id===button.dataset.dmId);
    if(!draft)return;
    $('#brandOfferBrand').value='@'+draft.brand;
    $('#brandOfferItem').value='';
    $('#brandOfferInitialStatus').value='offered';
    $('#brandOfferItem').focus();
    return;
  }
  if(action==='offer-copy' || action==='offer-remove'){
    const id=button.dataset.offerId;
    const offer=state.brandOffers.find(x=>x.id===id);
    if(!offer)return;
    if(action==='offer-copy'){
      const text=offerReplyTemplate(offer,'en');
      if(!text)return;
      navigator.clipboard.writeText(text)
        .then(()=>toast('Nachricht kopiert – du sendest sie selbst über Instagram.'))
        .catch(()=>toast('Kopieren nicht möglich.'));
      return;
    }
    if(window.confirm('Dieses lokal gespeicherte Angebot von @'+offer.brand+' entfernen?')){
      state.brandOffers=state.brandOffers.filter(x=>x.id!==id);
      save();renderBrandOffers();
    }
    return;
  }
  if (action.startsWith('dm-')) {
    const id=button.dataset.dmId;
    const draft=state.dmDrafts.find(x=>x.id===id);
    if(!draft)return;
    if(action==='dm-edit'){openDmEditor(id);return;}
    if(action==='dm-copy' || action==='dm-copy-link'){
      const message=dmDraftText(draft,action==='dm-copy-link');
      if(!message)return;
      if(!navigator.clipboard?.writeText){openDmEditor(id);return;}
      navigator.clipboard.writeText(message)
        .then(()=>toast('Text kopiert – sende ihn selbst in Instagram.'))
        .catch(()=>openDmEditor(id));
      return;
    }
    if(action==='dm-sent' && window.confirm('Hast du das Originalvideo und die Nachricht wirklich über Instagram an @'+draft.brand+' gesendet?')){
      state.dmDrafts=confirmDmSent(state.dmDrafts,id);
      save();renderDmDrafts();toast('Nur deine eigene Sendebestätigung gespeichert.');
      return;
    }
    if(action==='dm-replied' && window.confirm('Hat die Marke in Instagram tatsächlich geantwortet?')){
      state.dmDrafts=updateDmStatus(state.dmDrafts,id,'replied');
      const reported=recordConfirmedReply(state.phase20,draft);
      state.phase20=reported.state;
      save();renderDmDrafts();renderAlerts();
      toast('Deine Antwortbestätigung gespeichert – nicht automatisch aus Instagram ausgelesen.');
      return;
    }
    if(action==='dm-remove' && window.confirm('Diese DM-Vorlage lokal entfernen?')){
      state.dmDrafts=state.dmDrafts.filter(x=>x.id!==id);
      save();renderDmDrafts();return;
    }
    return;
  }
  if (action === 'free-drop-review') {
    const item=byId(button.dataset.id);
    if(item)showParticipationDialog(item);
    else toast('Fund inzwischen nicht mehr aktuell. Bitte den Katalog neu laden.');
    return;
  }
  if (action === 'copy-free-draft') {
    const program=OFFICIAL_PROGRAMS.find(x=>x.id===button.dataset.programId);
    const draft=programMessage(program);
    if (!draft)return;
    navigator.clipboard.writeText(draft)
      .then(()=>toast('Anfrage kopiert – vor dem Senden persönlich anpassen.'))
      .catch(()=>toast('Kopieren auf diesem Gerät nicht verfügbar.'));
    return;
  }
  if (action === 'auto-review') {
    const item=byId(button.dataset.id);
    if(item) showParticipationDialog(item);
    return;
  }
  if (action === 'load-more') {
    if (button.dataset.target === 'feed') ui.visibleFeed = Math.min(1000,ui.visibleFeed+FEED_PAGE_SIZE);
    if (button.dataset.target === 'saved') ui.visibleSaved = Math.min(1000,ui.visibleSaved+FEED_PAGE_SIZE);
    renderFeed();return;
  }
  if (action === 'read-alert') {
    state.alerts = markAlertsRead(state.alerts,button.dataset.alertId);
    save();renderAlerts();return;
  }
  if (action === 'open-alert-offer') {
    const item = byId(button.dataset.offerId);
    state.alerts = markAlertsRead(state.alerts,button.dataset.alertId);
    save();renderAlerts();
    if (item) showParticipationDialog(item);
    return;
  }
  if (action === 'copy-template') {
    const item = byId(ui.assistantOfferId);
    const index = Number(button.dataset.template);
    const value = item && suggestedComments(item)[index];
    if (value) navigator.clipboard.writeText(value).then(() =>
      toast('Kommentar kopiert – veröffentliche ihn selbst beim Veranstalter.')
    ).catch(() => toast('Bitte Clipboard-Zugriff in Safari erlauben.'));
    return;
  }
  if (action === 'clear-brand-filter') {
    ui.brandFilter = null;ui.category='focus';ui.discoveryMode='for-you';ui.visibleFeed=FEED_PAGE_SIZE;setTab('discover');return;
  }
  if (action === 'brand-offers') {
    ui.brandFilter = String(button.dataset.brandId || '');
    ui.category = 'all';ui.discoveryMode='for-you';ui.query='';ui.visibleFeed=FEED_PAGE_SIZE;$('#search').value='';
    ui.verifiedOnly=false;ui.endingSoonOnly=false;
    setTab('discover');return;
  }
  if (action === 'remove-account') {
    const account = String(button.dataset.account || '').toLowerCase();
    state.accounts = state.accounts.filter(x => x !== account);
    save();renderAccounts();toast('Account-Label entfernt – vorhandene Teilnahmen bleiben erhalten.');
    return;
  }
  if (action === 'remove-brand') {
    const handle = button.dataset.handle;
    state.brands = state.brands.filter(b => b.handle?.toLowerCase() !== handle.toLowerCase());
    save();render();toast('Marke aus deiner Watchlist entfernt.');
    return;
  }
  const item = byId(button.dataset.id);
  if (!item) return;
  if (action === 'assist') return showParticipationDialog(item);
  if (action === 'bookmark') return toggleSaved(item);
  if (action === 'copy') return copyText(item);
  if (action === 'log') return openActivityDialog(item.id);
});
$('#discoveryDialog').addEventListener('close',()=>{
  $('#discoveryPreview').replaceChildren();ui.activeGalleryItem=null;
});
$('#discoveryBookmark').addEventListener('click',()=>{
  const item=ui.activeGalleryItem && byId(ui.activeGalleryItem.offerId);
  if(!item)return;
  toggleSaved(item);
  $('#discoveryBookmark').textContent=state.saved.includes(item.id)?'Aus Merkliste entfernen':'Merken';
});
$('#discoveryChecklist').addEventListener('click',()=>{
  const item=ui.activeGalleryItem && byId(ui.activeGalleryItem.offerId);
  $('#discoveryDialog').close();
  if(item)showParticipationDialog(item);
});
$('#discoveryDmButton').addEventListener('click',()=>{
  const item=ui.activeGalleryItem;
  if(!item || !reelUrl(item.url))return;
  $('#dmReel').value=item.url;
  const handle=item.brand.replace(/^@/,'');
  $('#dmBrand').value=/^[a-z0-9._]{1,30}$/i.test(handle)?'@'+handle:'';
  $('#discoveryDialog').close();
  // The data-tab handler navigates to the DM form on this same tap.
});
$('#addButton').addEventListener('click', () => openDialog('addDialog'));
$('#pasteLinkButton').addEventListener('click', async () => {
  // Explicit iPad tap only. Clipboard data never leaves the device.
  try {
    const value = await navigator.clipboard.readText();
    const url = safeExternalUrl(value.trim());
    if (url) {
      $('#addForm').elements.namedItem('url').value = url;
      openDialog('addDialog');
      toast('Link eingefügt. Ergänze Marke und Gewinnspiel-Titel.');
    } else {
      openDialog('addDialog');toast('Kein gültiger HTTPS-Link in der Zwischenablage.');
    }
  } catch {
    openDialog('addDialog');toast('Bitte den Link selbst in das Formular einfügen.');
  }
});
$('#addBrandButton').addEventListener('click', () => openDialog('brandDialog'));
document.querySelectorAll('input[name="motionMode"]').forEach(input => {
  input.addEventListener('change', event => {
    state.display=normalizeDisplayPrefs({motion:event.target.value});
    save();renderDisplay();
  });
});
document.querySelectorAll('input[name="metaMode"]').forEach(input => {
  input.addEventListener('change', event => {
    state.integration = normalizeIntegrationSetup({...state.integration,mode:event.target.value});
    save();renderIntegrations();
  });
});
$('#metaSteps').addEventListener('change', event => {
  const box = event.target.closest('input[data-meta-step]');
  if (!box) return;
  const value = box.dataset.metaStep;
  const checked = new Set(state.integration.checked);
  if (box.checked) checked.add(value); else checked.delete(value);
  state.integration = normalizeIntegrationSetup({...state.integration,checked:[...checked]});
  save();renderIntegrations();
});
$('#batchImportText').addEventListener('input', e => {
  const links = extractOpportunityLinks(e.target.value || '');
  $('#batchImportPreview').textContent = links.length
    ? links.length + ' unterschiedliche gültige HTTPS-Beiträge gefunden (maximal 40 pro Import).'
    : 'Noch keine passenden HTTPS-Links erkannt.';
});
$('#batchImportForm').addEventListener('submit', e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const links = extractOpportunityLinks(String(form.get('links') || ''));
  if (!links.length) return toast('Keine gültigen Instagram-Beiträge oder HTTPS-Links erkannt.');
  const imported = makeImportedOffers(links, [...all(), ...getSaved()], String(form.get('brand') || ''));
  if (!imported.length) return toast('Alle Links sind bereits vorhanden.');
  const remaining = Math.max(0,500 - state.manual.length);
  const accepted = imported.slice(0,remaining);
  if (!accepted.length) return toast('Maximal 500 manuelle Aktionen. Bitte erst alte Einträge sichern.');
  state.manual = [...accepted, ...state.manual];
  save(); e.currentTarget.reset();
  $('#batchImportPreview').textContent = accepted.length + ' Links gespeichert – nicht als echte Gewinnspiele bestätigt.';
  render();
  toast(accepted.length + ' Link(s) lokal hinzugefügt. Originale zuerst prüfen.');
});
$('#accountLabelForm').addEventListener('submit', e => {
  e.preventDefault();
  const candidate = String(new FormData(e.currentTarget).get('account') || '');
  const result = addAccountLabel(state.accounts,candidate);
  if (!result.added) return toast(result.reason);
  state.accounts = result.accounts;
  save();e.currentTarget.reset();renderAccounts();
  toast('Account-Label hinzugefügt (kein Instagram-Login).');
});
function downloadPrivateFile(contents,extension,mediaType) {
  const blob = new Blob([contents],{type:mediaType});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href=url;
  anchor.download='pr-hunter-backup-'+new Date().toISOString().slice(0,10)+'.'+extension;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
$('#encryptedBackup').addEventListener('click', async () => {
  const field=$('#backupPassword');
  try {
    const contents=await encryptBackup(backupDocument(state),field.value);
    downloadPrivateFile(contents,'prh','application/json');
    $('#backupStatus').textContent='Verschlüsselte Sicherung zum Speichern angeboten. Bewahre dein Passwort getrennt auf.';
    toast('Passwortgeschützte Sicherung erstellt.');
  } catch(error) {
    toast(String(error?.message || 'Verschlüsselung fehlgeschlagen').slice(0,120));
  } finally {field.value='';}
});
$('#downloadBackup').addEventListener('click', () => {
  try {
    downloadPrivateFile(backupDocument(state),'json','application/json');
    $('#backupStatus').textContent = 'Unverschlüsselte Sicherung erstellt. Die Datei enthält private Informationen.';
  } catch {
    toast('Sicherung nicht möglich. Bitte Safari-Dateizugriff prüfen.');
  }
});
$('#restoreBackup').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 3_500_000) return toast('Sicherung zu groß (max. 3,5 MB).');
  try {
    const text=await file.text();
    const encrypted=isEncryptedBackup(text);
    const passphrase=$('#backupPassword').value;
    if (encrypted && passphrase.length<12) return toast('Zum Entschlüsseln das Passwort mit mindestens 12 Zeichen eingeben.');
    const data=encrypted ? await decryptBackup(text,passphrase) : text;
    const parsed = parseBackup(data);
    if (!window.confirm('Bestehende lokale Daten durch die Sicherung ersetzen? Dein aktueller Stand wird überschrieben.')) return;
    state = parsed;
    state.alerts = normalizeAlertsState(state.alerts);
    state.phase20 = normalizePhase20State(state.phase20);
    $('#backupPassword').value='';
    save();render();setTab('inbox');
    $('#backupStatus').textContent = 'Sicherung geladen. Bitte Einträge kontrollieren.';
    toast('Lokale Sicherung erfolgreich wiederhergestellt.');
  } catch (error) {
    toast('Import abgebrochen: ' + String(error?.message || 'Ungültige Datei').slice(0,90));
  }
});
$('#refreshAlertsButton').addEventListener('click', refresh);
$('#markAllAlertsRead').addEventListener('click', () => {
  state.alerts=markAlertsRead(state.alerts);save();renderAlerts();
});
$('#clearReadAlerts').addEventListener('click', () => {
  state.alerts=clearReadAlerts(state.alerts);save();renderAlerts();
});
$('#alertNewPref').addEventListener('change',e => {
  state.alerts.prefs.newOffers=e.target.checked;save();renderAlerts();
});
$('#alertDeadlinePref').addEventListener('change',e => {
  state.alerts.prefs.expiring=e.target.checked;save();renderAlerts();
});
$('#verifiedOnlyButton').addEventListener('click', () => { ui.verifiedOnly = !ui.verifiedOnly; renderFeed(); });
$('#endingSoonButton').addEventListener('click', () => { ui.endingSoonOnly = !ui.endingSoonOnly; renderFeed(); });
$('#activityAccountFilter').addEventListener('input', e => {
  ui.accountQuery = String(e.target.value || '').trim().toLocaleLowerCase('de-DE');
  renderActivity();
});
$('#participationDialog').addEventListener('change', e => {
  const item = byId(ui.assistantOfferId);
  if (!item) return;
  const stored = checklistFor(item);
  const optional = e.target.closest('[data-opt-step]');
  const step = e.target.closest('[data-check-step]');
  if (optional) {
    const id = optional.dataset.optStep;
    stored.selected = optional.checked ? [...stored.selected,id] : stored.selected.filter(x=>x!==id);
    if (!optional.checked) stored.completed = stored.completed.filter(x=>x!==id);
  } else if (step) {
    const id = step.dataset.checkStep;
    stored.completed = step.checked ? [...stored.completed,id] : stored.completed.filter(x=>x!==id);
  } else return;
  storeChecklist(item,stored);renderParticipationDialog(item);renderFeed();renderAssistantQueue();
});
$('#participationConfirm').addEventListener('click', () => {
  const item = byId(ui.assistantOfferId);
  if (!item) return;
  const data = checklistFor(item);
  if (!canConfirmEntry(item,data.selected,data.completed,state.activity) ||
      ['applied','accepted','received'].includes(state.tracked[item.id]))
    return toast('Teilnahme noch nicht vollständig geprüft oder bereits dokumentiert.');
  $('#participationDialog').close();
  openActivityDialog(item.id,'entered');
});
$('#logActivityButton').addEventListener('click', () => openActivityDialog());
$('#refreshButton').addEventListener('click', refresh);
$('#autoRefreshButton').addEventListener('click', refresh);
$('#freeProductsRefresh').addEventListener('click',refresh);
$('#brandOfferForm').addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const id='offer-'+(typeof crypto.randomUUID==='function' ?
    crypto.randomUUID() : Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
  const result=createBrandOffer(state.brandOffers,{
    brand:String(data.get('brand')||''),
    item:String(data.get('item')||''),
    status:String(data.get('status')||'offered')
  },id);
  if(!result.added){toast(result.reason);return;}
  state.brandOffers=result.offers;
  save();renderBrandOffers();event.currentTarget.reset();
  toast('Angebot privat notiert – keine automatische Instagram-Verbindung.');
});
$('#brandOfferList').addEventListener('change',event=>{
  const checkbox=event.target.closest('[data-offer-field]');
  if(checkbox){
    const key=checkbox.dataset.offerField, id=checkbox.dataset.offerId;
    if(!['productFreeConfirmed','germanyConfirmed','shippingConfirmed'].includes(key))return;
    state.brandOffers=updateBrandOffer(state.brandOffers,id,{[key]:checkbox.checked});
    save();renderBrandOffers();return;
  }
  const shipping=event.target.closest('[data-offer-cost]');
  if(shipping){
    const id=shipping.dataset.offerCost;
    const cost=shipping.value.trim()===''?null:Number(shipping.value);
    if(cost!==null && (!Number.isFinite(cost) || cost<0 || cost>1000)){
      toast('Bitte einen gültigen Versandbetrag zwischen 0 und 1000 € angeben.');
      renderBrandOffers();return;
    }
    state.brandOffers=updateBrandOffer(state.brandOffers,id,{shippingEUR:cost});
    save();renderBrandOffers();return;
  }
  const select=event.target.closest('[data-offer-status]');
  if(!select)return;
  const id=select.dataset.offerStatus;
  const next=select.value;
  if(!OFFER_STATUSES.includes(next))return;
  if(['confirmed','shipped','received'].includes(next) &&
     !window.confirm('Hast du diesen Status selbst tatsächlich bestätigt? PR-Hunter liest keine Instagram-DMs und keine Sendungsverfolgung automatisch aus.')){
    renderBrandOffers();return;
  }
  state.brandOffers=updateBrandOffer(state.brandOffers,id,{status:next});
  save();renderBrandOffers();
});
$('#brandReelImportForm').addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const result=addSavedReel(state.savedReels,String(data.get('brand')||''),String(data.get('url')||''));
  if(!result.added){toast(result.reason);return;}
  state.savedReels=result.reels;
  save();event.currentTarget.reset();
  ui.discoveryMode='reels';ui.visibleFeed=FEED_PAGE_SIZE;
  renderFeed();
  toast('Instagram-Link gespeichert – die Vorschau erscheint automatisch im Feed.');
});
$('#homeDmQuickForm').addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const brand=String(data.get('brand')||'');
  const reelUrl=String(data.get('reelUrl')||'');
  const message=dmScoutText({brand,reelUrl,signal:'unverified'});
  if(!message){toast('Vollständigen Instagram-Link und gültige @Marke eintragen.');return;}
  // Persist a local manual record for the dashboard before navigating out.
  const added=addSavedReel(state.savedReels,brand,reelUrl);
  if(added.added){state.savedReels=added.reels;save();}
  startHomeDm(brand,reelUrl,'unverified');
});
$('#dmForm').addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const result=addDmDraft(state.dmDrafts,{
    reelUrl:String(data.get('reelUrl')||''),brand:String(data.get('brand')||''),
    language:String(data.get('language')||'en'),
    kind:String(data.get('kind')||'generic')
  });
  if(!result.added){
    $('#dmFormStatus').textContent=result.reason;
    toast(result.reason);return;
  }
  state.dmDrafts=result.drafts;
  save();renderDmDrafts();
  $('#dmFormStatus').textContent='Vorlage lokal gespeichert. Noch nichts an Instagram gesendet.';
  event.currentTarget.reset();
  openDmEditor(result.drafts[0].id);
  toast('DM-Nachricht vorbereitet – Video musst du in Instagram selbst teilen.');
});
$('#freeHideFollower').addEventListener('change',event=>{
  state.freePrefs=normalizeFreeProductPrefs({...state.freePrefs,showFollowerRestricted:!event.target.checked});
  save();renderFreeProducts();
});
$('#freeProgramCards').addEventListener('change',event=>{
  const element=event.target.closest('[data-program-select]');
  if(!element)return;
  const id=element.dataset.programSelect, status=element.value;
  if (!OFFICIAL_PROGRAMS.some(p=>p.id===id) || !PROGRAM_STATES.includes(status))return;
  if(status==='received' && !window.confirm('Hast du das kostenlose Produkt wirklich erhalten? Der Status wird nur lokal gespeichert.')){
    renderFreeProducts();return;
  }
  if(status==='applied' && !window.confirm('Hast du dich selbst beim Veranstalter beworben? PR-Hunter hat keine Bewerbung abgeschickt.')){
    renderFreeProducts();return;
  }
  state.programProgress[id]={status,updatedAt:new Date().toISOString()};
  save();renderFreeProducts();
  toast('Dein persönlicher Status wurde gespeichert – keine Anbieterbestätigung durch die App.');
});
$('#autoHunterEnabled').addEventListener('change',event=>{
  state.autoPrefs=normalizeAutoPrefs({...state.autoPrefs,enabled:event.target.checked});
  save();renderAutoHunter();
});
$('#autoHunterTech').addEventListener('change',event=>{
  state.autoPrefs=normalizeAutoPrefs({...state.autoPrefs,includeTech:event.target.checked});
  save();renderAutoHunter();
});
let searchTimer;
$('#search').addEventListener('input', event => {
  const value = event.target.value.trim();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    ui.query = value;
    ui.visibleFeed = FEED_PAGE_SIZE;
    renderFeed();
  }, 120);
});
$('#addForm').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const url = safeExternalUrl(clean(form.get('url')));
  const brand = clean(form.get('brand')).slice(0,80);
  const title = clean(form.get('title')).slice(0,130);
  if (!url || !brand || !title) return toast('Bitte gültige Angaben und eine HTTPS-Adresse verwenden.');
  if (all().some(item => item.url === url)) return toast('Diese Aktion ist schon gespeichert.');
  state.manual.unshift({
    id:'manual-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36)),
    title, brand, url,
    category: clean(form.get('category')) || 'Mode',
    description:'Von dir eingefügte Aktion. Regeln, Frist und Versand prüfen.',
    source:'Manuell hinzugefügt',
    offerType:'Manueller Fund',
    manual:true,
    published:new Date().toISOString()
  });
  state.manual = state.manual.slice(0,500);
  save();$('#addDialog').close();event.currentTarget.reset();setTab('discover');toast('Aktion lokal gespeichert.');
});
$('#brandForm').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const brand = normalizeBrand(form.get('name'), form.get('url'));
  if (!brand) return toast('Bitte eine direkte HTTPS-Instagram-Profiladresse eingeben.');
  if (watchedBrands().some(b => b.handle.toLowerCase() === brand.handle.toLowerCase()))
    return toast('Diese Marke ist bereits in der Watchlist.');
  state.brands.unshift(brand);
  state.brands = state.brands.slice(0,100);
  save();$('#brandDialog').close();event.currentTarget.reset();setTab('brands');toast('Marke als Referenz gespeichert – noch kein Auto-Monitoring.');
});
$('#activityForm').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const input = Object.fromEntries(form.entries());
  const log = makeActivity(input);
  if (!log) return toast('Bitte Status, Account-Label und Nachweislink prüfen.');
  const item = byId(log.offerId);
  if (!item) return toast('Wähle eine vorhandene Aktion.');
  log.offerTitle = clean(item.title).slice(0,130);
  log.offerUrl = safeExternalUrl(item.url);
  if (log.type === 'entered' && (
    isConfirmedParticipation(state.activity,item.id) ||
    ['applied','accepted','received'].includes(state.tracked[item.id])
  )) return toast('Diese Aktion wurde schon als Teilnahme erfasst.');
  state.activity.unshift(log);
  state.activity = state.activity.slice(0,1000);
  if (log.type === 'entered') state.tracked[item.id] = 'applied';
  if (log.type === 'won') state.tracked[item.id] = 'accepted';
  if (log.type === 'received') state.tracked[item.id] = 'received';
  save();$('#activityDialog').close();event.currentTarget.reset();setTab('activity');
  toast('Aktivität auf diesem Gerät dokumentiert.');
});
if ('serviceWorker' in navigator)
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
function updateConnectionStatus() {
  $('#connectionStatus').hidden = navigator.onLine !== false;
}
window.addEventListener('online', () => { updateConnectionStatus(); refresh(); });
window.addEventListener('offline',updateConnectionStatus);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')maybeAutoRefresh();
});
setInterval(maybeAutoRefresh,60*1000);
updateConnectionStatus();
render();
askDmReturn();
refresh();
