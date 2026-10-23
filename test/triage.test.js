import test from 'node:test';
import assert from 'node:assert/strict';
import { triage, maxLevel } from '../public/js/triage.js';

const cases = [
  // calm by default: her everyday symptoms are not emergencies
  ['My tooth hurts when I bite down', 'routine'],
  ['I feel so tired all the time', 'routine'],
  ['Right side tummy ache again, same as before', 'routine'],
  ['No fever, no vomiting, just the usual ache', 'routine'],
  ['I had loose motions today', 'soon'],
  ['Felt a bit dizzy getting up', 'soon'],
  // steroid sick-day and infection on immunosuppression
  ['I have been vomiting since morning', 'urgent'],
  ['Diarrhoea 5 times today', 'urgent'],
  ['I have a fever of 38.5', 'urgent'],
  ['I missed my prednisone yesterday and today', 'urgent'],
  // dental
  ['My cheek is swollen near the tooth', 'urgent'],
  ['There is pus coming from the gum', 'urgent'],
  ['The swelling is spreading to my eye', 'emergency'],
  ['I can\'t swallow properly', 'emergency'],
  // liver and gut
  ['My eyes look yellow', 'urgent'],
  ['Black stools this morning', 'urgent'],
  ['Severe stomach pain, much worse than before', 'urgent'],
  // collapse
  ['She fainted in the kitchen', 'emergency'],
  ['Very drowsy and hard to wake', 'emergency'],
];

test('triage levels', () => {
  for (const [t, want] of cases) assert.equal(triage(t).level, want, t);
});
test('a reason comes with every flag', () => {
  assert.match(triage('vomiting all night').reasons[0], /sick-day/);
});
test('maxLevel never lowers', () => {
  assert.equal(maxLevel('routine', 'urgent'), 'urgent');
  assert.equal(maxLevel('emergency', 'soon'), 'emergency');
});
