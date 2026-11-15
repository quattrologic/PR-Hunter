import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  SCOUT_VIEWS,normalizeScoutPrefs,setScoutView,dismissScoutReel,dismissScoutBrand,
  inspectScoutCaption,assessScoutReel,buildSmartScout,smartBrandSuggestions
} from '../docs/smart-scout.mjs';
import {backupDocument,parseBackup} from '../docs/phase4-core.mjs';

const NOW=Date.parse('2026-11-15T12:00:00Z');
const DATE='2026-11-14T09:00:00Z';
const url=id=>'https://www.instagram.com/reel/'+id+'/';
const reel=(brand,id,caption,other={})=>({
  brand,url:url(id),caption,publishedAt:DATE,...other
});
test('caption signals are cautious, distinguishing a free mention from a confirmed invitation',()=>{
  const a=inspectScoutCaption('Send us this reel for your chance to win a free hoodie.');
  assert.equal(a.mentionsDm,true);
  assert.equal(a.mentionsFree,true);
  assert.equal(a.asksForPayment,false);
  const b=assessScoutReel({score:25,brand:'prohibitedclo',category:'Kleidung',
    signal:'invitation',caption:'Send us this reel to win a free hoodie!'},['suvene.de']);
  assert.equal(b.kind,'dm');
  assert.equal(b.isNew,true);
  assert.equal(b.confirmedFree,false);
  assert.equal(b.eligibleForUser,false);
  assert.ok(b.reasons.includes('Video-DM-Hinweis'));
  const c=assessScoutReel({score:15,brand:'suvene.de',category:'Kleidung',
    signal:'free-mention',caption:'Free hoodie giveaway'},['suvene.de']);
  assert.equal(c.kind,'free');
  assert.equal(c.isNew,false);
});
test('costs, creator restrictions, ended events and regions are explicit flags and scored down',()=>{
  const good=assessScoutReel({
    score:30,brand:'brand',category:'Kleidung',
    signal:'invitation',caption:'Send us this Reel for a FREE hoodie giveaway'
  },[]);
  const bad=assessScoutReel({
    score:30,brand:'brand',category:'Kleidung',
    signal:'invitation',caption:'Send us this Reel for a FREE hoodie giveaway. Shipping fee. Creators only. Giveaway ended. US only.'
  },[]);
  assert.equal(good.kind,'dm');
  assert.equal(bad.warnings.length,4);
  assert.ok(bad.warnings.some(x=>x.includes('Kosten')));
  assert.ok(bad.warnings.some(x=>x.includes('Creator')));
  assert.ok(bad.warnings.some(x=>x.includes('beendet')));
  assert.ok(bad.warnings.some(x=>x.includes('eingeschränkt')));
  assert.ok(bad.score<good.score);
  assert.equal(bad.confirmedFree,false);
});
test('local filter and skip lists use bounded, canonical URLs and handles only',()=>{
  const p=normalizeScoutPrefs({
    view:'dm',
    hiddenReels:[url('AAA11111')+'?igsh=x',url('AAA11111'),'javascript:alert(1)'],
    hiddenBrands:['@prohibitedclo','prohibitedclo','suvene.de.evil/redirect']
  });
  assert.equal(p.view,'dm');
  assert.deepEqual(p.hiddenReels,[url('AAA11111')]);
  assert.deepEqual(p.hiddenBrands,['prohibitedclo']);
  assert.equal(setScoutView(p,'not-real').view,'all');
  const newP=dismissScoutReel(p,url('BBB22222'));
  assert.deepEqual(newP.hiddenReels,[url('BBB22222'),url('AAA11111')]);
  assert.equal(dismissScoutReel(p,'https://evil.example/').hiddenReels.length,1);
  assert.deepEqual(dismissScoutBrand(p,'@brkdwn.studios').hiddenBrands,
    ['brkdwn.studios','prohibitedclo']);
  assert.equal(normalizeScoutPrefs({hiddenReels:Array.from({length:220},(_,i)=>url('REC'+i+'ABCD'))}).hiddenReels.length,150);
  assert.deepEqual(SCOUT_VIEWS,['all','dm','free','new']);
});
test('ranking uses actual official URLs, not generic search results or scraped guesses',()=>{
  const found=buildSmartScout({
    reels:[
      reel('lowlightsstudios','LOW123456','Send us this reel and win a free hoodie'),
      reel('reternity','RET123456','Introducing our latest denim jacket'),
      reel('prohibitedclo','PRO123456','Free giveaway graphic tee'),
      reel('fake','OLD123456','Giveaway ended - shipping fee. US only', {publishedAt:'2026-09-01T10:00:00Z'})
    ],
    savedBrands:['suvene.de'],
    savedReels:[{brand:'lowlightsstudios',url:url('OTHER987')}]
  },NOW);
  assert.equal(found.counts.all,3);
  assert.equal(found.counts.dm,1);
  assert.equal(found.counts.free,2);
  assert.ok(found.items[0].score>=found.items[1].score);
  assert.ok(found.items.every(x=>x.url.startsWith('https://www.instagram.com/reel/')));
  assert.ok(found.items.every(x=>x.confirmedFree===false));
  const dm=buildSmartScout({
    reels:[reel('lowlightsstudios','LOW123456','Send us this reel and win a free hoodie'),
      reel('reternity','RET123456','Introducing our latest denim jacket')],
    savedBrands:['suvene.de'],prefs:{view:'dm'}
  },NOW);
  assert.equal(dm.items.length,1);
  assert.equal(dm.items[0].kind,'dm');
  const hidden=buildSmartScout({
    reels:[reel('lowlightsstudios','LOW123456','Send us this reel and win a free hoodie')],
    savedBrands:['suvene.de'],prefs:{hiddenReels:[url('LOW123456')]}
  },NOW);
  assert.equal(hidden.items.length,0);
  assert.equal(hidden.counts.all,0);
});
test('small-label suggestions react to learned references and dismissals',()=>{
  const initial=smartBrandSuggestions({savedBrands:['suvene.de']},12);
  assert.ok(initial.some(x=>x.handle==='lowlightsstudios'));
  assert.ok(initial.some(x=>x.handle==='prohibitedclo'));
  const later=smartBrandSuggestions({
    savedBrands:['suvene.de','lowlightsstudios'],
    prefs:{hiddenBrands:['prohibitedclo']}
  },12);
  assert.ok(!later.some(x=>x.handle==='lowlightsstudios'));
  assert.ok(!later.some(x=>x.handle==='prohibitedclo'));
  assert.notDeepEqual(initial.map(x=>x.handle),later.map(x=>x.handle));
});
test('feedback is preserved in existing backups and old backups remain importable',()=>{
  const pref=dismissScoutBrand(dismissScoutReel(
    setScoutView({},'free'),url('REEL56789')),'prohibitedclo');
  const saved=backupDocument({savedReels:[],scoutPrefs:pref});
  const restored=parseBackup(saved);
  assert.deepEqual(restored.scoutPrefs,pref);
  assert.deepEqual(parseBackup(backupDocument({savedReels:[]})).scoutPrefs,
    {view:'all',hiddenReels:[],hiddenBrands:[]});
});
test('Phase 16 visible iPad filter, watch, hide controls and offline module are wired',async()=>{
  const [html,app,css,sw,readme]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/instagram-white.css',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8'),
    readFile(new URL('../README.md',import.meta.url),'utf8')
  ]);
  for(const filter of SCOUT_VIEWS)assert.ok(html.includes('data-scout-view="'+filter+'"'));
  assert.ok(app.includes('buildSmartScout('));
  assert.ok(app.includes('smartBrandSuggestions('));
  assert.ok(app.includes('dismissScoutReel('));
  assert.ok(app.includes('dismissScoutBrand('));
  assert.ok(app.includes('normalizeScoutPrefs(state.scoutPrefs)'));
  assert.ok(app.includes("if(action==='scout-hide-reel')"));
  assert.ok(app.includes("if(action==='scout-hide-brand'||action==='scout-save-brand')"));
  assert.ok(app.includes('mountInstagramAutoPreviews();'));
  assert.ok(css.includes('.smart-scout-filters'));
  assert.ok(css.includes('.smart-brand-choice'));
  assert.ok(sw.includes("CACHE_PREFIX + 'v26'"));
  assert.ok(sw.includes("'./smart-scout.mjs'"));
  assert.ok(html.includes('app.js?v=25'));
  assert.ok(readme.includes('Smart Video Scout, filtering and local learning'));
  for(const path of ['smart-scout.mjs','app.js','phase4-core.mjs','sw.js']){
    const cmd=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../docs/'+path,import.meta.url))],{encoding:'utf8'});
    assert.equal(cmd.status,0,path+': '+cmd.stderr);
  }
});
