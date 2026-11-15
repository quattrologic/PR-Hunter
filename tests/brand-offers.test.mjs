import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  OFFER_STATUSES,OFFER_STATUS_LABELS,normalizeBrandOffers,createBrandOffer,
  updateBrandOffer,offerWarnings,offerStats,offerReplyTemplate
} from '../docs/brand-offers.mjs';
import {backupDocument,parseBackup} from '../docs/phase4-core.mjs';
import {encryptBackup,decryptBackup} from '../docs/phase6-core.mjs';
import {webcrypto} from 'node:crypto';

const when=new Date('2026-11-15T08:00:00Z');
const id='offer-01234567-89ab-cdef-0123-456789abcdef';
const base={
  brand:'@example.streetwear',
  item:'Streetwear Hoodie',
  status:'shipping-asked'
};
function make(){
  return createBrandOffer([],base,id,when);
}
test('new offer records are explicitly user-entered, not automatically sent or received',()=>{
  const created=make();
  assert.equal(created.added,true);
  assert.equal(created.offers.length,1);
  assert.equal(created.offers[0].brand,'example.streetwear');
  assert.equal(created.offers[0].item,'Streetwear Hoodie');
  assert.equal(created.offers[0].status,'shipping-asked');
  assert.equal(created.offers[0].productFreeConfirmed,false);
  assert.equal(created.offers[0].germanyConfirmed,false);
  assert.equal(created.offers[0].shippingConfirmed,false);
  assert.equal(created.offers[0].shippingEUR,null);
  assert.equal(offerStats(created.offers).received,0);
});
test('invalid handle, missing offered product, and duplicate ID are rejected',()=>{
  assert.equal(createBrandOffer([],{brand:'bad / handle',item:'Sneakers'},id,when).added,false);
  assert.equal(createBrandOffer([],{brand:'@legit',item:'  '},id,when).added,false);
  assert.equal(createBrandOffer([],{brand:'@legit',item:'Shoes'},'unsafe-id',when).added,false);
  assert.equal(createBrandOffer(make().offers,base,id,when).added,false);
  const safe=createBrandOffer([],{brand:'@Legit.Brand',item:' shoes '},id,when);
  assert.equal(safe.offers[0].brand,'legit.brand');
  assert.equal(safe.offers[0].item,'shoes');
});
test('unknown Germany shipping and costs never default to zero',()=>{
  const offer=make().offers[0];
  assert.equal(offerWarnings(offer).length,3);
  assert.ok(offerWarnings(offer).some(x=>x.includes('Versandkosten noch nicht')));
  const asked=updateBrandOffer([offer],id,{shippingConfirmed:true},when)[0];
  assert.equal(asked.shippingEUR,null);
  assert.ok(offerWarnings(asked).some(x=>x.includes('Versandkosten')));
  const paid=updateBrandOffer([asked],id,{shippingEUR:8},when)[0];
  assert.equal(paid.shippingEUR,8);
  assert.ok(offerWarnings(paid).some(x=>x.includes('Limit von 5')));
});
test('explicitly checking product, Germany and fee is needed before no warnings',()=>{
  const original=make().offers;
  const updated=updateBrandOffer(original,id,{
    productFreeConfirmed:true,germanyConfirmed:true,shippingConfirmed:true,shippingEUR:0
  },when);
  assert.deepEqual(offerWarnings(updated[0]),[]);
  assert.equal(updated[0].shippingEUR,0);
  const reset=updateBrandOffer(updated,id,{shippingConfirmed:false},when);
  assert.equal(reset[0].shippingEUR,null);
  assert.ok(offerWarnings(reset[0]).length);
  assert.equal(original[0].shippingEUR,null); // pure update
});
test('invalid costs and unexpected status fields cannot grant confirmation',()=>{
  const original=make().offers;
  const next=updateBrandOffer(original,id,{
    shippingConfirmed:true,shippingEUR:'0',status:'auto-shipped',
    brand:'fakeprofile',id:'offer-overwrite',item:'changed',
    productFreeConfirmed:'yes',germanyConfirmed:1
  },when);
  assert.equal(next[0].shippingEUR,null);
  assert.equal(next[0].status,'shipping-asked');
  assert.equal(next[0].brand,'example.streetwear');
  assert.equal(next[0].id,id);
  assert.equal(next[0].item,'changed');
  assert.equal(next[0].productFreeConfirmed,false);
  assert.equal(next[0].germanyConfirmed,false);
  assert.equal(updateBrandOffer(next,id,{shippingEUR:-4},when)[0].shippingEUR,null);
  assert.equal(updateBrandOffer(next,id,{shippingEUR:1001},when)[0].shippingEUR,null);
});
test('statuses are user-provided only and receipts cannot be invented',()=>{
  const existing=make().offers;
  assert.deepEqual(OFFER_STATUSES,[
    'offered','shipping-asked','confirmed','shipped','received','closed'
  ]);
  assert.match(OFFER_STATUS_LABELS.received,/dir erhalten/);
  const confirmed=updateBrandOffer(existing,id,{status:'confirmed'},when);
  assert.equal(offerStats(confirmed).confirmed,1);
  assert.equal(offerStats(confirmed).received,0);
  const delivered=updateBrandOffer(confirmed,id,{status:'received'},when);
  assert.equal(offerStats(delivered).received,1);
  assert.equal(offerStats(delivered).awaiting,0);
  assert.equal(offerStats(existing).awaiting,1);
  assert.equal(updateBrandOffer(delivered,id,{status:'success-from-instagram'},when)[0].status,'received');
});
test('normalization strips unsafe records and never stores private address fields',()=>{
  const valid=make().offers[0];
  const records=[
    {...valid,address:'Home street 1',phone:'+49...',password:'secret'},
    {...valid,status:'received'}, // duplicate id dropped
    {brand:'bad<script>',id:'offer-badinvalid',item:'Hoodie',status:'received'},
    {brand:'legit',id:'offer-aaaaaaaa-aaaaaaaa',item:' \t '}
  ];
  const items=normalizeBrandOffers(records);
  assert.equal(items.length,1);
  assert.equal(items[0].status,'shipping-asked');
  for(const field of ['address','phone','password','trackingNumber','cardNumber'])
    assert.ok(!(field in items[0]));
  assert.deepEqual(normalizeBrandOffers(null),[]);
});
test('a short follow-up asks about free items and delivery without claiming creator status',()=>{
  const offer=make().offers[0];
  const en=offerReplyTemplate(offer);
  assert.ok(en.includes('shipping to Germany'));
  assert.ok(en.includes('completely free'));
  assert.ok(!en.includes('I am a creator'));
  const de=offerReplyTemplate(offer,'de');
  assert.ok(de.includes('Versand nach Deutschland'));
  assert.ok(de.includes('komplett kostenlos'));
  assert.equal(offerReplyTemplate(null),null);
});
test('offer progress is preserved through legacy/plaintext and encrypted private backups',async()=>{
  const current={saved:['legacy-item'],brandOffers:make().offers};
  const plain=backupDocument(current,when);
  const restored=parseBackup(plain);
  assert.deepEqual(restored.saved,['legacy-item']);
  assert.equal(restored.brandOffers[0].brand,'example.streetwear');
  assert.equal(restored.brandOffers[0].status,'shipping-asked');
  const old=parseBackup(backupDocument({saved:['old']},when));
  assert.deepEqual(old.brandOffers,[]);
  const pass='strong-example-private-passphrase';
  const encrypted=await encryptBackup(plain,pass,webcrypto);
  assert.ok(!encrypted.includes('example.streetwear'));
  assert.ok(!encrypted.includes('Streetwear Hoodie'));
  const decrypted=await decryptBackup(encrypted,pass,webcrypto);
  assert.equal(parseBackup(decrypted).brandOffers[0].brand,'example.streetwear');
});
test('white iPad view contains private offer UI, manual safeguards and offline cache',async()=>{
  const [html,app,white,worker,readme]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/instagram-white.css',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8'),
    readFile(new URL('../README.md',import.meta.url),'utf8')
  ]);
  for(const id of [
    'brandOffersTitle','brandOfferForm','brandOfferBrand','brandOfferItem',
    'brandOfferInitialStatus','brandOfferList','brandOfferAwaiting',
    'brandOfferConfirmed','brandOfferReceived'
  ])assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(app.includes('createBrandOffer(state.brandOffers'));
  assert.ok(app.includes('updateBrandOffer(state.brandOffers'));
  assert.ok(app.includes('renderBrandOffers()'));
  assert.ok(app.includes("window.confirm('Hast du diesen Status selbst tatsächlich bestätigt?"));
  assert.ok(app.includes('offerReplyTemplate(offer'));
  assert.ok(app.includes('brandOffers:[]'));
  assert.ok(white.includes('.brand-offer-card'));
  assert.ok(white.includes('background:#fff'));
  assert.ok(worker.includes("'./brand-offers.mjs'"));
  assert.ok(worker.includes("CACHE_PREFIX + 'v22'"));
  assert.ok(readme.includes('Private DM offers / packages'));
  for(const file of ['brand-offers.mjs','phase4-core.mjs','app.js','sw.js']){
    const path=fileURLToPath(new URL('../docs/'+file,import.meta.url));
    const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
    assert.equal(result.status,0,file+': '+result.stderr);
  }
});
