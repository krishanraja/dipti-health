// The fact checker: which facts in her Sheet are due a "still right?" check.
// Her medicines, symptoms and appointments change often, so each one is
// checked again after a while, and a few come up each day. Past appointments
// that are still "booked" come first, then upcoming ones, then medicines her
// list and prescription disagree on, then symptoms, then everything else by
// oldest check. Pure functions; browser and tests.
import { priorities } from './record-model.js';
import { TZ } from './dipti-model.js';
import { parseDate } from './metrics.js';

export const STALE_DAYS = 7;
export const PER_DAY = 3;

// "YYYY-MM-DD" for a date in her time zone.
export const dayOf = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
// The Sheet can hand a date back as "2026-10-08" or as a full date string.
const iso = s => { const p = parseDate(s); return p ? `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : ''; };
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const since = (checked, today) => (iso(checked) ? days(iso(checked), today) : 999);
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Tue 28 Oct", or "today" / "tomorrow".
export function whenText(date, time, today = dayOf()) {
  const d = iso(date);
  if (!d) return '';
  const n = days(today, d);
  const t = new Date(d + 'T12:00:00Z');
  const day = n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : `${WD[t.getUTCDay()]} ${t.getUTCDate()} ${MON[t.getUTCMonth()]}`;
  return `${day}${time ? ' ' + time : ''}`;
}

export const ANSWERS = {
  med: [['still', 'Yes, still right'], ['changed', 'The dose or time changed'], ['stopped', 'I stopped it']],
  apptPast: [['done', 'Yes, I went'], ['moved', 'It moved to another day'], ['cancelled', 'It was cancelled']],
  apptSoon: [['still', 'Yes, still on'], ['moved', 'It moved'], ['cancelled', 'It was cancelled']],
  symptom: [['still', 'About the same'], ['better', 'Getting better'], ['done', 'Gone now'], ['worse', 'Worse']],
};

export function appointments(canon, today = dayOf()) {
  const rows = (canon.appointments || []).map(a => ({ ...a, date: iso(a.date) })).filter(a => a.date);
  const booked = rows.filter(a => (a.status || 'booked') === 'booked');
  return {
    upcoming: booked.filter(a => a.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    overdue: booked.filter(a => a.date < today),
    earlier: rows.filter(a => a.status && a.status !== 'booked').sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export function nextAppointment(canon, today = dayOf()) {
  return appointments(canon, today).upcoming[0] || null;
}

// Every fact that is due, most pressing first. Each:
// {id, tab, key, kind, question, says, answers, rank, age}
export function factsDue(canon, today = dayOf()) {
  const out = [];
  const add = f => out.push({ ...f, id: `${f.tab}:${f.key}` });
  const ap = appointments(canon, today);
  ap.overdue.forEach(a => add({ tab: 'Appointments', key: a.id, kind: 'apptPast', row: a, rank: 0, age: since(a.checked, today),
    question: `Did you see ${a.with} ${whenText(a.date, a.time, today)}?`, says: a.for ? `For: ${a.for}` : '' }));
  ap.upcoming.filter(a => days(today, a.date) <= 3 && since(a.checked, today) >= 2).forEach(a => add({ tab: 'Appointments', key: a.id, kind: 'apptSoon', row: a, rank: 1, age: since(a.checked, today),
    question: `Still on: ${a.with}, ${whenText(a.date, a.time, today)}?`, says: [a.where, a.for].filter(Boolean).join(' · ') }));
  (canon.medications || []).filter(m => m.name && m.status !== 'stopped').forEach(m => {
    const age = since(m.checked, today);
    if (age < STALE_DAYS) return;
    add({ tab: 'Medications', key: m.name, kind: 'med', row: m, rank: m.status === 'check' ? 2 : 4, age,
      question: `Are you still taking ${m.name}${m.dose ? ', ' + m.dose : ''}${m.timing ? ' ' + m.timing : ''}?`,
      says: m.status === 'check' && m.rx ? `Last prescription: ${m.rx}` : '' });
  });
  priorities(canon).filter(p => /^(now|waiting|better)$/.test(p.status)).forEach(p => {
    const age = since(p.checked, today);
    if (age < STALE_DAYS) return;
    const what = String(p.title).replace(/\s*\(.*?\)\s*/g, ' ').trim();
    add({ tab: 'Priorities', key: p.id, kind: 'symptom', row: p, rank: 3, age, question: `How is your ${what.toLowerCase()} now?`, says: '' });
  });
  return out.sort((a, b) => a.rank - b.rank || b.age - a.age).map(f => ({ ...f, answers: ANSWERS[f.kind] }));
}

// Today's few. Checks already done today are left out by factsDue itself.
export const factsToday = (canon, today = dayOf()) => factsDue(canon, today).slice(0, PER_DAY);

// The Sheet writes for one answer. `edit` carries what she typed for a
// change: {dose, timing} for a medicine, {date, time} for a moved appointment.
// Returns [{action, payload}] and a short line for the toast.
export function writesFor(fact, answer, edit = {}) {
  const k = fact.key;
  const check = [{ action: 'check', payload: { tab: fact.tab, key: k } }];
  switch (fact.kind) {
    case 'med':
      if (answer === 'still') return { writes: check, said: 'Checked ✓' };
      if (answer === 'stopped') return { writes: [{ action: 'medication', payload: { name: k, status: 'stopped', checked: true } }], said: `${k} marked as stopped` };
      if (answer === 'changed') {
        const p = { name: k, checked: true };
        if (edit.dose) p.dose = edit.dose;
        if (edit.timing) p.timing = edit.timing;
        return { writes: [{ action: 'medication', payload: p }], said: `${k} updated` };
      }
      break;
    case 'apptPast':
    case 'apptSoon':
      if (answer === 'still') return { writes: check, said: 'Checked ✓' };
      if (answer === 'done') return { writes: [{ action: 'appointment', payload: { id: k, status: 'done', checked: true } }], said: 'Marked as done' };
      if (answer === 'cancelled') return { writes: [{ action: 'appointment', payload: { id: k, status: 'cancelled', checked: true } }], said: 'Marked as cancelled' };
      if (answer === 'moved') {
        const p = { id: k, status: 'booked', checked: true };
        if (edit.date) p.date = edit.date;
        if (edit.time !== undefined) p.time = edit.time;
        return { writes: [{ action: 'appointment', payload: p }], said: 'New date saved' };
      }
      break;
    case 'symptom':
      if (answer === 'still') return { writes: check, said: 'Checked ✓' };
      if (answer === 'better') return { writes: [{ action: 'priority', payload: { id: k, status: 'better', checked: true } }], said: 'Glad it is easing' };
      if (answer === 'done') return { writes: [{ action: 'priority', payload: { id: k, status: 'done', checked: true } }], said: 'Marked as sorted' };
      if (answer === 'worse') return { writes: [...check, { action: 'note', payload: { tag: 'dipti-says', text: `${fact.row.title}: worse than before (fact check)` } }], said: 'Noted', worse: true };
      break;
  }
  return { writes: [], said: '' };
}

// Which answers need a second step for her to type the new details.
export const needsEdit = (fact, answer) => (fact.kind === 'med' && answer === 'changed') || (fact.kind.startsWith('appt') && answer === 'moved');

// Mirror the writes on the device's copy at once, so the screen moves on
// before the Sheet answers.
export function applyLocal(canon, writes, today = dayOf()) {
  for (const { action, payload: p } of writes) {
    if (action === 'check') {
      const keyCol = { Medications: 'name', Priorities: 'id', Appointments: 'id' }[p.tab];
      const list = { Medications: canon.medications, Priorities: canon.priorities, Appointments: canon.appointments }[p.tab] || [];
      const row = list.find(r => String(r[keyCol]).toLowerCase() === String(p.key).toLowerCase());
      if (row) row.checked = today;
    } else if (action === 'medication' || action === 'priority' || action === 'appointment') {
      const list = canon[{ medication: 'medications', priority: 'priorities', appointment: 'appointments' }[action]] ||= [];
      const k = action === 'medication' ? 'name' : 'id';
      let row = p[k] && list.find(r => String(r[k]).toLowerCase() === String(p[k]).toLowerCase());
      if (!row) { row = { status: action === 'appointment' ? 'booked' : '' }; list.push(row); }
      const { checked, ...fields } = p;
      Object.assign(row, fields);
      if (checked) row.checked = today;
    }
  }
  return canon;
}
