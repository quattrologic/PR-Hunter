// Small pure helpers shared by the iPad app and Node regression tests.
// No external accounts are accessed. Links are references, not verified giveaways.
export const SEED_BRANDS = Object.freeze([
  { id: 'suvene', name: 'Suvene', handle: 'suvene.de', url: 'https://www.instagram.com/suvene.de/' },
  { id: 'ranya', name: 'Ranya', handle: 'ranya.owt', url: 'https://www.instagram.com/ranya.owt/' },
  { id: '6pm', name: '6PM Updates', handle: '6pm.update', url: 'https://www.instagram.com/6pm.update/' },
  { id: 'mmml', name: 'More Money More Love', handle: 'moremoneymorelove.de', url: 'https://www.instagram.com/moremoneymorelove.de/' },
  { id: 'deputy', name: 'Deputy Department', handle: 'deputydepartment', url: 'https://www.instagram.com/deputydepartment/' }
]);
export const ACTIVITY_TYPES = Object.freeze({
  prepared: 'Kommentar vorbereitet',
  entered: 'Teilnahme selbst bestätigt',
  won: 'Zusage / Gewinn selbst eingetragen',
  received: 'Produkt erhalten'
});
export function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
export function normalizeBrand(name, profileUrl) {
  const safe = safeExternalUrl(profileUrl);
  if (!safe) return null;
  const url = new URL(safe);
  if (!['instagram.com','www.instagram.com'].includes(url.hostname)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 1 || !/^[a-z0-9._]{1,30}$/i.test(parts[0])) return null;
  const handle = parts[0];
  const label = String(name || handle).trim().slice(0, 80);
  if (!label) return null;
  return {
    id: 'custom-' + handle.toLowerCase(),
    name: label, handle,
    url: 'https://www.instagram.com/' + handle + '/'
  };
}
export function validAccountLabel(value) {
  return !value || /^@?[a-zA-Z0-9._]{1,30}$/.test(String(value).trim());
}
export function makeActivity(input, now = new Date()) {
  if (!input || !ACTIVITY_TYPES[input.type] || !String(input.offerId || '').trim()) return null;
  const account = String(input.account || '').trim();
  if (!validAccountLabel(account)) return null;
  const evidenceInput = String(input.evidenceUrl || '').trim();
  const evidenceUrl = evidenceInput ? safeExternalUrl(evidenceInput) : null;
  if (evidenceInput && !evidenceUrl) return null;
  const note = String(input.note || '').trim().slice(0, 500);
  const createdAt = now instanceof Date && Number.isFinite(now.valueOf())
    ? now.toISOString() : new Date().toISOString();
  return {
    id: 'log-' + createdAt + '-' + Math.random().toString(36).slice(2, 10),
    offerId: String(input.offerId).slice(0, 120),
    type: input.type,
    account: account.startsWith('@') ? account.slice(1) : account,
    note, evidenceUrl, createdAt
  };
}
export function isExpired(item, now = Date.now()) {
  if (!item?.deadline) return false;
  const expiry = Date.parse(item.deadline);
  return Number.isFinite(expiry) ? expiry < now : false;
}
export function rankFeed(items, category = 'focus', query = '') {
  const term = String(query).trim().toLocaleLowerCase('de-DE');
  const filtered = items.filter(item => {
    if (!item || !safeExternalUrl(item.url) || isExpired(item)) return false;
    if (category === 'focus' && !['Mode','Technik'].includes(item.category)) return false;
    if (category !== 'focus' && category !== 'all' && item.category !== category) return false;
    return [item.title,item.brand,item.source,item.description].join(' ').toLocaleLowerCase('de-DE').includes(term);
  });
  const newerFirst = (a, b) =>
    Number(b.sourceType === 'curated') - Number(a.sourceType === 'curated') ||
    String(b.published || '').localeCompare(String(a.published || ''));
  if (category !== 'focus') return filtered.sort(newerFirst);
  const fashion = filtered.filter(item => item.category === 'Mode').sort(newerFirst);
  const tech = filtered.filter(item => item.category === 'Technik').sort(newerFirst);
  const result = [];
  while (fashion.length || tech.length) {
    for (let i = 0; i < 9 && fashion.length; i++) result.push(fashion.shift());
    if (tech.length) result.push(tech.shift());
  }
  return result; // 90/10 target when inventory supports it; never manufacture entries.
}
export function activitySummary(activities = []) {
  const logs = Array.isArray(activities) ? activities : [];
  return {
    entered: logs.filter(x => x.type === 'entered').length,
    won: logs.filter(x => x.type === 'won').length,
    received: logs.filter(x => x.type === 'received').length
  };
}
