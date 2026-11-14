import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  normalizeAlertsState, alertPrefs, buildAlerts, unreadCount,
  markAlertsRead, clearReadAlerts, encryptBackup, decryptBackup, isEncryptedBackup
} from '../docs/phase6-core.mjs';
import { backupDocument, parseBackup } from '../docs/phase4-core.mjs';

const now = new Date('2026-11-14T18:00:00.000Z');
const item=(id,deadline)=>({
  id,title:'Streetwear Gewinnspiel ' + id,url:'https://example.org/giveaway/'+id,
  category:'Mode',deadline
});
const future='2026-11-16T18:00:00Z';
const distant='2026-12-20T18:00:00Z';

test('first catalog load sets baseline, never fabricates new discovery alerts',()=>{
  const result=buildAlerts([item('one',distant)],{},now);
  assert.equal(result.added,0);
  assert.equal(result.state.initialized,true);
  assert.deepEqual(result.state.knownIds,['one']);
  assert.equal(unreadCount(result.state),0);
});
test('near-expiry public items get an in-app warning only while still active',()=>{
  const result=buildAlerts([
    item('soon',future),
    item('expired','2026-11-13T00:00:00Z'),
    item('long',distant)
  ],{},now);
  assert.equal(result.added,1);
  assert.equal(result.state.inbox[0].kind,'deadline');
  assert.equal(result.state.inbox[0].offerId,'soon');
  assert.equal(unreadCount(result.state),1);
});
test('subsequent scans detect only new actual IDs, with no duplicate alerts',()=>{
  const first=buildAlerts([item('one',distant)],{},now);
  const second=buildAlerts([item('one',distant),item('two',distant)],first.state,now);
  assert.equal(second.added,1);
  assert.equal(second.state.inbox[0].kind,'new');
  const third=buildAlerts([item('two',distant),item('one',distant)],second.state,now);
  assert.equal(third.added,0);
  assert.equal(third.state.inbox.length,1);
});
test('alert toggles, read status and cleanup work without any automatic posting',()=>{
  const first=buildAlerts([item('one',future)],{prefs:{newOffers:false,expiring:false}},now);
  assert.equal(first.added,0);
  assert.deepEqual(alertPrefs({newOffers:false,expiring:false}),{newOffers:false,expiring:false});
  const second=buildAlerts([item('one',future)],{},now);
  const after=markAlertsRead(second.state,second.state.inbox[0].id);
  assert.equal(unreadCount(after),0);
  assert.equal(clearReadAlerts(after).inbox.length,0);
  assert.equal(unreadCount(markAlertsRead(second.state)),0);
});
test('garbled alert metadata never crashes restore or exceeds caps',()=>{
  const normalized=normalizeAlertsState({
    initialized:'yes',prefs:{newOffers:false},
    knownIds:['one','one',true, 'x'.repeat(130)],
    inbox:[{id:'new:x',kind:'new',offerId:'x',title:'ok',read:true}, {id:'broken',kind:'posted',offerId:'y'}]
  });
  assert.equal(normalized.initialized,false);
  assert.deepEqual(normalized.knownIds,['one']);
  assert.equal(normalized.inbox.length,1);
  assert.equal(normalized.inbox[0].read,true);
});
test('AES-256-GCM backup roundtrips local personal state, unread hints and settings',async()=>{
  const original={
    saved:['one'],manual:[],activity:[],accounts:['@street'],
    alerts:buildAlerts([item('one',future)],{},now).state
  };
  const text=backupDocument(original,now);
  const pass='my-strong-device-passphrase-123';
  const encrypted=await encryptBackup(text,pass);
  assert.equal(isEncryptedBackup(encrypted),true);
  assert.ok(!encrypted.includes('street'));
  assert.ok(!encrypted.includes('Streetwear Gewinnspiel'));
  assert.ok(!encrypted.includes('my-strong-device-passphrase-123'));
  const result=await decryptBackup(encrypted,pass);
  const restored=parseBackup(result);
  assert.deepEqual(restored.saved,['one']);
  assert.deepEqual(restored.accounts,['street']);
  assert.equal(restored.alerts.inbox.length,1);
  assert.equal(restored.alerts.inbox[0].kind,'deadline');
});
test('wrong password, tampering and obsolete encryption metadata fail closed',async()=>{
  const pass='another-secure-password';
  const encrypted=await encryptBackup(backupDocument({saved:['one']}),pass);
  await assert.rejects(()=>decryptBackup(encrypted,'totally-wrong-password'),/Falsches Passwort/);
  await assert.rejects(()=>encryptBackup('{}','short'),/12 Zeichen/);
  const payload=JSON.parse(encrypted);
  payload.iterations=1;
  await assert.rejects(()=>decryptBackup(JSON.stringify(payload),pass),/Verschlüsselungsformat/);
  payload.iterations=250000;
  payload.data='AAAA';
  await assert.rejects(()=>decryptBackup(JSON.stringify(payload),pass),/beschädigte Sicherung/);
  assert.equal(isEncryptedBackup('{}'),false);
});
test('older plaintext backups without an alerts key are compatible',()=>{
  const parsed=parseBackup(backupDocument({saved:['old'],manual:[]}));
  assert.deepEqual(parsed.saved,['old']);
  assert.deepEqual(parsed.alerts.inbox,[]);
  assert.equal(parsed.alerts.initialized,false);
});
test('Phase 6 controls, service worker offline modules and safe backup loading exist',async()=>{
  const [html,app,sw]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8')
  ]);
  for(const id of [
    'alertsPanel','alertCount','alertList','alertNewPref','alertDeadlinePref',
    'markAllAlertsRead','clearReadAlerts','refreshAlertsButton',
    'backupPassword','encryptedBackup','restoreBackup'
  ])assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(html.includes('Cloud-Synchronisierung: nicht verbunden'));
  assert.ok(html.includes('keine Mitteilungen bei geschlossener App'));
  assert.ok(app.includes('buildAlerts(ui.catalog, beforeAlerts)'));
  assert.ok(app.includes('encryptBackup(backupDocument(state),field.value)'));
  assert.ok(app.includes('isEncryptedBackup(text)'));
  assert.ok(app.includes('window.confirm('));
  assert.ok(sw.includes('./phase6-core.mjs'));
  for (const name of ['phase6-core.mjs','phase4-core.mjs','app.js','sw.js']){
    const file=fileURLToPath(new URL('../docs/'+name,import.meta.url));
    const run=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(run.status,0,name+': '+run.stderr);
  }
});
