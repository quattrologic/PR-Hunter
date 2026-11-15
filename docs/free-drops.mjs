// Phase 19 — Free Drops & Giveaway Hunter. Pure, fail-closed public-catalog filtering.
// A public hint is NEVER proof of an awarded or free item.
import { verifiedDealPrice, isBlackFridayLead } from './discovery-grid.mjs';

const VIEWS = ['all','giveaways','drops','deals','black-friday'];
export const FREE_DROP_VIEWS = Object.freeze(VIEWS);

export function normalizeFreeDropPrefs(input) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    view: VIEWS.includes(raw.view) ? raw.view : 'all',
    germanyOnly: raw.germanyOnly === true,
    maxShippingEUR: 5
  };
}
function safeHttps(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (!url.hostname.includes('.')) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
function finiteCost(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000
    ? Math.round(value * 100) / 100 : null;
}
export function classifyFreeDrop(item, now = Date.now()) {
  if (!item || typeof item !== 'object' || !['Mode','Technik'].includes(item.category)) return null;
  const url = safeHttps(item.url);
  if (!url || !String(item.title || '').trim()) return null;
  const rawDeadline = item.deadline;
  const deadline = rawDeadline ? Date.parse(rawDeadline) : NaN;
  if (rawDeadline && (!Number.isFinite(deadline) || deadline < now)) return null;
  const curated = item.sourceType === 'curated' && item.noPurchase === true &&
    item.keepPrize === true && Boolean(safeHttps(item.termsUrl));
  const text = String(item.title || '') + ' ' + String(item.offerType || '');
  const giveaway = /gewinnspiel|giveaway|verlos|gewinnen|win\s+a\b/i.test(text);
  const priced = verifiedDealPrice(item, now);
  const deal = priced !== null && priced >= 1 && priced <= 10;
  const drop = /\bdrop\b|release|launch|restock/i.test(text) && priced !== null && priced <= 10;
  const blackFriday = isBlackFridayLead(item);
  if (!giveaway && !deal && !drop && !blackFriday) return null;
  // Black Friday is not automatically a cheap deal and an RSS hint is never verified.
  const kind = giveaway ? 'giveaway' : drop ? 'drop' : deal ? 'deal' : 'promotion';
  const germany = item.shipsToGermany === true ? 'confirmed' :
    item.shipsToGermany === false ? 'excluded' : 'unknown';
  if (germany === 'excluded') return null;
  const shipping = finiteCost(item.shippingCostEUR);
  const warnings = [];
  if (!curated) warnings.push('Fundhinweis – Teilnahme und Angebotsbedingungen ungeprüft');
  if (germany === 'unknown') warnings.push('Lieferung/Teilnahme aus Deutschland unbestätigt');
  if (shipping === null) warnings.push('Versandkosten unbekannt');
  if (shipping !== null && shipping > 5) warnings.push('Versand über deinem 5-€-Limit');
  if (item.noPurchase !== true) warnings.push('Kauf- bzw. Teilnahmegebührenfreiheit unbestätigt');
  if (item.keepPrize !== true) warnings.push('Dauerhaftes Behalten unbestätigt');
  if (!Number.isFinite(deadline)) warnings.push('Keine bestätigte Teilnahmeschlussfrist');
  if (curated && (!Number.isFinite(Date.parse(item.checkedOn)) ||
     now - Date.parse(item.checkedOn) > 45 * 86400000))
    warnings.push('Redaktionelle Prüfung ist veraltet');
  return {
    id: String(item.id || url), url, title: String(item.title).slice(0,130),
    brand: String(item.brand || item.source || 'Quelle').slice(0,80),
    termsUrl: safeHttps(item.termsUrl), kind, category: item.category,
    curated, checkedOn: curated ? String(item.checkedOn || '') : null,
    published: typeof item.published === 'string' ? item.published : null,
    deadline: Number.isFinite(deadline) ? new Date(deadline).toISOString() : null,
    germany, shippingEUR: shipping, priceEUR: priced, blackFriday,
    participation: typeof item.participation === 'string' ? item.participation.slice(0,150) : '',
    costStatus: typeof item.costStatus === 'string' ? item.costStatus.slice(0,150) : '',
    warnings
  };
}
export function freeDropDiscovery(catalog, rawPrefs = {}, now = Date.now()) {
  const prefs = normalizeFreeDropPrefs(rawPrefs);
  const seen = new Set();
  const entries = [];
  for (const record of Array.isArray(catalog) ? catalog.slice(0,500) : []) {
    const offer = classifyFreeDrop(record, now);
    if (!offer) continue;
    const canonical = offer.url.replace(/\/$/,'').toLowerCase();
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    if (prefs.germanyOnly && offer.germany !== 'confirmed') continue;
    if (prefs.view === 'giveaways' && offer.kind !== 'giveaway') continue;
    if (prefs.view === 'drops' && offer.kind !== 'drop') continue;
    if (prefs.view === 'deals' && (offer.priceEUR === null || offer.priceEUR < 1 || offer.priceEUR > 10)) continue;
    if (prefs.view === 'black-friday' && !offer.blackFriday) continue;
    entries.push(offer);
  }
  entries.sort((a,b) =>
    Number(b.curated) - Number(a.curated) ||
    Number(b.germany === 'confirmed') - Number(a.germany === 'confirmed') ||
    Number(b.category === 'Mode') - Number(a.category === 'Mode') ||
    (a.deadline === null ? 1 : b.deadline === null ? -1 :
      Date.parse(a.deadline) - Date.parse(b.deadline)) ||
    a.title.localeCompare(b.title,'de'));
  return {
    items:entries.slice(0,100),
    counts:{
      all:entries.length,
      giveaways:entries.filter(x=>x.kind==='giveaway').length,
      deals:entries.filter(x=>x.priceEUR!==null && x.priceEUR>=1 && x.priceEUR<=10).length,
      germanyConfirmed:entries.filter(x=>x.germany==='confirmed').length,
      unknownShipping:entries.filter(x=>x.shippingEUR===null).length
    }
  };
}
