// Private one-way Drop Hunter PC → PR-Hunter iPad sync.
// Pairing code and bearer token are NEVER committed or sent to GitHub.
const STORAGE_KEY='pr-hunter-drop-hunter-pair-v1';
let connection=null,lastData=null,busy=false,lastUpdated=0;
const $=id=>document.getElementById(id);
const money=cents=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format((cents||0)/100);

export function validateTailnetUrl(input){
  const url=new URL(String(input||'').trim());
  if(url.protocol!=='https:' || url.username || url.password ||
    !url.hostname.toLowerCase().endsWith('.ts.net') ||
    url.search || url.hash || url.pathname!=='/' || (url.port && !/^\d{2,5}$/.test(url.port)))
    throw new Error('Nur eine private Tailscale-HTTPS-Adresse (*.ts.net) ist erlaubt.');
  return url.origin;
}
export function safePrivateSnapshot(data){
  if(!data || data.schema!=='drop-hunter-private-sync-v1' ||
      !Array.isArray(data.drops) || !Array.isArray(data.orders))throw new Error('Ungültige PC-Synchronisierungsdaten.');
  return {
    updated:typeof data.lastUpdated==='string'?data.lastUpdated:'',
    drops:data.drops.slice(0,500).filter(x=>x && typeof x.brand==='string' &&
      typeof x.url==='string' && /^https:\/\//i.test(x.url))
      .map(x=>({brand:x.brand.slice(0,80),url:x.url,startsAt:String(x.startsAt||'').slice(0,40),note:String(x.note||'').slice(0,180)})),
    orders:data.orders.slice(0,500).filter(x=>x && typeof x.brand==='string' &&
      Number.isInteger(x.amountCents)&&x.amountCents>=0&&x.amountCents<=10000)
      .map(x=>({brand:x.brand.slice(0,80),amountCents:x.amountCents,status:['bestellt','versandt','angekommen'].includes(x.status)?x.status:'bestellt',createdAt:String(x.createdAt||'').slice(0,40)}))
  };
}
function showMessage(text,success=false){
  const el=$('dhSyncStatus');if(!el)return;
  el.textContent=text;el.dataset.status=success?'ok':'info';
}
function textEl(name,content,klass){
  const element=document.createElement(name);
  if(klass)element.className=klass;
  element.textContent=String(content);
  return element;
}
function dateLabel(value){
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toLocaleString('de-DE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'Zeit nicht bekannt';
}
function render(){
  if(!$('dhDropsList'))return;
  const countDrops=lastData?.drops?.length||0,countOrders=lastData?.orders?.length||0;
  $('dhDropCount').textContent=String(countDrops);
  $('dhOrderCount').textContent=String(countOrders);
  $('dhSpend').textContent=money(lastData?.orders?.reduce((sum,o)=>sum+o.amountCents,0)||0);
  $('dhPairForm').hidden=!!connection;
  $('dhConnectedControls').hidden=!connection;
  const drops=$('dhDropsList'),orders=$('dhOrdersList');
  drops.replaceChildren();orders.replaceChildren();
  if(!lastData){
    drops.append(textEl('p','Noch keine PC-Dropdaten synchronisiert.','dh-empty'));
    orders.append(textEl('p','Noch keine bestätigten Bestellungen übertragen.','dh-empty'));
    return;
  }
  if(!lastData.drops.length)drops.append(textEl('p','Keine gespeicherten PC-Drops.','dh-empty'));
  for(const drop of lastData.drops){
    const article=document.createElement('article');article.className='dh-row';
    const info=document.createElement('div');
    info.append(textEl('strong',drop.brand),textEl('small',dateLabel(drop.startsAt)+(drop.note?' · '+drop.note:'')));
    article.append(info);
    try{
      const url=new URL(drop.url);
      if(url.protocol==='https:' && !url.username && !url.password){
        const link=textEl('a','Shop ↗');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';
        article.append(link);
      }
    }catch{}
    drops.append(article);
  }
  if(!lastData.orders.length)orders.append(textEl('p','Keine manuell bestätigten Bestellungen.','dh-empty'));
  for(const order of lastData.orders){
    const article=document.createElement('article');article.className='dh-row';
    const info=document.createElement('div');
    info.append(textEl('strong',order.brand),textEl('small',dateLabel(order.createdAt)+' · '+order.status));
    article.append(info,textEl('b',money(order.amountCents)));
    orders.append(article);
  }
}
async function refresh(){
  if(!connection || busy || document.visibilityState!=='visible')return;
  busy=true;showMessage('PC-Verbindung wird geprüft …');
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
    let response;
    try{
      response=await fetch(connection.origin+'/v1/snapshot',{
        cache:'no-store',mode:'cors',headers:{Authorization:'Bearer '+connection.token},
        signal:controller.signal
      });
    }finally{clearTimeout(timer);}
    if(response.status===401){
      connection=null;lastData=null;
      try{localStorage.removeItem(STORAGE_KEY);}catch{}
      render();throw new Error('Kopplung ungültig. Bitte am PC einen neuen Code erstellen.');
    }
    if(!response.ok)throw new Error('PC-Server meldet HTTP '+response.status+'.');
    lastData=safePrivateSnapshot(await response.json());
    lastUpdated=Date.now();
    render();
    showMessage('Verbunden · zuletzt aktualisiert '+new Date(lastUpdated).toLocaleTimeString('de-DE')+'.',true);
  }catch(err){
    showMessage('Keine Verbindung zum PC: '+String(err.message||err)+'. Prüfe Tailscale Serve, WLAN und dass Drop Hunter läuft.');
  }finally{busy=false;}
}
async function pair(event){
  event.preventDefault();
  if(busy)return;
  busy=true;
  const form=event.currentTarget;
  let origin;
  try{
    origin=validateTailnetUrl(form.elements.url.value);
    const code=form.elements.code.value.trim();
    if(!/^\d{8}$/.test(code))throw new Error('Bitte den achtstelligen Einmalcode aus der PC-App eingeben.');
    showMessage('Sichere Verbindung zum PC wird aufgebaut …');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    let response;
    try{
      response=await fetch(origin+'/v1/pair',{
        method:'POST',cache:'no-store',mode:'cors',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({code}),signal:controller.signal
      });
    }finally{clearTimeout(timer);}
    if(!response.ok)throw new Error('Kopplung abgelehnt (HTTP '+response.status+').');
    const data=await response.json();
    if(data.schema!=='drop-hunter-pair-v1'||typeof data.token!=='string'||data.token.length<30)
      throw new Error('Unbekannte Antwort vom PC.');
    connection={origin,token:data.token};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(connection));
    form.elements.code.value='';render();busy=false;await refresh();
  }catch(err){showMessage(String(err.message||err));}
  finally{busy=false;}
}
export function initDropHunterSync(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(raw && typeof raw.token==='string' && raw.token.length>=30){
      connection={origin:validateTailnetUrl(raw.origin),token:raw.token};
    }
  }catch{}
  $('dhPairForm')?.addEventListener('submit',pair);
  $('dhRefresh')?.addEventListener('click',()=>refresh());
  $('dhDisconnect')?.addEventListener('click',()=>{
    if(!confirm('Kopplung auf diesem iPad trennen? Der PC bleibt unverändert.'))return;
    connection=null;lastData=null;lastUpdated=0;
    localStorage.removeItem(STORAGE_KEY);render();showMessage('iPad-Verbindung getrennt.');
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&connection)refresh();});
  setInterval(()=>{if(connection && Date.now()-lastUpdated>30000)refresh();},30000);
  render();
  if(connection)refresh();
}
export function refreshDropHunterSync(){return refresh();}
