// The knowledge bank: everything Dipti (and family helping out) has logged,
// distilled into what is known about her. Rebuilt from the whole sheet every time, so it
// never forgets older entries and grows with every log, check-in, photo and
// chat. Two kinds of knowledge:
//   derived: counted straight from the logs (symptom timelines, tablets ticked,
//            result trends, check-in verdicts). Always exact.
//   learned: facts the doctor picked up in conversation, saved as Notes tagged
//            "fact" (one row per fact, newest wins).
// Pure functions, no DOM; runs in the browser, on the server and in tests.
import { TAGS, SYMPTOMS, noteData, noteSummary, localDay } from './dipti-model.js';
import { MEASURES, KEY_MEASURES, seriesFor, trend, fmtDate } from './metrics.js';

export const FACT_TAG = 'fact';
export const FACT_TOPICS = ['symptom', 'history', 'medicine', 'lifestyle', 'care', 'family', 'other'];
const TOPIC_LABEL = { symptom: 'Symptoms', history: 'Health history', medicine: 'Medicines', lifestyle: 'Daily life', care: 'Care and appointments', family: 'Family', other: 'Other' };
const DAY = 86400000;

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const realNotes = canon => (canon.notes || []).filter(n => n.by !== 'claude-test');
const tsOf = n => new Date(n.tsUTC).getTime() || 0;

export function factNote(f, from = 'chat') {
  const topic = FACT_TOPICS.includes(f.topic) ? f.topic : 'other';
  const data = { topic, from, ...(f.replaces ? { replaces: String(f.replaces).slice(0, 300) } : {}) };
  return { tag: FACT_TAG, text: `FACT: ${String(f.fact || f.text).trim().slice(0, 300)}\nDATA: ${JSON.stringify(data)}` };
}

// Someone taps "Forget" on a fact the doctor got wrong.
export function forgetNote(text, topic = 'other') {
  return { tag: FACT_TAG, text: `FACT REMOVED: ${String(text).slice(0, 300)}\nDATA: ${JSON.stringify({ topic, removes: String(text).slice(0, 300) })}` };
}

// Learned facts, newest first. A repeated fact keeps its newest wording; a
// fact that says what it replaces retires the older one; "Forget" retires it
// too (until it is learned again).
export function facts(canon) {
  const rows = realNotes(canon).filter(n => n.tag === FACT_TAG)
    .map(n => ({ ts: n.tsUTC, by: n.by, text: noteSummary(n).replace(/^FACT:\s*/i, '').trim(), ...(noteData(n) || {}) }))
    .filter(f => f.text)
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  const seen = new Set(), retired = new Set(), out = [];
  for (const f of rows) {
    if (f.removes) { retired.add(norm(f.removes)); continue; }
    const k = norm(f.text);
    if (seen.has(k) || retired.has(k)) continue;
    seen.add(k);
    if (f.replaces) retired.add(norm(f.replaces));
    out.push({ ts: f.ts, by: f.by, topic: FACT_TOPICS.includes(f.topic) ? f.topic : 'other', text: f.text, from: f.from || 'chat' });
  }
  return out;
}

// Every value of every key measure over time, oldest first: {ggt: [{date, value}]}.
export function series(testResults = []) {
  const out = {};
  for (const key of KEY_MEASURES) {
    const pts = seriesFor(testResults, key);
    if (pts.length) out[key] = pts.map(p => ({ date: p.date, value: p.value, below: p.below }));
  }
  return out;
}

// How often each symptom has come up, from her own logs.
export function symptomTimeline(canon, now = new Date()) {
  const t = now.getTime();
  const out = {};
  for (const n of realNotes(canon)) {
    const d = noteData(n);
    if (n.tag !== TAGS.symptom || !d?.symptom) continue;
    const ts = n.tsUTC, sev = { mild: 0, moderate: 1, bad: 2 }[d.severity] ?? 0;
    const s = out[d.symptom] ||= { id: d.symptom, label: (SYMPTOMS.find(x => x.id === d.symptom) || { short: d.symptom }).short, count: 0, last30: 0, prev30: 0, first: ts, last: ts, worst: 0 };
    s.count++;
    const age = t - new Date(ts).getTime();
    if (age <= 30 * DAY) s.last30++; else if (age <= 60 * DAY) s.prev30++;
    if (ts < s.first) s.first = ts;
    if (ts > s.last) s.last = ts;
    s.worst = Math.max(s.worst, sev);
  }
  return Object.values(out).map(s => ({ ...s, trend: s.last30 > s.prev30 ? (s.prev30 ? 'more often' : 'new this month') : s.last30 < s.prev30 ? 'less often' : 'about the same' }))
    .sort((a, b) => String(b.last).localeCompare(String(a.last)));
}

// Average check-in scores (0-10) this week against the week before.
export function scoreTrends(canon, now = new Date()) {
  const t = now.getTime();
  const rows = canon.checkins || [];
  const avg = (k, from, to) => {
    const v = rows.filter(c => { const a = t - new Date(c.tsUTC).getTime(); return a >= from * DAY && a < to * DAY; }).map(c => +c[k]).filter(Number.isFinite);
    return v.length ? Math.round(v.reduce((x, y) => x + y, 0) / v.length * 10) / 10 : null;
  };
  return ['tooth', 'abdomen', 'fatigue'].map(k => ({ key: k, week: avg(k, 0, 7), before: avg(k, 7, 14) })).filter(x => x.week !== null);
}

