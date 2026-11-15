import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  dmScoutSignal,instagramDmLink,dmScoutText,dmScoutCandidates,
  dmScoutProspects,PUBLIC_SMALL_BRAND_WATCH
} from '../docs/dm-scout.mjs';
import {addDmDraft} from '../docs/dm-assistant.mjs';

const NOW=Date.parse('2026-11-15T10:30:00Z');
const post='https://www.instagram.com/reel/ABC12345678/';
const yesterday='2026-11-14T10:00:00Z';
const official={brand:'brkdwn.studios',url:post,
  caption:'We are a small streetwear brand. Send us this reel and win a free hoodie!',
  publishedAt:yesterday};
test('the scanner recognizes actual free-video instructions, never silently creates one',()=>{
  assert.equal(dmScoutSignal(official.caption),'invitation');
  assert.equal(dmScoutSignal('DM us this reel to find out more'),'send-request');
  assert.equal(dmScoutSignal('Free hoodie giveaway but sign up online'),'free-mention');
  assert.equal(dmScoutSignal('Shop our new collection this Friday'),'none');
  assert.equal(dmScoutSignal('Just an image of sneakers'),'none');
  assert.equal(dmScoutSignal('Sende uns dieses Video und gewinne ein kostenloses Outfit'),'invitation');
});
test('a direct Meta ig.me chat link is built from the verified handle only',()=>{
  assert.equal(instagramDmLink('@brkdwn.studios'),'https://ig.me/m/brkdwn.studios');
  assert.equal(instagramDmLink('6pm.update'),'https://ig.me/m/6pm.update');
  for(const value of ['a?text=hello','https://evil.example/m/who','@../evil','a..b',null]){
    assert.equal(instagramDmLink(value),null);
  }
});
test('fan-mode DM is personal and factual: no content-creator claim, no fabricated shipping guarantee',()=>{
  const text=dmScoutText({brand:'brkdwn.studios',reelUrl:post,signal:'invitation'});
  assert.ok(text.includes('I’m not a content creator'));
  assert.ok(text.includes(post));
  assert.ok(text.includes('open to regular followers too?'));
  assert.ok(!text.includes('free shipping'));
  const unknown=dmScoutText({brand:'brkdwn.studios',reelUrl:post,signal:'unverified'});
  assert.ok(unknown.includes('Are you offering any free pieces'));
  assert.ok(!unknown.includes('the offer open'));
  assert.ok(dmScoutText({brand:'brkdwn.studios',reelUrl:post,signal:'unverified'},'de').includes('kein Creator'));
  assert.equal(dmScoutText({brand:'evil.com/spoof',reelUrl:post}),null);
  assert.equal(dmScoutText({brand:'legit',reelUrl:'https://evil.example/'}),null);
});
test('official Meta captions take precedence over local duplicates and only actual URLs create leads',()=>{
  const results=dmScoutCandidates({
    officialReels:[official],
    savedReels:[{brand:'brkdwn.studios',url:post},{brand:'other',url:'https://instagram.com/p/Other456789/' }],
    drafts:[{brand:'brkdwn.studios',reelUrl:post}],
    publicOffers:[{brand:'fictional',url:'https://example.com/free-hoodie'}]
  },NOW);
  assert.equal(results.length,2);
  assert.equal(results[0].source,'meta');
  assert.equal(results[0].signal,'invitation');
  assert.equal(results[0].confidence,'Textsignal · Bedingungen prüfen');
  assert.equal(results[0].brand,'brkdwn.studios');
  assert.equal(results[1].signal,'unverified');
  assert.equal(results[1].caption,'');
});
test('stale, future-dated and invalid public posts never appear as current',()=>{
  const found=dmScoutCandidates({officialReels:[
    {...official,publishedAt:'2026-09-01T12:00:00Z'},
    {...official,url:'https://instagram.com/reel/New3456789/',publishedAt:'2026-11-17T12:00:00Z'},
    {...official,url:'javascript:alert(1)'},
    {...official,url:'https://www.instagram.com/reel/Newer12345/',publishedAt:yesterday}
  ]},NOW);
  assert.equal(found.length,1);
  assert.equal(found[0].brand,'brkdwn.studios');
  assert.ok(found[0].reelUrl.includes('Newer12345'));
});
test('existing DM preparation state is compatible and no message is recorded as actually sent',()=>{
  const draft=addDmDraft([],{brand:'brkdwn.studios',reelUrl:post,language:'en'});
  assert.equal(draft.added,true);
  assert.equal(draft.drafts[0].status,'prepared');
  const candidates=dmScoutCandidates({drafts:draft.drafts},NOW);
  assert.equal(candidates.length,1);
  assert.equal(candidates[0].source,'draft');
  assert.equal(candidates[0].signal,'unverified');
});
test('small-label prospects are explicitly unverified, and cannot imply giveaways',()=>{
  const list=dmScoutProspects([{handle:'suvene.de'}]);
  assert.ok(list.some(x=>x.handle==='brkdwn.studios'));
  assert.ok(list.some(x=>x.handle==='lucidclub'));
  assert.ok(list.some(x=>x.handle==='anora.thelabel'));
  assert.ok(list.some(x=>x.handle==='suvene.de'));
  assert.ok(list.every(x=>x.verifiedOffer===false));
  assert.ok(PUBLIC_SMALL_BRAND_WATCH.every(x=>!('reelUrl' in x)));
});
test('homepage Video-DM feature opens the editable draft before copying',async()=>{
  const [html,app,style,sw,config,readme]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/instagram-white.css',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8'),
    readFile(new URL('../config/instagram-brands.json',import.meta.url),'utf8'),
    readFile(new URL('../README.md',import.meta.url),'utf8')
  ]);
  for(const id of ['homeDmTitle','homeDmQuickForm','homeDmReel','homeDmBrand',
    'homeDmScoutStatus','homeDmScoutCards','homeDmProspects',
    'homeDmCopyDialog','homeDmCopyText','homeDmOpenChat']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.ok(html.indexOf('id="homeDmTitle"')<html.indexOf('id="brandStrip"'));
  assert.ok(app.includes('renderHomeDmScout();'));
  assert.ok(app.includes("if(action==='home-dm-start')"));
  assert.ok(app.includes("$('#homeDmQuickForm').addEventListener('submit'"));
  assert.ok(app.includes('navigator.clipboard.writeText(dmDraftText(draft,true))'));
  assert.ok(app.includes('if(draft)openDmEditor(draft.id)'));
  assert.ok(html.includes('id="dmEditorChat"'));
  assert.ok(!app.includes("new URLSearchParams({text:"));
  assert.ok(style.includes('.home-dm-scout'));
  assert.ok(style.includes('.home-dm-quick'));
  assert.ok(sw.includes("CACHE_PREFIX + 'v26'"));
  assert.ok(sw.includes("'./dm-scout.mjs'"));
  assert.ok(html.includes('app.js?v=25'));
  assert.ok(readme.includes('Video-DM Scout as primary iPad homepage feature'));
  const b=JSON.parse(config);
  assert.ok(b.brands.includes('brkdwn.studios'));
  assert.ok(b.brands.includes('anora.thelabel'));
  assert.ok(b.brands.length<=b.maxAccounts);
  for(const path of ['docs/app.js','docs/dm-scout.mjs','docs/sw.js']){
    const out=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../'+path,import.meta.url))],
      {encoding:'utf8'});
    assert.equal(out.status,0,path+': '+out.stderr);
  }
});
