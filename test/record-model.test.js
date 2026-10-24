import test from 'node:test';
import assert from 'node:assert/strict';
import { priorities, medicines, questionsByDoctor, historyEvents } from '../public/js/record-model.js';
import { doctorNote, noteParts, firstPerson } from '../public/js/brief.js';
import { keepsFacts } from '../lib/note.js';

// Invented record in the Sheet's shape.
const canon = {
  priorities: [
    { id: 'P2', rank: '2', title: 'Tummy pain', status: 'now', plan: 'Get stool results; Ask about pain plan', askWhom: 'Dr GI' },
    { id: 'P3', rank: '3', title: 'Old thing', status: 'done' },
    { id: 'P1', rank: '1', title: 'Tooth', status: 'waiting', why: 'Hurts to bite', plan: '1. Book specialist\n2. Ask about a crown', askWhom: 'Dr Tooth' },
  ],
  medications: [
    { name: 'Alpha', dose: '10 mg', timing: 'morning', rx: 'Same', status: 'current' },
    { name: 'Beta', dose: '20 mg', timing: 'twice', rx: '10 mg night', status: 'check' },
    { name: 'Gamma', dose: '5 mg', timing: 'night', rx: '', status: 'stopped' },
  ],
  questions: [
    { id: 'Q1', question: 'Crown?', askWhom: 'Dr Tooth', priority: '1', status: 'open' },
    { id: 'Q2', question: 'Stool results?', askWhom: 'Dr GI', priority: '2', status: 'open' },
    { id: 'Q3', question: 'Done one', askWhom: 'Dr GI', priority: '1', status: 'answered', answer: 'Yes', updated: '2026-10-20' },
  ],
  clinicians: [{ name: 'Dr Tooth', role: 'Dentist', owns: 'Tooth' }],
  testResults: [{ date: '2026-04-10', test: 'GGT', result: '70.5', range: '5-38' }, { date: '2026-10-05', test: 'GGT', result: '95.5 U/L' }],
  checkins: [{ tsUTC: '2026-10-22T03:00:00Z', tooth: '6', abdomen: '3', fatigue: '7', sleep: 'poor', verdict: 'Steady' }],
  notes: [
    { tsUTC: '2026-10-21T03:00:00Z', by: 'Dipti', tag: 'concern', text: 'CONCERN: Why does it hurt?\nURGENCY: routine\nANSWER: A crack, probably.' },
    { tsUTC: '2026-10-22T03:00:00Z', by: 'Dipti', tag: 'concern', text: 'CONCERN: Why does it hurt?\nURGENCY: routine\nANSWER: Same plan.' },
    { tsUTC: '2026-10-22T04:00:00Z', by: 'Krish', tag: 'meds-taken', text: 'MEDS: taken' },
  ],
};

test('priorities: her order, sorted ones last, plan split into steps', () => {
  const p = priorities(canon);
  assert.deepEqual(p.map(x => x.id), ['P1', 'P2', 'P3']);
  assert.deepEqual(p[0].steps, ['Book specialist', 'Ask about a crown']);
  assert.deepEqual(p[1].steps, ['Get stool results', 'Ask about pain plan']);
  assert.equal(p[0].statusInfo.label, 'Waiting');
});
test('medicines: differences from the prescription are counted, stopped kept apart', () => {
  const m = medicines(canon);
  assert.deepEqual(m.current.map(x => [x.name, x.differs]), [['Alpha', false], ['Beta', true]]);
  assert.equal(m.differ, 1);
  assert.equal(m.stopped[0].name, 'Gamma');
});
test('questions grouped by doctor, answered ones out', () => {
  const g = questionsByDoctor(canon);
  assert.deepEqual(g.map(x => x.who), ['Dr Tooth', 'Dr GI']);
  assert.equal(g[1].questions.length, 1);
});
test('history: repeated questions collapse, routine taps hidden, newest first', () => {
  const h = historyEvents(canon);
  const asked = h.filter(e => e.kind === 'asked');
  assert.equal(asked.length, 1); assert.equal(asked[0].count, 2); assert.equal(asked[0].title, 'You asked');
  assert.ok(!h.some(e => /MEDS/.test(e.detail)));
  assert.equal(h[0].date, '22 Oct 2026');
});
test('a note to one doctor is short, in her voice, and asks at most two things', () => {
  const c = { ...canon, medications: [...canon.medications, { name: 'Prednisone', dose: '10 mg', timing: 'morning', status: 'current' }],
    questions: [...canon.questions, { id: 'Q4', question: 'Night guard?', askWhom: 'Dr Tooth', priority: '2', status: 'open' }, { id: 'Q5', question: 'Implant?', askWhom: 'Dr Tooth', priority: '3', status: 'open' }] };
  const t = doctorNote(c, { doctor: 'Dr Tooth' });
  assert.match(t, /^Hello Dr Tooth,/);
  assert.match(t, /I'm writing about my tooth\. Hurts to bite\./);
  assert.match(t, /I take Prednisone \(10 mg, morning\), so please keep the steroid in mind\./);
  assert.match(t, /1\. Crown\?\n2\. Night guard\?/);
  assert.doesNotMatch(t, /Implant|Stool|GGT|Beta/);
  assert.ok((t.match(/\?/g) || []).length <= 3);
  assert.ok(t.split(/\s+/).length < 80);
  assert.match(t, /Thank you so much\.\nDipti$/);
});
test('a note finds its topic from what the doctor looks after', () => {
  const c = { priorities: [{ id: 'P', rank: '1', title: 'Tooth pain (upper molar)', status: 'now' }], clinicians: [{ name: 'Dr A', role: 'Dentist', owns: 'Teeth and gums' }] };
  assert.equal(noteParts(c, { doctor: 'Dr A' }).about, 'Tooth pain');
});
test('her record is written to her; her note is written by her', () => {
  assert.equal(firstPerson('Your dentist will not remove it while you are on steroids and will tell you soon.'), 'My dentist will not remove it while I am on steroids and will tell me soon.');
});
test('a warmer rewrite is refused if it adds a number, a question, or drops her name', () => {
  const parts = noteParts(canon, { doctor: 'Dr Tooth' });
  const d = doctorNote(canon, { doctor: 'Dr Tooth' });
  assert.ok(keepsFacts(d, d, parts));
  assert.ok(!keepsFacts(d, d.replace('Thank', 'Take 20 mg. Thank'), parts));
  assert.ok(!keepsFacts(d, d.replace('Thank', 'Is it bad? Should I? Thank'), parts));
  assert.ok(!keepsFacts(d, d.replace(/Dipti$/, 'D.'), parts));
});
