// Dipti's own logging, stored in the canon sheet: logs are Notes (append-only,
// tagged, with a JSON DATA line). Pure functions, no DOM; unit tested.
//
// Proportion is a design rule here, not a tone: every log gets one plain
// "how much to worry" level and one next step, never a list of possibilities.
import { triage, maxLevel } from './triage.js';

export const TZ = 'Asia/Kolkata';

export const TAGS = {
  symptom: 'symptom-log', meds: 'meds-taken', says: 'dipti-says', fact: 'fact', concern: 'concern', found: 'found-out',
};

// Her symptoms, in her words. `area` links a symptom to a priority.
export const SYMPTOMS = [
  { id: 'tooth', label: 'Tooth or gum pain', short: 'Tooth', area: 'tooth' },
  { id: 'abdomen', label: 'Right-side tummy pain', short: 'Tummy', area: 'abdomen' },
  { id: 'tired', label: 'Very tired or drained', short: 'Tired', area: 'fatigue' },
  { id: 'diarrhoea', label: 'Diarrhoea', short: 'Diarrhoea', area: 'abdomen' },
  { id: 'sick', label: 'Being sick (vomiting)', short: 'Vomiting', area: 'abdomen' },
  { id: 'joints', label: 'Joint pain or swelling', short: 'Joints' },
  { id: 'sleep', label: 'Poor sleep', short: 'Sleep', area: 'fatigue' },
  { id: 'dizzy', label: 'Dizzy or light-headed', short: 'Dizzy' },
  { id: 'other', label: 'Something else', short: 'Other' },
];
export const WHEN = [['now', 'Right now'], ['today', 'Earlier today'], ['week', 'This week']];
export const SEVERITY = [['mild', 'Mild'], ['moderate', 'Moderate'], ['bad', 'Bad']];

// Small, evidence-based habits for her three priorities (see
// knowledge/dental-evidence.md and the Evidence tab).
export const HABIT_IDEAS = [
  'Chew on the left side', 'Night guard in before sleep', 'Soft, lukewarm food today',
  'Same bedtime as last night', 'A 15 minute gentle walk', 'Steroid card in my bag',
];

export function localDay(ts, tz = TZ) {
  const d = new Date(ts);
  return isNaN(d) ? '' : d.toLocaleDateString('en-CA', { timeZone: tz });
}

export function noteText(summary, data) {
  return `${summary}\nDATA: ${JSON.stringify(data)}`;
}
export function noteData(n) {
  const t = String(n.text || ''); const i = t.indexOf('\nDATA: ');
  if (i < 0) return null;
  try { return JSON.parse(t.slice(i + 7)); } catch { return null; }
}
export function noteSummary(n) { return String(n.text || '').split('\nDATA: ')[0].split('\nRID: ')[0]; }

// How much to worry about one log: the shared red-flag rules, plus the
// structured fields. Deliberately calm: "routine" and "soon" are the usual
// answers; only real red flags go higher.
export function symptomLevel(log) {
  const s = SYMPTOMS.find(x => x.id === log.symptom);
  const words = `${s ? s.label : ''} ${log.when === 'now' ? 'right now' : ''} ${log.note || ''}`;
  let level = triage(words).level;
  // Repeated diarrhoea or vomiting on long-term steroids: sick-day rules today.
  if (log.symptom === 'diarrhoea' && log.severity !== 'mild') level = maxLevel(level, 'urgent');
  if (log.symptom === 'sick') level = maxLevel(level, 'urgent');
  if (log.symptom === 'dizzy' && log.severity === 'bad') level = maxLevel(level, 'urgent');
  if (log.severity === 'bad' && level === 'routine') level = 'soon';
  return level;
}

// The plain line shown after a log: one level, one next step.
export const WORRY = {
  routine: { title: 'Noted. Nothing worrying in that', step: 'It is in your record for your next appointment.' },
  soon: { title: 'Worth mentioning this week', step: 'Not an emergency. Add it to your questions for the right doctor.' },
  urgent: { title: 'Call your doctor today', step: 'This needs a same-day word with a doctor.' },
  emergency: { title: 'Get help now', step: 'Call 112 (India) or 999 (UK), or go to the nearest emergency department.' },
};

// Has she asked about the same thing in the last day? Then the doctor points
// back to her plan instead of re-analysing it from scratch.
const STOP = new Set('the a an and or of to in is it my i me with for on at be was are this that what why how do does can should about from have has when there they you your not but if so as by again still really very just'.split(' '));
const words = s => new Set((String(s).toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !STOP.has(w)).map(w => w.slice(0, 6)));
export function repeatAsk(canon, message, now = Date.now(), hours = 24) {
  const want = words(message);
  if (want.size < 2) return 0;
  return (canon?.notes || []).filter(n => n.tag === TAGS.concern && now - new Date(n.tsUTC).getTime() < hours * 3600000)
    .map(n => words((String(n.text).match(/^CONCERN:\s*([\s\S]*?)(?:\nURGENCY:|$)/) || [, ''])[1]))
    .filter(have => {
      let same = 0; for (const w of want) if (have.has(w)) same++;
      return same >= 2 && same / want.size >= 0.5;
    }).length;
}

// The latest check-in scores, for the Today screen.
export function lastCheckin(canon) {
  const c = (canon?.checkins || []).slice(-1)[0];
  if (!c) return null;
  return { ts: c.tsUTC, tooth: +c.tooth, abdomen: +c.abdomen, fatigue: +c.fatigue, sleep: c.sleep, bowels: c.bowels, mood: c.mood, verdict: c.verdict };
}

// Score series for one area (tooth | abdomen | fatigue), oldest first.
export function scoreSeries(canon, area, n = 14) {
  return (canon?.checkins || []).filter(c => c[area] !== '' && !isNaN(+c[area])).slice(-n).map(c => ({ ts: c.tsUTC, value: +c[area] }));
}
