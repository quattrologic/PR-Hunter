import { verifiedDealPrice } from '../docs/discovery-grid.mjs';
import { createHash } from 'node:crypto';

const validUrl = input => {
  try {
    const u = new URL(input);
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
  } catch { return null; }
};
const validDate = input => Number.isFinite(Date.parse(input));

export function normalizeCurated(item, now = new Date()) {
  if (!item || typeof item !== 'object') return null;
  const url = validUrl(item.url);
  const termsUrl = validUrl(item.termsUrl);
  const expiry = Date.parse(item.deadline);
  const time = now instanceof Date ? now.getTime() : Number(now);
  if (!url || !termsUrl || !Number.isFinite(expiry) || !Number.isFinite(time) || time > expiry) return null;
  // Paid 1–10 € drops are allowed only with a fresh, retailer-owned price
  // record. The existing no-purchase giveaway rules remain unchanged.
  const price = verifiedDealPrice(item,time);
  const paidDrop = item.offerKind === 'verified-deal' && item.noPurchase === false &&
    price !== null && price >= 1 && price <= 10;
  if ((item.noPurchase !== true && !paidDrop) ||
      item.keepPrize !== true || item.shipsToGermany === false) return null;
  if (!['Mode','Technik'].includes(item.category)) return null;
  if (!item.title || !item.brand || !item.checkedOn || !validDate(item.checkedOn)) return null;
  const published = validDate(item.published) ? new Date(item.published).toISOString() : null;
  return {
    id: createHash('sha256').update(url).digest('hex').slice(0,20),
    title: String(item.title).slice(0,130),
    brand: String(item.brand).slice(0,80),
    source: 'Offizielle Aktion · geprüft am ' + String(item.checkedOn).slice(0,10),
    description: String(item.description || '').slice(0,300),
    url, termsUrl, category: item.category,
    published, deadline: new Date(expiry).toISOString(),
    offerType: String(item.offerType || 'Gewinnspiel').slice(0,50),
    sourceType: 'curated',
    checkedOn: String(item.checkedOn).slice(0,10),
    // Explicit eligibility fields remain in the machine-readable report.
    // Missing/uncertain costs or permission are never converted into consent.
    noPurchase:item.noPurchase === true,
    ...(paidDrop ? {
      offerKind:'verified-deal',
      dealPriceEUR:price,
      priceSourceUrl:validUrl(item.priceSourceUrl),
      priceCheckedAt:new Date(item.priceCheckedAt).toISOString()
    } : {}),
    keepPrize:item.keepPrize === true,
    shipsToGermany:item.shipsToGermany === true ? true : null,
    shippingCostEUR:typeof item.shippingCostEUR==='number' && Number.isFinite(item.shippingCostEUR)
      ? item.shippingCostEUR : null,
    autoEntry:item.autoEntry?.allowed === true && validUrl(item.autoEntry.rulesUrl) &&
      item.autoEntry.adapterId && validDate(item.autoEntry.reviewedAt)
      ? {allowed:true,rulesUrl:validUrl(item.autoEntry.rulesUrl),
          reviewedAt:String(item.autoEntry.reviewedAt).slice(0,30),
          adapterId:String(item.autoEntry.adapterId).slice(0,80)} : null,
    shippingStatus: item.shipsToGermany === true ? 'Deutschland laut Bedingungen erlaubt' : 'Deutschlandversand unbestätigt',
    costStatus: String(item.costStatus || 'Kosten prüfen').slice(0,150),
    participation: String(item.method || 'Regeln prüfen').slice(0,150)
  };
}
export function mergeCatalog(found, curated, now = new Date()) {
  const timestamp = now instanceof Date ? now.getTime() : Number(now);
  const active = [...curated,...found].filter(x => {
    if (!x || typeof x.url !== 'string' || !validUrl(x.url) || !x.id) return false;
    return !x.deadline || (validDate(x.deadline) && Date.parse(x.deadline) >= timestamp);
  });
  const seen = new Set();
  const deduped = [];
  for (const offer of active) {
    const key = new URL(offer.url).href.replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(offer);
  }
  return deduped;
}
