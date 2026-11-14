import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, isRelevant, decodeEntities, normalizeOpportunity } from '../scripts/scout.mjs';
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