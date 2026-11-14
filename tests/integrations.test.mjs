import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  META_OPTIONS, INTEGRATION_STEPS, normalizeIntegrationSetup, integrationStatus,
  matchedPublicOffers, buildBrandSearchLink, sourceHealthSummary
} from '../docs/integrations.mjs';
import { backupDocument, parseBackup } from '../docs/phase4-core.mjs';
import { SEED_BRANDS } from '../docs/ultimate-core.mjs';

test('Meta readiness never invents an authorized Instagram connection', () => {
  const state=integrationStatus({});
  assert.equal(state.connected,false);
  assert.equal(state.checkedCount,0);
  assert.equal(state.missing.length,4);
  assert.equal(state.configuredForPlanning,false);
  const finished=integrationStatus({
    mode:'facebook_login',
    checked:INTEGRATION_STEPS.map(x=>x.id)
  });
  assert.equal(finished.mode,'facebook_login');
  assert.equal(finished.configuredForPlanning,true);
  assert.equal(finished.connected,false);
  assert.match(finished.label,/nicht verbunden/i);
});
test('only supported boolean readiness steps are stored; secrets cannot be expressed as scopes', () => {
  const value=normalizeIntegrationSetup({
    mode:'not_an_api',checked:['professional','professional','api_key','permissions','access_token']
  });
  assert.deepEqual(value,{mode:'instagram_login',checked:['professional','permissions']});
  assert.deepEqual(Object.keys(value).sort(),['checked','mode']);
});
test('actual capability grid does not offer automated participation in other users posts', () => {
  assert.equal(META_OPTIONS.instagram_login.needsPage,false);
  assert.equal(META_OPTIONS.facebook_login.needsPage,true);
  assert.ok(META_OPTIONS.instagram_login.unavailable.some(x=>x.includes('Liken')));
  assert.ok(META_OPTIONS.facebook_login.unavailable.some(x=>x.includes('Gewinnspielkommentare')));
  assert.ok(!META_OPTIONS.instagram_login.capabilities.some(x=>x.includes('Automatische Gewinnspielteilnahme')));
});
test('Brand Radar matches only actual offer titles and organizer text', () => {
  const six=SEED_BRANDS.find(x=>x.id==='6pm');
  const suvene=SEED_BRANDS.find(x=>x.id==='suvene');
  const mmml=SEED_BRANDS.find(x=>x.id==='mmml');
  const now=Date.parse('2026-11-14T16:00:00Z');
  const data=[
    {id:'x',title:'6PM Black Week: Store Credit',brand:'6PM',url:'https://6pmseason.com',category:'Mode',deadline:'2026-11-29T23:00:00Z',sourceType:'curated'},
    {id:'y',title:'Kalender gewinnen',brand:'',url:'https://example.org',description:'Suvene wird in einer Sidebar erwähnt',category:'Mode'},
    {id:'z',title:'Suvene Hoodie Giveaway',brand:'Suvene',url:'https://example.org',category:'Mode',deadline:'2026-11-12T23:00:00Z'},
    {id:'a',title:'More Money More Love Hoodie-Verlosung',brand:'',url:'https://example.org/a',category:'Mode'}
  ];
  assert.deepEqual(matchedPublicOffers(six,data,now).map(x=>x.id),['x']);
  assert.deepEqual(matchedPublicOffers(suvene,data,now),[]);
  assert.deepEqual(matchedPublicOffers(mmml,data,now).map(x=>x.id),['a']);
});
test('brand discover action uses a safe external search query, not fabricated Instagram results', () => {
  const url=buildBrandSearchLink(SEED_BRANDS.find(x=>x.id==='suvene'));
  assert.ok(url.startsWith('https://www.google.com/search?q='));
  assert.ok(decodeURIComponent(url).includes('suvene.de'));
  assert.equal(buildBrandSearchLink({handle:'',name:''}),null);
});
test('source diagnostics report genuine successful feeds and missing sources', () => {
  assert.deepEqual(sourceHealthSummary([]),{checked:0,succeeded:0,matching:0,broken:[]});
  assert.deepEqual(sourceHealthSummary([
    {name:'One',status:'ok',matching:4},
    {name:'Two',status:'http-403',matching:50},
    {name:'Three',status:'ok',matching:1}
  ]),{checked:3,succeeded:2,matching:5,broken:['Two']});
});
test('Meta checklist survives local backup roundtrip without any credential field', () => {
  const prefs={mode:'facebook_login',checked:['professional','app','backend','permissions']};
  const exported=backupDocument({saved:[],manual:[],integration:prefs},new Date('2026-11-14T15:00:00Z'));
  const parsed=parseBackup(exported);
  assert.deepEqual(parsed.integration,prefs);
  const malicious=JSON.stringify({
    format:'pr-hunter-local-backup',version:1,
    state:{integration:{mode:'unsafe',checked:['professional','access_token','app'],secret:'ABC123'}}
  });
  assert.deepEqual(parseBackup(malicious).integration,{mode:'instagram_login',checked:['professional','app']});
});
test('the connected UI is never faked; has real controls, source status and brand search', async () => {
  const [html,app,sw]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8')
  ]);
  for (const id of [
    'metaSetupProgress','metaCapabilities','metaSteps','metaGuidance',
    'sourceTotals','integrationSourceList','brandFilterMessage'
  ]) assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(html.includes('Instagram nicht verbunden'));
  assert.ok(app.includes('matchedPublicOffers(brand,ui.catalog)'));
  assert.ok(app.includes('sourceHealthSummary(ui.sourceStatus)'));
  assert.ok(app.includes('normalizeIntegrationSetup(state.integration)'));
  assert.ok(sw.includes('./integrations.mjs'));
  assert.ok(html.includes('id="backupPassword" type="password"')); // local-only encrypted backup passphrase
  assert.ok(!html.slice(html.indexOf('id="infoPanel"'),html.indexOf('id="infoPanel"')+4500).includes('type="password"'));
  assert.ok(!app.includes('fetch("https://graph.instagram.com'));
  for(const file of ['integrations.mjs','app.js','sw.js','phase4-core.mjs']) {
    const syntax=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../docs/'+file,import.meta.url))],{encoding:'utf8'});
    assert.equal(syntax.status,0,file+': '+syntax.stderr);
  }
});
