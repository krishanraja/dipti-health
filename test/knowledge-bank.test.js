import test from 'node:test';
import assert from 'node:assert/strict';
import { bank, bankItems, bankSize, bankText, facts, factNote, series, symptomTimeline, scoreTrends } from '../public/js/knowledge-bank.js';
import { TAGS, noteText } from '../public/js/dipti-model.js';

const now = new Date('2026-10-16T10:00:00Z');
const n = (ts, tag, text, by = 'Dipti') => ({ tsUTC: ts, by, tag, text });

test('facts: newest wording wins, duplicates collapse, replaced facts retire', () => {
  const notes = [
    n('2026-10-01T00:00:00Z', 'fact', factNote({ topic: 'symptom', fact: 'Dizzy twice a week' }).text, 'Krish'),
    n('2026-10-02T00:00:00Z', 'fact', factNote({ topic: 'symptom', fact: 'dizzy twice a week.' }).text, 'Krish'),
    n('2026-10-03T00:00:00Z', 'fact', factNote({ topic: 'medicine', fact: 'Takes atorvastatin 20 mg' }).text, 'Sam'),
    n('2026-10-04T00:00:00Z', 'fact', factNote({ topic: 'medicine', fact: 'Takes atorvastatin 40 mg', replaces: 'Takes atorvastatin 20 mg' }).text, 'Sam'),
    n('2026-10-05T00:00:00Z', 'fact', 'FACT: hidden', 'claude-test'),
  ];
  const f = facts({ notes });
  assert.deepEqual(f.map(x => x.text), ['Takes atorvastatin 40 mg', 'dizzy twice a week.']);
  assert.equal(f[0].topic, 'medicine');
});
test('factNote: unknown topics fall back to other, text is clipped', () => {
  const { tag, text } = factNote({ topic: 'nonsense', fact: 'x'.repeat(400) });
  assert.equal(tag, 'fact');
  assert.match(text, /"topic":"other"/);
  assert.equal(text.split('\n')[0].length, 'FACT: '.length + 300);
});
test('series: every value per measure over time, across date formats, with "<" kept', () => {
  const s = series([
    { date: 'Fri Apr 10 2026 00:00:00 GMT+0100 (British Summer Time)', test: 'Cortisol, morning', result: '<0.7 ug/dL', range: '6.6-22.6' },
    { date: '2026-10-05', test: 'Cortisol, morning', result: 1.6 },
    { date: 'not a date', test: 'Cortisol, morning', result: '9' },
    { date: '2026-10-05', test: 'GGT', result: '95.5 U/L' },
  ]);
  assert.deepEqual(s.cortisol.map(v => v.value), [0.7, 1.6]);
  assert.equal(s.cortisol[0].below, true);
  assert.deepEqual(s.ggt.map(v => v.value), [95.5]);
});
test('symptom timeline: her logs, with a trend', () => {
  const notes = [
    n('2026-08-20T00:00:00Z', TAGS.symptom, noteText('SYMPTOM: x', { symptom: 'tooth', severity: 'mild' })),
    n('2026-10-10T00:00:00Z', TAGS.symptom, noteText('SYMPTOM: x', { symptom: 'tooth', severity: 'bad' })),
    n('2026-10-12T00:00:00Z', TAGS.symptom, noteText('SYMPTOM: x', { symptom: 'tooth', severity: 'moderate' })),
  ];
  const tt = symptomTimeline({ notes }, now).find(s => s.id === 'tooth');
  assert.equal(tt.count, 3); assert.equal(tt.worst, 2); assert.equal(tt.trend, 'more often'); assert.equal(tt.label, 'Tooth');
});
test('check-in score trends: this week against last week', () => {
  const c = (d, tooth) => ({ tsUTC: new Date(now - d * 86400000).toISOString(), tooth, abdomen: 3, fatigue: 6 });
  const t = scoreTrends({ checkins: [c(10, 8), c(9, 8), c(2, 5), c(1, 4)] }, now);
  assert.deepEqual(t.find(x => x.key === 'tooth'), { key: 'tooth', week: 4.5, before: 8 });
});
test('bank: empty record is safe and says so', () => {
  const b = bank({}, now);
  assert.equal(bankSize(b), 0);
  assert.equal(bankText(b), '(nothing logged yet)');
});
test('bank text stays within budget and keeps the most important groups first', () => {
  const notes = Array.from({ length: 300 }, (_, i) => n(new Date(now - i * 3600000).toISOString(), TAGS.says, `DIPTI SAYS: message number ${i} with some words`));
  notes.push(n('2026-10-01T00:00:00Z', 'fact', factNote({ topic: 'care', fact: 'Endodontist booked for 4 Nov' }).text, 'Krish'));
  const text = bankText(bank({ notes }, now), 1200);
  assert.ok(text.length <= 1250);
  assert.match(text, /Endodontist booked/);
});
test('bank items read in plain English', () => {
  const b = bank({ testResults: [{ date: '2026-06-01', test: 'GGT', result: '70.5' }, { date: '2026-10-05', test: 'GGT', result: '95.5 U/L' }] }, now);
  const g = bankItems(b).find(x => x.title === 'Results over time');
  assert.match(g.items[0], /GGT \(liver enzyme\): 70\.5 → 95\.5 U\/L \(up\), latest 5 Oct 2026/);
});
test('forget: a removed fact disappears until it is learned again', async () => {
  const { forgetNote } = await import('../public/js/knowledge-bank.js');
  const notes = [
    n('2026-10-01T00:00:00Z', 'fact', factNote({ topic: 'medicine', fact: 'Takes aspirin daily' }).text, 'Krish'),
    n('2026-10-02T00:00:00Z', 'fact', forgetNote('Takes aspirin daily', 'medicine').text, 'Krish'),
  ];
  assert.deepEqual(facts({ notes }), []);
  notes.push(n('2026-10-03T00:00:00Z', 'fact', factNote({ topic: 'medicine', fact: 'Takes aspirin daily' }).text, 'Krish'));
  assert.equal(facts({ notes }).length, 1);
});
