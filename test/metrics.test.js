import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, fmtDate, readValue, readRange, seriesFor, flag, direction, resultCards, measureOf } from '../public/js/metrics.js';

test('dates in every format the sheet returns', () => {
  assert.deepEqual(parseDate('2026-10-05'), { y: 2026, m: 9, d: 5 });
  assert.deepEqual(parseDate('Mon Oct 05 2026 00:00:00 GMT+0530 (India Standard Time)'), { y: 2026, m: 9, d: 5 });
  assert.equal(fmtDate('5 Oct 2026', { year: true }), '5 Oct 2026');
});
test('values and ranges as printed on Indian lab reports', () => {
  assert.deepEqual(readValue('<0.7 ug/dL'), { value: 0.7, below: true, above: false });
  assert.deepEqual(readValue('>24.3'), { value: 24.3, below: false, above: true });
  assert.equal(readValue('1,250 pg/mL').value, 1250);
  assert.deepEqual(readRange('6.6-22.6'), { low: 6.6, high: 22.6 });
  assert.deepEqual(readRange('< 2.6'), { low: null, high: 2.6 });
});
test('test names map to measures', () => {
  assert.equal(measureOf({ test: 'Cortisol, morning' }), 'cortisol');
  assert.equal(measureOf({ test: 'Gamma GT (GGT)' }), 'ggt');
  assert.equal(measureOf({ test: 'SGPT (ALT)' }), 'alt');
  assert.equal(measureOf({ test: 'Vitamin D 25-OH' }), 'vitd');
  assert.equal(measureOf({ test: 'Platelets' }), null);
});
test('flags and direction: towards the range is better, never guessed without a range', () => {
  const rows = [{ date: '2026-06-10', test: 'GGT', result: '70.5', range: '5-38' }, { date: '2026-10-05', test: 'GGT', result: '95.5' }];
  const s = seriesFor(rows, 'ggt');
  assert.equal(flag(s[1]), 'high');
  assert.equal(direction(s), 'worse');
  const v = seriesFor([{ date: '2026-04-10', test: 'Vitamin D', result: '28' }, { date: '2026-10-05', test: 'Vitamin D', result: '61.2' }], 'vitd');
  assert.equal(flag(v[0]), 'low'); assert.equal(flag(v[1]), 'ok'); assert.equal(direction(v), 'better');
  const alt = seriesFor([{ date: '2026-10-05', test: 'ALT', result: '44.4' }], 'alt');
  assert.equal(flag(alt[0]), 'none');
  assert.equal(flag(seriesFor([{ date: '2026-10-05', test: 'ALT', result: '44.4', range: '0-33' }], 'alt')[0]), 'high');
});
test('result cards only for measures with data', () => {
  const cards = resultCards([{ date: '2026-10-05', test: 'HbA1c', result: '5.7 %' }]);
  assert.deepEqual(cards.map(c => c.key), ['hba1c']);
  assert.equal(cards[0].flag, 'ok');
});
