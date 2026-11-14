// Private-server integration point. NOT called from GitHub Pages or public Actions.
// Real provider adapters may be configured only after organizer permission,
// authorized user identity, opt-in, official API approval and secure backend setup.
import { automaticEntryGate } from '../docs/auto-hunter-core.mjs';

export async function executeAllowedEntry({
  offer,adapters,consent,receiptStore,identity,now=Date.now()
}) {
  const gate=automaticEntryGate(offer,adapters,consent,now);
  if(!gate.ready)return {status:'blocked',reasons:gate.reasons};
  if(!receiptStore || typeof receiptStore.claimIfAbsent!=='function' ||
     typeof receiptStore.finalize!=='function' || typeof receiptStore.release!=='function')
    return {status:'blocked',reasons:['Kein atomarer, privater Teilnahme-Nachweisspeicher']};
  if(typeof identity?.personId!=='string' || identity.personId.length<16)
    return {status:'blocked',reasons:['Keine verifizierte persönliche Identität']};
  const key=identity.personId+':'+offer.id;
  const claimed=await receiptStore.claimIfAbsent(key);
  if(!claimed)return {status:'duplicate',reasons:['Bereits eine Teilnahme für diese Person registriert oder in Bearbeitung']};
  const adapter=adapters[offer.autoEntry.adapterId];
  try {
    // Adapter sends only data required by an independently approved provider API.
    // It must not solve CAPTCHA, bypass login, spoof identities or post socially.
    const result=await adapter.submit({offer,identity,consent});
    if(!result || result.accepted!==true || typeof result.receiptId!=='string' ||
       !result.receiptId.trim()) {
      // Keep claim reserved: the vendor might have accepted an entry but
      // failed to return a receipt. Never risk silent duplicate submissions.
      return {status:'unknown',reasons:['Keine gültige Bestätigung – manuell beim Anbieter klären']};
    }
    const receipt={offerId:offer.id,provider:offer.autoEntry.adapterId,
      submittedAt:new Date(now).toISOString(),receiptId:result.receiptId.slice(0,150)};
    await receiptStore.finalize(key,receipt);
    return {status:'submitted',receipt};
  }catch(error){
    // A network failure might still mean the provider accepted the entry;
    // preserve the claim to avoid accidental duplicate submissions.
    return {status:'unknown',reasons:['Anbieterantwort unklar – manuell prüfen, nicht erneut senden']};
  }
}
