import test from 'node:test';
import assert from 'node:assert/strict';
import { factsDue, factsToday, writesFor, needsEdit, appointments, nextAppointment, whenText, PER_DAY } from '../public/js/facts-model.js';

const TODAY = '2026-10-23';
const canon = {
  medications: [
    { name: 'Medicine A', dose: '10 mg', timing: 'morning', status: 'current', checked: '2026-10-20' }, // checked 3 days ago: not due
    { name: 'Medicine B', dose: '20 mg', timing: 'night', status: 'check', rx: '10 mg', checked: '' }, // never checked, list differs
    { name: 'Medicine C', dose: '5 mg', status: 'current', checked: '2026-10-01' },
    { name: 'Old D', status: 'stopped' },
  ],
  priorities: [
    { id: 'P1', rank: '1', title: 'Tooth pain (upper example)', status: 'now', checked: '2026-10-10' },
    { id: 'P2', rank: '2', title: 'Sorted thing', status: 'done' },
  ],
  appointments: [
    { id: 'A1', date: '2026-10-21', time: '10:30', with: 'Dr Example', status: 'booked' }, // in the past, still booked
    { id: 'A2', date: '2026-10-25', time: '', with: 'Dentist', status: 'booked', checked: '2026-10-20' }, // in 2 days
    { id: 'A3', date: '2026-11-20', with: 'Later doctor', status: 'booked' },
    { id: 'A4', date: '2026-10-08', with: 'Past doctor', status: 'done' },
  ],
};

test('due facts: overdue appointment first, then the soon one, then the medicine to confirm, then symptoms, then stale medicines', () => {
  const f = factsDue(canon, TODAY);
  assert.deepEqual(f.map(x => x.id), ['Appointments:A1', 'Appointments:A2', 'Medications:Medicine B', 'Priorities:P1', 'Medications:Medicine C']);
  assert.equal(f[0].question, 'Did you see Dr Example Wed 21 Oct 10:30?');
  assert.equal(f[1].question, 'Still on: Dentist, Sun 25 Oct?');
  assert.equal(f[2].says, 'Last prescription: 10 mg');
  assert.equal(f[3].question, 'How is your tooth pain now?');
  assert.equal(factsToday(canon, TODAY).length, PER_DAY);
});

test('a fact checked recently, a stopped medicine and a sorted priority are not asked about', () => {
  const ids = factsDue(canon, TODAY).map(x => x.id);
  assert.ok(!ids.includes('Medications:Medicine A'));
  assert.ok(!ids.includes('Medications:Old D'));
  assert.ok(!ids.includes('Priorities:P2'));
  assert.ok(!ids.includes('Appointments:A3')); // weeks away
});

test('answers become Sheet writes; changes carry checked so they count as checked', () => {
  const [past, soon, med, sym] = factsDue(canon, TODAY);
  assert.deepEqual(writesFor(med, 'still').writes, [{ action: 'check', payload: { tab: 'Medications', key: 'Medicine B' } }]);
  assert.deepEqual(writesFor(med, 'stopped').writes[0], { action: 'medication', payload: { name: 'Medicine B', status: 'stopped', checked: true } });
  assert.deepEqual(writesFor(med, 'changed', { dose: '15 mg' }).writes[0].payload, { name: 'Medicine B', checked: true, dose: '15 mg' });
  assert.equal(writesFor(past, 'done').writes[0].payload.status, 'done');
  assert.deepEqual(writesFor(soon, 'moved', { date: '2026-10-30', time: '09:00' }).writes[0].payload, { id: 'A2', status: 'booked', checked: true, date: '2026-10-30', time: '09:00' });
  assert.equal(writesFor(sym, 'better').writes[0].payload.status, 'better');
  const worse = writesFor(sym, 'worse');
  assert.equal(worse.worse, true);
  assert.equal(worse.writes[1].action, 'note');
  assert.ok(needsEdit(med, 'changed') && needsEdit(soon, 'moved') && !needsEdit(med, 'still'));
});

test('appointments: upcoming in order, overdue, and the next one', () => {
  const a = appointments(canon, TODAY);
  assert.deepEqual(a.upcoming.map(x => x.id), ['A2', 'A3']);
  assert.deepEqual(a.overdue.map(x => x.id), ['A1']);
  assert.deepEqual(a.earlier.map(x => x.id), ['A4']);
  assert.equal(nextAppointment(canon, TODAY).id, 'A2');
  assert.equal(whenText('2026-10-24', '9:00', TODAY), 'tomorrow 9:00');
});

test('after answering, the same fact is not asked again today', async () => {
  const { applyLocal } = await import('../public/js/facts-model.js');
  const c = structuredClone(canon);
  for (const f of factsDue(c, TODAY)) applyLocal(c, writesFor(f, f.kind === 'apptPast' ? 'done' : 'still').writes, TODAY);
  assert.deepEqual(factsDue(c, TODAY), []);
  assert.equal(c.appointments.find(a => a.id === 'A1').status, 'done');
});

test('dates the Sheet returns as full date strings still work', () => {
  const c = { appointments: [{ id: 'A9', date: 'Thu Oct 08 2026 00:00:00 GMT+0100 (British Summer Time)', with: 'Dr Y', status: 'done' }] };
  assert.equal(appointments(c, TODAY).earlier[0].date, '2026-10-08');
});
