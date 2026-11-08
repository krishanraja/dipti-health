import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../scripts/fixture.mjs';
import { weekTrend, climbing, afterCheckin, todayTrend, areaCheckins, daysThisWeek } from '../public/js/insights-model.js';

const DAY = 86400000;
const now = new Date('2026-11-08T12:00:00Z');
const ci = (daysAgo, tooth, abdomen = 2, fatigue = 5) => ({ tsUTC: new Date(now.getTime() - daysAgo * DAY).toISOString(), tooth: String(tooth), abdomen: String(abdomen), fatigue: String(fatigue) });

test('week trend: easing, higher, steady, and nothing to compare', () => {
  const canon = { checkins: [ci(12, 6), ci(10, 6), ci(8, 5), ci(5, 3), ci(3, 3), ci(1, 2)] };
  assert.equal(weekTrend(canon, 'tooth', now).dir, 'easing');
  assert.equal(weekTrend(canon, 'abdomen', now).dir, 'steady');
  assert.equal(weekTrend({ checkins: [ci(10, 2), ci(2, 5)] }, 'tooth', now).dir, 'higher');
  assert.equal(weekTrend({ checkins: [ci(2, 5)] }, 'tooth', now).dir, null);
});

test('Today leads with what is easing', () => {
  const canon = { checkins: [ci(10, 6, 2, 4), ci(9, 6, 2, 4), ci(3, 3, 2, 6), ci(1, 3, 2, 6)] };
  assert.equal(todayTrend(canon, now), 'Tooth pain easing this week');
  assert.equal(todayTrend({ checkins: [] }, now), '');
});

test('climbing needs three rises ending at 5 or more', () => {
  assert.equal(climbing({ checkins: [ci(3, 2), ci(2, 4), ci(1, 6)] }, 'tooth'), true);
  assert.equal(climbing({ checkins: [ci(3, 1), ci(2, 2), ci(1, 3)] }, 'tooth'), false);
  assert.equal(climbing({ checkins: [ci(3, 6), ci(2, 6), ci(1, 7)] }, 'tooth'), false);
});

test('after a check-in: easing first, the usual said once, a rise named, days counted', () => {
  const canon = { checkins: [ci(3, 6, 2, 4), ci(2, 6, 2, 4), ci(1, 6, 2, 4)] };
  const r = afterCheckin(canon, { tooth: 3, abdomen: 2, fatigue: 7 }, now);
  assert.equal(r.first, false);
  assert.match(r.lines[0], /^Tooth pain is lower than your recent days \(3, from about 6\)/);
  assert.equal(r.lines[1], 'Tummy pain is about your usual.');
  assert.match(r.lines[2], /^Tiredness is higher/);
  assert.match(r.lines[3], /^4 days checked in this week/);
  const same = afterCheckin(canon, { tooth: 6, abdomen: 2, fatigue: 4 }, now);
  assert.equal(same.lines[0], 'Tooth pain, tummy pain and tiredness are about your usual.');
});

test('first check-in says so instead of comparing with nothing', () => {
  assert.equal(afterCheckin({ checkins: [] }, { tooth: 3, abdomen: 2, fatigue: 5 }, now).first, true);
});

test('a My care area carries its own check-in story; areas without a score do not', () => {
  const canon = { checkins: [ci(12, 6), ci(10, 6), ci(5, 3), ci(1, 2)] };
  const s = areaCheckins(canon, 'teeth', now);
  assert.equal(s.title, 'Your check-ins');
  assert.match(s.text, /^Tooth pain \(6 → 6 → 3 → 2 out of 10\)\. Easing/);
  assert.equal(areaCheckins(canon, 'heart', now), null);
  assert.equal(areaCheckins({ checkins: [] }, 'teeth', now), null);
});

test('works on the fixture and on Sheet-shaped dates', () => {
  const f = fixture();
  assert.ok(daysThisWeek(f) >= 6);
  assert.ok(areaCheckins(f, 'teeth'));
  const sheet = { checkins: [{ tsUTC: '', tsLocal: '2026-11-07 09:30', tooth: '4', abdomen: '1', fatigue: '5' }] };
  assert.equal(daysThisWeek(sheet, now), 1);
});

test('a note that names a medicine on her list is spotted, by brand or generic', async () => {
  const { medsMentioned } = await import('../public/js/insights-model.js');
  const canon = { medications: [
    { name: 'Sleepzo', generic: 'dormazapine', status: 'current' },
    { name: 'Moodex', generic: 'calmoxetine', status: 'current' },
    { name: 'Old one', generic: 'oldamine', status: 'stopped' },
  ] };
  assert.deepEqual(medsMentioned(canon, 'When I take the full sleepzo i sleep well. From today I am taking 3/4'), ['Sleepzo']);
  assert.deepEqual(medsMentioned(canon, 'Started calmoxetine in the morning'), ['Moodex']);
  assert.deepEqual(medsMentioned(canon, 'stopped oldamine'), []);
  assert.deepEqual(medsMentioned(canon, 'slept badly'), []);
});
