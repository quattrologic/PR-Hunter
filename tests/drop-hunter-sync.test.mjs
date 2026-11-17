import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTailnetUrl,safePrivateSnapshot} from '../docs/drop-hunter-sync.mjs';

test('iPad pairs only private Tailscale HTTPS domain',()=>{
 assert.equal(validateTailnetUrl('https://desktop-abc.tailnet.ts.net:8443/'),'https://desktop-abc.tailnet.ts.net:8443');
 for(const value of ['http://desktop.tail.ts.net:8443/','https://example.com/','https://evil.ts.net/path','https://user:pass@desktop.tail.ts.net/'])assert.throws(()=>validateTailnetUrl(value));
});
test('iPad rejects malformed server data and retains manual order amounts',()=>{
 assert.throws(()=>safePrivateSnapshot({schema:'wrong',orders:[],drops:[]}));
 const p=safePrivateSnapshot({schema:'drop-hunter-private-sync-v1',orders:[{brand:'Brand',amountCents:1800,status:'bestellt',paypalSecret:'NOPE'}],drops:[],lastUpdated:'2026-11-15'});
 assert.equal(p.orders[0].amountCents,1800);
 assert.ok(!JSON.stringify(p).includes('paypalSecret'));
});

test('50 pieces 150 EUR snapshot accepts piece count and shipping, redacts private fields',()=>{
 const s=safePrivateSnapshot({
   schema:'drop-hunter-private-sync-v1',
   orders:[{brand:'Label',amountCents:13000,pieces:45,shippingCents:4000,status:'bestellt',paypalPassword:'SECRET'}],
   pending:[{reservedCents:1000,origin:'https://shop.example',session:'SECRET'}],drops:[]
 });
 assert.equal(s.orders[0].pieces,45);
 assert.equal(s.orders[0].amountCents,13000);
 assert.equal(s.orders[0].shippingCents,4000);
 assert.equal(s.pending[0].reservedCents,1000);
 assert.ok(!JSON.stringify(s).includes('SECRET'));
});

test('iPad accepts the new 200 EUR challenge, 6 EUR products and 200 EUR reservations',()=>{
 const s=safePrivateSnapshot({
  schema:'drop-hunter-private-sync-v1',
  challenge:{goalPieces:50,budgetCents:20000,minProductCents:100,maxProductCents:600},
  pending:[{reservedCents:19500}],drops:[],
  orders:[{brand:'Street',amountCents:100,pieces:1,status:'bestellt'}]
 });
 assert.equal(s.budgetCents,20000);
 assert.equal(s.pending[0].reservedCents,19500);
 assert.equal(s.orders[0].pieces,1);
});
test('an old desktop snapshot does not silently claim the new 200 EUR config',()=>{
 const s=safePrivateSnapshot({
  schema:'drop-hunter-private-sync-v1',drops:[],orders:[],
  challenge:{goalPieces:50,budgetCents:15000}
 });
 assert.equal(s.budgetCents,null);
});
