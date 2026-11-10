// "Not now": a step she has chosen to set aside, with her reason if she gave
// one, and when to bring it back. Each choice is a Notes row in her own words
// (tag step-paused / step-resumed), so it needs no new Sheet column and her
// doctors, Ellie and the Sheet all see it. Pure; unit tested.
import { noteText, noteData } from './dipti-model.js';

export const PAUSE = 'step-paused';
export const RESUME = 'step-resumed';
export const REASONS = ['Not ready yet', 'Trying something else first', 'Time or cost', 'Want to talk it over first'];
export const WHEN = [['week', 'In a week'], ['month', 'In a month'], ['ask', 'Only when I ask']];

const iso = d => d.toISOString().slice(0, 10);
export function untilFor(when, today) {
  if (when === 'ask') return '';
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (when === 'month' ? 30 : 7));
  return iso(d);
}

// The Notes row for setting a step aside, and for bringing it back.
export function pauseNote(p, { reason = '', until = '' } = {}) {
  const r = String(reason || '').trim();
  return noteText(`SET ASIDE: ${p.nextStep}${r ? `. Why: ${r}` : ''}`, { pid: p.id, step: p.nextStep, until, reason: r });
}
export const resumeNote = p => noteText(`BACK ON: ${p.nextStep}`, { pid: p.id, step: p.nextStep });

// Is this priority's step set aside today? The latest choice for it wins. A
// pause covers the step as it was worded: if the step is changed, the new
// one is not set aside. Returns {until, reason} or null.
export function pauseOf(canon, p, today) {
  if (!p?.id || !p.nextStep) return null;
  let last = null;
  for (const n of canon?.notes || []) {
    if (n.tag !== PAUSE && n.tag !== RESUME) continue;
    const d = noteData(n);
    if (!d || d.pid !== p.id) continue;
    if (!last || String(n.tsUTC) >= String(last.n.tsUTC)) last = { n, d };
  }
  if (!last || last.n.tag !== PAUSE) return null;
  if (String(last.d.step).trim() !== String(p.nextStep).trim()) return null;
  if (last.d.until && last.d.until <= today) return null; // its time has come
  return { until: last.d.until || '', reason: last.d.reason || '' };
}

// "Until 17 Nov", or "Until you ask".
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function pauseLine(pz) {
  if (!pz) return '';
  if (!pz.until) return 'Set aside until you bring it back';
  const [, m, d] = pz.until.split('-').map(Number);
  return `Set aside until ${d} ${MON[m - 1]}`;
}
