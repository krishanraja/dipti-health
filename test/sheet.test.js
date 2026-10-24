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

test('fact checker writes: appointments, a check, and a change that counts as checked', () => {
  const api = createSheetApi({ secret: 's' });
  const post = (action, payload, by = 'Dipti') => api.post({ secret: 's', action, by, payload });
  assert.equal(post('appointment', { with: 'Dr X' }).ok, false); // a date is needed
  const a = post('appointment', { date: '2026-11-02', time: '10:30', with: 'Dr X', for: 'Tooth' });
  assert.equal(a.id, 'A1');
  assert.equal(post('appointment', { id: 'A1', status: 'nope' }).ok, false);
  assert.equal(post('appointment', { id: 'A1', date: '2026-11-04', checked: true }).ok, true);
  post('medication', { name: 'Med Q', dose: '5 mg' });
  const c = post('check', { tab: 'Medications', key: 'med q' });
  assert.equal(c.ok, true);
  assert.equal(post('check', { tab: 'Notes', key: 'x' }).ok, false);
  const canon = api.get({ secret: 's', action: 'read' });
  assert.equal(canon.appointments[0].date.slice(0, 10).length, 10);
  assert.ok(canon.appointments[0].checked);
  assert.ok(canon.medications[0].checked);
  assert.ok(canon.changelog.some(x => x.key === 'Med Q.checked' && x.by === 'Dipti'));
});

test('a Sheet without the new Appointments tab still reads, and setup() adds it', () => {
  const api = createSheetApi({ secret: 's' });
  delete api.tabs.Appointments;
  assert.deepEqual(api.get({ secret: 's', action: 'read' }).appointments, []);
  api.setup();
  assert.ok(api.tabs.Appointments);
});

test('a write sent twice with the same opId is applied once, and returns the first result', () => {
  const api = createSheetApi({ secret: 's' });
  const send = () => api.post({ secret: 's', action: 'appointment', by: 'Dipti', opId: 'op-1', payload: { date: '2026-11-02', with: 'Dr X' } });
  const a = send(), b = send();
  assert.equal(a.id, 'A1');
  assert.equal(b.id, 'A1');
  assert.equal(b.duplicate, true);
  assert.equal(api.tabs.Appointments.rows.length, 2); // header + one row
  // A different op is a new row.
  api.post({ secret: 's', action: 'appointment', by: 'Dipti', opId: 'op-2', payload: { date: '2026-11-03', with: 'Dr Y' } });
  assert.equal(api.tabs.Appointments.rows.length, 3);
  assert.ok(api.locks.released >= 3, 'the write lock is always released');
});

test('a refused write is not recorded, so a corrected retry with the same op can still apply', () => {
  const api = createSheetApi({ secret: 's' });
  const bad = api.post({ secret: 's', action: 'appointment', opId: 'op-9', payload: { with: 'Dr X' } });
  assert.equal(bad.ok, false);
  assert.equal(api.tabs._Ops.rows.length, 1);
});

test('the op ledger keeps only its newest rows; no other tab is ever trimmed', () => {
  const api = createSheetApi({ secret: 's' });
  for (let i = 0; i < 2250; i++) api.tabs._Ops.appendRow([`old-${i}`, '', 'note', '{"ok":true}']);
  api.post({ secret: 's', action: 'note', opId: 'fresh', payload: { text: 'hello' } });
  assert.equal(api.tabs._Ops.rows.length - 1, 2000);
  assert.equal(api.tabs._Ops.rows.at(-1)[0], 'fresh');
  assert.equal(api.tabs.Notes.rows.length, 2);
});

test('a chat is a short Notes row plus its full data in _Chats, and the reply can be recovered', () => {
  const api = createSheetApi({ secret: 's' });
  const data = JSON.stringify({ answer: { reply: 'Hello', urgency: 'routine' }, threadId: 't1' });
  const text = 'CONCERN: hi\nURGENCY: routine\nANSWER: Hello\nRID: r1';
  assert.equal(api.post({ secret: 's', action: 'chat', by: 'Dipti', opId: 'chat-r1', payload: { rid: 'r1', threadId: 't1', text, data } }).ok, true);
  assert.equal(api.post({ secret: 's', action: 'chat', by: 'Dipti', opId: 'chat-r1', payload: { rid: 'r1', threadId: 't1', text, data } }).duplicate, true);
  assert.equal(api.tabs.Notes.rows.length, 2);
  assert.equal(api.tabs._Chats.rows.length, 2);
  const canon = api.get({ secret: 's', action: 'read' });
  assert.ok(!('_chats' in canon) && !JSON.stringify(canon).includes('"threadId":"t1"'));
  const ans = api.get({ secret: 's', action: 'answer', rid: 'r1' });
  assert.equal(JSON.parse(ans.data).answer.reply, 'Hello');
  assert.match(ans.note, /^CONCERN: hi/);
});

test('older chat notes are read without their data, and can still be recovered', () => {
  const api = createSheetApi({ secret: 's' });
  api.tabs.Notes.appendRow(['2026-10-01T00:00:00.000Z', 'Dipti', 'CONCERN: old\nURGENCY: soon\nANSWER: Old reply\nRID: r0\nDATA: {"answer":{"reply":"Old reply"}}', 'concern']);
  const canon = api.get({ secret: 's', action: 'read' });
  assert.equal(canon.notes[0].text, 'CONCERN: old\nURGENCY: soon\nANSWER: Old reply\nRID: r0');
  assert.equal(JSON.parse(api.get({ secret: 's', action: 'answer', rid: 'r0' }).data).answer.reply, 'Old reply');
});

test('feedback: a chip alone is enough; it lands in the Feedback tab', () => {
  const api = createSheetApi({ secret: 's' });
  assert.equal(api.post({ secret: 's', action: 'feedback', by: 'Dipti', payload: {} }).ok, false);
  assert.equal(api.post({ secret: 's', action: 'feedback', by: 'Dipti', payload: { chip: 'Too much to read', screen: 'today' } }).ok, true);
  assert.deepEqual([...api.tabs.Feedback.rows[1]].slice(1), ['Dipti', 'Too much to read', '', 'today', 'new']);
});
