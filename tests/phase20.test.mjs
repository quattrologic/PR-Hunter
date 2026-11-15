import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizePhase20State, normalizePhase20Prefs, buildPhase20Notices,
  recordConfirmedReply, phase20Unread, markPhase20Read,
  clearPhase20Read, shouldRefreshPhase20, AUTO_REFRESH_MS
} from '../docs/phase20-core.mjs';
import { backupDocument, parseBackup } from '../docs/phase4-core.mjs';
const now=new Date('2026-11-15T16:00:00Z');
const reelA={url:'https://www.instagram.com/reel/AbCdE99/',brand:'smallbrand'};
const reelB={url:'https://www.instagram.com/reel/ZzYyX78/',brand:'secondbrand'};
const dropA={id:'drop-1',curated:true,title:'Hoodie gewinnen',url:'https://shop.example.org/promo',
  deadline:'2026-11-20T00:00:00Z'};
const dropB={id:'drop-2',curated:true,title:'Streetwear Drop',url:'https://shop.example.org/drop',
  deadline:'2026-11-25T00:00:00Z'};
test('first authorized scan establishes baseline for Reels and curated Drops',()=>{
  const result=buildPhase20Notices({},{
    reels:[reelA],drops:[dropA],reelsAuthorized:true,dropsLoaded:true
  },now);
  assert.equal(result.added,0);
  assert.equal(result.state.reelsInitialized,true);
  assert.equal(result.state.dropsInitialized,true);
  assert.equal(result.state.knownReels.length,1);
  assert.equal(result.state.knownDrops.length,1);
});
test('unconfigured Instagram source never establishes Reel baseline',()=>{
  const first=buildPhase20Notices({},{
    reels:[reelA],reelsAuthorized:false,dropsLoaded:false},now);
  assert.equal(first.state.reelsInitialized,false);
  const second=buildPhase20Notices(first.state,{
    reels:[reelA],reelsAuthorized:true,dropsLoaded:false},now);
  assert.equal(second.added,0);
  assert.equal(second.state.reelsInitialized,true);
});
test('only subsequent genuinely new official reels and curated drops generate notices',()=>{
  const first=buildPhase20Notices({},{
    reels:[reelA],drops:[dropA],reelsAuthorized:true,dropsLoaded:true
  },now);
  const second=buildPhase20Notices(first.state,{
    reels:[reelA,reelB],drops:[dropA,dropB,{...dropB,id:'rss',curated:false,url:'https://shop.example.org/rss'}],
    reelsAuthorized:true,dropsLoaded:true
  },now);
  assert.equal(second.added,2);
  assert.deepEqual(second.notices.map(n=>n.kind),['drop','reel']);
  assert.equal(second.state.inbox[0].kind,'reel');
  assert.equal(phase20Unread(second.state),2);
  const third=buildPhase20Notices(second.state,{
    reels:[reelA,reelB],drops:[dropA,dropB],reelsAuthorized:true,dropsLoaded:true},now);
  assert.equal(third.added,0);
});
test('expired, insecure and unknown shopping leads never create a Drop notification',()=>{
  const first=buildPhase20Notices({}, {drops:[dropA],dropsLoaded:true},now);
  const second=buildPhase20Notices(first.state,{drops:[
    {id:'old',curated:true,url:'https://shop.example.org/x',deadline:'2026-11-14'},
    {id:'unsafe',curated:true,url:'javascript:alert(1)',deadline:'2026-11-20'},
    {id:'feed',curated:false,url:'https://shop.example.org/feed',deadline:'2026-11-20'}
  ],dropsLoaded:true},now);
  assert.equal(second.added,0);
});
test('user-confirmed reply is not inferred from Instagram and cannot duplicate',()=>{
  const draft={id:'smallbrand|https://www.instagram.com/reel/AbCdE99/',
    reelUrl:reelA.url,brand:'smallbrand'};
  const first=recordConfirmedReply({},draft,now);
  assert.equal(first.added,1);
  assert.equal(first.state.inbox[0].kind,'reply');
  assert.match(first.state.inbox[0].message,/selbst bestätigt/);
  assert.equal(recordConfirmedReply(first.state,draft,now).added,0);
  assert.equal(recordConfirmedReply({}, {...draft,brand:'bad handle'},now).added,0);
  assert.equal(recordConfirmedReply({prefs:{manualReplies:false}},draft,now).added,0);
});
test('mark-read and clear cannot re-alert already observed reels',()=>{
  const baseline=buildPhase20Notices({}, {reels:[reelA],reelsAuthorized:true},now);
  const added=buildPhase20Notices(baseline.state,{reels:[reelA,reelB],reelsAuthorized:true},now);
  const read=markPhase20Read(added.state,added.state.inbox[0].id);
  assert.equal(phase20Unread(read),0);
  const cleared=clearPhase20Read(read);
  assert.equal(cleared.inbox.length,0);
  assert.equal(buildPhase20Notices(cleared,{reels:[reelA,reelB],reelsAuthorized:true},now).added,0);
});
test('invalid restored notices are ignored and user preferences remain private',()=>{
  assert.equal(normalizePhase20State({inbox:[{id:'x',kind:'made-up',offerId:'x'}]}).inbox.length,0);
  assert.equal(normalizePhase20State({inbox:[{id:'x',kind:'reel',offerId:'javascript:alert(1)'}]}).inbox.length,0);
  assert.equal(normalizePhase20Prefs({autoRefresh:'yes',deviceNotices:true}).autoRefresh,true);
  const state=normalizePhase20State({prefs:{newReels:false,autoRefresh:false},inbox:[]});
  const restored=parseBackup(backupDocument({phase20:state},now));
  assert.equal(restored.phase20.prefs.newReels,false);
  assert.equal(restored.phase20.prefs.autoRefresh,false);
  assert.equal(restored.phase20.prefs.deviceNotices,false);
});
test('foreground refresh is gated by last run, visibility, online and opt-in',()=>{
  assert.equal(AUTO_REFRESH_MS,600000);
  const recent={enabled:true,visible:true,online:true,lastAt:1000,now:1000+AUTO_REFRESH_MS-1};
  assert.equal(shouldRefreshPhase20(recent),false);
  assert.equal(shouldRefreshPhase20({...recent,now:1000+AUTO_REFRESH_MS}),true);
  for(const disabled of [{enabled:false},{visible:false},{online:false},{inFlight:true}])
    assert.equal(shouldRefreshPhase20({...recent,now:1000+AUTO_REFRESH_MS,...disabled}),false);
});
test('phase 20 controls and background-push limitations are explicit',async()=>{
  const [html,app,sw]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8')
  ]);
  for(const id of ['alertReelsPref','alertDropsPref','alertRepliesPref','alertAutoRefreshPref',
    'alertDeviceButton','alertDeviceStatus','alertAutoRefreshStatus'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(html.includes('keine Mitteilungen bei geschlossener App'));
  assert.ok(html.includes('keine automatische Instagram-Antworterkennung'));
  assert.ok(app.includes('buildPhase20Notices('));
  assert.ok(app.includes('recordConfirmedReply('));
  assert.ok(app.includes('shouldRefreshPhase20('));
  assert.ok(app.includes("document.visibilityState==='visible'"));
  assert.ok(sw.includes("CACHE_PREFIX + 'v28'"));
  assert.ok(sw.includes("'./phase20-core.mjs'"));
});
