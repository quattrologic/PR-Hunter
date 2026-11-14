const KEY = 'pr-hunter-state-v1';
const $ = selector => document.querySelector(selector);
const ui = { tab: 'discover', query: '', category: 'focus', catalog: [] };
const blank = { saved: [], tracked: {}, manual: [] };
let state;
try { state = Object.assign({}, blank, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { state = { ...blank }; }
if (!Array.isArray(state.saved)) state.saved = [];
if (!Array.isArray(state.manual)) state.manual = [];
if (!state.tracked || typeof state.tracked !== 'object') state.tracked = {};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast('Speicher konnte nicht aktualisiert werden.'); } };
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const safeUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; } };
const all = () => [...state.manual, ...ui.catalog];
const status = id => state.tracked[id] || 'new';
let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2600);
}
async function refresh() {
  $('#syncLabel').textContent = 'Katalog wird geprüft…';
  try {
    const res = await fetch('./opportunities.json', { cache: 'no-store' });
    if (!res.ok) throw Error('Fehler beim Laden');
    const data = await res.json();
    ui.catalog = Array.isArray(data.opportunities) ? data.opportunities.filter(x => x && typeof x.id === 'string' && safeUrl(x.url)) : [];
    $('#syncLabel').textContent = data.generatedAt ? 'Letzter Scout-Lauf: ' + new Date(data.generatedAt).toLocaleString('de-DE') : 'Noch keine Feeds eingerichtet';
  } catch {
    $('#syncLabel').textContent = 'Offline – Katalog nicht erreichbar';
    ui.catalog = [];
  }
  render();
}
function stat(id, number) { $(id).textContent = String(number); }
function render() {
  const items = all();
  stat('#totalCount', items.length);
  stat('#savedCount', items.filter(x => state.saved.includes(x.id)).length);
  stat('#appliedCount', items.filter(x => ['applied','accepted','received'].includes(status(x.id))).length);
  stat('#acceptedCount', items.filter(x => ['accepted','received'].includes(status(x.id))).length);
  const titles = { discover: 'Opportunities', saved: 'Deine Merkliste', tracked: 'Meine Anfragen', info: 'Über PR-Hunter' };
  $('#sectionTitle').textContent = titles[ui.tab];
  $('#infoPanel').hidden = ui.tab !== 'info';
  $('#listArea').hidden = ui.tab === 'info';
  document.querySelectorAll('[data-tab]').forEach(button => {
    const active = button.dataset.tab === ui.tab;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  if (ui.tab === 'info') return;
  const q = ui.query.toLocaleLowerCase('de-DE');
  const filtered = items.filter(item => {
    if (ui.tab === 'saved' && !state.saved.includes(item.id)) return false;
    if (ui.tab === 'tracked' && status(item.id) === 'new') return false;
    if (!['all', 'focus'].includes(ui.category) && item.category !== ui.category) return false;
    return [item.title,item.brand,item.description,item.source].join(' ').toLocaleLowerCase('de-DE').includes(q);
  });
  // With "Mode & Technik zuerst" selected, both categories appear before other matches.
  // All other categories remain accessible and no actual offers are fabricated.
  if (ui.category === 'focus') filtered.sort((a, b) => {
    const rank = item => ['Mode', 'Technik'].includes(item.category) ? 2 : 0;
    return rank(b) - rank(a) || (b.published || '').localeCompare(a.published || '');
  });
  $('#cards').innerHTML = filtered.length ? filtered.map(card).join('') : '<div class="empty"><span class="symbol">✧</span><strong>Hier ist noch Platz für Entdeckungen.</strong><p>Der automatische Scout benötigt erlaubte öffentliche RSS-Feeds. Du kannst auch selbst ein Angebot hinzufügen. Es werden keine erfundenen Live-Angebote angezeigt.</p><button class="primary-btn" data-action="add">＋ Angebot hinzufügen</button></div>';
}
function card(item) {
  const id = escapeText(item.id);
  const bookmarked = state.saved.includes(item.id);
  const source = escapeText(item.brand || item.source || 'Quelle');
  const label = escapeText(item.source || (item.manual ? 'Selbst gespeichert' : 'Öffentlicher Feed'));
  const description = escapeText((item.description || 'Öffne die Aktion und prüfe die Teilnahmebedingungen.').slice(0, 260));
  const link = safeUrl(item.url);
  const selected = status(item.id);
  const options = [['new','Noch nicht beworben'],['applied','Kontaktiert'],['accepted','Zusage erhalten'],['received','Produkt erhalten']].map(pair => '<option value="' + pair[0] + '"' + (selected === pair[0] ? ' selected' : '') + '>' + pair[1] + '</option>').join('');
  return '<article class="opportunity"><div class="card-top"><div class="card-top" style="justify-content:flex-start"><span class="source-icon" aria-hidden="true">✦</span><div><div class="brand-name">' + source + '</div><div class="source-name">' + label + '</div></div></div><span class="kind">' + escapeText(item.category || 'Sonstiges') + '</span></div><h3>' + escapeText(item.title) + '</h3><p class="description">' + description + '</p><div class="card-bottom"><a href="' + escapeText(link) + '" target="_blank" rel="noopener noreferrer">Aktion ansehen ↗</a><div class="card-actions"><button class="icon-btn' + (bookmarked ? ' selected' : '') + '" data-action="bookmark" data-id="' + id + '" aria-label="' + (bookmarked ? 'Aus Merkliste entfernen' : 'Auf Merkliste setzen') + '" title="Merkliste">' + (bookmarked ? '♥' : '♡') + '</button><button class="icon-btn" data-action="draft" data-id="' + id + '" title="Persönliche Anfrage kopieren">Text kopieren</button></div></div><label class="source-name">Dein Status<select class="status-select" data-status="' + id + '">' + options + '</select></label></article>';
}
function setTab(tab) { ui.tab = tab; render(); }
function openDialog() { $('#addDialog').showModal(); }
$('#addButton').addEventListener('click', openDialog);
$('#closeDialog').addEventListener('click', () => $('#addDialog').close());
$('#refreshButton').addEventListener('click', refresh);
$('#search').addEventListener('input', event => { ui.query = event.target.value.trim(); render(); });
$('#category').addEventListener('change', event => { ui.category = event.target.value; render(); });
document.addEventListener('click', async event => {
  const nav = event.target.closest('[data-tab]');
  if (nav) return setTab(nav.dataset.tab);
  const action = event.target.closest('[data-action]');
  if (!action) return;
  if (action.dataset.action === 'add') return openDialog();
  const item = all().find(x => x.id === action.dataset.id);
  if (!item) return;
  if (action.dataset.action === 'bookmark') {
    state.saved = state.saved.includes(item.id) ? state.saved.filter(id => id !== item.id) : [...state.saved, item.id];
    save(); render();
  } else if (action.dataset.action === 'draft') {
    const message = 'Hallo ' + (item.brand || 'Team') + ', ich habe eure Aktion "' + item.title + '" entdeckt und würde gerne mehr über die Teilnahmebedingungen erfahren. Gibt es aktuell die Möglichkeit, sich dafür zu bewerben? Viele Grüße';
    try { await navigator.clipboard.writeText(message); toast('Persönlicher Text kopiert – wird nicht versendet.'); }
    catch { toast('Kopieren nicht möglich – Safari benötigt eine sichere Verbindung.'); }
  }
});
document.addEventListener('change', event => {
  const select = event.target.closest('[data-status]');
  if (!select) return;
  if (select.value === 'new') delete state.tracked[select.dataset.status]; else state.tracked[select.dataset.status] = select.value;
  save(); render();
});
$('#addForm').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const url = safeUrl(String(form.get('url') || '').trim());
  if (!url) return toast('Bitte einen gültigen HTTPS-Link angeben.');
  const item = {
    id: 'manual-' + (globalThis.crypto?.randomUUID?.() || Date.now()),
    title: String(form.get('title') || '').trim().slice(0, 130),
    brand: String(form.get('brand') || '').trim().slice(0, 80),
    url,
    category: String(form.get('category') || 'Sonstiges'),
    description: 'Von dir gespeichertes Angebot. Teilnahmebedingungen selbst prüfen.',
    source: 'Manuell hinzugefügt',
    manual: true
  };
  if (!item.title || !item.brand) return;
  state.manual.unshift(item);
  save();
  $('#addDialog').close();
  $('#addForm').reset();
  ui.tab = 'discover';
  render();
  toast('Angebot auf diesem Gerät gespeichert.');
});
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
refresh();