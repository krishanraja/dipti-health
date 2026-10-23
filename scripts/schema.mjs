// Writes data/schema.json from the TABS list in apps-script/Code.gs, so the
// documented schema can never drift from the deployed one.
// Usage: node scripts/schema.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8'), ctx);
const TABS = vm.runInContext('TABS', ctx);
const out = {
  _comment: 'Canon sheet schema, generated from apps-script/Code.gs by scripts/schema.mjs. NO patient data: live values live only in the private Google Sheet.',
  tabs: Object.fromEntries(Object.entries(TABS).map(([name, t]) => [name, { mode: t.mode, headers: t.cols.map(c => c[0]) }])),
};
fs.writeFileSync(path.join(root, 'data', 'schema.json'), JSON.stringify(out, null, 2) + '\n');
console.log('wrote data/schema.json with', Object.keys(out.tabs).length, 'tabs');
