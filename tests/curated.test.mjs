import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeCurated, mergeCatalog } from '../scripts/curated.mjs';
import { rankFeed, isExpired } from '../docs/ultimate-core.mjs';

const config = JSON.parse(await readFile(new URL('../config/curated-offers.json', import.meta.url), 'utf8'));
const fixture = {
  slug:'hoodie-sweepstakes',
  brand:'Quality Brand',
  title:'Hoodie-Gewinnspiel',
  url:'https://example.org/hoodie',
  termsUrl:'https://example.org/rules',
  description:'Kostenloser Hoodie mit bestätigten Teilnahmebedingungen.',
  category:'Mode',
  checkedOn:'2026-11-14',
  deadline:'2026-11-16T23:59:00+01:00',
  published:'2026-11-14T10:00:00+01:00',
  noPurchase:true,
  keepPrize:true,
  shipsToGermany:true,
  offerType:'Kleidungs-Gewinnspiel',
  method:'Teilnahmeformular'
};
const before = new Date('2026-11-14T14:00:00Z');
const after = new Date('2026-11-17T00:00:00Z');

test('verified public source entries have separate original and official terms links', () => {
  assert.ok(config.offers.length >= 2);
  assert.ok(config.offers.some(x => x.brand === 'BERGMENSCH'));
  assert.ok(config.offers.some(x => x.brand === '6PM'));
  for(const item of config.offers) {
    assert.ok(item.noPurchase === true);
    assert.ok(item.keepPrize === true);
    assert.ok(item.deadline);
    assert.ok(item.checkedOn);
    assert.ok(normalizeCurated(item,before));
    assert.ok(normalizeCurated(item,before).termsUrl.startsWith('https://'));
  }
});
test('curated offers expire, cannot require a purchase or a return', () => {
  assert.ok(normalizeCurated(fixture,before));
  assert.equal(normalizeCurated(fixture,after),null);
  assert.equal(normalizeCurated({...fixture,noPurchase:false},before),null);
  assert.equal(normalizeCurated({...fixture,keepPrize:false},before),null);
  assert.equal(normalizeCurated({...fixture,shipsToGermany:false},before),null);
  assert.equal(normalizeCurated({...fixture,url:'http://example.org'},before),null);
  assert.equal(normalizeCurated({...fixture,termsUrl:'javascript:alert(1)'},before),null);
  assert.equal(normalizeCurated({...fixture,deadline:'not a date'},before),null);
});
test('catalog merge prioritizes reviewed terms and does not repeat same source URL', () => {
  const curated=normalizeCurated(fixture,before);
  const feed={id:'rss-1',url:fixture.url,title:'Hoodie gewinnen',category:'Mode'};
  const extra={id:'rss-2',url:'https://example.org/tech',title:'Headphones gewinnen',category:'Technik'};
  const merged=mergeCatalog([feed,extra],[curated],before);
  assert.deepEqual(merged.map(x=>x.id),[curated.id,'rss-2']);
});
test('expired source entries vanish from the live fashion feed while saved data can remain stored', () => {
  const current=normalizeCurated(fixture,before);
  assert.ok(!isExpired(current,before.getTime()));
  assert.ok(isExpired(current,after.getTime()));
  const ranked=rankFeed([current],'focus');
  // The fixture is in Nov 2026: do not assert a currently-live offer in future CI executions.
  assert.equal(ranked.length, isExpired(current) ? 0 : 1);
});
test('social-media manual shortcut and source-status display exist, no automatic mass posting', async () => {
  const [html,app,workflow]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../.github/workflows/scout.yml',import.meta.url),'utf8')
  ]);
  assert.ok(html.includes('id="pasteLinkButton"'));
  assert.ok(html.includes('streetweargiveaway'));
  assert.ok(app.includes("navigator.clipboard.readText()"));
  assert.ok(app.includes('sourceType'));
  assert.ok(app.includes('termsUrl'));
  assert.ok(workflow.includes('config/curated-offers.json'));
  assert.ok(workflow.includes('scripts/curated.mjs'));
});
