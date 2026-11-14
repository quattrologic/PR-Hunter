import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  canonicalOpportunityUrl, extractOpportunityLinks, makeImportedOffers,
  normalizeAccountLabel, accountLabels, addAccountLabel,
  backupDocument, parseBackup
} from '../docs/phase4-core.mjs';

test('Instagram Reels are canonicalized, only actual posts accepted', () => {
  assert.equal(
    canonicalOpportunityUrl('https://www.instagram.com/reel/AbCdef123/?igsh=abc&utm_source=share'),
    'https://www.instagram.com/reel/AbCdef123/'
  );
  assert.equal(
    canonicalOpportunityUrl('https://instagram.com/p/ABC12345/?foo=bar'),
    'https://www.instagram.com/p/ABC12345/'
  );
  for (const link of [
    'http://instagram.com/p/ABC12345/',
    'https://www.instagram.com/suvene.de/',
    'https://www.instagram.com/reels/ABC12345/',
    'https://www.instagram.com.evil.test/reel/ABC12345/',
    'javascript:alert(1)',
    'https://user:pass@instagram.com/reel/ABC12345/'
  ]) assert.equal(canonicalOpportunityUrl(link),null,link);
});

test('copy-pasted Instagram share messages yield clean, unique URLs', () => {
  const copied = [
    'Look at this: https://www.instagram.com/reel/AbCdef123/?igsh=anything',
    'Repeated https://instagram.com/reel/AbCdef123/?utm_source=chat',
    'Another https://www.instagram.com/p/ZYX987654/',
    'Profile link is not an offer: https://instagram.com/brand.name/',
    'Unrelated https://bad.example/?utm_source=x',
  ].join('\n');
  const links = extractOpportunityLinks(copied);
  assert.deepEqual(links, [
    'https://www.instagram.com/reel/AbCdef123/',
    'https://www.instagram.com/p/ZYX987654/',
    'https://bad.example/'
  ]);
  assert.deepEqual(extractOpportunityLinks(copied,1),[links[0]]);
  assert.deepEqual(extractOpportunityLinks('not a URL'),[]);
  assert.deepEqual(extractOpportunityLinks('x'.repeat(20001)),[]);
});

test('batch imports are unverified, de-duplicate and never fake Instagram metadata', () => {
  const links=[
    'https://www.instagram.com/reel/AbCdef123/',
    'https://www.instagram.com/p/ZYX987654/',
    'https://example.org/contest?utm_source=story'
  ];
  const existing=[{url:'https://instagram.com/reel/AbCdef123/?igsh=tracked'}];
  const now=new Date('2026-11-14T12:00:00Z');
  const offers=makeImportedOffers(links,existing,'My Brand',now);
  assert.equal(offers.length,2);
  assert.equal(offers[0].brand,'My Brand');
  assert.equal(offers[0].sourceType,'manual');
  assert.ok(offers[0].title.includes('selbst prüfen'));
  assert.ok(offers[0].description.includes('ungeprüft'));
  assert.equal(offers[0].url,'https://www.instagram.com/p/ZYX987654/');
  assert.equal(offers[0].category,'Mode');
  assert.ok(offers.every(item=>!item.checkedOn && !item.deadline));
});

test('account labels support max 20 distinct valid names, no login or repeated entry engine', () => {
  assert.equal(normalizeAccountLabel('@My.Style'), 'my.style');
  assert.equal(normalizeAccountLabel('name @ another'),null);
  assert.deepEqual(accountLabels(['@ME','me','@SECOND']),['me','second']);
  const twenty=Array.from({length:20},(_,i)=>'account'+i);
  assert.equal(addAccountLabel(twenty,'account20').added,false);
  assert.equal(addAccountLabel(twenty,'account20').accounts.length,20);
  assert.equal(addAccountLabel(['me'],'@NEW').accounts[1],'new');
  assert.equal(addAccountLabel(['me'],'me').added,false);
});

