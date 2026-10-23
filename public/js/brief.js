// A short, factual summary to send a doctor before an appointment, built only
// from her Sheet. For one doctor it leads with what they look after and their
// questions; for "any doctor" it covers everything. Pure; unit tested.
import { fmtDate, resultCards } from './metrics.js';
import { priorities, medicines, questionsByDoctor } from './record-model.js';

const has = (hay, needle) => String(hay || '').toLowerCase().includes(String(needle || '').toLowerCase());

export function briefText(canon = {}, { doctor = null, today = new Date() } = {}) {
  const c = canon, p = c.profile || {};
  const doc = doctor ? (c.clinicians || []).find(x => x.name === doctor) : null;
  const L = [`HEALTH SUMMARY${doc ? ` FOR ${doc.name.toUpperCase()}` : ''} (prepared by the patient from her own records)`,
    `Prepared ${fmtDate(today.toISOString(), { year: true })}`, ''];
  if (p.summary) L.push(p.summary, '');

  const pr = priorities(c).filter(x => x.status !== 'done');
  const mine = doc ? pr.filter(x => has(x.askWhom, doc.name) || has(x.askWhom, doc.role) || has(doc.owns, x.title)) : pr;
  if (mine.length) {
    L.push('WHAT I NEED HELP WITH');
    mine.forEach((x, i) => L.push(`${i + 1}. ${x.title}${x.why ? ': ' + x.why : ''}`));
    L.push('');
  }
  const conds = (c.conditions || []).filter(x => x.status !== 'resolved');
  if (conds.length) { L.push('CONDITIONS'); conds.forEach(x => L.push(`- ${x.name}${x.evidence === 'Stated' ? ' (as I understand it)' : ''}`)); L.push(''); }

  const m = medicines(c);
  L.push('MEDICINES I TAKE NOW');
  m.current.length ? m.current.forEach(x => L.push(`- ${x.name}${x.generic ? ' (' + x.generic + ')' : ''} ${x.dose} ${x.timing}`.replace(/\s+/g, ' ').trimEnd() + (x.differs ? ` [differs from my last prescription: ${x.rx || 'not on it'}]` : ''))) : L.push('- none recorded');
  if (m.differ) L.push(`Please confirm the ${m.differ} marked medicine${m.differ === 1 ? '' : 's'}.`);

  const rc = resultCards(c.testResults || []);
  if (rc.length) {
    L.push('', 'KEY RESULTS (oldest to newest)');
    for (const r of rc) L.push(`- ${r.def.label}: ${r.points.map(pt => `${pt.below ? '<' : ''}${pt.value} (${fmtDate(pt.date)})`).join(', ')} ${r.def.unit}`.trimEnd());
  }
  const ci = (c.checkins || []).slice(-5);
  if (ci.length) { L.push('', 'MY RECENT SCORES (0 to 10)'); ci.forEach(x => L.push(`- ${fmtDate(x.tsUTC || x.tsLocal)}: tooth ${x.tooth}, tummy ${x.abdomen}, tiredness ${x.fatigue}, sleep ${x.sleep}`)); }

  const groups = questionsByDoctor(c);
  const qs = doc ? groups.filter(g => has(g.who, doc.name) || has(g.who, doc.role)) : groups;
  const flat = qs.flatMap(g => g.questions.map(q => ({ ...q, who: g.who })));
  if (flat.length) {
    L.push('', 'MY QUESTIONS');
    flat.forEach((q, n) => L.push(`${n + 1}. ${q.question}${doc ? '' : ` (for ${q.who})`}`));
  }
  return L.join('\n');
}
