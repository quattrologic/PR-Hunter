import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  SEARCH_HASHTAGS,VERIFIED_STREETWEAR_ACCOUNTS,currentSavedBrandHandles,
  rankSimilarBrands,rankSimilarVideos
} from '../docs/similar-reels.mjs';
import {
  hashtagLookupUrl,recentHashtagUrl,normalizeHashtagVideo,scanPublicHashtagVideos
} from '../scripts/instagram-hashtag-scan.mjs';

const NOW=Date.parse('2026-11-15T12:00:00Z');
const MOCK_TOKEN='EAA1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ORIGINAL='https://www.instagram.com/reel/ABCDEF12345/';
test('saved accounts, own Reel posts and DM drafts become private, personalized seed handles',()=>{
  const handles=currentSavedBrandHandles({
    savedBrands:[{handle:'suvene.de'},'@ranya.owt','@invalid/username'],
    savedReels:[{brand:'@deputydepartment',url:ORIGINAL}],
    drafts:[{brand:'brkdwn.studios',reelUrl:ORIGINAL}]
  });
  assert.deepEqual(handles,['suvene.de','ranya.owt','deputydepartment','brkdwn.studios']);
  const defaults=currentSavedBrandHandles();
  assert.ok(defaults.includes('suvene.de'));
  assert.ok(defaults.includes('6pm.update'));
  assert.equal(defaults.length,5);
});
test('small brand suggestions respond to seed style, exclude saved and never invent giveaways',()=>{
  const puffer=rankSimilarBrands({savedBrands:['suvene.de']});
  const skate=rankSimilarBrands({savedBrands:['brkdwn.studios']});
  assert.ok(puffer.some(x=>x.handle==='lowlightsstudios'));
  assert.ok(skate.some(x=>x.handle==='prohibitedclo'));
  assert.ok(!puffer.some(x=>x.handle==='suvene.de'));
  assert.ok(puffer.every(x=>!('freeProducts' in x)));
  assert.notDeepEqual(puffer.map(x=>x.handle),skate.map(x=>x.handle));
  for(const entry of VERIFIED_STREETWEAR_ACCOUNTS)
    assert.ok(entry.source==='user'||entry.source==='previous'||entry.source.startsWith('https://'));
});
test('new similar Reel results are real, recent, original and deduplicated',()=>{
  const items=rankSimilarVideos({
    savedBrands:['suvene.de'],
    reels:[
      {brand:'lowlightsstudios',url:ORIGINAL,caption:'Free hoodie — send us this reel',
        publishedAt:'2026-11-14T11:00:00Z'},
      {brand:'lowlightsstudios',url:ORIGINAL,caption:'Free hoodie',
        publishedAt:'2026-11-14T11:00:00Z'},
      {brand:'vicinity_de',url:'https://www.instagram.com/reel/ZABC123456/',caption:'Our drop',
        publishedAt:'2026-09-01T10:00:00Z'},
      {brand:'bad',url:'https://evil.example/reel/ABCDEF12345/',caption:'Free',
        publishedAt:'2026-11-14T11:00:00Z'}
    ]
  },NOW);
  assert.equal(items.length,1);
  assert.equal(items[0].brand,'lowlightsstudios');
  assert.equal(items[0].signal,'invitation');
  assert.equal(items[0].category,'Kleidung');
  assert.equal(rankSimilarVideos({
    reels:[{brand:'lowlightsstudios',url:ORIGINAL,caption:'Free hoodie',
      publishedAt:'2026-11-14T11:00:00Z'}],
    savedReels:[{brand:'lowlightsstudios',url:ORIGINAL}]
  },NOW).length,0,'saved URLs are not new discoveries');
});
test('anonymous hashtag Reels remain attributed to hashtag, not to a fabricated DM recipient',()=>{
  const source={
    media_type:'VIDEO',permalink:ORIGINAL,caption:'#hoodiegiveaway Free hoodie',
    timestamp:'2026-11-15T10:00:00Z'
  };
  const normalized=normalizeHashtagVideo(source,'hoodiegiveaway',NOW);
  assert.equal(normalized.brand,null);
  assert.equal(normalized.hashtag,'hoodiegiveaway');
  assert.equal(normalized.url,ORIGINAL);
  assert.equal(normalizeHashtagVideo({...source,media_type:'IMAGE'},'hoodiegiveaway',NOW),null);
  assert.equal(normalizeHashtagVideo({...source,timestamp:'2026-11-01T10:00:00Z'},'hoodiegiveaway',NOW),null);
  assert.equal(normalizeHashtagVideo({...source,permalink:'https://instagram.com/p/ABCDEF12345/'},'hoodiegiveaway',NOW),null);
  assert.equal(normalizeHashtagVideo(source,'unapproved-tag',NOW),null);
  const ranked=rankSimilarVideos({discoveries:[normalized],savedBrands:['suvene.de']},NOW);
  assert.equal(ranked.length,1);
  assert.equal(ranked[0].brand,null);
  assert.equal(ranked[0].source,'hashtag-search');
});
test('Meta hashtag scanner calls approved exact endpoints with Bearer token, never leaks secret',async()=>{
  const seen=[];
  const mocked=async(url,options)=>{
    seen.push({url,options});
    if(url.includes('/ig_hashtag_search'))return {
      ok:true,json:async()=>({data:[{id:'17841500000000123'}]})
    };
    if(url.includes('/recent_media'))return {
      ok:true,json:async()=>({data:[
        {media_type:'VIDEO',permalink:ORIGINAL,caption:'Free Hoodie Giveaway',
          timestamp:'2026-11-15T10:00:00Z'},
        {media_type:'IMAGE',permalink:'https://instagram.com/p/ABCDEF12345/',
          timestamp:'2026-11-15T10:00:00Z'}
      ]})
    };
    return {ok:false,status:400};
  };
  const report=await scanPublicHashtagVideos({
    userId:'17841400000000123',accessToken:MOCK_TOKEN,
    tags:['hoodiegiveaway','hoodiegiveaway'],fetchImpl:mocked,now:new Date(NOW)
  });
  assert.equal(report.status,'active');
  assert.equal(report.tagsChecked,1);
  assert.equal(report.discovered.length,1);
  assert.equal(report.discovered[0].brand,null);
  assert.equal(seen.length,2);
  assert.ok(seen[0].url.includes('ig_hashtag_search'));
  assert.ok(seen[0].url.includes('q=hoodiegiveaway'));
  assert.ok(seen[1].url.includes('/recent_media'));
  assert.ok(seen.every(x=>x.options.headers.Authorization==='Bearer '+MOCK_TOKEN));
  assert.ok(seen.every(x=>!x.url.includes(MOCK_TOKEN)));
  assert.ok(!JSON.stringify(report).includes(MOCK_TOKEN));
  assert.ok(hashtagLookupUrl('17841400000000123','hoodiegiveaway').startsWith('https://graph.facebook.com/'));
  assert.ok(recentHashtagUrl('17841400000000123','17841500000000123').includes('fields='));
  assert.throws(()=>hashtagLookupUrl('17841400000000123','unapproved'));
  assert.equal(SEARCH_HASHTAGS.length,6);
});
test('not configured/forbidden hashtag search yields exactly zero automatic videos',async()=>{
  const none=await scanPublicHashtagVideos({
    tags:['streetweargiveaway'],
    fetchImpl:()=>{throw Error('must not fetch without credentials');},
    now:new Date(NOW)
  });
  assert.equal(none.status,'not-configured');
  assert.equal(none.discovered.length,0);
  const denied=await scanPublicHashtagVideos({
    userId:'17841400000000123',accessToken:MOCK_TOKEN,
    tags:['streetweargiveaway'],
    fetchImpl:async()=>({ok:false,status:403}),now:new Date(NOW)
  });
  assert.equal(denied.status,'unavailable');
  assert.equal(denied.discovered.length,0);
  assert.equal(denied.tagsUnsupported,1);
});
test('homepage UI uses saved local interests, real auto Reels and three-frame view limit',async()=>{
  const [html,app,css,sw,wf,pkg,config,report,readme]=await Promise.all([
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/instagram-white.css',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8'),
    readFile(new URL('../.github/workflows/scout.yml',import.meta.url),'utf8'),
    readFile(new URL('../package.json',import.meta.url),'utf8'),
    readFile(new URL('../config/instagram-brands.json',import.meta.url),'utf8'),
    readFile(new URL('../docs/similar-reels.json',import.meta.url),'utf8'),
    readFile(new URL('../README.md',import.meta.url),'utf8')
  ]);
  for(const id of ['similarReelCards','similarBrandChoices','similarVideoStatus','similarVideoTitle'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(app.includes("rankSimilarVideos({...seed,reels:official,discoveries:hashtags})"));
  assert.ok(app.includes('rankSimilarBrands(seed,7)'));
  assert.ok(app.includes('renderSimilarVideoDiscovery();'));
  assert.ok(app.includes("'./similar-reels.json'"));
  assert.ok(app.includes('#similarReelCards .instagram-auto-preview'));
  assert.ok(app.includes('startHomeDm(lead.brand,lead.url,lead.signal)'));
  assert.ok(app.includes("$('#homeDmBrand').focus()"));
  assert.ok(!app.includes('renderFakeSimilarReels'));
  assert.ok(css.includes('.similar-video-discovery'));
  assert.ok(css.includes('.similar-video-grid'));
  assert.ok(html.includes('app.js?v=22'));
  assert.ok(sw.includes("CACHE_PREFIX + 'v22'"));
  assert.ok(sw.includes("'./similar-reels.mjs'"));
  assert.ok(sw.includes("'similar-reels.json'"));
  assert.ok(wf.includes('npm run similar-video-scan'));
  assert.ok(wf.includes('secrets.PR_HUNTER_META_IG_USER_ID'));
  assert.equal(JSON.parse(pkg).scripts['similar-video-scan'],'node scripts/instagram-hashtag-scan.mjs');
  assert.equal(JSON.parse(report).status,'not-configured');
  assert.equal(JSON.parse(report).discovered.length,0);
  const watch=JSON.parse(config).brands;
  assert.ok(watch.includes('lowlightsstudios'));
  assert.ok(watch.includes('prohibitedclo'));
  assert.ok(watch.length<=20);
  assert.ok(readme.includes('Personalized similar-brand Instagram video discovery'));
  for(const path of ['docs/app.js','docs/similar-reels.mjs','scripts/instagram-hashtag-scan.mjs']){
    const check=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../'+path,import.meta.url))],
      {encoding:'utf8'});
    assert.equal(check.status,0,path+': '+check.stderr);
  }
});
