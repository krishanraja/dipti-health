import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanUpdates } from '../lib/updates.js';

const canon = {
  medications: [{ name: 'Medicine A', status: 'current' }],
  appointments: [{ id: 'A1', date: '2026-10-25', with: 'Dentist', status: 'booked' }],
  priorities: [{ id: 'P1', status: 'now' }],
};

test('valid proposals pass, matched to the names and ids in her Sheet', () => {
  const u = cleanUpdates([
    { kind: 'medication', say: 'Mark Medicine A as stopped from today?', payload: { name: 'medicine a', status: 'stopped' } },
    { kind: 'appointment', say: 'Move the dentist to Fri?', payload: { id: 'a1', date: '2026-10-30', status: 'moved' } },
  ], canon);
  assert.deepEqual(u[0].payload, { name: 'Medicine A', status: 'stopped' });
  assert.deepEqual(u[1].payload, { id: 'A1', date: '2026-10-30', status: 'booked' });
});

test('unsafe or empty proposals are dropped', () => {
  const u = cleanUpdates([
    { kind: 'medication', say: 'Stop something unknown?', payload: { name: 'Mystery', status: 'stopped' } },
    { kind: 'medication', say: 'No change at all?', payload: { name: 'Medicine A' } },
    { kind: 'appointment', say: 'New one without a date?', payload: { with: 'Dr Z' } },
    { kind: 'priority', say: 'Unknown priority?', payload: { id: 'P9', status: 'done' } },
    { kind: 'delete', say: 'Delete everything?', payload: {} },
    { kind: 'medication', payload: { name: 'Medicine A', status: 'stopped' } }, // no question to show
  ], canon);
  assert.deepEqual(u, []);
});

test('at most two, and a new appointment needs a date and who', () => {
  const u = cleanUpdates([
    { kind: 'appointment', say: 'Add Dr Z on 2 Nov?', payload: { with: 'Dr Z', date: '2026-11-02', time: '9:00' } },
    { kind: 'priority', say: 'Mark tooth pain as better?', payload: { id: 'P1', status: 'better' } },
    { kind: 'medication', say: 'Started Medicine B?', payload: { name: 'Medicine B', status: 'current', dose: '5 mg' } },
  ], canon);
  assert.equal(u.length, 2);
  assert.deepEqual(u[0].payload, { date: '2026-11-02', time: '9:00', with: 'Dr Z' });
});
