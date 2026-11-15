// Phase 12: private, user-confirmed brand offer tracking.
// No Instagram access, no DM scraping, no address/payment storage.
import { normalizeDmHandle } from './dm-assistant.mjs';

export const OFFER_STATUSES=Object.freeze([
  'offered','shipping-asked','confirmed','shipped','received','closed'
]);
export const OFFER_STATUS_LABELS=Object.freeze({
  offered:'Angebot erhalten',
  'shipping-asked':'Details angefragt',
  confirmed:'Von dir bestätigt',
  shipped:'Laut dir versendet',
  received:'Von dir erhalten',
  closed:'Beendet'
});
const MAX_OFFERS=100;
const MAX_ITEM_CHARS=100;
const validDate=(value)=>typeof value==='string' && value.length<=40 &&
  Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : '';
const validId=value=>typeof value==='string' && /^offer-[a-zA-Z0-9-]{8,88}$/.test(value);
function cleanItem(value) {
  return String(value??'').trim().slice(0,MAX_ITEM_CHARS).replace(/[\u0000-\u001f\u007f]/g,' ');
}
function validCost(value) {
  if(typeof value!=='number' || !Number.isFinite(value) || value<0 || value>1000)return null;
  return Math.round(value*100)/100;
}
function normalizeOne(raw){
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) return null;
  const id=raw.id, brand=normalizeDmHandle(raw.brand), item=cleanItem(raw.item);
  if(!validId(id) || !brand || !item)return null;
  const shippingConfirmed=raw.shippingConfirmed===true;
  return {
    id,brand,item,
    status:OFFER_STATUSES.includes(raw.status)?raw.status:'offered',
    productFreeConfirmed:raw.productFreeConfirmed===true,
    germanyConfirmed:raw.germanyConfirmed===true,
    shippingConfirmed,
    shippingEUR:shippingConfirmed?validCost(raw.shippingEUR):null,
    createdAt:validDate(raw.createdAt),
    updatedAt:validDate(raw.updatedAt)
  };
}
export function normalizeBrandOffers(input) {
  if(!Array.isArray(input))return [];
  const seen=new Set(),items=[];
  for(const raw of input){
    const offer=normalizeOne(raw);
    if(!offer || seen.has(offer.id))continue;
    seen.add(offer.id);items.push(offer);
    if(items.length>=MAX_OFFERS)break;
  }
  return items;
}
export function createBrandOffer(current,input,id,now=new Date()) {
  const existing=normalizeBrandOffers(current);
  const brand=normalizeDmHandle(input?.brand);
  const item=cleanItem(input?.item);
  if(!brand || !item)return {offers:existing,added:false,reason:'Gib einen gültigen Markennamen und das angebotene Produkt ein.'};
  if(!validId(id))return {offers:existing,added:false,reason:'Ungültige interne Angebotskennung.'};
  if(existing.some(x=>x.id===id))return {offers:existing,added:false,reason:'Dieses Angebot ist bereits gespeichert.'};
  if(existing.length>=MAX_OFFERS)return {offers:existing,added:false,reason:'Maximal 100 Angebote speicherbar.'};
  const when=now instanceof Date && Number.isFinite(now.getTime())?now.toISOString():new Date().toISOString();
  const offer=normalizeOne({
    id,brand,item,createdAt:when,updatedAt:when,
    status:input?.status==='shipping-asked'?'shipping-asked':'offered',
    productFreeConfirmed:false,germanyConfirmed:false,
    shippingConfirmed:false,shippingEUR:null
  });
  return {offers:[offer,...existing],added:true,reason:null};
}
export function updateBrandOffer(current,id,patch,now=new Date()) {
  const when=now instanceof Date && Number.isFinite(now.getTime())?now.toISOString():new Date().toISOString();
  return normalizeBrandOffers(current).map(offer=>{
    if(offer.id!==id)return offer;
    // Only editable fields are copied, protecting id, brand and creation timestamp.
    const next={...offer};
    if(patch && Object.hasOwn(patch,'status') && OFFER_STATUSES.includes(patch.status))next.status=patch.status;
    if(patch && Object.hasOwn(patch,'productFreeConfirmed'))next.productFreeConfirmed=patch.productFreeConfirmed===true;
    if(patch && Object.hasOwn(patch,'germanyConfirmed'))next.germanyConfirmed=patch.germanyConfirmed===true;
    if(patch && Object.hasOwn(patch,'shippingConfirmed')){
      next.shippingConfirmed=patch.shippingConfirmed===true;
      if(!next.shippingConfirmed)next.shippingEUR=null;
    }
    if(patch && Object.hasOwn(patch,'shippingEUR') && next.shippingConfirmed)
      next.shippingEUR=validCost(patch.shippingEUR);
    if(patch && Object.hasOwn(patch,'item')){
      const item=cleanItem(patch.item);
      if(item)next.item=item;
    }
    next.updatedAt=when;
    return next;
  });
}
export function offerWarnings(offer) {
  if(!offer)return ['Kein Angebot ausgewählt'];
  const warnings=[];
  if(!offer.productFreeConfirmed)warnings.push('Kostenloses Produkt noch nicht eindeutig bestätigt');
  if(!offer.germanyConfirmed)warnings.push('Versand nach Deutschland noch nicht bestätigt');
  if(!offer.shippingConfirmed || offer.shippingEUR===null)
    warnings.push('Versandkosten noch nicht bestätigt');
  else if(offer.shippingEUR>5)warnings.push('Versand über deinem Limit von 5 €');
  return warnings;
}
export function offerStats(input) {
  const offers=normalizeBrandOffers(input);
  return {
    total:offers.length,
    awaiting:offers.filter(x=>['offered','shipping-asked'].includes(x.status)).length,
    confirmed:offers.filter(x=>['confirmed','shipped'].includes(x.status)).length,
    received:offers.filter(x=>x.status==='received').length
  };
}
export function offerReplyTemplate(offer,language='en'){
  if(!offer || !normalizeDmHandle(offer.brand))return null;
  const en='Thanks so much! 🙌 Which items are available, and is shipping to Germany included? Just to confirm, would the products and shipping be completely free? I’d love to know before sharing any personal details.';
  const de='Vielen Dank! 🙌 Welche Teile stehen zur Auswahl, und ist der Versand nach Deutschland möglich? Nur zur Sicherheit: Sind die Produkte und der Versand komplett kostenlos? Ich würde das gern wissen, bevor ich persönliche Daten teile.';
  return language==='de'?de:en;
}
