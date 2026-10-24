// Pure data shaping for the record and the dashboard: priorities, medicines
// side by side with the prescription, questions grouped by doctor, and the
// history timeline. No DOM; unit tested.
import { dateKey, fmtDate } from './metrics.js';
import { noteData, noteSummary, SYMPTOMS, TAGS } from './dipti-model.js';

export const STATUS = {
  now: { label: 'Working on it', tone: 'accent' },
  waiting: { label: 'Waiting', tone: 'warm' },
  better: { label: 'Getting better', tone: 'ok' },
  done: { label: 'Sorted', tone: 'ok' },
};

// Her priorities in her order; sorted ones last.
export function priorities(canon) {
  return [...(canon?.priorities || [])]
    .sort((a, b) => (a.status === 'done') - (b.status === 'done') || (+a.rank || 9) - (+b.rank || 9))
    .map(p => ({ ...p, steps: String(p.plan || '').split(/\n|\s*;\s*/).map(s => s.replace(/^[-•\d.)\s]+/, '').trim()).filter(Boolean), statusInfo: STATUS[p.status] || STATUS.now }));
}

// Medicines: current ones first, each compared with the last prescription.
// "check" means her list and the prescription disagree: a question for the
// prescriber, shown calmly.
export function medicines(canon) {
  const rows = canon?.medications || [];
  const same = m => /^same/i.test(m.rx || '') || (m.rx || '').trim() === `${m.dose} ${m.timing}`.trim();
  const current = rows.filter(m => m.status !== 'stopped').map(m => ({ ...m, differs: m.status === 'check' || (!!m.rx && !same(m)) }));
  return { current, stopped: rows.filter(m => m.status === 'stopped'), differ: current.filter(m => m.differs).length };
}

// Open questions grouped by who answers them, most important first.
export function questionsByDoctor(canon) {
  const groups = new Map();
  for (const q of canon?.questions || []) {
    if (q.status === 'answered') continue;
    const who = String(q.askWhom || 'Any doctor').trim();
    (groups.get(who) || groups.set(who, []).get(who)).push(q);
  }
  return [...groups].map(([who, qs]) => ({ who, questions: qs.sort((a, b) => (+a.priority || 9) - (+b.priority || 9)) }))
    .sort((a, b) => (+a.questions[0].priority || 9) - (+b.questions[0].priority || 9) || b.questions.length - a.questions.length);
}

export function openGaps(canon) { return (canon?.gaps || []).filter(g => g.status !== 'closed'); }

const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') + '…'; };

// Timeline events, newest first. Test rows by an automated tester are hidden.
export function historyEvents(canon) {
  const ev = [];
  for (const r of canon?.testResults || []) ev.push({ key: dateKey(r.date), ts: '', kind: 'result', title: r.test, detail: clip(r.result, 60) });
  const concerns = new Map();
  for (const n of canon?.notes || []) {
    if (n.by === 'claude-test') continue;
    const k = dateKey(n.tsUTC), text = String(n.text || '');
    if (n.tag === TAGS.concern) {
      const q = (text.match(/CONCERN:\s*([\s\S]*?)(?:\nURGENCY:|$)/) || [, text])[1].trim();
      const answer = (text.match(/ANSWER:\s*([\s\S]*?)(?:\nRID:|$)/) || [])[1] || '';
      const prev = concerns.get(q);
      if (prev) { prev.count++; if (n.tsUTC > prev.ts) Object.assign(prev, { key: k, ts: n.tsUTC, answer: clip(answer, 120) }); }
      else concerns.set(q, { key: k, ts: n.tsUTC, kind: 'asked', title: `${n.by === 'Dipti' ? 'You' : n.by} asked`, detail: clip(q, 90), answer: clip(answer, 120), count: 1 });
    } else if (n.tag === TAGS.meds || /^FACT REMOVED:/.test(text)) {
      continue;
    } else if (n.tag === TAGS.fact) {
      ev.push({ key: k, ts: n.tsUTC, kind: 'note', title: 'Noted', detail: clip(noteSummary(n).replace(/^FACT:\s*/, ''), 90) });
    } else if (n.tag === TAGS.symptom) {
      const d = noteData(n) || {};
      ev.push({ key: k, ts: n.tsUTC, kind: 'symptom', title: (SYMPTOMS.find(s => s.id === d.symptom) || { label: 'Symptom' }).label, detail: clip(noteSummary(n).replace(/^SYMPTOM:\s*[^,]*,?\s*/, ''), 90), level: d.level });
    } else if (n.tag === 'record') {
      const change = /^MEDICINE CHANGE:/.test(text);
      ev.push({ key: k, ts: n.tsUTC, kind: 'note', title: change ? 'Medicine change' : 'Reported', detail: clip(text.replace(/^(REPORTED|MEDICINE CHANGE):\s*/, ''), 110) });
    } else if (n.tag === TAGS.journal) {
      ev.push({ key: k, ts: n.tsUTC, kind: 'note', title: n.by === 'Dipti' ? 'You wrote' : `${n.by} wrote`, detail: clip(text.replace(/\nJID: \S+$/, ''), 110) });
    } else if (n.tag === TAGS.says) {
      ev.push({ key: k, ts: n.tsUTC, kind: 'note', title: n.by === 'Dipti' ? 'You noted' : `${n.by} noted`, detail: clip(text.replace(/^DIPTI SAYS:\s*/, ''), 90) });
    } else {
      ev.push({ key: k, ts: n.tsUTC, kind: 'note', title: n.by === 'Dipti' ? 'Note' : `Note from ${n.by}`, detail: clip(noteSummary(n), 90) });
    }
  }
  ev.push(...concerns.values());
  for (const c of canon?.checkins || []) {
    ev.push({ key: dateKey(c.tsUTC || c.tsLocal), ts: c.tsUTC || '', kind: 'checkin', title: `Check-in: ${c.verdict}`, detail: `Tooth ${c.tooth} · tummy ${c.abdomen} · tiredness ${c.fatigue}` });
  }
  for (const q of canon?.questions || []) {
    if (q.status === 'answered' && q.answer) ev.push({ key: dateKey(q.updated), ts: '', kind: 'answer', title: 'Doctor answered', detail: clip(`${q.question} ${q.answer}`, 90) });
  }
  return ev.filter(e => e.key).sort((a, b) => (b.key - a.key) || String(b.ts).localeCompare(String(a.ts)))
    .map(e => ({ ...e, date: fmtDate(String(e.key).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'), { year: true }) }));
}
