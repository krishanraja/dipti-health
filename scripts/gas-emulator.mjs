// Runs the real apps-script/Code.gs in Node against an in-memory spreadsheet,
// so local runs and simulations exercise the deployed sheet logic, column by
// column, instead of a hand-written imitation of it.
//
// Sheets quirks reproduced on write (appendRow / setValue):
//   "500" -> 500, "2026-10-12" -> Date, "2026-10-12 08:30" -> Date.
// readCanon then stringifies every cell, exactly as it does in production.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Mimic what Google Sheets does to a typed-in value.
export function coerce(v) {
  if (typeof v !== 'string') return v;
  if (/^-?\d+(\.\d+)?$/.test(v) && !/^0\d/.test(v)) return Number(v);
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = v.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return v;
}

class Range {
  constructor(sheet, r, c, nr = 1, nc = 1) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = this.sheet.rows[this.r - 1 + i] || [];
      out.push(Array.from({ length: this.nc }, (_, j) => row[this.c - 1 + j] ?? ''));
    }
    return out;
  }
  getValue() { return this.getValues()[0][0]; }
  setValue(v) {
    const row = this.sheet.rows[this.r - 1] || (this.sheet.rows[this.r - 1] = []);
    row[this.c - 1] = coerce(v);
    return this;
  }
}

class Sheet {
  constructor(name, headers) { this.name = name; this.rows = [headers.slice()]; this.width = headers.length; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.width; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  appendRow(values) { this.rows.push(values.map(coerce)); this.width = Math.max(this.width, values.length); return this; }
}

export function createSheetApi({ secret = 'mock', seed = null } = {}) {
  const tabs = {};
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => tabs[n] || null, getUrl: () => 'https://docs.google.com/spreadsheets/d/mock-sheet/edit' }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: text => ({ text, setMimeType() { return this; }, getContent() { return this.text; } }),
    },
    Utilities: {
      formatDate: (d, tz) => {
        const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
        return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
      },
    },
    JSON, Date, String, Number, Math, parseInt, Error,
  };
  const code = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8').replace("'__APP_SECRET__'", JSON.stringify(secret));
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'Code.gs' });
  // The tabs and headers come from Code.gs itself, the same list setup() uses.
  for (const [name, t] of Object.entries(vm.runInContext('TABS', ctx))) tabs[name] = new Sheet(name, t.cols.map(c => c[0]));

  if (seed) seedTabs(tabs, seed, vm.runInContext('TABS', ctx));

  return {
    tabs,
    get: params => JSON.parse(ctx.doGet({ parameter: params }).getContent()),
    post: body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent()),
  };
}

// Load a canon-shaped object into the tabs (used for invented seed data).
// canon key -> tab; each row is written in the tab's own column order.
export const CANON_TABS = {
  priorities: 'Priorities', conditions: 'Conditions', medications: 'Medications', testResults: 'TestResults',
  checkins: 'CheckIns', questions: 'Questions', gaps: 'KnowledgeGaps', clinicians: 'Clinicians',
  evidence: 'Evidence', sources: 'Sources', notes: 'Notes',
};
function seedTabs(tabs, c, TABS) {
  const put = (tab, rows) => rows.forEach(r => tabs[tab].appendRow(r.map(v => v ?? '')));
  put('Meta', Object.entries(c.meta || {}));
  put('Profile', Object.entries(c.profile || {}).map(([k, v]) => [k, v, 'seed', '', 'yes']));
  for (const [key, tab] of Object.entries(CANON_TABS)) {
    const keys = TABS[tab].cols.map(x => x[1]);
    put(tab, (c[key] || []).map(x => keys.map(k => x[k])));
  }
}
