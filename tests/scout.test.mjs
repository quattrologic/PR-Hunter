import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, isRelevant, decodeEntities, normalizeOpportunity, compareOpportunities } from '../scripts/scout.mjs';
test('reads RSS offers without HTML markup', () => {
  const [item] = parseFeed('<rss><channel><item><title>Gratis PR-Paket &amp; Shirt</title><link>https://example.org/offer</link><description><![CDATA[<p>Streetwear</p>]]></description></item></channel></rss>', 'Example');
  assert.equal(item.title, 'Gratis PR-Paket & Shirt');
  assert.equal(item.description, 'Streetwear');
  assert.equal(normalizeOpportunity(item).category, 'Mode');
});
test('reads Atom links', () => {
  const [item] = parseFeed('<feed><entry><title>Product testing</title><link href="https://example.org/offer" rel="alternate"/><summary>Free product</summary></entry></feed>');
  assert.equal(item.url, 'https://example.org/offer');
  assert.ok(normalizeOpportunity(item));
});
test('rejects unsupported and unrelated links', () => {
  assert.equal(normalizeOpportunity({ title: 'Giveaway', url: 'javascript:alert(1)' }), null);
  assert.equal(normalizeOpportunity({ title: 'Giveaway', url: 'http://example.org' }), null);
  assert.equal(normalizeOpportunity({ title: 'Unrelated news', url: 'https://example.org' }), null);
  assert.equal(isRelevant('Kleider-Wetter'), false);
});
test('encodes stable IDs and rejects old offers', () => {
  const item = { title: 'Produkttester gesucht', url: 'https://example.com/test#fragment' };
  const result = normalizeOpportunity(item);
  assert.ok(result.id);
  assert.equal(result.url, 'https://example.com/test');
  assert.equal(normalizeOpportunity({ ...item, published: '2020-01-01' }), null);
});
test('handles entity decoding', () => assert.equal(decodeEntities('Tom &amp; Jerry &#33;'), 'Tom & Jerry !'));
test('classifies and prioritizes fashion and technology opportunities', () => {
  const make = (title, suffix) => normalizeOpportunity({ title: title + ' Gewinnspiel', url: 'https://example.org/' + suffix, published: '2026-11-13T10:00:00Z' });
  const hoodie = make('Streetwear Hoodie', 'hoodie');
  const earbuds = make('Kopfhörer', 'earbuds');
  const other = make('Beauty', 'beauty');
  assert.equal(hoodie.category, 'Mode');
  assert.equal(earbuds.category, 'Technik');
  assert.equal(other.category, 'Beauty');
  const arranged = [other, earbuds, hoodie].sort(compareOpportunities);
  assert.equal(arranged.at(-1).category, 'Beauty');
  assert.ok(['Mode', 'Technik'].includes(arranged[0].category));
  assert.ok(['Mode', 'Technik'].includes(arranged[1].category));
});

test('rejects ordinary paid promotions mentioning free shipping', () => {
  const item = { title:'Tech-Angebot: Gratis Versand beim Einkauf', description:'20% Rabatt', url:'https://example.org/deal' };
  assert.equal(normalizeOpportunity(item), null);
  assert.equal(normalizeOpportunity({ ...item, title:'50% Rabatt Hoodie Deal', description:'Gewinnspiel im Footer' }), null);
});
test('recognizes giveaway and product test types without claiming guaranteed gifts', () => {
  const giveaway = normalizeOpportunity({ title: 'Playstation Gewinnspiel', url: 'https://example.org/a' });
  const testOffer = normalizeOpportunity({ title: 'Produkttester für Headset gesucht', url: 'https://example.org/b' });
  assert.equal(giveaway.offerType, 'Gewinnspiel');
  assert.equal(testOffer.offerType, 'Produkttest');
  assert.equal(testOffer.category, 'Technik');
});
