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
  dmBrandProfile, dmCopyText
} from './dm-assistant.mjs';
import {
  DISCOVERY_FILTERS, reelUrl, publicEmbedUrl, discoveryCards,
  filterEmptyMessage
} from './discovery-grid.mjs';

const STORE = 'pr-hunter-state-v1'; // Preserve the existing iPad user's saved data.
const $ = selector => document.querySelector(selector);
const ui = {
  tab:'discover', category:'focus', query:'', catalog:[], generatedAt:null,
  assistantOfferId:null, verifiedOnly:false, endingSoonOnly:false, accountQuery:'',
  brandFilter:null, sourceStatus:[], visibleFeed:FEED_PAGE_SIZE, visibleSaved:FEED_PAGE_SIZE,
  discoveryMode:'for-you', galleryItems:[], activeGalleryItem:null
};
const empty = { saved:[], tracked:{}, manual:[], brands:[], activity:[], savedDetails:{}, checklists:{}, accounts:[], integration:{}, alerts:{}, display:{}, autoPrefs:{}, freePrefs:{}, programProgress:{}, dmDrafts:[] };
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
state.display = normalizeDisplayPrefs(state.display);
state.autoPrefs = normalizeAutoPrefs(state.autoPrefs);
state.freePrefs = normalizeFreeProductPrefs(state.freePrefs);
state.programProgress = normalizeProgramProgress(state.programProgress);
state.dmDrafts = normalizeDmDrafts(state.dmDrafts);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clean = value => String(value ?? '').trim();
const asDate = value => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.valueOf()) ? date.toLocaleDateString('de-DE') : '';
};
const iconText = category => category === 'Mode' ? 'STREETWEAR' : category === 'Technik' ? 'TECH DROP' : 'DISCOVERY';
const save = () => {
  try { localStorage.setItem(STORE, JSON.stringify(state)); }
  catch { toast('Speichern nicht möglich. Bitte Safari-Speicher prüfen.'); }
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
function brandAvatar(brand) {
  const initials = brand.name.split(/\s+/).slice(0,2).map(x => x.slice(0,1)).join('').toUpperCase();
  return '<span class="brand-avatar" aria-hidden="true">' + esc(initials) + '</span>';
}
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
    '<span class="story-ring"><span class="story-ring-inner">' +
    esc(brand.name.split(/\s+/).slice(0,2).map(word=>word.slice(0,1)).join('').toUpperCase().slice(0,2)) +
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
function renderDiscoveryTile(item,index) {
  const brand=clean(item.brand).replace(/^@/,'') || 'Originalquelle';
  const title=clean(item.title);
  const kind=item.kind === 'reel' ? 'REEL' :
    item.kind==='giveaway' ? 'GEWINNSPIEL' :
    item.kind==='drop' ? 'DROP' : item.kind==='pr' ? 'PR' : 'FUNDHINWEIS';
  const brandInitials=brand.replace(/[^a-z0-9]+/ig,' ').trim().split(/\s+/).slice(0,2)
    .map(word=>word.slice(0,1)).join('').toUpperCase() || 'PR';
  const label=item.kind==='reel' ? 'Instagram · selbst gespeichert' :
    item.verifiedPrice!==null ? item.verifiedPrice.toLocaleString('de-DE',{style:'currency',currency:'EUR'}) :
    title;
  return '<article class="discover-tile"><button type="button" class="discover-tile-open" data-action="open-discovery" data-tile-index="' + index +
    '" aria-label="' + esc(kind+' von '+brand+': '+title) + '">' +
    '<span class="tile-art ' + esc(tileTheme(brand+title)) + '">' +
    '<span class="tile-category">' + esc(kind) + '</span>' +
    '<span class="tile-mark" aria-hidden="true">' + esc(brandInitials) + '</span>' +
    (item.kind==='reel' ? '<span class="tile-play" aria-hidden="true">▶</span>' : '') +
    '<span class="tile-label">' + esc(label.slice(0,70)) + '</span></span>' +
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
  $('#discoveryKind').textContent=item.kind==='reel'?'Instagram Reel':'Öffentliche Fundstelle';
  $('#discoveryBrand').textContent=item.brand;
  const original=$('#discoveryOriginal');
  original.href=link;
  original.textContent=item.kind==='reel'?'Original-Reel öffnen ↗':'Original-Angebot öffnen ↗';
  const preview=$('#discoveryPreview');
  preview.textContent='';
  const embed=item.kind==='reel'?publicEmbedUrl(link):null;
  const message=document.createElement('p');
  message.className='preview-placeholder';
  if(embed){
    const heading=document.createElement('strong');
    heading.textContent='Instagram-Vorschau';
    message.append(heading,'Wird nur für öffentliche Beiträge geladen. Falls Instagram die Einbettung blockiert, öffne das Original.');
    const load=document.createElement('button');
    load.type='button';
    load.className='primary-btn';
    load.textContent='Vorschau laden';
    load.addEventListener('click',()=>{
      const iframe=document.createElement('iframe');
      iframe.title='Öffentliche Instagram-Vorschau: '+item.brand;
      iframe.loading='lazy';
      iframe.referrerPolicy='strict-origin-when-cross-origin';
      iframe.allow='fullscreen';
      iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
      iframe.src=embed;
      preview.replaceChildren(iframe);
    });
    preview.append(message,load);
    $('#discoveryDisclaimer').textContent=
      'Instagram kann öffentliche Einbettungen einschränken. Kein Login in PR-Hunter und keine automatische Weiterleitung per DM.';
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
  const candidates=discoveryCards(feed,
    ui.verifiedOnly || ui.endingSoonOnly || ui.brandFilter ? [] : state.dmDrafts,
    {mode:ui.discoveryMode,query:ui.query});
  const page=getVisibleSlice(candidates,ui.visibleFeed);
  ui.galleryItems=page.items;
  $('#discoverCards').innerHTML=page.total ?
    page.items.map(renderDiscoveryTile).join('') +
    (page.remaining ? '<div class="load-more"><span>' + page.items.length + ' von ' + page.total +
      ' Einträgen</span><button type="button" data-action="load-more" data-target="feed">Mehr anzeigen ↓</button></div>' : '') :
    '<div class="empty"><div class="symbol">⌕</div><strong>Noch keine passenden Einträge</strong><p>' +
      esc(filterEmptyMessage(ui.discoveryMode)) +
      '</p><button class="subtle-btn" type="button" data-tab="inbox">Original-Link hinzufügen</button></div>';
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


function renderDmDrafts(){
  state.dmDrafts=normalizeDmDrafts(state.dmDrafts);
  const stats=dmStats(state.dmDrafts);
  $('#dmPreparedCount').textContent=String(stats.prepared);
  $('#dmSentCount').textContent=String(stats.sent);
  $('#dmRepliedCount').textContent=String(stats.replied);
  $('#dmDraftList').innerHTML=state.dmDrafts.length ? state.dmDrafts.map(draft=>{
    const name='@'+draft.brand;
    const profile=dmBrandProfile(draft.brand);
    const message=dmCopyText(draft);
    const status=draft.status==='sent'?'Laut dir gesendet':
      draft.status==='replied'?'Antwort laut dir erhalten':'Nur vorbereitet · nicht gesendet';
    return '<article class="dm-card"><div class="dm-card-top"><div><span class="free-kind">INSTAGRAM REEL · PRIVATE NACHRICHT</span>'+
      '<h3>'+esc(name)+'</h3></div><span class="dm-status'+(draft.status==='prepared'?'':' dm-finished')+'">'+esc(status)+'</span></div>'+
      '<p class="dm-text-preview">'+esc(message)+'</p>'+
      '<div class="dm-card-actions">'+
        '<button type="button" data-action="dm-copy" data-dm-id="'+esc(draft.id)+'">✎ Nachricht kopieren</button>'+
        '<button type="button" data-action="dm-copy-link" data-dm-id="'+esc(draft.id)+'">✎ Text + Link kopieren</button>'+
        '<a href="'+esc(draft.reelUrl)+'" target="_blank" rel="noopener noreferrer">↗ Video öffnen &amp; teilen</a>'+
        '<a href="'+esc(profile)+'" target="_blank" rel="noopener noreferrer">↗ Markenprofil</a>'+
      '</div>'+
      '<div class="dm-card-progress">'+
        (draft.status==='prepared'
          ? '<button type="button" data-action="dm-sent" data-dm-id="'+esc(draft.id)+'">Ich habe es selbst gesendet ✓</button>'
          : draft.status==='sent'
            ? '<button type="button" data-action="dm-replied" data-dm-id="'+esc(draft.id)+'">Marke hat geantwortet ✓</button>'
            : '')+
        '<button type="button" data-action="dm-remove" data-dm-id="'+esc(draft.id)+'">Entfernen</button>'+
      '</div></article>';
  }).join('') :
    '<div class="empty"><strong>Noch keine Video-DMs vorbereitet.</strong><p>Füge einen echten Instagram-Reel-Link ein und wähle die Marke. Senden musst du die DM anschließend selbst in Instagram.</p></div>';
}

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
  renderFeed();
  renderAssistantQueue();
  renderActivity();
  renderAccounts();
  renderIntegrations();
  renderAlerts();
  renderAutoHunter();
  renderFreeProducts();
  renderDmDrafts();
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
async function refresh() {
  $('#syncLabel').textContent = 'Katalog wird geladen …';
  try {
    const response = await fetch('./opportunities.json', {cache:'no-store'});
    if (!response.ok) throw Error('HTTP ' + response.status);
    const payload = await response.json();
    ui.catalog = Array.isArray(payload.opportunities) ? payload.opportunities.filter(item =>
      item && typeof item.id === 'string' && safeExternalUrl(item.url)
    ) : [];
    ui.generatedAt = payload.generatedAt || null;
    ui.sourceStatus = Array.isArray(payload.sources) ? payload.sources : [];
    const beforeAlerts = state.alerts;
    const nextAlerts = buildAlerts(ui.catalog, beforeAlerts);
    state.alerts = nextAlerts.state;
    if (nextAlerts.added || !beforeAlerts.initialized) save();
    $('#syncLabel').textContent = ui.generatedAt ? 'Scout: ' + new Date(ui.generatedAt).toLocaleString('de-DE') : 'Noch kein Scan';
    $('#sourceHealth').textContent = 'Öffentliche Feeds: ' + (payload.sourcesSucceeded ?? '?') + '/' + (payload.sourcesChecked ?? '?') +
      ' erreichbar · ' + (payload.curatedActive ?? 0) + ' redaktionell geprüfte Aktionen · ' +
      ui.catalog.length + ' Fundhinweise · keine Instagram-Automation';
  } catch {
    ui.sourceStatus = [];
    $('#syncLabel').textContent = 'Katalog offline';
    $('#sourceHealth').textContent = 'Zurzeit keine Verbindung zu den öffentlichen Feeds. Gespeicherte Aktionen bleiben lokal erhalten.';
  }
  render();
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
  if (nav) { setTab(nav.dataset.tab); return; }
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
  if (action.startsWith('dm-')) {
    const id=button.dataset.dmId;
    const draft=state.dmDrafts.find(x=>x.id===id);
    if(!draft)return;
    if(action==='dm-copy' || action==='dm-copy-link'){
      const message=dmCopyText({...draft,includeLink:action==='dm-copy-link'});
      if(!message)return;
      navigator.clipboard.writeText(message)
        .then(()=>toast('Text kopiert – sende ihn selbst in Instagram.'))
        .catch(()=>toast('Kopieren fehlgeschlagen. Du kannst den Text in der Karte markieren.'));
      return;
    }
    if(action==='dm-sent' && window.confirm('Hast du das Originalvideo und die Nachricht wirklich über Instagram an @'+draft.brand+' gesendet?')){
      state.dmDrafts=updateDmStatus(state.dmDrafts,id,'sent');
      save();renderDmDrafts();toast('Nur deine eigene Sendebestätigung gespeichert.');
      return;
    }
    if(action==='dm-replied' && window.confirm('Hat die Marke in Instagram tatsächlich geantwortet?')){
      state.dmDrafts=updateDmStatus(state.dmDrafts,id,'replied');
      save();renderDmDrafts();toast('Deine Antwortbestätigung gespeichert – nicht automatisch aus Instagram ausgelesen.');
      return;
    }
    if(action==='dm-remove' && window.confirm('Diese DM-Vorlage lokal entfernen?')){
      state.dmDrafts=state.dmDrafts.filter(x=>x.id!==id);
      save();renderDmDrafts();return;
    }
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
updateConnectionStatus();
render();
refresh();
