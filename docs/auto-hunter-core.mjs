// PR-Hunter Auto-Hunter: conservative website-only eligibility and consent gates.
// No automatic third-party submissions from this public PWA. No social bots.
import { safeExternalUrl } from './ultimate-core.mjs';

const SOCIAL_DOMAINS = Object.freeze([
  'instagram.com','tiktok.com','facebook.com','threads.net','x.com','twitter.com'
]);
const REQUIRED_REVIEW_AGE_MS = 30 * 86400000;
export const DEFAULT_AUTO_PREFS = Object.freeze({
  enabled:true,
  clothingFirst:true,
  maxShippingEUR:5,
  includeTech:true
});
export function normalizeAutoPrefs(value) {
  const input=value && typeof value==='object' && !Array.isArray(value) ? value : {};
  return {
    enabled:input.enabled !== false,
    clothingFirst:input.clothingFirst !== false,
    maxShippingEUR:5, // User's existing hard limit must not drift.
    includeTech:input.includeTech !== false
  };
}
function isSocialUrl(value){
  const safe=safeExternalUrl(value);
  if(!safe)return false;
  const host=new URL(safe).hostname.toLowerCase();
  return SOCIAL_DOMAINS.some(domain=>host===domain || host.endsWith('.'+domain));
}
const hasValidDate=value=>Number.isFinite(Date.parse(value));
function organizerEvidenceRecent(item,now){
  const date=Date.parse(item?.checkedOn);
  return Number.isFinite(date) && date <= now && (now-date) <= REQUIRED_REVIEW_AGE_MS;
}
// Automatic entry requires a documented, approved vendor API and separate backend consent.
// Even genuine website contests are not assumed to accept programmatic submissions.
export function automaticEntryGate(item, adapters = {}, consent = {}, now = Date.now()) {
  const reasons=[];
  if(!item || typeof item!=='object')return {ready:false,reasons:['Unbekannte Aktion']};
  if(!safeExternalUrl(item.url))reasons.push('Unsicherer Original-Link');
  if(isSocialUrl(item.url))reasons.push('Social-Media-Automation ausgeschlossen');
  if(!hasValidDate(item.deadline) || Date.parse(item.deadline)<=now)reasons.push('Aktive und bestätigte Frist fehlt');
  if(item.sourceType!=='curated')reasons.push('Teilnahmebedingungen nicht redaktionell geprüft');
  if(item.noPurchase!==true)reasons.push('Kaufpflicht nicht ausgeschlossen');
  if(item.keepPrize!==true)reasons.push('Behalten des Gewinns nicht bestätigt');
  if(item.shipsToGermany!==true)reasons.push('Lieferung nach Deutschland nicht bestätigt');
  if(typeof item.shippingCostEUR!=='number' || !Number.isFinite(item.shippingCostEUR) ||
    item.shippingCostEUR<0 || item.shippingCostEUR>5)reasons.push('Versandkosten bis 5 € nicht bestätigt');
  if(!organizerEvidenceRecent(item,now))reasons.push('Teilnahmebedingungen zu alt oder nicht datiert');
  const approval=item.autoEntry;
  if(!approval || approval.allowed!==true || !safeExternalUrl(approval.rulesUrl) ||
    !hasValidDate(approval.reviewedAt) || Date.parse(approval.reviewedAt)>now ||
    now-Date.parse(approval.reviewedAt)>REQUIRED_REVIEW_AGE_MS)
    reasons.push('Automatisierte Teilnahme nicht ausdrücklich und aktuell erlaubt');
  const adapterId=String(approval?.adapterId || '');
  const adapter=Object.hasOwn(adapters,adapterId) ? adapters[adapterId] : null;
  if(!adapter || adapter.approved!==true || typeof adapter.submit!=='function' ||
    !safeExternalUrl(adapter.endpoint) || !safeExternalUrl(item.url) ||
    new URL(adapter.endpoint).hostname!==new URL(item.url).hostname)
    reasons.push('Kein geprüfter offizieller Anbieter-Adapter');
  if(consent.explicitOptIn!==true || consent.identityVerified!==true)
    reasons.push('Persönliche Einwilligung und Identität fehlen');
  if(consent.oneEntryPerPerson!==true)
    reasons.push('Einmal-pro-Person-Regel nicht bestätigt');
  return {ready:reasons.length===0,reasons};
}
export function evaluateWebsiteOffer(item,now=Date.now()) {
  const blockers=[];
  const warnings=[];
  if(!item || typeof item!=='object' || !safeExternalUrl(item.url))
    return {status:'excluded',reason:'Kein gültiger HTTPS-Link',warnings:[]};
  if(isSocialUrl(item.url))
    return {status:'excluded',reason:'Instagram, TikTok und andere Social Media ausgeschlossen',warnings:[]};
  if(item.category!=='Mode' && item.category!=='Technik')
    return {status:'excluded',reason:'Keine gesuchte Kleidung oder Technik',warnings:[]};
  if(item.deadline && hasValidDate(item.deadline) && Date.parse(item.deadline)<=now)
    return {status:'excluded',reason:'Teilnahmefrist vorbei',warnings:[]};
  if(item.sourceType!=='curated')warnings.push('Öffentliche Fundstelle – Regeln noch nicht geprüft');
  if(!item.deadline || !hasValidDate(item.deadline))warnings.push('Frist nicht bestätigt');
  if(item.sourceType==='curated') {
    if(item.noPurchase!==true)warnings.push('Keine Kaufpflicht nicht bestätigt');
    if(item.keepPrize!==true)warnings.push('Gewinn dauerhaft behalten nicht bestätigt');
    if(item.shipsToGermany!==true)warnings.push('Deutschlandversand ungeklärt');
    if(typeof item.shippingCostEUR!=='number' || !Number.isFinite(item.shippingCostEUR))
      warnings.push('Versandkosten bis 5 € nicht bestätigt');
    else if(item.shippingCostEUR>5 || item.shippingCostEUR<0)
      blockers.push('Versand über 5 €');
    if(!organizerEvidenceRecent(item,now))
      warnings.push('Teilnahmebedingungen nicht kürzlich geprüft');
  }
  if(item.sourceType==='curated' && item.noPurchase===false)blockers.push('Kauf erforderlich');
  if(item.sourceType==='curated' && item.keepPrize===false)blockers.push('Gewinn muss zurückgegeben werden');
  if(/store[-\s]?guthaben|gutschein|store\s?credit/i.test(String(item.title||'')+' '+String(item.offerType||'')))
    warnings.push('Guthaben statt direktem Kleidungsstück');
  if(blockers.length) return {status:'excluded',reason:blockers.join(' · '),warnings};
  const next=warnings.length ? 'needs-review' : 'verified-for-manual-entry';
  return {
    status:next,
    reason:next==='needs-review'
      ? 'Automatisch gefunden – vor Teilnahme Bedingungen prüfen'
      : 'Eckdaten geprüft – automatische Teilnahme nicht freigegeben',
    warnings
  };
}
export function autoHunterReport(offers,prefs={},now=Date.now()) {
  const settings=normalizeAutoPrefs(prefs);
  const all=Array.isArray(offers)?offers:[];
  const counts={found:all.length,excluded:0,review:0,eligibleManual:0,submitted:0,automaticEntryReady:0};
  if(!settings.enabled)return {prefs:settings,counts,items:[],updatedAt:new Date(now).toISOString()};
  const items=[];
  for(const offer of all) {
    const result=evaluateWebsiteOffer(offer,now);
    if(result.status==='excluded'){counts.excluded++;continue;}
    if(offer.category==='Technik' && !settings.includeTech){counts.excluded++;continue;}
    if(result.status==='needs-review')counts.review++;
    else counts.eligibleManual++;
    items.push({
      id:String(offer.id||'').slice(0,120),
      title:String(offer.title||'').slice(0,130),
      category:offer.category,
      brand:String(offer.brand||'').slice(0,80),
      url:offer.url,
      deadline:offer.deadline||null,
      status:result.status,reason:result.reason,warnings:result.warnings,
      sourceType:offer.sourceType||'rss'
    });
  }
  items.sort((a,b)=>{
    if(settings.clothingFirst){
      const fashion=Number(b.category==='Mode')-Number(a.category==='Mode');
      if(fashion)return fashion;
    }
    const status=Number(b.status==='verified-for-manual-entry')-Number(a.status==='verified-for-manual-entry');
    if(status)return status;
    return String(b.deadline||'9999').localeCompare(String(a.deadline||'9999')) * -1;
  });
  return {prefs:settings,counts,items:items.slice(0,200),updatedAt:new Date(now).toISOString()};
}
