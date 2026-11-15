import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCurated } from '../scripts/curated.mjs';

const now=new Date('2026-11-15T12:00:00Z');
const offer={
 title:'Streetwear limited Drop Hoodie',brand:'Example',
 url:'https://shop.example.org/product/hoodie',
 termsUrl:'https://shop.example.org/conditions',
 category:'Mode',checkedOn:'2026-11-14',deadline:'2026-11-30T00:00:00Z',
 keepPrize:true,noPurchase:false,shipsToGermany:true,
 offerKind:'verified-deal',dealPriceEUR:7.99,
 priceSourceUrl:'https://shop.example.org/product/hoodie',
 priceCheckedAt:'2026-11-14T09:00:00Z',shippingCostEUR:4
};
test('eligible paid drops require verified price 1–10 € and preserve purchase distinction',()=>{
 const normalized=normalizeCurated(offer,now);
 assert.equal(normalized.dealPriceEUR,7.99);
 assert.equal(normalized.noPurchase,false);
 assert.equal(normalized.shippingCostEUR,4);
});
test('reject paid items without proof, with expired price proof, or outside 1–10 € range',()=>{
 for(const changed of [
  {dealPriceEUR:11},{dealPriceEUR:0},{dealPriceEUR:'7.99'},
  {priceSourceUrl:'https://fake.example.com/product'},
  {priceCheckedAt:'2026-09-01T12:00:00Z'},
  {offerKind:'unverified'},{noPurchase:null},
  {shipsToGermany:false},{keepPrize:false}
 ])assert.equal(normalizeCurated({...offer,...changed},now),null);
});
test('no-purchase giveaways do not become verified cheap deals through supplied fields',()=>{
 const original={...offer,offerKind:undefined,noPurchase:true,dealPriceEUR:undefined};
 const normalized=normalizeCurated(original,now);
 assert.ok(normalized);
 assert.equal(normalized.dealPriceEUR,undefined);
});