test('private JSON backup safely roundtrips old and new local data', () => {
  const now=new Date('2026-11-14T12:00:00Z');
  const input={
    saved:['manual-1'],
    tracked:{'manual-1':'applied'},
    manual:[{
      id:'manual-1',title:'Hoodie Instagram post',brand:'Brand',
      url:'https://www.instagram.com/reel/ABC12345/?igsh=abc',
      category:'Mode',manual:true
    }],
    brands:[{name:'My Label',url:'https://www.instagram.com/my.label/'}],
    activity:[{
      id:'log-1',offerId:'manual-1',type:'entered',
      account:'@style.guy',evidenceUrl:'https://www.instagram.com/p/ABC123456/',
      createdAt:'2026-11-14T10:00:00Z'
    }],
    savedDetails:{
      'manual-1':{
        id:'manual-1',title:'Saved',url:'https://www.instagram.com/reel/ABC12345/',
        category:'Mode'
      }
    },
    checklists:{'manual-1':{selected:['follow','comment'],completed:['rules'],updatedAt:'2026-11-14'}},
    accounts:['@style.guy','@second']
  };
  const parsed=parseBackup(backupDocument(input,now));
  assert.deepEqual(parsed.saved,['manual-1']);
  assert.equal(parsed.tracked['manual-1'],'applied');
  assert.equal(parsed.manual[0].url,'https://www.instagram.com/reel/ABC12345/');
  assert.equal(parsed.activity[0].account,'style.guy');
  assert.deepEqual(parsed.checklists['manual-1'].selected,['follow','comment']);
  assert.deepEqual(parsed.accounts,['style.guy','second']);
  assert.equal(parsed.brands[0].handle,'my.label');
  assert.equal(parsed.savedDetails['manual-1'].title,'Saved');
});

test('backup parser rejects invalid formats and strips unsafe content', () => {
  assert.throws(()=>parseBackup('not json'),/JSON/);
  assert.throws(()=>parseBackup('{}'),/Sicherungsformat/);
  assert.throws(()=>parseBackup('x'.repeat(2000001)),/groß/);
  const doc=JSON.stringify({format:'pr-hunter-local-backup',version:1,state:{
    manual:[
      {id:'bad',title:'Bad',url:'javascript:alert(1)'},
      {id:'good',title:'Good',url:'https://example.org/offer'}
    ],
    activity:[
      {offerId:'good',type:'entered',account:'hacker@example.com'},
      {offerId:'good',type:'entered',account:'@realuser'}
    ],
    tracked:{'safe':'applied','evil':'dangerous'},
    checklists:{'safe':{selected:['follow','hack'],completed:['rules','fake']}}
  }});
  const parsed=parseBackup(doc);
  assert.equal(parsed.manual.length,1);
  assert.equal(parsed.activity.length,1);
  assert.equal(parsed.tracked.evil,undefined);
  assert.deepEqual(parsed.checklists.safe.selected,['follow']);
  assert.deepEqual(parsed.checklists.safe.completed,['rules']);
});

test('Phase 4 frontend has link inbox, private accounts, restore confirmation and cache', async () => {
  const [html,app,sw]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8')
  ]);
  for(const id of [
    'inboxPanel','batchImportForm','batchImportText','batchImportPreview',
    'accountLabelForm','accountLabels','downloadBackup','restoreBackup',
    'backupStatus','accountLabelSuggestions'
  ]) assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(app.includes("const STORE = 'pr-hunter-state-v1'"));
  assert.ok(app.includes('parseBackup(data)')); // Phase 6 accepts decrypted .prh or legacy .json
  assert.ok(app.includes('isEncryptedBackup(text)'));
  assert.ok(app.includes('window.confirm('));
  assert.ok(app.includes("const file = new Blob([contents]"));
  assert.ok(sw.includes('./phase4-core.mjs'));
  assert.ok(!app.includes('instagram.com/api/v1'));
  for(const file of ['phase4-core.mjs','app.js','sw.js']) {
    const path=fileURLToPath(new URL('../docs/'+file,import.meta.url));
    const syntax=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
    assert.equal(syntax.status,0,file+': '+syntax.stderr);
  }
});
