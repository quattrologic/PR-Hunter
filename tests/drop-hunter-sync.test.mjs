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
