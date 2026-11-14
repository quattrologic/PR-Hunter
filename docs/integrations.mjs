// Phase 5: an honest integration-readiness model and public-feed matching.
// Not an OAuth implementation; never accepts or stores access tokens.
export const META_OPTIONS = Object.freeze({
  instagram_login: Object.freeze({
    label:'Instagram Login',
    needsPage:false,
    capabilities:Object.freeze(['Eigenes Profil verwalten','Eigene Beiträge und Kommentare','Unterstützte Nachrichten']),
    unavailable:Object.freeze(['Beliebige fremde Reel-Kommentare','Automatisches Liken/Folgen','Uneingeschränkte Hashtag-Suche'])
  }),
  facebook_login: Object.freeze({
    label:'Facebook Login',
    needsPage:true,
    capabilities:Object.freeze(['Professionelles Instagram-Profil','Bestimmte Hashtag-Suchfunktionen','Business Discovery im erlaubten Umfang']),
    unavailable:Object.freeze(['Fremde Gewinnspielkommentare massenhaft veröffentlichen','Automatisches Liken/Folgen'])
  })
});
export const INTEGRATION_STEPS = Object.freeze([
  {id:'professional',label:'Eigenes Instagram-Konto auf Business oder Creator einstellen'},
  {id:'app',label:'Eigene Meta-Developer-App registrieren'},
  {id:'backend',label:'Sicheren HTTPS-Server für OAuth einrichten (nicht GitHub Pages)'},
  {id:'permissions',label:'Benötigte Meta-Berechtigungen und ggf. App-Prüfung klären'}
]);
const STEP_IDS = new Set(INTEGRATION_STEPS.map(x=>x.id));
export function normalizeIntegrationSetup(input) {
  const mode = input?.mode === 'facebook_login' ? 'facebook_login' : 'instagram_login';
  const checked = Array.isArray(input?.checked)
    ? [...new Set(input.checked.filter(x=>STEP_IDS.has(x)))] : [];
  return {mode,checked};
}
export function integrationStatus(input) {
  const state = normalizeIntegrationSetup(input);
  const missing = INTEGRATION_STEPS.filter(step=>!state.checked.includes(step.id));
  return {
    ...state,
    checkedCount:state.checked.length,
    total:INTEGRATION_STEPS.length,
    missing,
    configuredForPlanning:missing.length===0,
    connected:false,
    label:missing.length ? 'Vorbereitung offen' : 'Voraussetzungen laut eigener Checkliste abgehakt – nicht verbunden'
  };
}
function norm(value) {
  return String(value || '').toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function brandTokens(brand) {
  if (!brand || typeof brand !== 'object') return [];
  const tokens = [norm(brand.name), norm(String(brand.handle || '').split('.')[0])];
  if (brand.id === '6pm') tokens.push('6pm');
  if (brand.id === 'mmml') tokens.push('more money more love');
  return [...new Set(tokens.filter(t=>t.length>=4 || t==='6pm'))];
}
function hasPhrase(haystack, phrase) {
  return (' '+haystack+' ').includes(' '+phrase+' ');
}
// Only match the organizer's brand name, or explicit words in offer titles.
// Never treat an article sidebar mentioning a brand as a confirmed brand giveaway.
export function matchedPublicOffers(brand, offers, now = Date.now()) {
  const tokens = brandTokens(brand);
  if (!tokens.length || !Array.isArray(offers)) return [];
  return offers.filter(offer => {
    if (!offer || !offer.url || typeof offer.title !== 'string') return false;
    if (offer.deadline && Number.isFinite(Date.parse(offer.deadline)) &&
        Date.parse(offer.deadline) < now) return false;
    const organizer = norm(offer.brand);
    const headline = norm(offer.title);
    return tokens.some(token => (organizer && (organizer===token || hasPhrase(organizer,token))) ||
      hasPhrase(headline,token));
  });
}
export function buildBrandSearchLink(brand) {
  const keyword = String(brand?.handle || brand?.name || '').replace(/[^a-zA-Z0-9._\s-]/g,'').trim().slice(0,80);
  if (!keyword) return null;
  const search = 'site:instagram.com (' + keyword + ') ("giveaway" OR "gewinnspiel" OR "verlosung")';
  return 'https://www.google.com/search?q=' + encodeURIComponent(search);
}
export function sourceHealthSummary(sources) {
  const list = Array.isArray(sources) ? sources : [];
  const success = list.filter(x=>x && x.status === 'ok');
  return {
    checked:list.length,
    succeeded:success.length,
    matching:success.reduce((sum,x)=>sum+(Number.isSafeInteger(x.matching) && x.matching>0 ? x.matching : 0),0),
    broken:list.filter(x=>x?.status !== 'ok').map(x=>String(x?.name || 'Unbekannte Quelle').slice(0,80))
  };
}
