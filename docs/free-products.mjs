// Phase 9: reviewed discovery destinations, NOT automatically active campaigns.
// All program information is deliberately conservative. Always read original terms.
export const OFFICIAL_PROGRAMS = Object.freeze([
  {
    id:'seame-creator',name:'SEAME – Creator Community',type:'creator',category:'Mode',
    focus:'Fashion & Accessoires',audience:'Damen-/Fashion-orientiert; Größen prüfen',
    url:'https://de.seame-brand.com/pages/ambassador',checkedOn:'2026-11-14',
    noPurchaseToApply:true,freeProducts:'possible',keepPrize:'unknown',
    minFollowers:null,minAge:null,contentRequired:true,shipsToGermany:'unknown',
    overview:'Offene Bewerbung für Mode-Creator. Gratisprodukte sind mögliche Kooperationsbedingungen, aber nicht garantiert.',
    requirements:'Content/Portfolio zeigen; konkrete Leistungen und Nutzungsrechte müssen vorher vereinbart werden.'
  },
  {
    id:'humble-ambassador',name:'HUMBLE ORIGINAL – Ambassador',type:'creator',category:'Mode',
    focus:'Streetwear',audience:'Streetwear; Größen prüfen',
    url:'https://www.humbleoriginal.com/de/pages/brand-ambassador-werden',checkedOn:'2026-11-14',
    noPurchaseToApply:null,freeProducts:'possible',keepPrize:'unknown',
    minFollowers:1000,minAge:null,contentRequired:true,shipsToGermany:'unknown',
    overview:'Bewerbung für Streetwear-Creator. Ausgewählte Kleidung ist als mögliche Leistung aufgeführt.',
    requirements:'Die Marke nennt mindestens 1.000 Instagram-Follower und prüft Stil und Engagement.'
  },
  {
    id:'yfm-ambassador',name:'YFM – Streetwear Ambassador',type:'creator',category:'Mode',
    focus:'Streetwear',audience:'Streetwear; Größen prüfen',
    url:'https://youngfashionmind.de/pages/brand-ambassador',checkedOn:'2026-11-14',
    noPurchaseToApply:null,freeProducts:'possible',keepPrize:'unknown',
    minFollowers:2000,minAge:null,contentRequired:true,shipsToGermany:'unknown',
    overview:'Streetwear-Ambassador-Bewerbung mit möglichem kostenlosem Willkommenspaket bei Aufnahme.',
    requirements:'Die Marke verlangt nach eigenen Angaben mindestens 2.000 aktive Follower.'
  },
  {
    id:'hey-marly',name:'HEY MARLY – Ambassador',type:'creator',category:'Mode',
    focus:'Mode & Accessoires',audience:'Eher Damen-Mode; Passform prüfen',
    url:'https://www.heymarly.com/pages/anmeldung-ambassador-programm',
    termsUrl:'https://www.heymarly.com/en/pages/ambassador-faq',
    checkedOn:'2026-11-14',noPurchaseToApply:true,freeProducts:'after_selection',
    keepPrize:'unknown',minFollowers:0,minAge:18,contentRequired:true,
    shipsToGermany:'unknown',
    overview:'Auch Anfänger können sich bewerben. Nach Zusage kostenlose Produktauswahl für Content – keine Aufnahmegarantie.',
    requirements:'Mindestens 18 Jahre; regelmäßiger kreativer Content nach Annahme. Produktauswahl und Versand beim Anbieter prüfen.'
  },
  {
    id:'trnd',name:'trnd – Produkttests',type:'product_test',category:'Gemischt',
    focus:'Technik, Pflege & weitere Produkte',audience:'Kampagnenabhängig',
    url:'https://www.trnd.com/de/projekte',
    termsUrl:'https://www.trnd.com/de/ueber-trnd/faq',
    checkedOn:'2026-11-14',noPurchaseToApply:true,freeProducts:'after_selection',
    keepPrize:'sometimes',minFollowers:null,minAge:null,contentRequired:false,
    shipsToGermany:'varies',
    overview:'Kostenlose Projektbewerbungen und Produkttests. Ob du ein Produkt behalten darfst, steht im jeweiligen Projekt.',
    requirements:'Registrierung, projektspezifische Auswahlfragen und ehrliches Feedback; Auswahl nicht garantiert.'
  },
  {
    id:'influenster',name:'Influenster – VoxBox',type:'product_test',category:'Gemischt',
    focus:'Kostenlose Testprodukte verschiedener Marken',audience:'Kampagnenabhängig',
    url:'https://www.influenster.com/de',
    termsUrl:'https://influenster.zendesk.com/hc/de/articles/4404895684365--Welche-Programme-bietet-Influenster-an-und-wie-nehme-ich-daran-teil',
    checkedOn:'2026-11-14',noPurchaseToApply:true,freeProducts:'after_selection',
    keepPrize:'unknown',minFollowers:null,minAge:null,contentRequired:false,
    shipsToGermany:'varies',
    overview:'Kostenlose Produktpakete nach Einladung oder Umfrage. Es gibt keine Zusage, dass du etwas bekommst.',
    requirements:'Ehrliches Profil, gegebenenfalls Umfragen und authentische Bewertungen. Keine automatisierte Bewerbung.'
  },
  {
    id:'forme',name:'ForMe – Testen & Behalten',type:'product_test',category:'Gemischt',
    focus:'Markenprodukte für Test und Bewertung',audience:'Kampagnenabhängig',
    url:'https://www.for-me-online.de/testen-und-gewinnen',
    checkedOn:'2026-11-14',noPurchaseToApply:true,freeProducts:'after_selection',
    keepPrize:'yes_per_campaign',minFollowers:null,minAge:null,contentRequired:false,
    shipsToGermany:'varies',
    overview:'Plattform für kostenlose Testprodukte, die ausgewählte Tester behalten dürfen. Aktuelle Produkte wechseln.',
    requirements:'Registrierung, Auswahlfragen und anschließende ehrliche Produktbewertung.'
  }
]);

