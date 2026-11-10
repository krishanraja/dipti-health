import test from 'node:test';
import assert from 'node:assert/strict';
import { pauseNote, resumeNote, pauseOf, untilFor, pauseLine, PAUSE, RESUME } from '../public/js/pause-model.js';

const p = { id: 'P1', title: 'Invented priority', nextStep: 'See the invented specialist' };
const note = (tag, text, tsUTC) => ({ tag, text, tsUTC, by: 'Dipti' });

test('a step set aside stays aside until its date, then comes back', () => {
  const canon = { notes: [note(PAUSE, pauseNote(p, { reason: 'Not ready yet', until: '2026-11-17' }), '2026-11-10T05:00:00Z')] };
  assert.deepEqual(pauseOf(canon, p, '2026-11-10'), { until: '2026-11-17', reason: 'Not ready yet' });
  assert.equal(pauseOf(canon, p, '2026-11-17'), null);
  assert.equal(pauseLine(pauseOf(canon, p, '2026-11-10')), 'Set aside until 17 Nov');
});

test('"only when I ask" lasts until she brings it back', () => {
  const canon = { notes: [note(PAUSE, pauseNote(p, { until: '' }), '2026-11-10T05:00:00Z')] };
  assert.deepEqual(pauseOf(canon, p, '2027-06-01'), { until: '', reason: '' });
  assert.equal(pauseLine(pauseOf(canon, p, '2027-06-01')), 'Set aside until you bring it back');
  canon.notes.push(note(RESUME, resumeNote(p), '2026-11-12T05:00:00Z'));
  assert.equal(pauseOf(canon, p, '2026-11-12'), null);
});

test('a changed step is not covered by the old pause; other priorities are untouched', () => {
  const canon = { notes: [note(PAUSE, pauseNote(p, { until: '' }), '2026-11-10T05:00:00Z')] };
  assert.equal(pauseOf(canon, { ...p, nextStep: 'A different step' }, '2026-11-10'), null);
  assert.equal(pauseOf(canon, { ...p, id: 'P2' }, '2026-11-10'), null);
});

test('the note reads in her words, with the reason when she gives one', () => {
  assert.match(pauseNote(p, { reason: 'Time or cost', until: '2026-11-17' }), /^SET ASIDE: See the invented specialist\. Why: Time or cost\nDATA: /);
  assert.match(pauseNote(p), /^SET ASIDE: See the invented specialist\nDATA: /);
  assert.equal(untilFor('week', '2026-11-10'), '2026-11-17');
  assert.equal(untilFor('month', '2026-11-10'), '2026-12-10');
  assert.equal(untilFor('ask', '2026-11-10'), '');
});
