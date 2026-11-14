import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  FEED_PAGE_SIZE, DISPLAY_MODES, normalizeDisplayPrefs,
  getVisibleSlice, offerVerification, shouldAnimate
} from '../docs/phase7-core.mjs';
import { backupDocument, parseBackup } from '../docs/phase4-core.mjs';

const fixedTime=Date.parse('2026-11-14T20:00:00Z');
const curated={
  title:'Hochwertiges Hoodie-Gewinnspiel',
  sourceType:'curated',
  deadline:'2026-11-18T00:00:00Z',
  shippingStatus:'Deutschland laut Bedingungen erlaubt',
  costStatus:'Gewinnbedingte Folgekosten können beim Gewinner liegen'
};
test('progressive loading caps the initial feed and never invents offers',()=>{
  const input=Array.from({length:53},(_,i)=>({id:'offer-'+i}));
  const first=getVisibleSlice(input);
  assert.equal(FEED_PAGE_SIZE,18);
  assert.equal(first.total,53);
  assert.equal(first.items.length,18);
  assert.equal(first.remaining,35);
  assert.equal(first.nextVisible,36);
  assert.equal(getVisibleSlice(input,36).items.length,36);
  assert.equal(getVisibleSlice(input,54).items.length,53);
  assert.equal(getVisibleSlice([],18).total,0);
  assert.equal(getVisibleSlice(input,-2).items.length,18);
  assert.equal(getVisibleSlice(input,NaN).items.length,18);
  assert.equal(getVisibleSlice(input,18,999999).items.length,18);
  assert.equal(getVisibleSlice(null,50).total,0);
});
test('verification labels never imply that raw RSS and Instagram imports are confirmed offers',()=>{
  const ig=offerVerification({
    sourceType:'manual',url:'https://www.instagram.com/reel/ABCDE12/',
    title:'Instagram-Beitrag – Gewinnspiel selbst prüfen'
  },fixedTime);
  assert.equal(ig.status,'unverified');
  assert.ok(ig.problems.some(x=>x.includes('nicht unabhängig geprüft')));
  assert.ok(ig.problems.some(x=>x.includes('Frist')));
  const rss=offerVerification({sourceType:'rss',title:'Fund'},fixedTime);
  assert.equal(rss.status,'unverified');
});
test('curated source evidence is not the same as free shipping or prize quality',()=>{
  const reviewed=offerVerification(curated,fixedTime);
  assert.equal(reviewed.status,'reviewed-with-open-questions');
  assert.ok(reviewed.problems.some(x=>x.includes('Folgekosten')));
  const unknown=offerVerification({...curated,shippingStatus:'Deutschlandversand unbestätigt'},fixedTime);
  assert.ok(unknown.problems.some(x=>x.includes('Deutschlandversand')));
  const old=offerVerification({...curated,deadline:'2026-11-10T10:00:00Z'},fixedTime);
  assert.equal(old.status,'expired');
  const clear=offerVerification({...curated,costStatus:'0 EUR Versand (laut Bedingungen)'},fixedTime);
  assert.equal(clear.status,'reviewed');
  assert.equal(offerVerification(null).status,'unknown');
});
test('motion mode defaults to OS-controlled, never overrides reduced-motion preference',()=>{
  assert.deepEqual(DISPLAY_MODES,['system','smooth','reduced']);
  assert.deepEqual(normalizeDisplayPrefs({motion:'smooth'}),{motion:'smooth'});
  assert.deepEqual(normalizeDisplayPrefs({motion:'javascript:bad'}),{motion:'system'});
  assert.deepEqual(normalizeDisplayPrefs({motion:'reduced'}),{motion:'reduced'});
  assert.deepEqual(normalizeDisplayPrefs(null),{motion:'system'});
  assert.equal(shouldAnimate('smooth',true),false);
  assert.equal(shouldAnimate('smooth',false),true);
  assert.equal(shouldAnimate('reduced',false),false);
  assert.equal(shouldAnimate('system',true),false);
});
test('display preference roundtrips safely inside older backups',()=>{
  const original={saved:['old'],manual:[],display:{motion:'reduced'}};
  const saved=parseBackup(backupDocument(original,new Date('2026-11-14T15:00:00Z')));
  assert.deepEqual(saved.display,{motion:'reduced'});
  assert.deepEqual(parseBackup(backupDocument({display:{motion:'not-supported'}})).display,{motion:'system'});
  assert.deepEqual(parseBackup(backupDocument({saved:[]})).display,{motion:'system'});
});
test('Phase 7 iPad UI shows accessible motion settings, offline status and progressive feed',async()=>{
  const [html,app,css,sw,readme]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/ultimate.css',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8'),
    readFile(new URL('../README.md',import.meta.url),'utf8')
  ]);
  for(const marker of [
    'class="skip-link"','id="connectionStatus"','id="feedResultCount"',
    'name="motionMode" type="radio" value="system"',
    'name="motionMode" type="radio" value="smooth"',
    'name="motionMode" type="radio" value="reduced"'
  ]) assert.ok(html.includes(marker),marker);
  assert.ok(app.includes('getVisibleSlice(feed,ui.visibleFeed)'));
  assert.ok(app.includes('getVisibleSlice(getSaved(),ui.visibleSaved)'));
  assert.ok(app.includes('setTimeout(() => {'));
  assert.ok(app.includes('offerVerification(item)'));
  assert.ok(app.includes('state.display = normalizeDisplayPrefs(state.display)'));
  assert.ok(app.includes('document.documentElement.dataset.motion'));
  assert.ok(app.includes("window.addEventListener('offline',updateConnectionStatus)"));
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.ok(css.includes('html[data-motion="reduced"]'));
  assert.ok(css.includes('.skip-link:focus-visible'));
  assert.ok(css.includes('.sidebar .nav{overflow-x:auto'));
  assert.ok(sw.includes("'./phase7-core.mjs'"));
  assert.ok(sw.includes("key.startsWith(CACHE_PREFIX) && key !== CACHE"));
  assert.ok(sw.includes("req.mode === 'navigate'"));
  assert.ok(sw.includes("cache.match('./index.html')"));
  assert.ok(!sw.includes('cache.addAll(["./opportunities.json"'));
  assert.ok(readme.includes('Phase 7'));
  for(const file of ['phase7-core.mjs','phase4-core.mjs','app.js','sw.js']){
    const path=fileURLToPath(new URL('../docs/'+file,import.meta.url));
    const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
    assert.equal(check.status,0,file+': '+check.stderr);
  }
});
