import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  normalizeAutoPrefs, evaluateWebsiteOffer, autoHunterReport, automaticEntryGate
} from '../docs/auto-hunter-core.mjs';
import { executeAllowedEntry } from '../scripts/allowed-entry-runner.mjs';
import { normalizeCurated } from '../scripts/curated.mjs';
import { buildPublicAutoReport } from '../scripts/auto-hunter.mjs';
import { backupDocument, parseBackup } from '../docs/phase4-core.mjs';

const now=Date.parse('2026-11-14T18:00:00Z');
const standard={
  id:'offer-1',url:'https://example.org/hoodie-giveaway',title:'Hoodie gewinnen',
  category:'Mode',sourceType:'curated',
  deadline:'2026-11-19T00:00:00Z',checkedOn:'2026-11-14',
  noPurchase:true,keepPrize:true,shipsToGermany:true,
  shippingCostEUR:0,
  costStatus:'Versand kostenlos',
  shippingStatus:'Deutschland laut Bedingungen erlaubt'
};
const allowed={
  ...standard,
  autoEntry:{
    allowed:true,adapterId:'verified-official-api',
    rulesUrl:'https://example.org/official-rules',
    reviewedAt:'2026-11-14T12:00:00Z'
  }
};
const adapters={
  'verified-official-api':{
    approved:true,endpoint:'https://example.org/api/entry',
    submit:async()=>({accepted:true,receiptId:'official-confirmation-55'})
  }
};
const consent={explicitOptIn:true,identityVerified:true,oneEntryPerPerson:true};
const identity={personId:'opaque-private-person-identifier-123'};
function store(){
  const active=new Map();
  return {
    active,
    async claimIfAbsent(key){
      if(active.has(key))return false;
      active.set(key,{status:'pending'});return true;
    },
    async finalize(key,receipt){active.set(key,{status:'submitted',receipt});},
    async release(key){active.delete(key);}
  };
}

