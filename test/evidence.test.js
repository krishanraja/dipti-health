import test from 'node:test';
import assert from 'node:assert/strict';
import { entityNames, entitiesIn, related, evidenceText, sourcesFor } from '../public/js/evidence.js';

// Invented pack in the shape of the Evidence tab.
const ev = [
  { id: 'MED_A', kind: 'medication', title: 'Examplol (exemplazine): 10 mg', entities: 'MED_A', text: 'About Examplol.' },
  { id: 'LAB_X', kind: 'lab', title: 'Widget enzyme', entities: 'LAB_X', text: 'Widget enzyme notes.' },
  { id: 'IX02', kind: 'interaction', title: 'Examplol + widget', severity: 'high', grade: 'B', entities: 'MED_A LAB_X', text: 'High one.', sources: 'S1' },
  { id: 'IX01', kind: 'interaction', title: 'Examplol crisis', severity: 'critical', grade: 'A', entities: 'MED_A', text: 'Critical one.', sources: 'S1 S2' },
  { id: 'REC_1', kind: 'recommendation', title: 'Do a thing', entities: 'IX01', text: 'Rec.' },
];
const src = [{ id: 'S1', grade: 'A', title: 'Guideline', url: 'https://example.org/g' }, { id: 'S2', grade: 'B', title: 'No link' }];

test('entity names come from the pack itself, brand and generic', () => {
  const n = entityNames(ev);
  assert.ok(n.MED_A.includes('examplol'));
  assert.ok(n.MED_A.includes('exemplazine'));
});
test('a question finds the entities it names', () => {
  assert.deepEqual(entitiesIn('Is exemplazine safe with my widget enzyme result?', ev).sort(), ['LAB_X', 'MED_A']);
  assert.deepEqual(entitiesIn('nothing relevant', ev), []);
});
test('related rows, most serious first', () => {
  assert.deepEqual(related(ev, ['MED_A']).map(r => r.id), ['IX01', 'IX02', 'MED_A']);
});
test('the whole pack as text, severity first, with the source list', () => {
  const t = evidenceText(ev, src);
  assert.ok(t.indexOf('[IX01]') < t.indexOf('[IX02]'));
  assert.match(t, /S1 \[A\] Guideline/);
  assert.match(evidenceText([], []), /not in the Sheet yet/);
});
test('source links only where a URL exists', () => {
  assert.deepEqual(sourcesFor(ev[3], src).map(s => s.id), ['S1']);
});
