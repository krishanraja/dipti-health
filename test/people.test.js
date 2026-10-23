import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoster, matchPerson, person } from '../public/js/people.js';

// Invented names except Krish, who is the app's builder; the list is Vercel env PEOPLE.
const roster = parseRoster(JSON.stringify([
  { name: 'Dipti', aliases: ['Didi'], patient: true },
  { name: 'Krish', aliases: ['Krishan'] },
  { name: '' },
]));

test('roster: cleaned, empty names dropped, bad JSON is an empty list', () => {
  assert.equal(roster.length, 2);
  assert.deepEqual(parseRoster('not json'), []);
  assert.deepEqual(parseRoster({ nope: 1 }), []);
  assert.equal(parseRoster([{ name: '<b>Eve</b>' }])[0].name, 'bEveb');
});
test('names and nicknames match, ignoring case and spaces', () => {
  assert.equal(matchPerson(roster, 'krishan ').name, 'Krish');
  assert.equal(matchPerson(roster, 'didi').patient, true);
  assert.equal(matchPerson(roster, 'Nobody'), null);
});
test('Dipti is "you"; anyone else hears "Dipti"', () => {
  const d = person({ role: 'dipti', who: 'Krish', roster });
  assert.equal(d.id, 'dipti'); assert.equal(d.doc, 'you'); assert.equal(d.dipti, true);
  const k = person({ role: 'family', who: 'Krishan', roster });
  assert.equal(k.name, 'Krish'); assert.equal(k.doc, 'Dipti'); assert.equal(k.docPoss, "Dipti's"); assert.equal(k.known, true);
  assert.equal(person({ role: 'family', who: '', roster }).known, false);
  // Saying you are Dipti on the family code still makes you Dipti.
  assert.equal(person({ role: 'family', who: 'didi', roster }).dipti, true);
});
