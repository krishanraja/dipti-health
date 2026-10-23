import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../scripts/fixture.mjs';
import { conditionList, zoom, linksFor, groupOf, shortName, countLine, linkStory, labelFor } from '../public/js/conditions-model.js';

const canon = fixture();

test('groups: long-term, being watched, settled; older status words still work', () => {
  assert.equal(groupOf('long-term'), 'long-term');
  assert.equal(groupOf('active'), 'watching');
  assert.equal(groupOf('resolved'), 'settled');
  assert.deepEqual(conditionList(canon).map(g => g.label), ['Long-term', 'Being watched', 'Settled']);
});

test('short name is the first AlsoCalled name, else the name without brackets', () => {
  assert.equal(shortName({ name: 'X', aliases: 'Short; other' }), 'Short');
  assert.equal(shortName({ name: 'Low thing (not formally diagnosed)' }), 'Low thing');
});

test('links come from interaction rows that name the condition, with everyday labels', () => {
  const l = linksFor(canon, 'COND_EX1');
  assert.deepEqual(l.map(x => x.label), ['Medicine A', 'Medicine B', 'Old medicine E (stopped)', 'GGT', 'Liver finding', 'Tiredness']);
  assert.equal(l.find(x => x.id === 'COND_EX2').kind, 'condition');
  assert.equal(countLine(l), '3 medicines · 1 result · 1 condition · 1 symptom');
  // The technical question never shows; the plain one does.
  const s = linkStory(l.find(x => x.id === 'MED_A'));
  assert.match(s.plain, /affect each other/);
  assert.equal(s.ask, 'What should I do with Medicine A when I am unwell?');
});

test('lists of possible causes never become links', () => {
  // MAP_SYM_TIRED names SYM_TIRED and MED_B, but it is a symptom_attribution row.
  const l = linksFor(canon, 'SYM_TIRED');
  assert.ok(!l.some(x => x.id === 'MED_B'));
  assert.deepEqual(l.map(x => x.id), ['MED_A', 'COND_EX1']);
});

test('an entity with no label is left out, never shown as a code', () => {
  const c = { ...canon, evidence: [...canon.evidence, { id: 'IX9', kind: 'interaction', entities: 'COND_EX3 MED_UNKNOWN', plain: 'p' }] };
  assert.equal(labelFor(c, 'MED_UNKNOWN'), null);
  assert.equal(linksFor(c, 'COND_EX3').length, 0);
});

test('zoom: one condition with its medicines, results, doctor, questions and priority', () => {
  const z = zoom(canon, 'COND_EX1');
  assert.equal(z.short, 'Autoimmune example');
  assert.deepEqual(z.meds.map(m => m.med.name), ['Medicine A', 'Medicine B']); // the stopped one is not listed as taken
  assert.deepEqual(z.results.map(r => r.key), ['ggt']);
  const tooth = zoom(canon, 'COND_EX3');
  assert.equal(tooth.priority?.n, 1);
  assert.equal(tooth.links.length, 0);
  assert.equal(zoom(canon, 'nope'), null);
});

test('a condition without a Key still opens, with no links', () => {
  const c = { ...canon, conditions: [{ name: 'Typed in by hand', status: '' }] };
  const [g] = conditionList(c);
  assert.equal(g.label, 'Being watched');
  const z = zoom(c, g.items[0].id);
  assert.equal(z.short, 'Typed in by hand');
  assert.equal(z.links.length, 0);
});
