// Phase 3 – local-first participation workflow. No Instagram API, login, scraping or posting.
export const CHECKLIST_TASKS = Object.freeze([
  { id:'rules', label:'Originalbeitrag und Regeln gelesen', section:'required' },
  { id:'eligibility', label:'Alter, Deutschlandversand, Kosten und Behalten geprüft', section:'required' },
  { id:'follow', label:'Marke folgen (falls verlangt)', section:'social' },
  { id:'like', label:'Beitrag liken (falls verlangt)', section:'social' },
  { id:'comment', label:'Eigenen Kommentar veröffentlichen (falls verlangt)', section:'social' },
  { id:'tag', label:'Person markieren – nur mit deren Einverständnis (falls verlangt)', section:'social' },
  { id:'story', label:'Beitrag in Story teilen (falls verlangt)', section:'social' },
  { id:'newsletter', label:'Newsletter-Teilnahmeformular ausfüllen', section:'official' },
  { id:'email', label:'Bestätigungs-E-Mail öffnen (Double-Opt-in)', section:'official' },
  { id:'whatsapp', label:'Offiziellen WhatsApp-Kanal selbst aufrufen', section:'official' },
  { id:'form', label:'Gewinnspielformular beim Anbieter abschicken', section:'official' }
]);
const VALID_IDS = new Set(CHECKLIST_TASKS.map(x => x.id));
const REQUIRED = ['rules','eligibility'];
const SOCIAL = ['follow','like','comment','tag','story'];
export function requiredSteps(item) {
  const method = String(item?.participation || '').toLowerCase();
  const steps = [...REQUIRED];
  if (/newsletter/.test(method)) steps.push('newsletter');
  if (/double.opt.in/.test(method)) steps.push('email');
  if (/whatsapp/.test(method)) steps.push('whatsapp');
  if (/formular/.test(method)) steps.push('form');
  return [...new Set(steps)];
}
export function normalizeSelectedSteps(item, selection = []) {
  const required = requiredSteps(item);
  const chosen = Array.isArray(selection) ? selection.filter(id => VALID_IDS.has(id) && !required.includes(id)) : [];
  return [...required, ...new Set(chosen)];
}
export function stepDefinitions(item, selection = []) {
  const chosen = normalizeSelectedSteps(item, selection);
  return CHECKLIST_TASKS.filter(task => chosen.includes(task.id));
}
export function checklistProgress(item, selection = [], completed = []) {
  const steps = normalizeSelectedSteps(item, selection);
  const done = new Set(Array.isArray(completed) ? completed.filter(id => steps.includes(id)) : []);
  return {
    total: steps.length,
    finished: done.size,
    complete: steps.every(id => done.has(id)),
    remaining: steps.filter(id => !done.has(id))
  };
}
export function offerWarnings(item, now = Date.now()) {
  const warnings = [];
  if (!item) return ['Unbekannte Aktion'];
  if (item.deadline && Number.isFinite(Date.parse(item.deadline)) && Date.parse(item.deadline) < now)
    warnings.push('Teilnahmefrist ist abgelaufen');
  if (item.sourceType !== 'curated')
    warnings.push('Teilnahmebedingungen nicht unabhängig geprüft');
  if (item.sourceType === 'curated') {
    if (item.shippingStatus !== 'Deutschland laut Bedingungen erlaubt')
      warnings.push('Lieferung nach Deutschland nicht bestätigt');
    const cost = String(item.costStatus || '').toLowerCase();
    if (/unklar|nicht ausdrücklich|folgekosten|prüfen|unbestätigt/.test(cost))
      warnings.push('Mögliche Versand- oder Folgekosten ungeklärt');
  }
  if (!item.deadline) warnings.push('Teilnahmefrist unbekannt');
  return warnings;
}
export function isConfirmedParticipation(activities, offerId) {
  return Array.isArray(activities) && activities.some(log =>
    log?.offerId === offerId && ['entered','won','received'].includes(log.type));
}
export function canConfirmEntry(item, selection = [], completed = [], activities = [], now = Date.now()) {
  if (!item || isConfirmedParticipation(activities, item.id)) return false;
  if (item.deadline && Number.isFinite(Date.parse(item.deadline)) && Date.parse(item.deadline) < now) return false;
  return checklistProgress(item, selection, completed).complete;
}
export function timeUntilDeadline(item, now = Date.now()) {
  const ms = Date.parse(item?.deadline);
  if (!Number.isFinite(ms)) return null;
  const hours = Math.ceil((ms - now) / 3_600_000);
  if (hours <= 0) return { status:'expired', hours:0, label:'Abgelaufen' };
  if (hours <= 24) return { status:'urgent', hours, label:'Noch ' + hours + ' Std.' };
  const days = Math.ceil(hours / 24);
  return { status: days <= 3 ? 'soon' : 'later', hours, label:'Noch ' + days + ' Tage' };
}
export function urgentOffers(items, now = Date.now()) {
  if (!Array.isArray(items)) return [];
  return items.filter(item => {
    const deadline = timeUntilDeadline(item, now);
    return deadline && deadline.status !== 'expired' && deadline.hours <= 72;
  }).sort((a,b) => Date.parse(a.deadline) - Date.parse(b.deadline));
}
export function suggestedComments(item) {
  const title = String(item?.title || '').toLowerCase();
  const fashion = item?.category === 'Mode';
  const product = /hoodie|sweater|pullover/.test(title) ? 'Hoodie' :
    /sneaker|schuhe|shoes/.test(title) ? 'Sneaker' :
    /tracksuit|anzug/.test(title) ? 'Tracksuit' :
    fashion ? 'Piece' : 'Produkt';
  return [
    'Der ' + product + ' sieht echt stark aus! 🔥',
    'Richtig coole Aktion – viel Glück an alle! 🤍',
    'Sehr nice, die Details gefallen mir richtig gut.'
  ];
}
export function safeTaskSelection(value) {
  return Array.isArray(value) ? [...new Set(value.filter(id => VALID_IDS.has(id) && SOCIAL.includes(id)))] : [];
}
