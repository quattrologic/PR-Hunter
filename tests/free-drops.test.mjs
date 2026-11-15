import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFreeDrop, freeDropDiscovery, normalizeFreeDropPrefs } from '../docs/free-drops.mjs';

const today = Date.parse('2026-11-15T12:00:00Z');
const base = {
 id:'one', title:'Streetwear Hoodie Gewinnspiel', category:'Mode',
 url:'https://example.org/giveaway', termsUrl:'https://example.org/rules',
 sourceType:'curated', checkedOn:'2026-11-14',
 deadline:'2026-11-17T23:59:00Z', noPurchase:true, keepPrize:true,
 shipsToGermany:true, shippingCostEUR:0
};
test('reviewed German giveaway has an explicit zero shipping fee and deadline',()=>{
 const item=classifyFreeDrop(base,today);
 assert.equal(item.curated,true);
 assert.equal(item.shippingEUR,0);
 assert.equal(item.germany,'confirmed');
 assert.equal(item.kind,'giveaway');
 assert.equal(item.warnings.length,0);
});
test('never display expired, malformed, insecure or excluded-country listings',()=>{
 for(const bad of [
  {...base,deadline:'2026-11-01'},
  {...base,deadline:'not a date'},
  {...base,url:'http://example.org/giveaway'},
  {...base,url:'https://evil:secret@example.org/giveaway'},
  {...base,shipsToGermany:false},
  {...base,category:'Lifestyle'}]) {
   assert.equal(classifyFreeDrop(bad,today),null);
  }
});
test('unreviewed and unknown shipping remain warnings, not free guarantees',()=>{
 const item=classifyFreeDrop({...base,sourceType:'rss',noPurchase:null,
  keepPrize:null,shipsToGermany:null,shippingCostEUR:null,deadline:null},today);
 assert.equal(item.curated,false);
 assert.equal(item.shippingEUR,null);
 assert.equal(item.germany,'unknown');
 assert.ok(item.warnings.length>=4);
});
test('cheap deal filter requires current retailer-owned price evidence',()=>{
 const deal={...base,title:'Streetwear Drop',id:'deal',url:'https://shop.example.org/item',
  dealPriceEUR:6.5,priceCheckedAt:'2026-11-14T10:00:00Z',
  priceSourceUrl:'https://shop.example.org/item'};
 assert.equal(classifyFreeDrop(deal,today).priceEUR,6.5);
 assert.equal(freeDropDiscovery([deal],{view:'deals'},today).counts.all,1);
 for(const bad of [
  {...deal,priceCheckedAt:'2026-10-01T10:00:00Z'},
  {...deal,priceSourceUrl:'https://other.example.org/item'},
  {...deal,dealPriceEUR:'3.99'},
  {...deal,dealPriceEUR:13}]) {
  assert.equal(freeDropDiscovery([bad],{view:'deals'},today).items.length,0);
 }
});
test('germany-only filter, deduplication, pagination and fashion priority',()=>{
 const unknown={...base,id:'2',url:'https://example.org/second',category:'Technik',shipsToGermany:null};
 const result=freeDropDiscovery([unknown,base,{...base,id:'dup'}],{germanyOnly:true},today);
 assert.equal(result.counts.all,1);
 assert.equal(result.items[0].id,'one');
});
test('black week promotions are not misrepresented as 1-10-euro deals',()=>{
 const item=classifyFreeDrop({...base,title:'Black Week Promo',
 sourceType:'rss',noPurchase:null,keepPrize:null},today);
 assert.equal(item.kind,'promotion');
 assert.equal(item.blackFriday,true);
 assert.equal(item.priceEUR,null);
 assert.equal(freeDropDiscovery([{...base,title:'Black Week Promo'}],{view:'deals'},today).items.length,0);
});
test('unknown preferences fail closed',()=>{
 assert.deepEqual(normalizeFreeDropPrefs({view:'hack',germanyOnly:'true'}),{
 view:'all',germanyOnly:false,maxShippingEUR:5});
});

test('phase19 iPad UI, PWA shell and backups include Free Drops',async()=>{
 const {readFile}=await import('node:fs/promises');
 const html=await readFile(new URL('../docs/index.html',import.meta.url),'utf8');
 const app=await readFile(new URL('../docs/app.js',import.meta.url),'utf8');
 const sw=await readFile(new URL('../docs/sw.js',import.meta.url),'utf8');
 const backup=await readFile(new URL('../docs/phase4-core.mjs',import.meta.url),'utf8');
 assert.ok(html.includes('id="freeDropsCards"'));
 assert.ok(html.includes('id="freeDropsGermanyOnly"'));
 assert.ok(html.includes('data-free-drop-view="deals"'));
 assert.ok(html.includes('free-drops.css?v=27'));
 assert.ok(app.includes("freeDropDiscovery(ui.catalog,prefs)"));
 assert.ok(app.includes("data-action=\"free-drop-review\""));
 assert.ok(sw.includes("CACHE_PREFIX + 'v28'"));
 assert.ok(sw.includes("'./free-drops.mjs'"));
 assert.ok(backup.includes('freeDropPrefs:normalizeFreeDropPrefs(raw.freeDropPrefs)'));
});
test('verified paid drop is reviewed but never described as a free gift',()=>{
 const drop={...base,title:'Hoodie Drop',noPurchase:false,offerKind:'verified-deal',
  dealPriceEUR:5,priceCheckedAt:'2026-11-14T10:00:00Z',
  priceSourceUrl:'https://example.org/giveaway'};
 const result=classifyFreeDrop(drop,today);
 assert.equal(result.curated,true);
 assert.equal(result.priceEUR,5);
 assert.ok(result.warnings.some(x=>x.includes('kein Gratisartikel')));
});