test('the public Auto-Hunter defaults to automated scouting but never submits',()=>{
  const report=autoHunterReport([standard]);
  assert.equal(report.prefs.enabled,true);
  assert.equal(report.counts.found,1);
  assert.equal(report.counts.submitted,0);
  assert.equal(report.counts.automaticEntryReady,0);
  assert.equal(report.items[0].status,'verified-for-manual-entry');
  assert.equal(normalizeAutoPrefs({maxShippingEUR:500}).maxShippingEUR,5);
});
test('Instagram TikTok Facebook and expired actions are excluded from web automation',()=>{
  const inputs=[
    'https://www.instagram.com/p/ABCDE12/',
    'https://www.tiktok.com/@brand/video/123',
    'https://facebook.com/contest',
    'https://x.com/status/123'
  ];
  for(const url of inputs) {
    const result=evaluateWebsiteOffer({...standard,url},now);
    assert.equal(result.status,'excluded',url);
  }
  assert.equal(evaluateWebsiteOffer({...standard,deadline:'2026-11-12T00:00:00Z'},now).status,'excluded');
  assert.equal(evaluateWebsiteOffer({...standard,category:'Lifestyle'},now).status,'excluded');
});
test('unverified RSS and missing rules never become auto-approved entries',()=>{
  const rss={...standard,sourceType:'rss',deadline:undefined,shippingCostEUR:undefined};
  const result=evaluateWebsiteOffer(rss,now);
  assert.equal(result.status,'needs-review');
  assert.ok(result.warnings.some(x=>x.includes('Regeln')));
  assert.equal(automaticEntryGate(rss,adapters,consent,now).ready,false);
  assert.equal(automaticEntryGate(standard,adapters,consent,now).ready,false);
});
test('shipping over 5 €, required purchase or return obligation block eligibility',()=>{
  assert.equal(evaluateWebsiteOffer({...standard,shippingCostEUR:6},now).status,'excluded');
  assert.equal(evaluateWebsiteOffer({...standard,noPurchase:false},now).status,'excluded');
  assert.equal(evaluateWebsiteOffer({...standard,keepPrize:false},now).status,'excluded');
  assert.equal(automaticEntryGate({...allowed,shippingCostEUR:6},adapters,consent,now).ready,false);
  assert.equal(automaticEntryGate({...allowed,shipsToGermany:null},adapters,consent,now).ready,false);
});
test('explicit, current organizer permission, official adapter and consent are all mandatory',()=>{
  assert.equal(automaticEntryGate(allowed,adapters,consent,now).ready,true);
  const checks=[
    automaticEntryGate(allowed,{},consent,now),
    automaticEntryGate(allowed,adapters,{},now),
    automaticEntryGate(allowed,adapters,{...consent,oneEntryPerPerson:false},now),
    automaticEntryGate({...allowed,autoEntry:{...allowed.autoEntry,allowed:false}},adapters,consent,now),
    automaticEntryGate({...allowed,checkedOn:'2026-08-01'},adapters,consent,now),
    automaticEntryGate({...allowed,autoEntry:{...allowed.autoEntry,reviewedAt:'2026-08-01'}},adapters,consent,now),
    automaticEntryGate({...allowed,autoEntry:{...allowed.autoEntry,rulesUrl:'javascript:alert(1)'}},adapters,consent,now),
    automaticEntryGate(allowed,{'verified-official-api':{...adapters['verified-official-api'],endpoint:'https://another-host.org/api'}},consent,now)
  ];
  assert.ok(checks.every(x=>!x.ready && x.reasons.length>0));
});
test('a private official provider API can return a real receipt once; duplicate is blocked atomically',async()=>{
  const receiptStore=store();
  const args={offer:allowed,adapters,consent,identity,receiptStore,now};
  const first=await executeAllowedEntry(args);
  assert.equal(first.status,'submitted');
  assert.equal(first.receipt.receiptId,'official-confirmation-55');
  const second=await executeAllowedEntry(args);
  assert.equal(second.status,'duplicate');
  assert.equal(receiptStore.active.size,1);
  const differentAccountSamePerson=await executeAllowedEntry({...args,identity:{personId:identity.personId,account:'extra'}});
  assert.equal(differentAccountSamePerson.status,'duplicate');
});
test('no provider, no user opt-in, no encrypted server receipt store means zero entries',async()=>{
  const missingStore=await executeAllowedEntry({offer:allowed,adapters,consent,identity,now});
  assert.equal(missingStore.status,'blocked');
  const noConsent=await executeAllowedEntry({offer:allowed,adapters,consent:{},identity,receiptStore:store(),now});
  assert.equal(noConsent.status,'blocked');
  const noAdapter=await executeAllowedEntry({offer:allowed,adapters:{},consent,identity,receiptStore:store(),now});
  assert.equal(noAdapter.status,'blocked');
  const failed=await executeAllowedEntry({
    offer:allowed,adapters:{'verified-official-api':{...adapters['verified-official-api'],
      submit:async()=>{throw Error('timeout');}}},
    consent,identity,receiptStore:store(),now
  });
  assert.equal(failed.status,'unknown');
  const reserve=store();
  const incomplete=await executeAllowedEntry({
    offer:allowed,adapters:{'verified-official-api':{...adapters['verified-official-api'],
      submit:async()=>({accepted:true})}},
    consent,identity,receiptStore:reserve,now
  });
  assert.equal(incomplete.status,'unknown');
  assert.equal(reserve.active.size,1); // no retry if receipt is ambiguous

});
test('officially reviewed offers carry conservative missing-cost and permission fields',()=>{
  const item=normalizeCurated({
    brand:'Brand',title:'Hoodie-Gewinnspiel',url:'https://example.org/contest',
    termsUrl:'https://example.org/terms',deadline:'2026-11-19T12:00:00Z',
    checkedOn:'2026-11-14',category:'Mode',noPurchase:true,keepPrize:true,
    shipsToGermany:true,costStatus:'Kosten nicht bestätigt',method:'Webformular'
  },new Date(now));
  assert.equal(item.noPurchase,true);
  assert.equal(item.keepPrize,true);
  assert.equal(item.shipsToGermany,true);
  assert.equal(item.shippingCostEUR,null);
  assert.equal(item.autoEntry,null);
  assert.equal(automaticEntryGate(item,adapters,consent,now).ready,false);
});
test('automated GitHub report contains public metadata but no personal submissions',async()=>{
  const report=await buildPublicAutoReport({opportunities:[standard,{...standard,id:'x',sourceType:'rss',category:'Technik'}]},new Date(now));
  assert.equal(report.automaticSubmissionsEnabled,false);
  assert.equal(report.providerAdaptersActive,0);
  assert.equal(report.counts.submitted,0);
  assert.equal(report.counts.found,2);
  assert.equal(report.items.length,2);
  assert.equal(report.items[0].category,'Mode');
  assert.equal(report.scope,'public-website-discovery-only');
});
test('personal auto settings survive local backup and cannot increase shipping cap',()=>{
  const parsed=parseBackup(backupDocument({autoPrefs:{
    enabled:true,clothingFirst:true,includeTech:false,maxShippingEUR:999
  }}));
  assert.deepEqual(parsed.autoPrefs,{
    enabled:true,clothingFirst:true,includeTech:false,maxShippingEUR:5
  });
});
test('Phase 8 UI and scheduled unattended Auto-Hunter scan are wired without secrets',async()=>{
  const [html,app,sw,workflow,pkg,script]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8'),
    readFile(new URL('../.github/workflows/scout.yml',import.meta.url),'utf8'),
    readFile(new URL('../package.json',import.meta.url),'utf8'),
    readFile(new URL('../scripts/allowed-entry-runner.mjs',import.meta.url),'utf8')
  ]);
  for(const id of ['autoPanel','autoHunterList','autoScanned','autoReview','autoReadyManual',
    'autoSubmitted','autoRefreshButton','autoHunterEnabled','autoHunterTech','autoSourceLabel'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(app.includes('autoHunterReport(ui.catalog,settings)'));
  assert.ok(app.includes('renderAutoHunter()'));
  assert.ok(app.includes('showParticipationDialog(item)'));
  assert.ok(workflow.includes('cron: "14 */6 * * *"'));
  assert.ok(workflow.includes('npm run auto-scan'));
  assert.ok(workflow.includes('docs/auto-hunter.json'));
  assert.ok(JSON.parse(pkg).scripts['auto-scan']);
  assert.ok(sw.includes('./auto-hunter-core.mjs'));
  assert.ok(script.includes('receiptStore.claimIfAbsent'));
  assert.ok(!script.includes('process.env.INSTAGRAM_PASSWORD'));
  for (const filename of ['auto-hunter-core.mjs','app.js','sw.js']) {
    const path=fileURLToPath(new URL('../docs/'+filename,import.meta.url));
    const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
    assert.equal(check.status,0,filename+': '+check.stderr);
  }
});