export const PROGRAM_STATES = Object.freeze([
  'interested','applied','accepted','received','rejected'
]);
export const PROGRAM_STATE_LABELS = Object.freeze({
  interested:'Interessiert',
  applied:'Beworben (selbst bestätigt)',
  accepted:'Angenommen (selbst bestätigt)',
  received:'Produkt erhalten (selbst bestätigt)',
  rejected:'Abgelehnt / nicht ausgewählt'
});

export function normalizeFreeProductPrefs(input) {
  const raw=input && typeof input==='object' && !Array.isArray(input) ? input : {};
  return {
    view:['all','creator','product_test','giveaway'].includes(raw.view) ? raw.view : 'all',
    prioritiseClothing:raw.prioritiseClothing !== false,
    showFollowerRestricted:raw.showFollowerRestricted !== false
  };
}
export function normalizeProgramProgress(input) {
  const raw=input && typeof input==='object' && !Array.isArray(input) ? input : {};
  const allowed=new Set(OFFICIAL_PROGRAMS.map(x=>x.id));
  const result=Object.create(null);
  for(const [id,value] of Object.entries(raw).slice(0,OFFICIAL_PROGRAMS.length)){
    if(!allowed.has(id) || !value || !PROGRAM_STATES.includes(value.status))continue;
    result[id]={status:value.status,updatedAt:
      typeof value.updatedAt==='string' && /^\d{4}-\d\d-\d\dT/.test(value.updatedAt)
        ? value.updatedAt.slice(0,35) : ''};
  }
  return result;
}
export function programWarnings(program,now=Date.now()) {
  const flags=[];
  if(!program || typeof program!=='object')return ['Programm nicht gefunden'];
  const reviewed=Date.parse(program.checkedOn);
  if(!Number.isFinite(reviewed) || now-reviewed>45*86400000)
    flags.push('Quelle nicht frisch geprüft – Bedingungen erneut lesen');
  if(program.keepPrize==='unknown') flags.push('Dauerhaftes Behalten nicht bestätigt');
  if(program.keepPrize==='sometimes') flags.push('Behalten nur bei manchen Projekten');
  if(program.shipsToGermany!=='yes')flags.push('Versand und maximale Versandkosten für Einzelaktion prüfen');
  if(program.minFollowers>0)flags.push('Mindestens '+program.minFollowers.toLocaleString('de-DE')+' Follower verlangt');
  if(program.minAge===18)flags.push('Teilnahme nur ab 18 Jahren');
  if(program.contentRequired)flags.push('Content-Verpflichtungen und Nutzungsrechte prüfen');
  if(program.freeProducts==='possible')flags.push('Gratisprodukte sind nicht garantiert');
  return flags;
}
export function rankPrograms(programs=OFFICIAL_PROGRAMS,prefs={},now=Date.now()) {
  const settings=normalizeFreeProductPrefs(prefs);
  return (Array.isArray(programs)?programs:[]).filter(x=>{
    if(!x || !x.id)return false;
    if(settings.view!=='all' && settings.view!=='giveaway' && x.type!==settings.view)return false;
    if(settings.view==='giveaway')return false;
    if(!settings.showFollowerRestricted && x.minFollowers>0)return false;
    return true;
  }).sort((a,b)=>{
    if(settings.prioritiseClothing){
      const category=Number(b.category==='Mode')-Number(a.category==='Mode');
      if(category)return category;
    }
    const accessible=(x)=>Number(x.minFollowers===0 || x.minFollowers===null) +
      Number(x.noPurchaseToApply===true);
    return accessible(b)-accessible(a) || a.name.localeCompare(b.name,'de');
  });
}
export function classifyOpportunity(item) {
  const title=String(item?.title||'').toLocaleLowerCase('de-DE');
  const type=String(item?.offerType||'').toLocaleLowerCase('de-DE');
  if(/produkttest|product.test|tester gesucht|testpersonen gesucht|kostenlos testen/.test(title+' '+type))
    return 'product_test';
  if(/ambassador|creator|pr.package|pr.paket|ugc|kooperation|collaboration|brand.partner/.test(title+' '+type))
    return 'creator';
  if(/gewinnspiel|verlosung|giveaway|gewinnen/.test(title+' '+type))
    return 'giveaway';
  return 'unknown';
}
export function classifyPublicLeads(catalog=[],prefs={},now=Date.now()) {
  const settings=normalizeFreeProductPrefs(prefs);
  const seen=new Set();
  const list=[];
  for(const item of Array.isArray(catalog)?catalog:[]){
    if(!item || !['Mode','Technik'].includes(item.category))continue;
    if(item.deadline && Number.isFinite(Date.parse(item.deadline)) && Date.parse(item.deadline)<now)continue;
    const url=String(item.url||'');
    if(!/^https:\/\//i.test(url) || seen.has(url))continue;
    const kind=classifyOpportunity(item);
    if(kind==='unknown')continue;
    if(settings.view!=='all' && settings.view!==kind)continue;
    seen.add(url);
    list.push({...item,leadKind:kind,reviewNeeded:true});
  }
  return list.sort((a,b)=>{
    if(settings.prioritiseClothing){
      const c=Number(b.category==='Mode')-Number(a.category==='Mode');
      if(c)return c;
    }
    const priority={product_test:3,creator:2,giveaway:1};
    return (priority[b.leadKind]||0)-(priority[a.leadKind]||0);
  }).slice(0,100);
}
export function programMessage(program) {
  if(!program || program.type!=='creator')return null;
  return [
    'Hallo '+program.name.split(' – ')[0]+'-Team,',
    '',
    'ich interessiere mich für euer Creator-/Ambassador-Programm und möchte mich über die Voraussetzungen informieren.',
    'Ich mag euren Stil und würde gern erfahren, ob ihr aktuell mit neuen Creatorn zusammenarbeitet.',
    'Besonders wichtig sind mir die konkreten Leistungen, mögliche Content-Pflichten, Nutzungsrechte und Versandbedingungen.',
    '',
    'Viele Grüße',
    '[Vorname]'
  ].join('\n');
}
export function programStats(progress,programs=OFFICIAL_PROGRAMS){
  const known=normalizeProgramProgress(progress);
  return {
    programs:programs.length,
    applied:Object.values(known).filter(x=>['applied','accepted','received'].includes(x.status)).length,
    accepted:Object.values(known).filter(x=>['accepted','received'].includes(x.status)).length,
    received:Object.values(known).filter(x=>x.status==='received').length
  };
}
