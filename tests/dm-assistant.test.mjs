import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  normalizeDmHandle, normalizeReelUrl, dmBrandProfile, dmCopyText,
  normalizeDmDrafts, addDmDraft, updateDmStatus, dmStats
} from '../docs/dm-assistant.mjs';
import { backupDocument, parseBackup } from '../docs/phase4-core.mjs';

const reel='https://www.instagram.com/reel/ABCde1234/';
const date=new Date('2026-11-14T18:00:00Z');

test('genuine Instagram links canonicalize; profiles, lookalikes and unsafe URLs are rejected',()=>{
  assert.equal(normalizeReelUrl('https://instagram.com/reel/ABCde1234/?igsh=abcdef&utm_source=share'),reel);
  assert.equal(normalizeReelUrl('https://m.instagram.com/p/Zyx98765/?abc=hello'),
    'https://www.instagram.com/p/Zyx98765/');
  for(const url of [
    'http://instagram.com/reel/ABCde1234/',
    'https://instagram.com/somebrand/',
    'https://instagram.com/reel/',
    'https://instagram.com/reels/ABCde1234/',
    'https://instagram.com/reel/ABCde1234/more',
    'https://instagram.com.evil.test/reel/ABCde1234/',
    'https://www.instagram.com@phishing.test/reel/ABCde1234/',
    'https://user:pass@instagram.com/reel/ABCde1234/',
    'javascript:alert(1)'
  ]) assert.equal(normalizeReelUrl(url),null,url);
});
test('brand handles are validated, and the profile URL is never user-controlled HTML',()=>{
  assert.equal(normalizeDmHandle('@BRKDWN.Studios'),'brkdwn.studios');
  assert.equal(normalizeDmHandle('@lucidclub'),'lucidclub');
  assert.equal(dmBrandProfile('@lucidclub'),'https://www.instagram.com/lucidclub/');
  for(const value of ['', '@', 'brand with spaces', 'a..b','.ab','ab.','bad@handle','bad/path', 'a'.repeat(31)])
    assert.equal(normalizeDmHandle(value),null,value);
  assert.equal(dmBrandProfile('bad/evil'),null);
});
test('short English and German messages explicitly identify a regular fan, not an ambassador',()=>{
  const en=dmCopyText({brand:'@brkdwn.studios',language:'en',kind:'shirt'});
  assert.ok(en.includes('@brkdwn.studios'));
  assert.ok(en.includes('not a content creator or brand ambassador'));
  assert.ok(en.includes('a shirt'));
  assert.ok(en.includes('regular followers'));
  assert.ok(!en.includes(reel)); // sending native Reel and text are separate steps
  const de=dmCopyText({brand:'@lucidclub',language:'de',kind:'tracksuit'});
  assert.ok(de.includes('kein Content Creator oder Markenbotschafter'));
  assert.ok(de.includes('Trainingsanzug'));
  assert.equal(dmCopyText({brand:'bad/@name'}),null);
});
test('optional combined text and post URL supports pasting; does not pretend to have forwarded a video',()=>{
  const text=dmCopyText({brand:'lucidclub',language:'en',reelUrl:reel,includeLink:true});
  assert.ok(text.includes(reel));
  assert.ok(!text.includes('I have shared your video'));
  assert.ok(!text.includes('I am an influencer'));
  assert.ok(!text.includes('sent automatically'));
  const noLink=dmCopyText({brand:'lucidclub',includeLink:true,reelUrl:'https://evil.example'});
  assert.ok(!noLink.includes('evil.example'));
});
test('one original Reel and one brand produce one draft; no duplicate sending',()=>{
  const first=addDmDraft([],{brand:'@brkdwn.studios',reelUrl:reel,kind:'shirt'},date);
  assert.equal(first.added,true);
  assert.equal(first.drafts.length,1);
  assert.equal(first.drafts[0].status,'prepared');
  const again=addDmDraft(first.drafts,{brand:'BRKDWN.STUDIOS',reelUrl:reel+'?utm=x'},date);
  assert.equal(again.added,false);
  assert.equal(again.drafts.length,1);
  assert.equal(again.drafts[0].status,'prepared');
  const anotherBrand=addDmDraft(first.drafts,{brand:'lucidclub',reelUrl:reel,kind:'tracksuit'},date);
  assert.equal(anotherBrand.added,true);
  assert.equal(anotherBrand.drafts.length,2);
});
test('no draft can be marked sent without the caller explicitly setting status',()=>{
  const initial=addDmDraft([],{brand:'lucidclub',reelUrl:reel},date).drafts;
  assert.deepEqual(dmStats(initial),{prepared:1,sent:0,replied:0,total:1});
  const sent=updateDmStatus(initial,initial[0].id,'sent',date);
  assert.deepEqual(dmStats(sent),{prepared:0,sent:1,replied:0,total:1});
  const replied=updateDmStatus(sent,sent[0].id,'replied',date);
  assert.equal(dmStats(replied).replied,1);
  const illegal=updateDmStatus(replied,replied[0].id,'auto-sent',date);
  assert.equal(illegal[0].status,'replied');
});
test('safety: malformed record status or URLs in backups are removed; template fields sanitized',()=>{
  const sanitized=normalizeDmDrafts([
    {brand:'@lucidclub',reelUrl:reel,status:'sent',language:'de',kind:'tracksuit'},
    {brand:'LUCIDCLUB',reelUrl:reel,status:'replied'},
    {brand:'@bad',reelUrl:'https://not-instagram.example/reel/ABCde1234/'},
    {brand:'@brkdwn.studios',reelUrl:'https://instagram.com/p/QWE54321/',
      status:'mass-posted',language:'XX',kind:'@<script>'}
  ]);
  assert.equal(sanitized.length,2);
  assert.equal(sanitized[0].status,'sent');
  assert.equal(sanitized[1].status,'prepared');
  assert.equal(sanitized[1].language,'en');
  assert.equal(sanitized[1].kind,'generic');
});
test('drafts survive encrypted/plaintext backups without losing existing fields',()=>{
  const draft=addDmDraft([],{brand:'brkdwn.studios',reelUrl:reel,kind:'shirt'},date).drafts;
  const restored=parseBackup(backupDocument({saved:['old'],dmDrafts:draft},date));
  assert.deepEqual(restored.saved,['old']);
  assert.equal(restored.dmDrafts.length,1);
  assert.equal(restored.dmDrafts[0].brand,'brkdwn.studios');
  assert.equal(restored.dmDrafts[0].status,'prepared');
  assert.deepEqual(parseBackup(backupDocument({saved:['old']},date)).dmDrafts,[]);
});
test('iPad UI has copy/open/share/confirmation but no automated Meta DM request',async()=>{
  const [html,app,sw,readme,css]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8'),
    readFile(new URL('../README.md',import.meta.url),'utf8'),
    readFile(new URL('../docs/ultimate.css',import.meta.url),'utf8')
  ]);
  for(const id of ['dmPanel','dmForm','dmBrand','dmReel','dmLanguage','dmKind',
    'dmFormStatus','dmDraftList','dmPreparedCount','dmSentCount','dmRepliedCount'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(html.includes('data-dm-preset="lucidclub"'));
  assert.ok(html.includes('data-dm-preset="brkdwn.studios"'));
  assert.ok(app.includes('Video öffnen')); // dynamically rendered DM card button
  assert.ok(app.includes("navigator.clipboard.writeText(message)"));
  assert.ok(app.includes("window.confirm('Hast du das Originalvideo"));
  assert.ok(app.includes('updateDmStatus'));
  assert.ok(!app.includes('fetch("https://graph.instagram.com/'));
  assert.ok(sw.includes("'./dm-assistant.mjs'"));
  assert.ok(css.includes('.dm-card'));
  assert.ok(readme.includes('Send-a-Reel DM Assistant'));
  for(const file of ['dm-assistant.mjs','phase4-core.mjs','app.js','sw.js']){
    const path=fileURLToPath(new URL('../docs/'+file,import.meta.url));
    const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
    assert.equal(result.status,0,file+': '+result.stderr);
  }
});
