// The research pack in her Sheet (Evidence and Sources tabs): interactions,
// medicine notes, lab notes and recommendations, each graded A to E.
// Nothing patient-specific lives in this file: entity names are learned from
// the Evidence rows themselves. Pure functions; browser, server and tests.

export const SEVERITY_RANK = { critical: 0, high: 1, moderate: 2, low: 3, '': 4 };
export const GRADE_LABEL = {
  A: 'Guideline, regulator or trial', B: 'Observational study or review', C: 'Case report or mechanism',
  D: 'Patient community (a signal, not proof)', E: 'Reasoned from her record (to verify)',
};

const words = s => (String(s || '').toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []);
const STOP = new Set('the and with for from into her his not test low high pain list current only both raised pattern formally diagnosed morning total free vitamin strong forte tablet tablets daily grade small mild medicine medicines supplement example capsule injection'.split(' '));
const entitiesOf = row => String(row.entities || '').split(/[\s,;|]+/).filter(Boolean);

// Names for each entity id, from the rows that describe one entity
// (kind medication | lab | condition | name), e.g. MED_X -> ["brand", "generic"],
// plus the everyday label in the row's Plain column ("tummy pain").
export function entityNames(evidence = []) {
  const names = {};
  const add = (id, title) => {
    const ws = words(title).filter(w => !STOP.has(w));
    if (!ws.length) return;
    const set = names[id] ||= new Set();
    set.add(words(title).join(' '));
    ws.filter(w => w.length >= 5).forEach(w => set.add(w));
  };
  for (const r of evidence) {
    const one = /^(medication|lab|condition|symptom|name)$/.test(r.kind);
    if (!one && r.kind !== 'symptom_attribution') continue;
    const id = entitiesOf(r)[0] || r.id;
    if (one) add(id, String(r.title || '').split(':')[0]);
    if (r.plain) add(id, String(r.plain).replace(/\(.*?\)/g, ''));
  }
  return Object.fromEntries(Object.entries(names).map(([k, v]) => [k, [...v]]));
}

// Entity ids a question mentions.
export function entitiesIn(text, evidence = []) {
  const t = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ') + ' ';
  const out = new Set();
  for (const [id, names] of Object.entries(entityNames(evidence))) {
    if (names.some(n => n.length >= 4 && t.includes(' ' + n + ' '))) out.add(id);
  }
  return [...out];
}

const rank = r => (SEVERITY_RANK[r.severity] ?? 4) * 10 + ('ABCDE'.indexOf(r.grade) + 1 || 6);

// Rows that touch any of the given entities, most serious first.
export function related(evidence = [], ids = [], k = 8) {
  const want = new Set(ids);
  return evidence.filter(r => entitiesOf(r).some(e => want.has(e)) || want.has(r.id))
    .sort((a, b) => rank(a) - rank(b)).slice(0, k);
}

// The pack as compact text for the model: every row, most serious first,
// inside a size budget (the whole pack is small enough to fit).
export function evidenceText(evidence = [], sources = [], budget = 45000) {
  if (!evidence.length) return '(The research pack is not in the Sheet yet.)';
  // 'name' rows only label an entity; they carry no evidence.
  const rows = evidence.filter(r => r.kind !== 'name').sort((a, b) => rank(a) - rank(b));
  const L = [];
  for (const r of rows) {
    const tags = [r.kind, r.severity && `severity ${r.severity}`, r.grade && `grade ${r.grade}`, r.appliesWhen && `applies: ${r.appliesWhen}`].filter(Boolean).join(', ');
    L.push(`[${r.id}] (${tags}) ${String(r.text || r.title).replace(/\s+/g, ' ').trim()}${r.ask ? ` Question for her doctor: ${r.ask}` : ''}${r.sources ? ` Sources: ${r.sources}` : ''}`);
  }
  if (sources.length) {
    L.push('', 'Source list (id, grade, title):');
    for (const s of sources) L.push(`${s.id} [${s.grade}] ${s.title}${s.year ? ' (' + s.year + ')' : ''}`);
  }
  let out = L.join('\n');
  if (out.length > budget) out = out.slice(0, budget).replace(/\n[^\n]*$/, '') + '\n(lower-severity items trimmed)';
  return out;
}

// Source ids in a row -> {id, title, url, grade}, for showing a link.
export function sourcesFor(row, sources = []) {
  const byId = Object.fromEntries(sources.map(s => [s.id, s]));
  return String(row?.sources || '').split(/[\s,;|]+/).map(id => byId[id]).filter(s => s && s.url);
}
