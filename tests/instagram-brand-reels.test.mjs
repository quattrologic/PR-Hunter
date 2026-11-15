import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  trustedMetaThumbnail,normalizeBrandReel,normalizeInstagramReelsReport,
  normalizeSavedReels,addSavedReel,reelFeedStatusText
} from '../docs/instagram-brand-core.mjs';
import {discoveryCards} from '../docs/discovery-grid.mjs';
import {scanOfficialBrandReels,buildDiscoveryUrl} from '../scripts/instagram-business-scan.mjs';
import {backupDocument,parseBackup} from '../docs/phase4-core.mjs';

const NOW=Date.parse('2026-11-15T09:00:00Z');
const link='https://www.instagram.com/reel/AbCdEfG123/';
const thumb='https://scontent.cdninstagram.com/v/t51.29350-15/photo.jpg';
const reel={
  brand:'suvene.de',url:link,thumbnailUrl:thumb,
  caption:'New winter puffer',publishedAt:'2026-11-14T18:00:00Z',mediaType:'VIDEO'
};
test('official Meta thumbnails are restricted to trusted HTTPS CDN hosts',()=>{
  assert.equal(trustedMetaThumbnail(thumb),thumb);
  assert.ok(trustedMetaThumbnail('https://scontent.xx.fbcdn.net/img.jpg'));
  for(const unsafe of ['javascript:alert(1)','http://scontent.cdninstagram.com/a.jpg',
    'https://cdninstagram.com.evil.example/a.jpg','https://evil.example/a.jpg',
    'https://user:pass@cdninstagram.com/p.jpg','https://www.instagram.com:8443/media'])
    assert.equal(trustedMetaThumbnail(unsafe),null,unsafe);
});
test('only genuine recent professional Reel links can enter official brand feed',()=>{
  const normalized=normalizeBrandReel(reel,NOW);
  assert.equal(normalized.url,link);
  assert.equal(normalized.thumbnailUrl,thumb);
  assert.equal(normalized.brand,'suvene.de');
  assert.equal(normalizeBrandReel({...reel,url:'https://www.instagram.com/p/AbCdEfG123/'},NOW),null);
  assert.equal(normalizeBrandReel({...reel,mediaType:'IMAGE'},NOW),null);
  assert.equal(normalizeBrandReel({...reel,publishedAt:'2026-09-01T12:00:00Z'},NOW),null);
  assert.equal(normalizeBrandReel({...reel,brand:'name/evil'},NOW),null);
});
test('public payload does not fabricate items while Meta is unconfigured',()=>{
  const empty=normalizeInstagramReelsReport({status:'not-configured',reels:[reel]},NOW);
  assert.equal(empty.reels.length,0);
  assert.match(reelFeedStatusText(empty),/noch nicht verbunden/);
  const live=normalizeInstagramReelsReport({status:'active',generatedAt:'2026-11-15T08:00:00Z',
    brandsChecked:2,reels:[reel,{...reel}, {...reel,url:'https://instagram.com/reel/Other12345/'}]},NOW);
  assert.equal(live.reels.length,2);
  assert.equal(live.brandsChecked,2);
  assert.match(reelFeedStatusText(live),/2 aktuelle Videos/);
});
test('manual Reel import is private, deduplicated, and independent from DM confirmations',()=>{
  const imported=addSavedReel([],'@suvene.de',link);
  assert.equal(imported.added,true);
  assert.deepEqual(imported.reels[0],{brand:'suvene.de',url:link,source:'user-saved'});
  assert.equal(addSavedReel(imported.reels,'@suvene.de',link+'?igsh=xyz').added,false);
  assert.equal(addSavedReel([],'@suvene.de','https://www.instagram.com/p/Other12345/').added,true);
  assert.equal(addSavedReel([],'@suvene.de','https://www.instagram.com/tv/Other12345/').added,true);
  assert.equal(addSavedReel([],'@suvene.de','https://instagram.com@evil.example/p/Other12345/').added,false);
  assert.equal(addSavedReel([],'@suvene.de','https://www.instagram.com/p/Other12345/extra').added,false);
  assert.equal(addSavedReel([],'fake/brand',link).added,false);
  assert.deepEqual(normalizeSavedReels([{brand:'suvene.de',url:link,secret:'not-stored'}]),imported.reels);
  const restored=parseBackup(backupDocument({savedReels:imported.reels,dmDrafts:[]}));
  assert.equal(restored.savedReels[0].url,link);
  assert.deepEqual(restored.dmDrafts,[]);
});
test('real official thumbnail appears only for actual API record, not a fabricated brand',()=>{
  const official=normalizeInstagramReelsReport({status:'active',reels:[reel]},NOW);
  const manual=addSavedReel([],'ranya.owt','https://instagram.com/reel/OTHER1234/').reels;
  const tiles=discoveryCards([],[],{mode:'reels',now:NOW,brandReels:official.reels,savedReels:manual});
  assert.equal(tiles.length,2);
  assert.equal(tiles[0].brand,'@ranya.owt');
  assert.equal(tiles[0].thumbnailUrl,null);
  assert.equal(tiles[1].sourceType,'instagram-professional');
  assert.equal(tiles[1].thumbnailUrl,thumb);
  assert.equal(tiles[1].caption,'New winter puffer');
});
test('Meta credentials remain solely server-side, never in public source/report',async()=>{
  const output=await scanOfficialBrandReels({handles:['suvene.de'],fetchImpl:()=>{
    throw Error('should not call network without secrets');
  },now:new Date(NOW)});
  assert.equal(output.status,'not-configured');
  assert.equal(output.reels.length,0);
  assert.equal(output.brandsChecked,0);
  const config=JSON.parse(await readFile(new URL('../config/instagram-brands.json',import.meta.url),'utf8'));
  assert.ok(config.brands.length>=5 && config.brands.length<=20);
  assert.ok(!JSON.stringify(config).includes('accessToken'));
});
test('official Business Discovery fetch uses bearer authorization; reports only valid Reel URLs',async()=>{
  let captured;
  const mock=async (url,options)=>{
    captured={url,options};
    return {ok:true,json:async()=>({business_discovery:{
      username:'suvene.de',media:{data:[
        {id:'a',media_type:'VIDEO',media_product_type:'REELS',
         permalink:link,thumbnail_url:thumb,caption:'New winter puffer',
         timestamp:'2026-11-14T18:00:00Z'},
        {id:'b',media_type:'IMAGE',permalink:'https://instagram.com/p/IMG12345/',
         timestamp:'2026-11-14T18:00:00Z'}
      ]}
    }})};
  };
  const token='EAA1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const result=await scanOfficialBrandReels({userId:'17841400000001234',accessToken:token,
    handles:['suvene.de'],fetchImpl:mock,now:new Date(NOW)});
  assert.equal(result.status,'active');
  assert.equal(result.reels.length,1);
  assert.equal(result.reels[0].url,link);
  assert.equal(result.reels[0].thumbnailUrl,thumb);
  assert.ok(captured.url.includes('business_discovery.username'));
  assert.equal(captured.options.headers.Authorization,'Bearer '+token);
  assert.ok(!captured.url.includes(token));
  assert.ok(!JSON.stringify(result).includes(token));
  assert.equal(new URL(buildDiscoveryUrl('17841400000001234','suvene.de')).hostname,'graph.facebook.com');
});
test('Meta API failure never invents a brand feed',async()=>{
  const result=await scanOfficialBrandReels({
    userId:'17841400000001234',accessToken:'EAA1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    handles:['suvene.de'],fetchImpl:async()=>({ok:false,status:403}),
    now:new Date(NOW)
  });
  assert.equal(result.status,'unavailable');
  assert.equal(result.reels.length,0);
  assert.equal(result.brandsUnsupported,1);
});
test('iPad post import accepts the screenshot link type, distinct post label and private backup',()=>{
  const link='https://www.instagram.com/p/DQmock12345/?igsh=tracking';
  const imported=addSavedReel([],'@suvene.de',link);
  assert.equal(imported.added,true);
  assert.equal(imported.reels[0].url,'https://www.instagram.com/p/DQmock12345/');
  const tiles=discoveryCards([],[],{mode:'reels',savedReels:imported.reels});
  assert.equal(tiles.length,1);
  assert.equal(tiles[0].kind,'post');
  const restored=parseBackup(backupDocument({savedReels:imported.reels}));
  assert.equal(restored.savedReels[0].url,imported.reels[0].url);
});
test('Instagram input labels are above their fields and match the iPad form',async()=>{
  const html=await readFile(new URL('../docs/index.html',import.meta.url),'utf8');
  const css=await readFile(new URL('../docs/instagram-white.css',import.meta.url),'utf8');
  const app=await readFile(new URL('../docs/app.js',import.meta.url),'utf8');
  assert.ok(html.includes('<label for="brandReelLink">Instagram-Link</label>'));
  assert.ok(html.includes('<label for="brandReelHandle">Markenprofil</label>'));
  assert.ok(html.includes('placeholder="@suvene.de"'));
  assert.ok(html.includes('app.js?v=19'));
  assert.ok(css.includes('#brandReelImportForm .reel-import-field label'));
  assert.ok(css.includes('align-items:end'));
  assert.ok(app.includes("item.kind === 'post' ? 'BEITRAG'"));
  assert.ok(app.includes("mountInstagramAutoPreviews();"));
  assert.ok(!app.includes("▶ Vorschau laden</button>"));
});
test('iPad UI, backup and scheduled official Meta connector are wired without public secrets',async()=>{
  const [html,app,sw,css,workflow,pkg,backend]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/instagram-white.css',import.meta.url),'utf8'),
    readFile(new URL('../.github/workflows/scout.yml',import.meta.url),'utf8'),
    readFile(new URL('../package.json',import.meta.url),'utf8'),
    readFile(new URL('../scripts/instagram-business-scan.mjs',import.meta.url),'utf8')
  ]);
  for(const id of ['brandReelsTools','brandReelsStatus','brandReelImportForm',
    'brandReelLink','brandReelHandle','discoveryCaption'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(app.includes('normalizeInstagramReelsReport(await response.json())'));
  assert.ok(app.includes('addSavedReel(state.savedReels'));
  assert.ok(app.includes('publicEmbedUrl(item.url)'));
  assert.ok(app.includes('trustedMetaThumbnail(item.thumbnailUrl)'));
  assert.ok(app.includes('iframe'));
  assert.ok(sw.includes("'./instagram-brand-core.mjs'"));
  assert.ok(sw.includes("'instagram-reels.json'"));
  assert.ok(sw.includes("CACHE_PREFIX + 'v19'"));
  assert.ok(css.includes('.tile-real-image'));
  assert.ok(css.includes('.instagram-auto-preview'));
  assert.ok(workflow.includes('npm run instagram-scan'));
  assert.ok(workflow.includes('secrets.PR_HUNTER_META_IG_USER_ID'));
  assert.ok(workflow.includes('secrets.PR_HUNTER_META_USER_ACCESS_TOKEN'));
  assert.equal(JSON.parse(pkg).scripts['instagram-scan'],'node scripts/instagram-business-scan.mjs');
  assert.ok(!app.includes('META_USER_ACCESS_TOKEN'));
  assert.ok(!html.includes('META_USER_ACCESS_TOKEN'));
  assert.ok(backend.includes('Authorization'));
  for(const file of ['discovery-grid.mjs','instagram-brand-core.mjs','app.js','sw.js','phase4-core.mjs']){
    const path=fileURLToPath(new URL('../docs/'+file,import.meta.url));
    const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
    assert.equal(check.status,0,file+': '+check.stderr);
  }
});
