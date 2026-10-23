import test from 'node:test';
import assert from 'node:assert/strict';
import { createSheetApi } from '../scripts/gas-emulator.mjs';

const OLD_CONDITIONS = ['Condition', 'Status', 'Since', 'Evidence', 'Notes', 'Source', 'UpdatedAt'];

test('setup() adds new columns to a Sheet made by an older Code.gs, keeping its rows', () => {
  const api = createSheetApi({ secret: 's', oldHeaders: { Conditions: OLD_CONDITIONS } });
  api.tabs.Conditions.appendRow(['Invented condition', 'active', '2024-01-01', 'Doc', 'a note', 'seed', '2026-10-01']);
  // Before setup, reads still work and the new keys are blank.
  let c = api.get({ secret: 's', action: 'read' });
  assert.equal(c.conditions[0].notes, 'a note');
  assert.equal(c.conditions[0].plain, '');
  delete api.tabs.Notes;
  api.setup();
  assert.deepEqual(api.tabs.Conditions.rows[0], [...OLD_CONDITIONS, 'Key', 'AlsoCalled', 'Plain']);
  assert.ok(api.tabs.Notes, 'missing tab is created');
  assert.ok(api.logs.some(l => /Added to Conditions: Key, AlsoCalled, Plain/.test(l)));
  // Setup again changes nothing.
  api.setup();
  assert.equal(api.tabs.Conditions.rows[0].length, 10);
  const w = api.post({ secret: 's', action: 'condition', by: 'Dipti', payload: { name: 'invented condition', plain: 'Plain words.' } });
  assert.equal(w.ok, true);
  c = api.get({ secret: 's', action: 'read' });
  assert.equal(c.conditions.length, 1);
  assert.equal(c.conditions[0].plain, 'Plain words.');
  assert.equal(c.conditions[0].notes, 'a note');
});

test('columns are found by header, so a column moved by hand still lines up', () => {
  const moved = ['TimestampUTC', 'Text', 'By', 'Tag'];
  const api = createSheetApi({ secret: 's', oldHeaders: { Notes: moved } });
  api.post({ secret: 's', action: 'note', by: 'Krish', payload: { text: 'hello', tag: 'fact' } });
  const row = api.tabs.Notes.rows[1];
  assert.equal(row[1], 'hello'); assert.equal(row[2], 'Krish');
  const c = api.get({ secret: 's', action: 'read' });
  assert.equal(c.notes[0].text, 'hello'); assert.equal(c.notes[0].by, 'Krish');
});

test('a write to a column that is missing says to run setup()', () => {
  const api = createSheetApi({ secret: 's', oldHeaders: { Conditions: OLD_CONDITIONS } });
  api.tabs.Conditions.appendRow(['X', 'active', '', '', '', '', '']);
  const w = api.post({ secret: 's', action: 'condition', payload: { name: 'X', plain: 'p' } });
  assert.equal(w.ok, false);
  assert.match(w.error, /run setup\(\)/);
});
