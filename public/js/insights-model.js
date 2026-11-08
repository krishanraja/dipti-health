// What her own check-ins say, handed straight back to her: after each
// check-in, on Today, and in each area of My care. Every line compares her
// with herself (never with a population), in words first, and leads with
// what is easing. Nothing here is a diagnosis; a rise only ever suggests
// mentioning it to the doctor who looks after that area. Pure; unit tested.
import { TZ } from './dipti-model.js';

const DAY = 86400000;
export const SCORES = [
  { key: 'tooth', label: 'Tooth pain', area: 'teeth' },
  { key: 'abdomen', label: 'Tummy pain', area: 'gut' },
  { key: 'fatigue', label: 'Tiredness', area: 'hormones' },
];
const label = k => SCORES.find(s => s.key === k).label;
const lower = s => s.charAt(0).toLowerCase() + s.slice(1);
const round = v => Math.round(v * 10) / 10;
const mean = v => (v.length ? round(v.reduce((x, y) => x + y, 0) / v.length) : null);
const dayKey = t => new Date(t).toLocaleDateString('en-CA', { timeZone: TZ });

// Check-ins with a time and real scores, oldest first.
export function checkinRows(canon = {}) {
  return (canon.checkins || []).map(c => ({ ...c, t: Date.parse(c.tsUTC) || Date.parse(c.tsLocal) || 0 }))
    .filter(c => c.t).sort((a, b) => a.t - b.t);
}
const scoresOf = (rows, k) => rows.map(c => (c[k] === '' || c[k] == null ? NaN : +c[k])).filter(Number.isFinite);

// This week against the week before, for one score. A move of a whole point
// or more on a 0-10 scale counts; anything smaller is "steady".
export function weekTrend(canon, key, now = new Date()) {
  const t = now.getTime(), rows = checkinRows(canon);
  const inWin = (from, to) => rows.filter(c => t - c.t >= from * DAY && t - c.t < to * DAY);
  const week = scoresOf(inWin(0, 7), key), before = scoresOf(inWin(7, 14), key);
  const w = mean(week), b = mean(before);
  const dir = w === null || b === null ? null : b - w >= 1 ? 'easing' : w - b >= 1 ? 'higher' : 'steady';
  return { key, label: label(key), week: w, before: b, n: week.length, dir };
}

// The last three check-ins each higher than the one before, ending at 5 or
// more: worth a word with her doctor, not an alarm.
export function climbing(canon, key) {
  const v = scoresOf(checkinRows(canon), key).slice(-3);
  return v.length === 3 && v[0] < v[1] && v[1] < v[2] && v[2] >= 5;
}

// Days this week with a check-in (a day counts once).
export function daysThisWeek(canon, now = new Date()) {
  const t = now.getTime();
  return new Set(checkinRows(canon).filter(c => t - c.t < 7 * DAY && c.t <= t).map(c => dayKey(c.t))).size;
}

// Straight after a check-in: how today compares with her own recent days.
// canon is the record before this check-in was added; answers are today's.
// Returns { lines, first } with at most three short lines, easing first.
export function afterCheckin(canon, answers, now = new Date()) {
  const t = now.getTime();
  const recent = checkinRows(canon).filter(c => t - c.t < 14 * DAY && c.t <= t);
  if (!recent.length) return { first: true, lines: ['This is your first check-in in a while. From the next one, I will show you how things are moving.'] };
  const out = [];
  for (const s of SCORES) {
    const today = +answers[s.key], usual = mean(scoresOf(recent, s.key));
    if (!Number.isFinite(today) || usual === null) continue;
    const diff = today - usual;
    if (diff <= -1) out.push({ rank: 0, text: `${s.label} is lower than your recent days (${today}, from about ${Math.round(usual)}).` });
    else if (diff >= 2) out.push({ rank: 2, text: `${s.label} is higher than your recent days (${today}, from about ${Math.round(usual)}).` });
    else out.push({ rank: 1, label: s.label, text: `${s.label} is about your usual.` });
  }
  // "About your usual" three times says nothing; say it once.
  const usualOnes = out.filter(x => x.rank === 1);
  let usualText = usualOnes.map(x => x.text);
  if (usualOnes.length > 1) {
    const names = usualOnes.map((x, i) => (i ? lower(x.label) : x.label));
    usualText = [`${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are about your usual.`];
  }
  const lines = [...out.filter(x => x.rank === 0).map(x => x.text), ...usualText, ...out.filter(x => x.rank === 2).map(x => x.text)];
  // Days this week with a check-in, today's included.
  const days = new Set([...checkinRows(canon).filter(c => t - c.t < 7 * DAY && c.t <= t).map(c => dayKey(c.t)), dayKey(t)]).size;
  if (days >= 3) lines.push(`${days} days checked in this week. Each one helps your doctors see the pattern.`);
  return { first: false, lines: lines.slice(0, 4) };
}

// One short phrase for Today: the most useful thing her check-ins show.
// Easing leads, because it is easy to miss what is getting better.
export function todayTrend(canon, now = new Date()) {
  const tr = SCORES.map(s => weekTrend(canon, s.key, now)).filter(x => x.dir);
  const easing = tr.find(x => x.dir === 'easing');
  if (easing) return `${easing.label} easing this week`;
  const up = tr.find(x => x.dir === 'higher');
  if (up) return `${up.label} higher this week`;
  if (tr.length && tr.every(x => x.dir === 'steady')) return 'Steady this week';
  return '';
}

// For an area of My care: what her check-ins say about it, as one story item.
export function areaCheckins(canon, areaId, now = new Date()) {
  const s = SCORES.find(x => x.area === areaId);
  if (!s) return null;
  const rows = checkinRows(canon);
  const v = scoresOf(rows, s.key);
  if (!v.length) return null;
  const tr = weekTrend(canon, s.key, now);
  const last = rows.filter(c => Number.isFinite(+c[s.key]) && c[s.key] !== '').pop();
  const recent = v.slice(-5).join(' → ');
  const w = Math.round(tr.week), b = Math.round(tr.before);
  const words = tr.dir === 'easing' ? `Easing: about ${w} this week, from ${b} the week before.`
    : tr.dir === 'higher' ? `Higher: about ${w} this week, from ${b} the week before. Worth mentioning to your doctor.`
    : tr.dir === 'steady' ? `Steady: about ${w} this week, much as the week before.`
    : `Your last check-ins: ${recent} out of 10.`;
  return { ts: last?.tsUTC || '', title: 'Your check-ins', text: `${lower(s.label)} ${tr.dir ? `(${recent} out of 10). ` : ''}${words}`.replace(/^./, c => c.toUpperCase()) + (climbing(canon, s.key) && tr.dir !== 'higher' ? ' It has gone up three check-ins running; worth a word with your doctor.' : '') };
}

// Medicines on her list that a note names, by brand or generic. A check-in
// note of hers (27 Oct) recorded a dose change that never reached her list;
// this lets the app offer to update it there and then.
export function medsMentioned(canon = {}, text = '') {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return [];
  const stem = w => String(w || '').toLowerCase().match(/[a-z][a-z-]{3,}/)?.[0]?.slice(0, 5) || '';
  return (canon.medications || []).filter(m => m.name && m.status !== 'stopped').filter(m => {
    const stems = [stem(m.name), stem(m.generic)].filter(s => s.length >= 4);
    return stems.some(s => new RegExp(`\\b${s.replace(/[-]/g, '\\-')}`).test(t));
  }).map(m => m.name);
}
