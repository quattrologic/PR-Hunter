// Phase 7: lightweight iPad presentation and evidence-first source assessment.
// Never promises product quality, delivery, availability or winning odds.
export const FEED_PAGE_SIZE = 18;
export const DISPLAY_MODES = Object.freeze(['system','smooth','reduced']);
export function normalizeDisplayPrefs(input) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    motion: DISPLAY_MODES.includes(raw.motion) ? raw.motion : 'system'
  };
}
export function getVisibleSlice(items, visible = FEED_PAGE_SIZE, pageSize = FEED_PAGE_SIZE) {
  const safe = Array.isArray(items) ? items : [];
  const step = Number.isSafeInteger(pageSize) && pageSize>=1 && pageSize<=100 ? pageSize : FEED_PAGE_SIZE;
  const limit = Number.isSafeInteger(visible) && visible>0 ? Math.min(visible,1000) : step;
  return {
    items: safe.slice(0,limit),
    remaining: Math.max(0,safe.length-limit),
    total:safe.length,
    nextVisible:Math.min(safe.length,limit+step)
  };
}
export function offerVerification(offer, now = Date.now()) {
  const problems = [];
  if (!offer || typeof offer !== 'object') return {
    status:'unknown',label:'Daten fehlen',problems:['Unbekannte Aktion']
  };
  const expires=Date.parse(offer.deadline);
  if(offer.deadline && Number.isFinite(expires) && expires < now)
    return {status:'expired',label:'Abgelaufen',problems:['Die bekannte Teilnahmefrist ist vorbei']};
  if(offer.sourceType !== 'curated') {
    problems.push('Regeln, Gewinn und Veranstalter noch nicht unabhängig geprüft');
    if (!offer.deadline) problems.push('Teilnahmefrist fehlt');
    return {status:'unverified',label:'Fundhinweis · ungeprüft',problems};
  }
  const shipping=String(offer.shippingStatus || '');
  const costs=String(offer.costStatus || '');
  if(shipping !== 'Deutschland laut Bedingungen erlaubt')
    problems.push('Deutschlandversand nicht zuverlässig bestätigt');
  if(!costs || /unklar|nicht ausdrücklich|folgekosten|prüfen|unbestätigt|offen|können/i.test(costs))
    problems.push('Versand- oder Folgekosten vor Teilnahme prüfen');
  if(!offer.deadline || !Number.isFinite(expires))
    problems.push('Teilnahmefrist nicht verifiziert');
  return {
    status:problems.length ? 'reviewed-with-open-questions' : 'reviewed',
    label:problems.length ? 'Regeln geprüft · Angaben offen' : 'Regeln geprüft',
    problems
  };
}
export function shouldAnimate(mode, reducedMotionSystem) {
  const prefs=normalizeDisplayPrefs({motion:mode});
  return !reducedMotionSystem && prefs.motion!=='reduced';
}
