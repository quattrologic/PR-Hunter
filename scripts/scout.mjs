import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const configPath = new URL('../config/sources.json', import.meta.url);
const catalogPath = new URL('../docs/opportunities.json', import.meta.url);
const TERMS = /\b(giveaway|freebie|pr[\s-]?package|brand[\s-]?ambassador|gifted[\s-]?collab|product[\s-]?test(?:ing|er)?|free[\s-]?product|sampling|collaboration|gratis|gewinnspiel|verlosung|produkttest(?:er)?|testprodukt|geschenkaktion|kooperation|pr[\s-]?paket|pr[\s-]?sample)\b/i;
export function decodeEntities(text = '') {
  return String(text).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity) => {
      const known = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ' };
      if (entity[0] === '#') {
        const value = Number.parseInt(entity[1].toLowerCase() === 'x' ? entity.slice(2) : entity.slice(1), entity[1].toLowerCase() === 'x' ? 16 : 10);
        return Number.isFinite(value) && value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : '';
      }
      return known[entity.toLowerCase()] || whole;
    }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
const getTag = (chunk, tag) => {
  const expression = new RegExp('<(?:[a-z0-9_-]+:)?' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?' + tag + '\\s*>', 'i');
  return expression.exec(chunk)?.[1] || '';
};
export function isRelevant(text) { return TERMS.test(String(text ?? '')); }

// Prioritize clothing and technology, but keep relevant offers in other categories too.
export const priorityRank = category => category === 'Mode' || category === 'Technik' ? 2 : 0;
export function compareOpportunities(a, b) {
  return priorityRank(b.category) - priorityRank(a.category)
    || (b.published || '').localeCompare(a.published || '');
}
export function parseFeed(xml, sourceName = 'Öffentlicher Feed') {
  if (typeof xml !== 'string' || xml.length > 1_000_000) throw new Error('Unsupported feed size');
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)].slice(0, 200);
  return blocks.map(match => {
    const body = match[2];
    const atomHref = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i.exec(body)?.[1];
    return {
      title: decodeEntities(getTag(body, 'title')),
      description: decodeEntities(getTag(body, 'description') || getTag(body, 'summary') || getTag(body, 'content')),
      url: decodeEntities(atomHref || getTag(body, 'link')),
      published: decodeEntities(getTag(body, 'pubDate') || getTag(body, 'published') || getTag(body, 'updated')),
      source: sourceName
    };
  });
}
export function normalizeOpportunity(item) {
  if (!item?.title || !item?.url) return null;
  let url;
  try {
    url = new URL(item.url);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.hash = '';
  } catch { return null; }
  if (!isRelevant(item.title + ' ' + (item.description || ''))) return null;
  const rawDate = Date.parse(item.published);
  const published = Number.isFinite(rawDate) ? new Date(rawDate).toISOString() : null;
  if (published && rawDate < Date.now() - 90 * 24 * 60 * 60 * 1000) return null;
  const text = (item.title + ' ' + (item.description || '')).toLowerCase();
  const category = /\b(fashion|streetwear|clothing|kleidung|mode|sneakers?|shoes?|schuhe|hoodies?|sweatshirts?|shirts?|t-shirts?|tracksuits?|jogginganzug|jackets?|jacken?|caps?|mützen?|outfits?|pullover|jeans)\b/.test(text) ? 'Mode' :
    /\b(tech|technik|technologie|elektronik|smartphones?|iphones?|ipads?|handys?|handys|tablets?|laptops?|notebooks?|computer|gaming|headsets?|kopfhörer|earbuds|airpods|hardware|smartwatches?|tastaturen?|maus|mäuse|gadget|gadgets|konsolen?|playstation|xbox|lautsprecher|speakers?)\b/.test(text) ? 'Technik' :
    /\b(beauty|skincare|kosmetik|makeup|parfum)\b/.test(text) ? 'Beauty' :
    /\b(lifestyle|food|essen|fitness|sport)\b/.test(text) ? 'Lifestyle' : 'Sonstiges';
  const canonical = url.href;
  return {
    id: createHash('sha256').update(canonical).digest('hex').slice(0, 20),
    title: String(item.title).slice(0, 130),
    brand: String(item.source || 'Öffentlicher Feed').slice(0, 80),
    source: String(item.source || 'Öffentlicher Feed').slice(0, 80),
    description: String(item.description || 'Bedingungen bei der Quelle prüfen.').slice(0, 300),
    url: canonical, category, published
  };
}
async function scan() {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  if (!Array.isArray(config.sources)) throw Error('config/sources.json must contain a sources array');
  if (config.sources.length === 0) { console.log('No sources configured. Nothing to scan.'); return; }
  if (config.sources.length > 20) throw Error('Maximum 20 sources');
  let success = 0;
  const found = [];
  for (const source of config.sources) {
    let url;
    try {
      url = new URL(source.url);
      if (url.protocol !== 'https:' || url.username || url.password) throw Error('HTTPS feed required');
      const controller = AbortSignal.timeout(12000);
      const response = await fetch(url, { signal: controller, headers: { 'user-agent': 'PR-Hunter/0.1 public-feed-discovery' } });
      if (!response.ok || new URL(response.url).protocol !== 'https:') throw Error('HTTP ' + response.status);
      const data = await response.text();
      if (data.length > 1_000_000) throw Error('Feed exceeds 1MB');
      const items = parseFeed(data, String(source.name || url.hostname));
      found.push(...items.map(normalizeOpportunity).filter(Boolean));
      success++;
      console.log('OK:', url.hostname, items.length, 'entries');
    } catch (error) { console.warn('SKIP:', source?.name || source?.url || 'unknown', error.message); }
  }
  if (!success) throw Error('All configured feeds failed; preserving existing catalog');
  const existing = JSON.parse(await readFile(catalogPath, 'utf8'));
  const previous = Array.isArray(existing.opportunities) ? existing.opportunities : [];
  const combined = [...found, ...previous].filter(item => item?.id && item?.url && (!item.published || Date.parse(item.published) >= Date.now() - 90 * 86400000));
  const deduped = [...new Map(combined.map(item => [item.url, item])).values()]
    .sort(compareOpportunities).slice(0, 200);
  await writeFile(catalogPath, JSON.stringify({
    version: 1, generatedAt: new Date().toISOString(),
    sourcesChecked: config.sources.length, sourcesSucceeded: success,
    opportunities: deduped
  }, null, 2) + '\n');
  console.log('Saved', deduped.length, 'relevant opportunities');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL('file://' + process.argv[1]))) {
  scan().catch(error => { console.error(error); process.exitCode = 1; });
}