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

const STORE = 'pr-hunter-state-v1'; // Preserve the existing iPad user's saved data.
const $ = selector => document.querySelector(selector);
const ui = {
  tab:'discover', category:'focus', query:'', catalog:[], generatedAt:null,
  assistantOfferId:null, verifiedOnly:false, endingSoonOnly:false, accountQuery:'',
  brandFilter:null, sourceStatus:[]
};
const empty = { saved:[], tracked:{}, manual:[], brands:[], activity:[], savedDetails:{}, checklists:{}, accounts:[], integration:{} };
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
    '<a class="brand-pill" href="' + esc(brand.url) + '" target="_blank" rel="noopener noreferrer" title="Instagram-Profil öffnen">' +
    brandAvatar(brand) + '<span><strong>' + esc(brand.name) + '</strong><small>@' + esc(brand.handle) + '</small></span></a>'
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
    '<h3>' + esc(offerName) + '</h3><p class="description">' + esc(desc) + '</p>' + sourceInfo +
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
  $('#discoverCards').innerHTML = feed.length ? feed.map(renderOffer).join('') : emptyMessage('feed');
  const saved = getSaved();
  $('#savedCards').innerHTML = saved.length ? saved.map(renderOffer).join('') : emptyMessage('saved');
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
function render() {
  updateStats();
  renderBrands();
  renderFeed();
  renderAssistantQueue();
  renderActivity();
  renderAccounts();
  renderIntegrations();
}
const topTitles = { discover:'DISCOVER', brands:'BRAND RADAR', assistant:'PARTICIPATION', activity:'ACTIVITY LOG', inbox:'SOCIAL INBOX', saved:'SAVED', info:'INTEGRATIONS' };
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
  const filter = event.target.closest('[data-category]');
  if (filter) { ui.category = filter.dataset.category; renderFeed(); return; }
  const close = event.target.closest('[data-close]');
  if (close) { $('#' + close.dataset.close)?.close(); return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'add') return openDialog('addDialog');
  if (action === 'add-activity') return openActivityDialog();
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
    ui.brandFilter = null;ui.category='focus';setTab('discover');return;
  }
  if (action === 'brand-offers') {
    ui.brandFilter = String(button.dataset.brandId || '');
    ui.category = 'all';ui.query='';$('#search').value='';
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
$('#downloadBackup').addEventListener('click', () => {
  try {
    const contents = backupDocument(state);
    const file = new Blob([contents],{type:'application/json'});
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pr-hunter-backup-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url),5000);
    $('#backupStatus').textContent = 'Sicherung erstellt. Bewahre die Datei privat auf.';
  } catch {
    toast('Sicherung nicht möglich. Bitte Safari-Dateizugriff prüfen.');
  }
});
$('#restoreBackup').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 2_000_000) return toast('Sicherung zu groß (max. 2 MB).');
  try {
    const parsed = parseBackup(await file.text());
    if (!window.confirm('Bestehende lokale Daten durch die Sicherung ersetzen? Dein aktueller Stand wird überschrieben.')) return;
    state = parsed;
    save();render();setTab('inbox');
    $('#backupStatus').textContent = 'Sicherung geladen. Bitte Einträge kontrollieren.';
    toast('Lokale Sicherung erfolgreich wiederhergestellt.');
  } catch (error) {
    toast('Import abgebrochen: ' + String(error?.message || 'Ungültige Datei').slice(0,90));
  }
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
$('#search').addEventListener('input', event => { ui.query = event.target.value.trim(); renderFeed(); });
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
render();
refresh();
