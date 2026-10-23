// Conditions, one at a time: what each one is, where it stands, and what it
// connects to in her record. Links come from the research pack's interaction
// rows (Evidence tab): two things are linked when one row names both. Every
// link carries a plain sentence and a question in her own words, never a list
// of possible causes. Pure functions; browser and tests.
import { resultCards, measureOf } from './metrics.js';

export const GROUPS = [['long-term', 'Long-term'], ['watching', 'Being watched'], ['settled', 'Settled']];
export const KINDS = { med: 'Medicines', result: 'Results', condition: 'Other conditions', symptom: 'How you feel' };
const KIND_ORDER = ['med', 'result', 'condition', 'symptom'];
const STOP = new Set('the and with for from her not pain low high raised mild small grade still place pattern long term'.split(' '));

const ents = row => String(row?.entities || '').split(/[\s,;|]+/).filter(Boolean);
const words = s => (String(s || '').toLowerCase().match(/[a-z][a-z0-9]{2,}/g) || []).filter(w => !STOP.has(w));
const kindOf = id => /^MED_/.test(id) ? 'med' : /^LAB_/.test(id) ? 'result' : /^COND_/.test(id) ? 'condition' : /^SYM_/.test(id) ? 'symptom' : null;

// 'active' and 'resolved' are the older words for watching and settled.
export function groupOf(status) {
  const s = String(status || '').toLowerCase();
  if (/long/.test(s)) return 'long-term';
  if (/settled|resolved|past|gone/.test(s)) return 'settled';
  return 'watching';
}

// AlsoCalled holds other names; the first one is the short name.
export const aliases = c => String(c?.aliases || '').split(/\s*;\s*/).filter(Boolean);
export const shortName = c => aliases(c)[0] || String(c?.name || '').replace(/\s*\(.*?\)\s*/g, ' ').split(/[,;]/)[0].trim();
export const conditionId = c => c?.key || 'C:' + String(c?.name || '').toLowerCase();

// Everyday label for an entity id.
export function labelFor(canon, id) {
  if (kindOf(id) === 'condition') {
    const c = (canon.conditions || []).find(x => x.key === id);
    if (c) return shortName(c);
  }
  const row = (canon.evidence || []).find(r => r.kind !== 'interaction' && r.kind !== 'recommendation' && ents(r)[0] === id);
  if (row?.plain) return row.plain;
  if (row?.title) return String(row.title).replace(/^What can add to:\s*/i, '');
  return null;
}

// Everything one condition links to: [{id, kind, label, via: [{ix, plain, ask, severity}]}].
// Links whose entity has no label are left out rather than shown as a code.
export function linksFor(canon, key) {
  if (!key) return [];
  const out = new Map();
  for (const r of canon.evidence || []) {
    if (r.kind !== 'interaction') continue;
    const e = ents(r);
    if (!e.includes(key)) continue;
    for (const id of e) {
      if (id === key || !kindOf(id)) continue;
      const label = labelFor(canon, id);
      if (!label) continue;
      const n = out.get(id) || { id, kind: kindOf(id), label, via: [] };
      n.via.push({ ix: r.id, plain: r.plain || '', ask: r.askPlain || '', severity: r.severity || '' });
      out.set(id, n);
    }
  }
  return [...out.values()].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.via.length - a.via.length);
}

export function countsOf(links) {
  const c = { med: 0, result: 0, condition: 0, symptom: 0 };
  links.forEach(l => { c[l.kind]++; });
  return c;
}

// "4 medicines · 2 results"
export function countLine(links) {
  const c = countsOf(links);
  const name = { med: ['medicine', 'medicines'], result: ['result', 'results'], condition: ['condition', 'conditions'], symptom: ['symptom', 'symptoms'] };
  return KIND_ORDER.filter(k => c[k]).map(k => `${c[k]} ${name[k][c[k] === 1 ? 0 : 1]}`).join(' · ');
}

// The doctor whose "owns" line names this condition.
export function doctorFor(canon, c) {
  const ws = new Set([...aliases(c), c.name].flatMap(words));
  return (canon.clinicians || []).find(d => words(d.owns).some(w => ws.has(w))) || null;
}

// A live priority that is about this condition.
export function priorityFor(canon, c) {
  const ws = new Set(aliases(c).flatMap(words));
  if (!ws.size) return null;
  const pr = [...(canon.priorities || [])].filter(p => p.status !== 'done').sort((a, b) => (+a.rank || 99) - (+b.rank || 99));
  const i = pr.findIndex(p => words(p.title).some(w => ws.has(w)));
  return i < 0 ? null : { ...pr[i], n: i + 1 };
}

// The list, grouped, each with its link counts and any live priority.
export function conditionList(canon) {
  const rows = (canon.conditions || []).map(c => {
    const links = linksFor(canon, c.key);
    return { ...c, id: conditionId(c), group: groupOf(c.status), short: shortName(c), links, countLine: countLine(links), priority: priorityFor(canon, c) };
  });
  return GROUPS.map(([g, label]) => ({ group: g, label, items: rows.filter(r => r.group === g).sort((a, b) => (a.priority?.n ?? 9) - (b.priority?.n ?? 9)) })).filter(g => g.items.length);
}

// One condition in isolation, plus what in her record it touches.
export function zoom(canon, id) {
  const c = (canon.conditions || []).find(x => conditionId(x) === id);
  if (!c) return null;
  const links = linksFor(canon, c.key);
  const meds = (canon.medications || []).filter(m => m.status !== 'stopped');
  // A short map label ("Brand") matches a longer name ("Brand SR") in the Medications tab.
  const norm = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').trim();
  const same = (name, label) => { const a = norm(name), b = norm(label); return !!a && !!b && (a === b || a.startsWith(b + ' ') || b.startsWith(a + ' ')); };
  const linkedMeds = links.filter(l => l.kind === 'med')
    .map(l => ({ link: l, med: meds.find(m => same(m.name, l.label)) }))
    .filter(x => x.med);
  const cards = resultCards(canon.testResults || []);
  const labKeys = links.filter(l => l.kind === 'result').map(l => {
    const row = (canon.evidence || []).find(r => r.kind === 'lab' && ents(r)[0] === l.id);
    return measureOf({ test: row?.title || l.label });
  }).filter(Boolean);
  const linkedResults = cards.filter(k => labKeys.includes(k.key));
  const doctor = doctorFor(canon, c);
  const ws = new Set(aliases(c).flatMap(words));
  const questions = (canon.questions || []).filter(q => q.status !== 'answered' &&
    ((doctor && q.askWhom === doctor.name && words(q.question).some(w => ws.has(w))) || words(q.question).some(w => ws.has(w))));
  return {
    cond: c, id, short: shortName(c), group: groupOf(c.status), links, counts: countsOf(links),
    meds: linkedMeds, results: linkedResults, doctor, questions, priority: priorityFor(canon, c),
  };
}

// One link, told for the card under the map: the first plain sentence, and
// the question she could ask.
export function linkStory(link) {
  const v = link.via.find(x => x.plain) || link.via[0] || {};
  const ask = (link.via.find(x => x.ask) || {}).ask || '';
  return { plain: v.plain || '', ask, more: Math.max(0, link.via.length - 1) };
}
