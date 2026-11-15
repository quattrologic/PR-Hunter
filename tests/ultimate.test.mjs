import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SEED_BRANDS, normalizeBrand, safeExternalUrl, validAccountLabel,
  makeActivity, rankFeed, activitySummary
} from '../docs/ultimate-core.mjs';

test('all five user-specified streetwear references exist as trusted profile URLs', () => {
  assert.deepEqual(SEED_BRANDS.map(brand => brand.handle), [
    'suvene.de','ranya.owt','6pm.update','moremoneymorelove.de','deputydepartment'
  ]);
  for (const brand of SEED_BRANDS) {
    assert.ok(brand.url.startsWith('https://www.instagram.com/'));
    assert.equal(normalizeBrand(brand.name,brand.url).handle,brand.handle);
  }
});
test('only direct Instagram profile links can be added as watchlist brands', () => {
  assert.equal(normalizeBrand('X','https://instagram.com/p/video1'),null);
  assert.equal(normalizeBrand('X','https://evil.example/x'),null);
  assert.equal(normalizeBrand('X','javascript:alert(1)'),null);
  assert.equal(normalizeBrand('X','https://instagram.com.evil.example/x'),null);
  const brand = normalizeBrand('New Brand','https://www.instagram.com/new.brand/?igsh=tracking');
  assert.deepEqual([brand.name,brand.handle,brand.url],[
    'New Brand','new.brand','https://www.instagram.com/new.brand/'
  ]);
});
test('safe links exclude URL credentials and active script protocols', () => {
  assert.equal(safeExternalUrl('https://user:password@example.com'),null);
  assert.equal(safeExternalUrl('javascript:alert(1)'),null);
  assert.equal(safeExternalUrl('http://example.org'),null);
  assert.equal(safeExternalUrl('https://example.org/a'),'https://example.org/a');
});
test('90/10 preference never invents offers and respects filters', () => {
  const fashion=Array.from({length:20},(_,i)=>({
    id:'f'+i,title:'Hoodie '+i,brand:'Brand',url:'https://example.org/f'+i,
    category:'Mode',published:'2026-11-13T08:00:00Z'
  }));
  const tech=Array.from({length:3},(_,i)=>({
    id:'t'+i,title:'Headphones '+i,url:'https://example.org/t'+i,
    category:'Technik',published:'2026-11-12T08:00:00Z'
  }));
  const other={id:'o',title:'Food',url:'https://example.org/o',category:'Lifestyle'};
  const ranked=rankFeed([...tech,other,...fashion]);
  assert.equal(ranked.length,23);
  assert.equal(ranked[9].category,'Technik');
  assert.equal(ranked[19].category,'Technik');
  assert.equal(rankFeed([other], 'focus').length,0);
  assert.equal(rankFeed([other], 'all').length,1);
  assert.deepEqual(rankFeed(tech,'focus').map(item=>item.id),['t0','t1','t2']);
  assert.equal(rankFeed([...tech,...fashion],'Mode','Hoodie').length,20);
});
test('activity entries are local records, not claims of automated posts', () => {
  assert.ok(validAccountLabel('@style.account'));
  assert.equal(validAccountLabel('admin@evil.example'),false);
  const date=new Date('2026-11-14T09:00:00Z');
  const log=makeActivity({
    offerId:'offer-1',type:'entered',account:'@style.account',
    note:'Unter Originalbeitrag selbst kommentiert',
    evidenceUrl:'https://www.instagram.com/p/abcdef/'
  },date);
  assert.equal(log.type,'entered');
  assert.equal(log.account,'style.account');
  assert.equal(log.createdAt,'2026-11-14T09:00:00.000Z');
  assert.equal(activitySummary([log]).entered,1);
  assert.equal(makeActivity({...log,type:'mass_post'}),null);
  assert.equal(makeActivity({...log,evidenceUrl:'javascript:alert(1)'}),null);
  assert.equal(makeActivity({...log,account:'a'.repeat(31)}),null);
});
test('new UI includes all required real panels and local action forms', async () => {
  const html=await readFile(new URL('../docs/index.html',import.meta.url),'utf8');
  for (const id of ['discoverPanel','brandsPanel','activityPanel','savedPanel','infoPanel','addForm','brandForm','activityForm','discoverCards','brandCards','activityList','sourceHealth'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(html.includes('./ultimate.css'));
  assert.ok(html.includes('type="module" src="./app.js?v=20"'));
  const app=await readFile(new URL('../docs/app.js',import.meta.url),'utf8');
  assert.ok(app.includes("const STORE = 'pr-hunter-state-v1'")); // no lost bookmarks on upgrade
  assert.ok(app.includes('navigator.clipboard.writeText'));
  assert.ok(!app.includes('instagram.com/api/v1'));
});
test('service worker includes every new module for offline shell', async () => {
  const sw=await readFile(new URL('../docs/sw.js',import.meta.url),'utf8');
  assert.ok(sw.includes('ultimate.css'));
  assert.ok(sw.includes('ultimate-core.mjs'));
  assert.ok(sw.includes('opportunities.json'));
});


test('browser scripts parse as JavaScript modules', async () => {
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  for (const filename of ['app.js','ultimate-core.mjs','sw.js']) {
    const path = fileURLToPath(new URL('../docs/' + filename, import.meta.url));
    const check = spawnSync(process.execPath, ['--check',path], {encoding:'utf8'});
    assert.equal(check.status, 0, filename + ': ' + check.stderr);
  }
});
