import test from 'node:test';
import assert from 'node:assert/strict';
import { symptomLevel, repeatAsk, localDay, lastCheckin, scoreSeries, TAGS, WORRY } from '../public/js/dipti-model.js';

test('worry levels stay calm for everyday symptoms', () => {
  assert.equal(symptomLevel({ symptom: 'tooth', when: 'today', severity: 'moderate' }), 'routine');
  assert.equal(symptomLevel({ symptom: 'tired', when: 'week', severity: 'bad' }), 'soon');
  assert.equal(symptomLevel({ symptom: 'abdomen', when: 'now', severity: 'mild' }), 'routine');
});
test('steroid sick-day: diarrhoea or being sick is never just routine', () => {
  assert.equal(symptomLevel({ symptom: 'diarrhoea', when: 'today', severity: 'mild' }), 'soon');
  assert.equal(symptomLevel({ symptom: 'diarrhoea', when: 'today', severity: 'moderate' }), 'urgent');
  assert.equal(symptomLevel({ symptom: 'sick', when: 'today', severity: 'mild' }), 'urgent');
  assert.equal(symptomLevel({ symptom: 'diarrhoea', when: 'today', severity: 'bad', note: 'five times today' }), 'urgent');
  assert.equal(symptomLevel({ symptom: 'tooth', when: 'now', severity: 'bad', note: 'my cheek is swollen' }), 'urgent');
  assert.equal(symptomLevel({ symptom: 'dizzy', when: 'now', severity: 'bad' }), 'urgent');
});
test('every level has one title and one step', () => {
  for (const l of ['routine', 'soon', 'urgent', 'emergency']) { assert.ok(WORRY[l].title); assert.ok(WORRY[l].step); }
});
test('the same question within a day is spotted; a different one is not', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  const c = (h, q) => ({ tag: TAGS.concern, tsUTC: new Date(now - h * 3600000).toISOString(), text: `CONCERN: ${q}\nURGENCY: routine\nANSWER: a` });
  const canon = { notes: [c(2, 'Why does my tooth hurt when I bite?'), c(5, 'Tooth hurts when biting again, why?'), c(30, 'Why does my tooth hurt biting?'), c(1, 'What is my GGT?')] };
  assert.equal(repeatAsk(canon, 'My tooth still hurts when I bite, why?', now), 2);
  assert.equal(repeatAsk(canon, 'Should I eat more protein?', now), 0);
  assert.equal(repeatAsk({}, 'anything at all here', now), 0);
});
test('local day is India time', () => {
  assert.equal(localDay('2026-10-23T19:00:00Z'), '2026-10-24');
});
test('latest check-in and score series', () => {
  const canon = { checkins: [{ tsUTC: 'a', tooth: '7', abdomen: '4', fatigue: '8' }, { tsUTC: 'b', tooth: '5', abdomen: '4', fatigue: '6', verdict: 'Steady' }] };
  assert.equal(lastCheckin(canon).tooth, 5);
  assert.deepEqual(scoreSeries(canon, 'tooth').map(p => p.value), [7, 5]);
});
