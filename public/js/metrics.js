// Turns the sheet's test results into structured measures with a plain,
// proportionate meaning. Pure: no DOM, no network. Runs in browser and tests.
// Ranges come from her lab reports (the Range column). The defaults below are
// only ranges printed on her own reports; where none was printed it is null
// and no flag is shown, rather than a guessed range.

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Accepts "Wed Aug 26 2026 00:00:00 GMT+0100 (British Summer Time)", ISO
// timestamps, "2026-08-26", "26 Aug 2026" and "2026-10-13 08:39".
// Returns {y,m,d} or null. The calendar date as written is kept.
export function parseDate(s) {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { y: +m[1], m: +m[2] - 1, d: +m[3] };
  m = t.match(/\b([A-Z][a-z]{2}) (\d{1,2}) (\d{4})\b/);
  if (m && m[1].toLowerCase() in MONTHS) return { y: +m[3], m: MONTHS[m[1].toLowerCase()], d: +m[2] };
  m = t.match(/\b(\d{1,2}) ([A-Z][a-z]{2})[a-z]* (\d{4})\b/);
  if (m && m[2].toLowerCase() in MONTHS) return { y: +m[3], m: MONTHS[m[2].toLowerCase()], d: +m[1] };
  return null;
}
export function dateKey(s) { const p = parseDate(s); return p ? p.y * 10000 + (p.m + 1) * 100 + p.d : 0; }
export function fmtDate(s, { year = false } = {}) {
  const p = parseDate(s);
  if (!p) return '';
  return `${p.d} ${MON[p.m]}${year ? ' ' + p.y : ''}`;
}
export function daysUntil(s, now = new Date()) {
  const p = parseDate(s);
  if (!p) return null;
  const a = Date.UTC(p.y, p.m, p.d), b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000);
}

// First number in a result ("<0.4 ug/dL" -> 0.4 with below:true).
export function readValue(result) {
  const t = String(result || '').replace(/,(?=\d{3}\b)/g, '');
  const m = t.match(/([<>]=?)?\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { value: parseFloat(m[2]), below: m[1]?.startsWith('<') || false, above: m[1]?.startsWith('>') || false };
}
// "6.6-22.6", "< 2.6", ">6.5" -> {low, high}
export function readRange(range) {
  const t = String(range || '');
  let m = t.match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/);
  if (m) return { low: +m[1], high: +m[2] };
  m = t.match(/<\s*=?\s*(\d+(?:\.\d+)?)/); if (m) return { low: null, high: +m[1] };
  m = t.match(/>\s*=?\s*(\d+(?:\.\d+)?)/); if (m) return { low: +m[1], high: null };
  return null;
}

// The measures that matter for her priorities. `plain` is one calm sentence:
// what it is, and why it is being watched. Never a diagnosis.
export const MEASURES = {
  cortisol: {
    re: /cortisol/i, label: 'Morning cortisol', short: 'Cortisol', unit: 'µg/dL', range: { low: 6.6, high: 22.6 },
    plain: 'The body\'s own steroid. Long-term steroid tablets switch it down, so a low result can be expected; it matters most during illness, or before any change to the steroid dose.',
  },
  ggt: {
    re: /\bGGT\b|gamma/i, label: 'GGT (liver enzyme)', short: 'GGT', unit: 'U/L', range: { low: 5, high: 38 },
    plain: 'A liver enzyme. The trend over several tests matters more than any one reading.',
  },
  alt: {
    re: /\bALT\b|SGPT/i, label: 'ALT (liver enzyme)', short: 'ALT', unit: 'U/L', range: null,
    plain: 'Another liver enzyme. Read it alongside GGT and the other liver tests.',
  },
  hba1c: {
    re: /hba1c/i, label: 'HbA1c (3-month sugar)', short: 'HbA1c', unit: '%', range: { low: 4.2, high: 5.7 },
    plain: 'Average blood sugar over about three months.',
  },
  homocysteine: {
    re: /homocyst/i, label: 'Homocysteine', short: 'Homocysteine', unit: 'µmol/L', range: { low: 3.7, high: 13.9 },
    plain: 'A blood marker linked to B vitamins. If it stays high, it is a question for the doctor, not an emergency.',
  },
  ferritin: {
    re: /ferritin/i, label: 'Ferritin (iron stores)', short: 'Ferritin', unit: 'ng/mL', range: { low: 10, high: 291 },
    plain: 'Iron stores. Low iron can add to tiredness.',
  },
  vitd: {
    re: /vitamin d|25.?oh/i, label: 'Vitamin D', short: 'Vit D', unit: 'ng/mL', range: { low: 30, high: 100 },
    plain: 'Vitamin D level. Low levels are common and easy to treat.',
  },
  ldl: {
    re: /\bLDL\b/i, label: 'LDL cholesterol', short: 'LDL', unit: 'mg/dL', range: null,
    plain: 'The "bad" cholesterol. Lower is better for the heart.',
  },
};
export const KEY_MEASURES = Object.keys(MEASURES);

export function measureOf(row) {
  const t = String(row?.test || '');
  return KEY_MEASURES.find(k => MEASURES[k].re.test(t)) || null;
}

// Every value of one measure over time, oldest first.
export function seriesFor(testResults = [], key) {
  return testResults.filter(r => measureOf(r) === key)
    .map(r => ({ date: r.date, key: dateKey(r.date), ...readValue(r.result), range: readRange(r.range) || MEASURES[key].range, raw: r.result }))
    .filter(p => p.key && Number.isFinite(p.value))
    .sort((a, b) => a.key - b.key);
}

export function flag(p) {
  if (!p || !p.range) return 'none';
  const { low, high } = p.range || {};
  if (high != null && (p.value > high || (p.above && p.value >= high))) return 'high';
  if (low != null && (p.value < low || (p.below && p.value <= low))) return 'low';
  return 'ok';
}

export function trend(points) {
  if (points.length < 2) return '';
  const a = points[points.length - 2].value, b = points[points.length - 1].value;
  if (!a) return '';
  const pct = (b - a) / Math.abs(a);
  return Math.abs(pct) < 0.05 ? 'steady' : pct < 0 ? 'down' : 'up';
}

// Is the latest move towards the range (better) or away from it?
export function direction(points) {
  if (points.length < 2) return '';
  const last = points[points.length - 1], prev = points[points.length - 2];
  if (!last.range) return '';
  const { low, high } = last.range;
  const gap = v => (high != null && v > high ? v - high : low != null && v < low ? low - v : 0);
  const g1 = gap(prev.value), g2 = gap(last.value);
  if (g1 === g2) return g2 === 0 ? 'in range' : 'no change';
  return g2 < g1 ? 'better' : 'worse';
}

// One card per key measure that has data, in a fixed order.
export function resultCards(testResults = []) {
  return KEY_MEASURES.map(key => {
    const points = seriesFor(testResults, key);
    if (!points.length) return null;
    const last = points[points.length - 1];
    return { key, def: MEASURES[key], points, last, flag: flag(last), trend: trend(points), direction: direction(points) };
  }).filter(Boolean);
}

// One calm label and tone for a result card: in range, improving, or outside.
export function cardLabel(c) {
  if (c.flag === 'ok') return { text: 'In range', tone: 'ok' };
  if (c.flag === 'none') return { text: c.trend ? { up: 'Going up', down: 'Going down', steady: 'Steady' }[c.trend] : '', tone: '' };
  if (c.direction === 'better') return { text: 'Improving', tone: 'accent' };
  return { text: c.flag === 'high' ? 'Above range' : 'Below range', tone: 'warm' };
}
