import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  OFFICIAL_PROGRAMS, PROGRAM_STATES, PROGRAM_STATE_LABELS,
  normalizeFreeProductPrefs, normalizeProgramProgress,
  programWarnings, rankPrograms, classifyOpportunity, classifyPublicLeads,
  programMessage, programStats
} from '../docs/free-products.mjs';
import { backupDocument, parseBackup } from '../docs/phase4-core.mjs';
import { createFreeProductsSnapshot } from '../scripts/free-products-scan.mjs';

const today=Date.parse('2026-11-14T15:00:00Z');
const sample=(id,title,category='Mode',extra={})=>({
  id,title,category,url:'https://example.org/'+id,
  sourceType:'rss',published:'2026-11-14T11:00:00Z',...extra
});

test('public directory has real distinct official program URLs, no fake active campaign data',()=>{
  assert.ok(OFFICIAL_PROGRAMS.length>=6);
  assert.equal(new Set(OFFICIAL_PROGRAMS.map(p=>p.id)).size,OFFICIAL_PROGRAMS.length);
  assert.equal(new Set(OFFICIAL_PROGRAMS.map(p=>p.url)).size,OFFICIAL_PROGRAMS.length);
  for(const program of OFFICIAL_PROGRAMS){
    assert.match(program.url,/^https:\/\//);
    assert.ok(Number.isFinite(Date.parse(program.checkedOn)));
    assert.ok(['creator','product_test'].includes(program.type));
    assert.ok(['Mode','Gemischt'].includes(program.category));
    assert.notEqual(program.freeProducts,'guaranteed');
    assert.ok(!('applicationSubmitted' in program));
    assert.ok(program.overview.length>20);
  }
  assert.ok(OFFICIAL_PROGRAMS.some(p=>p.id==='trnd'));
  assert.ok(OFFICIAL_PROGRAMS.some(p=>p.id==='influenster'));
  assert.ok(OFFICIAL_PROGRAMS.some(p=>p.id==='hey-marly'));
});
test('HEYMarly age and creator responsibilities are never concealed',()=>{
  const hey=OFFICIAL_PROGRAMS.find(x=>x.id==='hey-marly');
  const issues=programWarnings(hey,today);
  assert.ok(issues.some(x=>x.includes('18 Jahren')));
  assert.ok(issues.some(x=>x.includes('Content')));
  assert.ok(issues.some(x=>x.includes('Versand')));
  assert.ok(issues.some(x=>x.includes('Behalten')));
});
test('high follower requirements are shown and can be excluded without inventing eligibility',()=>{
  const humble=OFFICIAL_PROGRAMS.find(x=>x.id==='humble-ambassador');
  const yfm=OFFICIAL_PROGRAMS.find(x=>x.id==='yfm-ambassador');
  assert.equal(humble.minFollowers,1000);
  assert.equal(yfm.minFollowers,2000);
  assert.ok(programWarnings(yfm,today).some(x=>x.includes('2.000')));
  const beginner=rankPrograms(OFFICIAL_PROGRAMS,{showFollowerRestricted:false},today);
  assert.ok(!beginner.some(x=>x.id==='humble-ambassador' || x.id==='yfm-ambassador'));
  assert.ok(beginner.some(x=>x.id==='hey-marly'));
});
test('per-program keep conditions are distinct, not all promised',()=>{
  assert.ok(programWarnings(OFFICIAL_PROGRAMS.find(x=>x.id==='trnd'),today)
    .some(x=>x.includes('manchen Projekten')));
  assert.ok(OFFICIAL_PROGRAMS.find(x=>x.id==='forme').keepPrize==='yes_per_campaign');
  assert.ok(OFFICIAL_PROGRAMS.find(x=>x.id==='seame-creator').freeProducts==='possible');
});
test('fashion first is ranking only, not fabricated supply or fixed ratio',()=>{
  const ranked=rankPrograms(OFFICIAL_PROGRAMS,{},today);
  const firstMixed=ranked.findIndex(x=>x.category==='Gemischt');
  const lastMode=ranked.map(x=>x.category).lastIndexOf('Mode');
  assert.ok(firstMixed>lastMode);
  assert.equal(normalizeFreeProductPrefs({view:'invalid'}).view,'all');
  assert.equal(rankPrograms(OFFICIAL_PROGRAMS,{view:'creator'}).every(x=>x.type==='creator'),true);
  assert.equal(rankPrograms(OFFICIAL_PROGRAMS,{view:'product_test'}).every(x=>x.type==='product_test'),true);
  assert.equal(rankPrograms(OFFICIAL_PROGRAMS,{view:'giveaway'}).length,0);
});
test('actual RSS offers classified as tests, creator calls, giveaways or unknown',()=>{
  assert.equal(classifyOpportunity(sample('a','Hoodie Produkttest jetzt bewerben')),'product_test');
  assert.equal(classifyOpportunity(sample('b','Streetwear Ambassador gesucht')),'creator');
  assert.equal(classifyOpportunity(sample('c','Sneaker Gewinnspiel')),'giveaway');
  assert.equal(classifyOpportunity(sample('d','Neue Jacke im Laden')),'unknown');
});
test('automatically found public leads exclude expired, unrelated and duplicate URLs',()=>{
  const data=[
    sample('a','Streetwear Produkttest'),
    sample('b','Kopfhörer Gewinnspiel','Technik'),
    sample('c','Sneaker giveaway','Mode',{deadline:'2026-11-11T00:00:00Z'}),
    sample('d','Lifestyle Gewinnspiel','Sonstiges'),
    sample('e','Keine Aktion'),
    sample('dup','Streetwear Produkttest','Mode',{url:'https://example.org/a'})
  ];
  const all=classifyPublicLeads(data,{},today);
  assert.deepEqual(all.map(x=>x.id),['a','b']);
  assert.equal(all[0].leadKind,'product_test');
  assert.ok(all.every(x=>x.reviewNeeded===true));
  const justGiveaways=classifyPublicLeads(data,{view:'giveaway'},today);
  assert.deepEqual(justGiveaways.map(x=>x.id),['b']);
});
test('application drafts are honest, manual, and never invent follower figures',()=>{
  const creator=OFFICIAL_PROGRAMS.find(x=>x.id==='humble-ambassador');
  const draft=programMessage(creator);
  assert.ok(draft.includes('HUMBLE'));
  assert.ok(draft.includes('Nutzungsrechte'));
  assert.ok(draft.includes('[Vorname]'));
  assert.ok(!draft.includes('1.000 Follower'));
  assert.ok(!draft.includes('garantiert'));
  assert.equal(programMessage(OFFICIAL_PROGRAMS.find(x=>x.id==='trnd')),null);
});
test('applying and receiving a product requires self-reported status, not a fabricated result',()=>{
  assert.ok(PROGRAM_STATES.includes('applied'));
  assert.ok(PROGRAM_STATES.includes('received'));
  assert.match(PROGRAM_STATE_LABELS.received,/selbst bestätigt/);
  const progress=normalizeProgramProgress({
    'seame-creator':{status:'applied',updatedAt:'2026-11-14T15:00:00Z'},
    trnd:{status:'received',updatedAt:'2026-11-14T18:00:00Z'},
    'fake':{status:'received'},
    'hey-marly':{status:'automatic-success'}
  });
  assert.equal(Object.keys(progress).length,2);
  const summary=programStats(progress);
  assert.equal(summary.applied,2);
  assert.equal(summary.accepted,1);
  assert.equal(summary.received,1);
  assert.equal(programStats({}).received,0);
});
test('program statuses and filters remain private, backup compatible and safely validated',()=>{
  const raw={programProgress:{
    'seame-creator':{status:'applied',updatedAt:'2026-11-14T15:00:00Z'},
    'unknown':{status:'received'}
  },freePrefs:{view:'creator',prioritiseClothing:true,showFollowerRestricted:false}};
  const restored=parseBackup(backupDocument(raw,new Date(today)));
  assert.equal(restored.programProgress['seame-creator'].status,'applied');
  assert.ok(!restored.programProgress['unknown']);
  assert.deepEqual(restored.freePrefs,{view:'creator',prioritiseClothing:true,showFollowerRestricted:false});
  const old=parseBackup(backupDocument({saved:['old']}));
  assert.deepEqual(old.freePrefs,{view:'all',prioritiseClothing:true,showFollowerRestricted:true});
  assert.equal(programStats(old.programProgress).applied,0);
});
test('scheduled snapshot does not imply directory pages were rechecked live',()=>{
  const catalog={generatedAt:'2026-11-14T14:00:00Z',opportunities:[
    sample('a','Streetwear Produkttest'),
    sample('b','Sneaker Giveaway'),
    sample('c','Werbeartikel')
  ]};
  const report=createFreeProductsSnapshot(catalog,new Date(today));
  assert.equal(report.programDirectoryReviewNotLive,true);
  assert.equal(report.automatedApplications,false);
  assert.equal(report.applied,0);
  assert.equal(report.received,0);
  assert.equal(report.programCount,OFFICIAL_PROGRAMS.length);
  assert.equal(report.opportunityCount,2);
  assert.equal(report.opportunityTypes.productTests,1);
  assert.equal(report.opportunityTypes.giveaways,1);
  assert.equal(report.opportunityTypes.collaborations,0);
  assert.ok(report.programs.every(x=>x.checkedOn==='2026-11-14'));
  assert.ok(!JSON.stringify(report).includes('userPassword'));
});
test('Phase 9 frontend and GitHub scheduled scan are wired',async()=>{
  const [html,app,sw,workflow,pkg,readme]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8'),
    readFile(new URL('../.github/workflows/scout.yml',import.meta.url),'utf8'),
    readFile(new URL('../package.json',import.meta.url),'utf8'),
    readFile(new URL('../README.md',import.meta.url),'utf8')
  ]);
  for(const id of ['productsPanel','freeProgramCards','freeLiveLeads','freeHideFollower',
    'freeProgramCount','freeAppliedCount','freeAcceptedCount','freeReceivedCount','freeProductsRefresh'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(html.includes('data-tab="products"'));
  assert.ok(html.includes('data-free-filter="creator"'));
  assert.ok(html.includes('data-free-filter="product_test"'));
  assert.ok(html.includes('data-free-filter="giveaway"'));
  assert.ok(html.includes('selbst bestätigt'));
  assert.ok(app.includes('renderFreeProducts()'));
  assert.ok(app.includes('programMessage(program)'));
  assert.ok(app.includes('normalizeProgramProgress'));
  assert.ok(app.includes('window.confirm('));
  assert.ok(sw.includes('./free-products.mjs'));
  assert.ok(workflow.includes('npm run free-products-scan'));
  assert.ok(workflow.includes('docs/free-products-report.json'));
  assert.equal(JSON.parse(pkg).scripts['free-products-scan'],'node scripts/free-products-scan.mjs');
  assert.ok(readme.includes('Phase 9'));
  for(const file of ['free-products.mjs','app.js','phase4-core.mjs','sw.js']){
    const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../docs/'+file,import.meta.url))],{encoding:'utf8'});
    assert.equal(result.status,0,file+': '+result.stderr);
  }
});
