import test from 'node:test';
import assert from 'node:assert/strict';
import {addDmDraft,prepareDmHandoff,resolveDmHandoff,editDmDraft,dmStats,setDmShipping,normalizeDmDrafts} from '../docs/dm-assistant.mjs';
import {backupDocument,parseBackup} from '../docs/phase4-core.mjs';
import {normalizeBrandReel} from '../docs/instagram-brand-core.mjs';
const input={brand:'testbrand',reelUrl:'https://www.instagram.com/reel/ABCde1234/'};
test('return confirmation preserves copied snapshot and only explicit Yes increments count once',()=>{
 let drafts=addDmDraft([],input).drafts;const id=drafts[0].id;
 drafts=prepareDmHandoff(drafts,id,'Exact copied text');
 assert.equal(dmStats(drafts).sent,0);
 drafts=editDmDraft(drafts,id,'Later draft change');
 drafts=parseBackup(backupDocument({dmDrafts:drafts})).dmDrafts;
 assert.equal(drafts[0].pendingMessage,'Exact copied text');
 drafts=resolveDmHandoff(drafts,id,true);
 assert.equal(drafts[0].sentMessage,'Exact copied text');
 assert.equal(dmStats(drafts).sent,1);
 assert.equal(drafts[0].pendingMessage,'');
 assert.deepEqual(resolveDmHandoff(drafts,id,true),drafts);
 const restored=parseBackup(backupDocument({dmDrafts:drafts})).dmDrafts;
 assert.equal(restored[0].sentMessage,'Exact copied text');
});
test('No/Cancel leaves a draft prepared and clears the pending return; only one pending handoff',()=>{
 let drafts=addDmDraft([],input).drafts;
 const id=drafts[0].id;
 drafts=prepareDmHandoff(drafts,id,'Copied');
 drafts=resolveDmHandoff(drafts,id,false);
 assert.equal(dmStats(drafts).sent,0);assert.equal(drafts[0].pendingMessage,'');
 drafts=addDmDraft(drafts,{...input,brand:'second'}).drafts;
 drafts=prepareDmHandoff(drafts,id,'First');
 drafts=prepareDmHandoff(drafts,drafts[0].id,'Second');
 assert.equal(drafts.filter(d=>d.pendingMessage).length,1);
});
test('shipping remains unknown unless entered, allows zero, rejects invalid costs; snapshots are bounded',()=>{
 let drafts=addDmDraft([],input).drafts;const id=drafts[0].id;
 assert.equal(drafts[0].shippingEUR,null);
 drafts=setDmShipping(drafts,id,0);assert.equal(drafts[0].shippingEUR,0);
 drafts=setDmShipping(drafts,id,6.99);assert.equal(drafts[0].shippingEUR,6.99);
 assert.equal(setDmShipping(drafts,id,-1)[0].shippingEUR,6.99);
 assert.equal(setDmShipping(drafts,id,null)[0].shippingEUR,null);
 assert.equal(normalizeDmDrafts([{...drafts[0],sentMessage:'x'.repeat(3000)}])[0].sentMessage.length,2400);
});
test('official follower count must be a known nonnegative integer, not inferred from missing data',()=>{
 const raw={brand:'testbrand',url:input.reelUrl,publishedAt:new Date().toISOString()};
 assert.equal(normalizeBrandReel(raw).followersCount,null);
 assert.equal(normalizeBrandReel({...raw,followersCount:4210}).followersCount,4210);
 for(const count of [-1,'4210',1.5])assert.equal(normalizeBrandReel({...raw,followersCount:count}).followersCount,null);
});
