import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  DISCOVERY_FILTERS,reelUrl,publicEmbedUrl,verifiedDealPrice,
  isBlackFridayLead,classifyDisplayKind,matchesDiscoveryMode,
  discoveryCards,filterEmptyMessage
} from '../docs/discovery-grid.mjs';

const NOW=Date.parse('2026-11-14T21:00:00Z');
const reel='https://www.instagram.com/reel/ABCDEFG12/';
const sample=(id,title,extra={})=>({
  id,title,url:'https://example.org/action/'+id,brand:'Example',
  sourceType:'curated',category:'Mode',...extra
});
const validDeal=sample('drop','Hoodie ab 5 Euro',{
  dealPriceEUR:5,priceCheckedAt:'2026-11-14T13:00:00Z',
  priceSourceUrl:'https://example.org/offer/hoodie'
});

test('strict Reel URL normalization rejects fake Instagram domains and unsafe post links',()=>{
  assert.equal(reelUrl('https://instagram.com/reel/ABCDEFG12/?igsh=tracked'),reel);
  assert.equal(reelUrl('https://www.instagram.com/p/QwErTy123/'),'https://www.instagram.com/p/QwErTy123/');
  assert.equal(publicEmbedUrl(reel),'https://www.instagram.com/reel/ABCDEFG12/embed/');
  for(const value of [
    'http://instagram.com/reel/ABCDEFG12/',
    'https://instagram.com.evil.test/reel/ABCDEFG12/',
    'https://instagram.com@evil.test/reel/ABCDEFG12/',
    'https://instagram.com/somebrand/',
    'https://www.instagram.com/reels/ABCDEFG12/',
    'https://user:password@instagram.com/reel/ABCDEFG12/',
    'https://instagram.com/reel/ABCDEFG12/more',
    'javascript:alert(1)',
    ''
  ]) {
    assert.equal(reelUrl(value),null,value);
    assert.equal(publicEmbedUrl(value),null,value);
  }
});
test('1–10€ Deals require recent structured evidence and cannot be inferred from a title',()=>{
  assert.equal(verifiedDealPrice(validDeal,NOW),5);
  assert.equal(matchesDiscoveryMode(validDeal,'deals',NOW),true);
  for(const bogus of [
    sample('give','500 € Store-Guthaben gewinnen',{}),
    {...validDeal,dealPriceEUR:'5'},
    {...validDeal,dealPriceEUR:500},
    {...validDeal,dealPriceEUR:0},
    {...validDeal,priceCheckedAt:'2026-10-01T00:00:00Z'},
    {...validDeal,priceCheckedAt:'2026-11-16T12:00:00Z'},
    {...validDeal,priceSourceUrl:'https://different-merchant.example/offer'},
    {...validDeal,priceSourceUrl:'javascript:alert(1)'}
  ]) assert.equal(matchesDiscoveryMode(bogus,'deals',NOW),false,bogus.title);
});
test('Black Week and Black Friday are recognized without pretending they are 1€ deals',()=>{
  const black=sample('six','6PM Black Week: 500 € Store-Guthaben gewinnen');
  assert.equal(isBlackFridayLead(black),true);
  assert.equal(matchesDiscoveryMode(black,'black-friday',NOW),true);
  assert.equal(matchesDiscoveryMode(black,'deals',NOW),false);
  assert.equal(classifyDisplayKind(black),'giveaway');
});
test('accurate reel/PR/competition/drop categories exclude unrelated items',()=>{
  const items=[
    sample('r','Instagram Reel',{url:reel}),
    sample('p','PR-Paket Creator Bewerbung'),
    sample('g','Sneaker Giveaway'),
    sample('d','New Streetwear Drop'),
    sample('o','Winter Outfits')
  ];
  assert.deepEqual(items.map(classifyDisplayKind),['reel','pr','giveaway','drop','offer']);
  assert.deepEqual(items.filter(x=>matchesDiscoveryMode(x,'reels',NOW)).map(x=>x.id),['r']);
  assert.deepEqual(items.filter(x=>matchesDiscoveryMode(x,'pr',NOW)).map(x=>x.id),['r','p']);
  assert.deepEqual(items.filter(x=>matchesDiscoveryMode(x,'giveaways',NOW)).map(x=>x.id),['g']);
  assert.deepEqual(items.filter(x=>matchesDiscoveryMode(x,'drops',NOW)).map(x=>x.id),['d']);
  assert.equal(DISCOVERY_FILTERS.length,7);
});
test('user-saved real Reel links come first, duplicates do not create fake extra video posts',()=>{
  const draft={id:'lucidclub|'+reel,brand:'lucidclub',reelUrl:reel,status:'prepared'};
  const offers=[
    sample('manual','Saved same reel',{url:'https://instagram.com/reel/ABCDEFG12/?utm_source=share'}),
    sample('other','Another giveaway')
  ];
  const out=discoveryCards(offers,[draft],{now:NOW});
  assert.equal(out.length,2);
  assert.equal(out[0].url,reel);
  assert.equal(out[0].brand,'@lucidclub');
  assert.equal(out[0].fromDraft,true);
  assert.equal(out[0].status,'prepared');
  assert.equal(out[1].kind,'giveaway');
  assert.ok(out.every(x=>!('views' in x) && !('likes' in x) && !('thumbnail' in x)));
});
test('search respects actual names and sources, expired offers vanish',()=>{
  const items=[
    sample('a','Streetwear Hoodie Giveaway',{brand:'Brand Studio'}),
    sample('b','Cool tech release',{category:'Technik'}),
    sample('expired','Expired hoodie',{deadline:'2026-11-12T00:00:00Z'})
  ];
  assert.deepEqual(discoveryCards(items,[],{mode:'for-you',query:'brand studio',now:NOW}).map(x=>x.offerId),['a']);
  assert.deepEqual(discoveryCards(items,[],{mode:'for-you',now:NOW}).map(x=>x.offerId),['a','b']);
  assert.equal(discoveryCards(items,[],{mode:'reels',now:NOW}).length,0);
  assert.ok(filterEmptyMessage('reels').includes('Reel-Link'));
  assert.ok(filterEmptyMessage('deals').includes('1–10 €'));
});
test('new Instagram-style iPad screen remains navigable, offline, accessible and conservative',async()=>{
  const [html,app,css,worker,readme,manifest]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/instagram-white.css',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8'),
    readFile(new URL('../README.md',import.meta.url),'utf8'),
    readFile(new URL('../docs/manifest.webmanifest',import.meta.url),'utf8')
  ]);
  for(const id of [
    'discoverPanel','discoverCards','search','brandStrip','profilePanel',
    'dmPanel','productsPanel','addButton','pasteLinkButton',
    'verifiedOnlyButton','endingSoonButton','refreshButton',
    'discoveryDialog','discoveryPreview','discoveryBookmark','discoveryDmButton',
    'discoveryChecklist','discoveryOriginal','alertCount','sourceHealth','feedResultCount',
    'totalCount','savedCount','appliedCount','acceptedCount'
  ]) assert.ok(html.includes('id="'+id+'"'),id);
  for(const mode of DISCOVERY_FILTERS)
    assert.ok(html.includes('data-discovery="'+mode+'"'),mode);
  assert.equal((html.match(/class="nav-btn\b/g)||[]).length>=5,true);
  assert.ok(html.includes('data-action="focus-discovery-search"'));
  assert.ok(html.includes('class="cards discover-grid"'));
  assert.ok(app.includes('page.items.map(renderDiscoveryTile)'));
  assert.ok(app.includes('getVisibleSlice(getSaved(),ui.visibleSaved)'));
  assert.ok(app.includes('ui.galleryItems=page.items'));
  assert.ok(app.includes('publicEmbedUrl(link)'));
  assert.ok(app.includes("load.addEventListener('click'"));
  assert.ok(app.includes("iframe.src=embed"));
  assert.ok(app.includes("$('#dmReel').value=item.url"));
  assert.ok(app.includes('reelUrl(item.url)'));
  assert.ok(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
  assert.ok(css.includes('background:#fff'));
  assert.ok(css.includes('.story-ring'));
  assert.ok(css.includes('.discover-dialog'));
  assert.ok(worker.includes("'./instagram-white.css'"));
  assert.ok(worker.includes("'./discovery-grid.mjs'"));
  assert.ok(worker.includes("CACHE_PREFIX + 'v18'"));
  assert.equal(JSON.parse(manifest).theme_color,'#ffffff');
  assert.ok(readme.includes('white Discover UI'));
  for(const file of ['discovery-grid.mjs','app.js','sw.js']){
    const path=fileURLToPath(new URL('../docs/'+file,import.meta.url));
    const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
    assert.equal(result.status,0,file+': '+result.stderr);
  }
});
