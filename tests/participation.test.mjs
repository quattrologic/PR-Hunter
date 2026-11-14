import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CHECKLIST_TASKS, requiredSteps, normalizeSelectedSteps, stepDefinitions,
  checklistProgress, offerWarnings, isConfirmedParticipation,
  canConfirmEntry, timeUntilDeadline, urgentOffers, suggestedComments, safeTaskSelection
} from '../docs/participation.mjs';

const now = Date.parse('2026-11-14T18:00:00Z');
const instagram = {
  id:'manual-ig',title:'Streetwear Hoodie Giveaway',
  url:'https://www.instagram.com/reel/ABC123/',category:'Mode',
  source:'Manually saved', sourceType:'manual'
};
const curated = {
  id:'b-2026',title:'Brand Hoodie-Gewinnspiel',
  category:'Mode',sourceType:'curated',
  participation:'Newsletter + Double-Opt-in + WhatsApp-Kanal',
  shippingStatus:'Deutschland laut Bedingungen erlaubt',
  costStatus:'Versandkosten für Gewinne nicht ausdrücklich bestätigt',
  deadline:'2026-11-16T17:00:00Z'
};

test('the default steps never assume a follow, like, or comment is required', () => {
  assert.deepEqual(requiredSteps(instagram),['rules','eligibility']);
  const ids = stepDefinitions(instagram).map(x=>x.id);
  assert.deepEqual(ids,['rules','eligibility']);
  assert.ok(!ids.includes('comment'));
  assert.ok(CHECKLIST_TASKS.some(x=>x.id==='comment'));
});
test('curated organizer methods become checklist steps only when explicitly specified', () => {
  assert.deepEqual(requiredSteps(curated),['rules','eligibility','newsletter','email','whatsapp']);
  assert.deepEqual(requiredSteps({...curated,participation:'Gewinnspielformular'}),
    ['rules','eligibility','form']);
});
test('only known optional social steps are stored, in stable order, without duplicates', () => {
  assert.deepEqual(safeTaskSelection(['follow','comment','follow','unknown','newsletter']),['follow','comment']);
  assert.deepEqual(normalizeSelectedSteps(instagram,['follow','comment','follow','unknown']),
    ['rules','eligibility','follow','comment']);
  const steps=stepDefinitions(instagram,['comment','follow']);
  assert.equal(steps.length,4);
  assert.ok(steps.some(x=>x.id==='follow'));
});
test('checking some boxes is not the same as confirming an entry', () => {
  const extra=['follow','like','comment'];
  const partial=checklistProgress(instagram,extra,['rules','eligibility','follow']);
  assert.equal(partial.total,5);
  assert.equal(partial.finished,3);
  assert.equal(partial.complete,false);
  assert.deepEqual(partial.remaining,['like','comment']);
  assert.equal(canConfirmEntry(instagram,extra,['rules','eligibility','follow'],[],now),false);
  assert.equal(canConfirmEntry(instagram,extra,['rules','eligibility','follow','like','comment'],[],now),true);
});
test('one confirmed entry blocks duplicate self-reported participation, irrespective of account', () => {
  const actions=[{offerId:'manual-ig',type:'entered',account:'account_a'}];
  assert.equal(isConfirmedParticipation(actions,'manual-ig'),true);
  assert.equal(canConfirmEntry(instagram,[],['rules','eligibility'],actions,now),false);
  assert.equal(isConfirmedParticipation([{offerId:'manual-ig',type:'prepared'}],'manual-ig'),false);
});
test('expired offers cannot be confirmed and urgent windows are accurate', () => {
  const expired={...curated,deadline:'2026-11-13T15:00:00Z'};
  assert.equal(canConfirmEntry(expired,[],requiredSteps(expired),[],now),false);
  assert.equal(timeUntilDeadline(expired,now).status,'expired');
  assert.equal(timeUntilDeadline(curated,now).status,'soon');
  const urgent={...instagram,deadline:'2026-11-15T00:00:00Z'};
  const long={...instagram,id:'long',deadline:'2026-12-20T00:00:00Z'};
  assert.deepEqual(urgentOffers([long,curated,expired,urgent],now).map(x=>x.id),['manual-ig','b-2026']);
});
test('unverified prize conditions are reported, not silently treated as free', () => {
  assert.ok(offerWarnings(instagram,now).some(x=>x.includes('nicht unabhängig')));
  assert.ok(offerWarnings(instagram,now).some(x=>x.includes('Frist unbekannt')));
  assert.ok(offerWarnings(curated,now).some(x=>x.includes('Versand- oder Folgekosten')));
  assert.ok(offerWarnings({...curated,shippingStatus:'Deutschlandversand unbestätigt'},now)
    .some(x=>x.includes('Deutschland')));
});
test('comment templates are only static local suggestions, not a publishing action', () => {
  const comments=suggestedComments(instagram);
  assert.equal(comments.length,3);
  assert.ok(comments[0].toLowerCase().includes('hoodie'));
  assert.notEqual(comments[0],comments[1]);
});
test('Phase 3 layout, event handlers and offline cache contain all required parts', async () => {
  const [html,app,sw] = await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8')
  ]);
  for(const id of [
    'assistantPanel','assistantQueue','assistantDeadlineCount',
    'verifiedOnlyButton','endingSoonButton','activityAccountFilter',
    'participationDialog','participationTitle','participationOriginal','participationTerms',
    'participationWarnings','participationTasks','participationExtra',
    'participationCounter','participationTemplates','participationConfirm'
  ]) assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(html.includes('data-tab="assistant"'));
  assert.ok(app.includes("const STORE = 'pr-hunter-state-v1'"));
  assert.ok(app.includes('storeChecklist(item,stored)'));
  assert.ok(app.includes('canConfirmEntry(item,data.selected,data.completed,state.activity)'));
  assert.ok(sw.includes('./participation.mjs'));
  assert.ok(!app.includes('instagram.com/api/v1'));
});
test('Phase 3 browser modules parse using the supported Node runner', async () => {
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  for(const filename of ['app.js','participation.mjs','ultimate-core.mjs','sw.js']) {
    const result = spawnSync(process.execPath,['--check',fileURLToPath(new URL('../docs/'+filename,import.meta.url))],{encoding:'utf8'});
    assert.equal(result.status,0,filename+': '+result.stderr);
  }
});
