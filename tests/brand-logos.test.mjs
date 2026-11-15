import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {KNOWN_BRAND_LOGOS,knownBrandLogo} from '../docs/brand-logos.mjs';
import {SEED_BRANDS} from '../docs/ultimate-core.mjs';

test('all five fixed streetwear labels display sourced public logos, not arbitrary letters',()=>{
  assert.equal(SEED_BRANDS.length,5);
  for(const brand of SEED_BRANDS){
    const logo=knownBrandLogo(brand.handle);
    assert.ok(logo,brand.handle+' should have a brand-sourced logo');
    assert.equal(knownBrandLogo('@'+brand.handle.toUpperCase()),logo);
    assert.ok(logo.source.startsWith('https://'));
    const url=new URL(logo.primary);
    assert.equal(url.protocol,'https:');
    assert.ok(!url.username&&!url.password);
    assert.ok(['cdn.shopify.com','ranyaowt.com','formsv2.soundestlink.com',
      'moremoneymorelove.com','deputydepartment.com'].includes(url.hostname));
    if(logo.fallback){
      const fallback=new URL(logo.fallback);
      assert.equal(fallback.protocol,'https:');
      assert.ok(fallback.pathname.endsWith('/favicon.ico'));
    }
  }
  assert.ok(knownBrandLogo('suvene.de').primary.includes('Suvene-Logo.png'));
  assert.ok(knownBrandLogo('deputydepartment').primary.includes('Main-Logo_1.png'));
});
test('unrecognized or malicious handles never receive another brand logo',()=>{
  for(const handle of ['evil.com','suvene.de.evil.com','javascript:alert(1)',
    '__proto__','constructor','toString',null,42,'']){
    assert.equal(knownBrandLogo(handle),null);
  }
});
test('iPad top story header loads logos with error fallbacks, no user secrets',async()=>{
  const [app,html,css,worker,readme]=await Promise.all([
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/instagram-white.css',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8'),
    readFile(new URL('../README.md',import.meta.url),'utf8')
  ]);
  assert.ok(app.includes("import {knownBrandLogo} from './brand-logos.mjs'"));
  assert.ok(app.includes('brandLogoInner(brand)'));
  assert.ok(app.includes('class="story-logo-image"'));
  assert.ok(app.includes('class="story-logo-fallback"'));
  assert.ok(app.includes("document.addEventListener('load'"));
  assert.ok(app.includes("document.addEventListener('error'"));
  assert.ok(app.includes('img.dataset.logoRetried'));
  assert.ok(css.includes('.story-logo-image.is-loaded'));
  assert.ok(css.includes('.has-loaded-logo>.story-logo-fallback'));
  assert.ok(html.includes('app.js?v=24'));
  assert.ok(html.includes('instagram-white.css?v=24'));
  assert.ok(worker.includes("'./brand-logos.mjs'"));
  assert.ok(worker.includes("CACHE_PREFIX + 'v24'"));
  assert.ok(readme.includes('sourced brand marks in top strip'));
  assert.ok(!app.includes('META_USER_ACCESS_TOKEN'));
});