export function adherence(canon, now = new Date()) {
  const t = now.getTime();
  const notes = realNotes(canon);
  const days = (tag, within) => new Set(notes.filter(n => n.tag === tag && t - tsOf(n) <= within * DAY).map(n => localDay(n.tsUTC))).size;
  return { meds7: days(TAGS.meds, 7), meds28: days(TAGS.meds, 28) };
}

// The whole bank, as structured data.
export function bank(canon = {}, now = new Date()) {
  const notes = realNotes(canon);
  const s = series(canon.testResults);
  const results = Object.entries(s).map(([key, vals]) => {
    const last = vals[vals.length - 1];
    return { key, label: MEASURES[key].label, unit: MEASURES[key].unit || '', values: vals, last, trend: trend(vals) };
  });
  const checks = (canon.checkins || []).slice(-6).map(c => c.verdict).filter(Boolean);
  const answered = (canon.questions || []).filter(q => q.status === 'answered' && q.answer).map(q => ({ q: q.question, a: q.answer }));
  const foundOut = notes.filter(n => n.tag === 'found-out').map(n => ({ ts: n.tsUTC, text: noteSummary(n).replace(/^FOUND OUT[^:]*:\s*/i, '') }));
  const said = notes.filter(n => n.tag === TAGS.says).map(n => ({ ts: n.tsUTC, text: noteSummary(n).replace(/^DIPTI SAYS:\s*/i, '') }));
  const concerns = notes.filter(n => n.tag === 'concern').map(n => ({ ts: n.tsUTC, text: (String(n.text).match(/^CONCERN:\s*([\s\S]*?)(?:\nURGENCY:|$)/) || [, ''])[1].trim() })).filter(c => c.text);
  const photos = (canon.testResults || []).filter(r => /photo/i.test(r.notes || '')).length;
  const first = [...notes.map(n => n.tsUTC), ...(canon.checkins || []).map(c => c.tsUTC)].filter(Boolean).sort()[0] || '';
  return {
    facts: facts(canon), symptoms: symptomTimeline(canon, now), scores: scoreTrends(canon, now), adherence: adherence(canon, now),
    results, checks, answered, foundOut, said, concerns, photos, since: first,
    entries: notes.length + (canon.checkins || []).length + (canon.testResults || []).length,
  };
}

const when = ts => fmtDate(ts, { year: true }) || String(ts).slice(0, 10);
const num = v => (Math.round(v * 100) / 100).toString();

// Grouped plain-English lines, for the "What the doctor knows" sheet.
export function bankItems(b) {
  const groups = [];
  const add = (title, items) => { if (items.length) groups.push({ title, items }); };
  add('Symptoms over time', b.symptoms.map(s => `${s.label}: ${s.count} time${s.count === 1 ? '' : 's'}, last ${when(s.last)} (${s.trend})`));
  add('Results over time', b.results.map(r => `${r.label}: ${r.values.map(v => (v.below ? '<' : '') + num(v.value)).join(' → ')}${r.unit ? ' ' + r.unit : ''}${r.trend ? ` (${r.trend})` : ''}, latest ${when(r.last.date)}`));
  const AREA = { tooth: 'Tooth pain', abdomen: 'Tummy pain', fatigue: 'Tiredness' };
  add('Check-in scores (0 to 10)', (b.scores || []).map(x => `${AREA[x.key]}: ${x.week} this week${x.before !== null ? `, ${x.before} the week before` : ''}`));
  const a = b.adherence;
  add('Tablets', a.meds28 ? [`Ticked her tablets on ${a.meds7} of the last 7 days (${a.meds28} of 28)`] : []);
  if (b.checks.length) add('Check-ins', [`Last ${b.checks.length}: ${b.checks.join(', ')}`]);
  for (const t of FACT_TOPICS) {
    const items = b.facts.filter(f => f.topic === t).map(f => f.text);
    if (items.length) groups.push({ title: TOPIC_LABEL[t], items, learned: true, topic: t });
  }
  add('Found out', b.foundOut.slice(-8).reverse().map(f => f.text));
  add('Doctor answers', b.answered.map(x => `${x.q} ${x.a}`));
  return groups;
}

export function bankSize(b) { return bankItems(b).reduce((n, g) => n + g.items.length, 0); }

// Compact text for the model. Covers the whole history inside a size budget.
export function bankText(b, budget = 6000) {
  const L = [];
  if (b.since) L.push(`Records start ${when(b.since)}. ${b.entries} entries so far.`);
  for (const g of bankItems(b)) { L.push(`### ${g.title}`); g.items.forEach(i => L.push(`- ${i}`)); }
  if (b.said.length) { L.push('### What Dipti has noted in her own words (newest first)'); b.said.slice(-12).reverse().forEach(x => L.push(`- ${when(x.ts)}: ${x.text}`)); }
  if (b.concerns.length) {
    L.push(`### What she has asked about (${b.concerns.length} questions, newest first)`);
    b.concerns.slice(-10).reverse().forEach(x => L.push(`- ${when(x.ts)}: ${x.text.slice(0, 160)}`));
  }
  let out = L.join('\n');
  if (out.length > budget) out = out.slice(0, budget).replace(/\n[^\n]*$/, '') + '\n(older items trimmed)';
  return out || '(nothing logged yet)';
}
