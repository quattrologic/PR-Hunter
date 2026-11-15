import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {publicEmbedUrl} from '../docs/discovery-grid.mjs';

function makePreviewModule(source,nodes=[]){
  const start=source.indexOf('// Public Instagram embeds are created only');
  const end=source.indexOf('function openDiscovery(item){',start);
  assert.ok(start>=0&&end>start,'auto preview block present');
  const host={querySelectorAll:()=>nodes};
  let observer;
  const ctx={
    Set,Array,window:{innerHeight:900},
    document:{
      querySelectorAll:()=>nodes,
      createElement(tag){
        assert.equal(tag,'iframe');
        return {tag,src:'',title:'',attrs:{},setAttribute(key,value){this.attrs[key]=value;},
          remove(){if(this.parent)this.parent.frame=null;}};
      }
    },
    $:()=>host,
    ui:{tab:'discover'},
    clean:v=>String(v||'').trim(),
    esc:v=>String(v||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),
    tileTheme:()=> 'art-paper',
    trustedMetaThumbnail:()=>null,
    publicEmbedUrl,
    IntersectionObserver:class {
      constructor(callback,opts){this.callback=callback;this.options=opts;this.observed=[];observer=this;}
      observe(node){this.observed.push(node);}
      disconnect(){this.disconnected=true;}
      trigger(entries){this.callback(entries);}
    }
  };
  vm.runInNewContext(source.slice(start,end)+
    '\nthis.publicMethods={renderDiscoveryTile,mountInstagramAutoPreviews};',ctx);
  return {ctx,methods:ctx.publicMethods,getObserver:()=>observer};
}
function previewNode(index){
  return {isConnected:true,dataset:{
    embedSrc:'https://www.instagram.com/reel/ABCDEFG12/embed/',
    brand:'suvene.de'
  },top:index*320,frame:null,placeholder:{hidden:false},
  closest(){return null;},
  querySelector(selector){return selector==='iframe'?this.frame:
    selector==='.instagram-auto-placeholder'?this.placeholder:null;},
  getBoundingClientRect(){return {top:this.top,height:320};},
  append(frame){this.frame=frame;frame.parent=this;}
  };
}
test('real saved posts render automatic Instagram embed containers, not click-to-load buttons',async()=>{
  const s=await readFile(new URL('../docs/app.js',import.meta.url),'utf8');
  const {methods}=makePreviewModule(s);
  for(const [kind,url] of [
    ['reel','https://www.instagram.com/reel/ABCDEFG12/'],
    ['post','https://www.instagram.com/p/ABCDEFG12/']
  ]){
    const tile=methods.renderDiscoveryTile({kind,url,brand:'@suvene.de',title:'Original'},0);
    assert.ok(tile.includes('class="instagram-auto-preview"'));
    assert.ok(tile.includes('data-embed-src="https://www.instagram.com/'+(kind==='reel'?'reel':'p')+'/ABCDEFG12/embed/"'));
    assert.ok(tile.includes('target="_blank"'));
    assert.ok(tile.includes('data-action="open-discovery"'));
    assert.ok(!tile.includes('inline-reel-preview'));
    assert.ok(!tile.includes('Vorschau laden'));
  }
  const plain=methods.renderDiscoveryTile({kind:'giveaway',url:'https://example.com',brand:'Brand',title:'Gewinnspiel'},0);
  assert.ok(!plain.includes('instagram-auto-preview'));
});
test('viewport observer loads only three live iframes; offscreen posts are unloaded',async()=>{
  const s=await readFile(new URL('../docs/app.js',import.meta.url),'utf8');
  const nodes=Array.from({length:6},(_,i)=>previewNode(i));
  const {methods,getObserver}=makePreviewModule(s,nodes);
  methods.mountInstagramAutoPreviews();
  const observer=getObserver();
  assert.ok(observer);
  assert.equal(observer.observed.length,6);
  observer.trigger(nodes.map(target=>({target,isIntersecting:true})));
  assert.equal(nodes.filter(n=>n.frame).length,3);
  for(const node of nodes.filter(n=>n.frame)){
    assert.equal(node.frame.src,'https://www.instagram.com/reel/ABCDEFG12/embed/');
    assert.equal(node.frame.loading,'eager');
    assert.equal(node.frame.referrerPolicy,'strict-origin-when-cross-origin');
    assert.equal(node.frame.attrs.sandbox,'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    assert.equal(node.placeholder.hidden,true);
  }
  observer.trigger(nodes.slice(0,3).map(target=>({target,isIntersecting:false})));
  assert.equal(nodes.filter(n=>n.frame).length,3);
  assert.ok(nodes.slice(0,3).every(n=>n.frame===null));
  assert.ok(nodes.slice(3).every(n=>n.frame!==null));
  assert.ok(nodes.slice(0,3).every(n=>n.placeholder.hidden===false));
  methods.mountInstagramAutoPreviews();
  assert.ok(observer.disconnected,'old observers disconnected on rerender');
});
test('detail view, offline assets and iPad layout use automatic previews',async()=>{
  const [app,html,worker,css,readme]=await Promise.all([
    readFile(new URL('../docs/app.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/index.html',import.meta.url),'utf8'),
    readFile(new URL('../docs/sw.js',import.meta.url),'utf8'),
    readFile(new URL('../docs/instagram-white.css',import.meta.url),'utf8'),
    readFile(new URL('../README.md',import.meta.url),'utf8')
  ]);
  assert.ok(app.includes('mountInstagramAutoPreviews();'));
  assert.ok(app.includes('preview.replaceChildren(instagramFrame(embed,item.brand));'));
  assert.ok(!app.includes("load.addEventListener('click'"));
  assert.ok(!app.includes("if(action==='inline-reel-preview')"));
  assert.ok(html.includes('app.js?v=27'));
  assert.ok(html.includes('instagram-white.css?v=27'));
  assert.ok(worker.includes("CACHE_PREFIX + 'v27'"));
  assert.ok(css.includes('.instagram-auto-preview>iframe'));
  assert.ok(css.includes('.instagram-auto-footer a'));
  assert.ok(readme.includes('automatic saved Instagram preview'));
});
