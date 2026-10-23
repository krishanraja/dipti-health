import test from 'node:test';
import assert from 'node:assert/strict';
import { priorities, medicines, questionsByDoctor, historyEvents } from '../public/js/record-model.js';
import { briefText } from '../public/js/brief.js';

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
test('a brief for one doctor leads with what they look after and only their questions', () => {
  const t = briefText(canon, { doctor: 'Dr Tooth', today: new Date('2026-10-24') });
  assert.match(t, /FOR DR TOOTH/);
  assert.match(t, /1\. Tooth: Hurts to bite/);
  assert.doesNotMatch(t, /Tummy pain/);
  assert.match(t, /Beta 20 mg twice \[differs from my last prescription: 10 mg night\]/);
  assert.match(t, /GGT \(liver enzyme\): 70\.5 \(10 Apr\), 95\.5 \(5 Oct\) U\/L/);
  assert.match(t, /MY QUESTIONS\n1\. Crown\?$/m);
  assert.doesNotMatch(t, /Stool results/);
});
test('a general brief covers every open question, with who it is for', () => {
  assert.match(briefText(canon), /Stool results\? \(for Dr GI\)/);
});
