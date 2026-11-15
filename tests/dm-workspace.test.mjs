import test from 'node:test';
import assert from 'node:assert/strict';
import {addDmDraft,dmDraftText,editDmDraft,filterDmDrafts,normalizeDmMessage,updateDmStatus} from '../docs/dm-assistant.mjs';
import {dmScoutText} from '../docs/dm-scout.mjs';
import {backupDocument,parseBackup} from '../docs/phase4-core.mjs';
const input={brand:'lucidclub',reelUrl:'https://www.instagram.com/reel/ABCde1234/'};
test('Scout wording, edits, status and old data survive backup without duplicate original links',()=>{
 const message=dmScoutText(input);
 let drafts=addDmDraft([],{...input,message}).drafts;
 assert.equal(dmDraftText(drafts[0],true),message);
 drafts=editDmDraft(drafts,drafts[0].id,'My own message');
 drafts=updateDmStatus(drafts,drafts[0].id,'sent');
 const restored=parseBackup(backupDocument({saved:['previous'],dmDrafts:drafts}));
 assert.deepEqual(restored.saved,['previous']);
 assert.equal(dmDraftText(restored.dmDrafts[0],true),'My own message\n\n'+input.reelUrl);
 const duplicate=addDmDraft(restored.dmDrafts,{...input,message:'overwrite?'});
 assert.equal(duplicate.added,false);
 assert.equal(duplicate.drafts[0].message,'My own message');
 assert.equal(duplicate.drafts[0].status,'sent');
});
test('old drafts fall back to templates, empty edits preserve content, text is bounded',()=>{
 const drafts=addDmDraft([],input).drafts;
 assert.match(dmDraftText(drafts[0]),/regular followers/);
 assert.deepEqual(editDmDraft(drafts,drafts[0].id,'   '),drafts);
 assert.equal(normalizeDmMessage('a'.repeat(2100)).length,2000);
 assert.equal(normalizeDmMessage('hello\0 world'),'hello world');
 assert.equal(normalizeDmMessage({text:'bad'}),'');
});
test('request status filters are exclusive, sorted and cannot mutate saved status',()=>{
 let drafts=addDmDraft([],input,new Date('2026-11-14')).drafts;
 drafts=addDmDraft(drafts,{...input,brand:'another'},new Date('2026-11-15')).drafts;
 drafts=updateDmStatus(drafts,drafts[0].id,'replied',new Date('2026-11-15'));
 assert.equal(filterDmDrafts(drafts,'sent').length,0);
 assert.equal(filterDmDrafts(drafts,'prepared').length,1);
 assert.equal(filterDmDrafts(drafts,'replied').length,1);
 assert.equal(filterDmDrafts(drafts)[0].brand,'another');
 assert.equal(drafts[1].status,'prepared');
});
