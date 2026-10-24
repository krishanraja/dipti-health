// My care: her conditions grouped into a few areas of the body, each with
// the person who looks after it and where it stands. Nothing is dropped:
// every condition sits in exactly one area. Only areas tied to a live
// priority are "being looked into now"; the rest are "known and looked
// after", which is true of everything in her record that has no open step.
// Statuses only repeat what the Sheet says. Pure; unit tested.
import { conditionList, doctorFor, groupOf } from './conditions-model.js';

// First match wins, in this order. The last area takes whatever is left.
export const AREAS = [
  { id: 'teeth', label: 'Teeth', icon: 'tooth', re: /\b(tooth|teeth|dental|dentist|gum|molar|jaw|endodont)/i },
  { id: 'gut', label: 'Tummy and liver', icon: 'gut', re: /(liver|hepat|\bgut\b|tummy|abdom|bowel|stomach|stool|\bggt\b|\balt\b|intoleran|gastro)/i },
  { id: 'hormones', label: 'Hormones and energy', icon: 'drop', re: /(cortisol|adrenal|thyroid|\bt3\b|\bt4\b|sugar|hba1c|diabet|insulin|endocrin|tired|fatigue|energy)/i },
  { id: 'joints', label: 'Joints and body pain', icon: 'joint', re: /(arthrit|joint|fibromyalg|rheumat|muscle|body pain)/i },
  { id: 'heart', label: 'Heart and blood pressure', icon: 'heart', re: /(heart|cardi|coronary|arter|blood pressure|hypertens|cholesterol|diastolic|homocysteine)/i },
  { id: 'mind', label: 'Mood and sleep', icon: 'moon', re: /(mood|anxi|depress|sleep|insomnia|apnoea|apnea|psychiat)/i },
  { id: 'everyday', label: 'Everyday health', icon: 'leaf', re: /./ },
];

const text = c => `${c.name} ${c.aliases || ''}`;
export const areaOf = c => AREAS.find(a => a.re.test(text(c))) || AREAS[AREAS.length - 1];
const areaOfTitle = t => AREAS.slice(0, -1).find(a => a.re.test(t)) || null;

export const TAG = {
  waiting: { text: 'Waiting', tone: 'wait' },
  now: { text: 'In hand', tone: 'hand' },
  better: { text: 'Getting better', tone: 'ok' },
  known: { text: 'Looked after', tone: 'ok' },
  long: { text: 'Long-term', tone: 'ok' },
  settled: { text: 'Settled', tone: 'quiet' },
};
const prTag = p => (p.status === 'waiting' ? TAG.waiting : p.status === 'better' ? TAG.better : TAG.now);

// The tag one condition carries in its area.
export function conditionTag(c) {
  if (c.priority) return prTag(c.priority);
  const g = groupOf(c.status);
  return g === 'settled' ? TAG.settled : g === 'long-term' ? TAG.long : TAG.known;
}

const firstSentence = s => (String(s || '').match(/^.+?[.!?](\s|$)/) || [String(s || '')])[0].trim();

export function careAreas(canon = {}) {
  const conds = conditionList(canon).flatMap(g => g.items);
  const live = [...(canon.priorities || [])].filter(p => p.status !== 'done').sort((a, b) => (+a.rank || 99) - (+b.rank || 99));
  const areas = AREAS.map(a => ({ ...a, conditions: [], priorities: [] }));
  const byId = Object.fromEntries(areas.map(a => [a.id, a]));
  for (const c of conds) byId[areaOf(c).id].conditions.push({ ...c, tag: conditionTag(c), line: firstSentence(c.plain) });
  live.forEach((p, i) => {
    const a = (p.title && areaOfTitle(`${p.title} ${p.askWhom || ''}`)) || conds.filter(c => c.priority?.id === p.id).map(areaOf)[0];
    if (a) byId[a.id].priorities.push({ ...p, n: i + 1 });
  });
  return areas.filter(a => a.conditions.length || a.priorities.length).map(a => {
    // The doctor who looks after most of this area.
    const tally = new Map();
    // A lab or a hospital runs tests; it does not look after her.
    const people = { ...canon, clinicians: (canon.clinicians || []).filter(d => !/\b(lab|hospital|referred|clinic)\b/i.test(`${d.role} ${d.name}`)) };
    a.conditions.forEach(c => { const d = doctorFor(people, c); if (d) tally.set(d.name, (tally.get(d.name) || 0) + 1); });
    const doctor = ([...tally].sort((x, y) => y[1] - x[1])[0]?.[0] || '').replace(/\s*\((?:not named|name not recorded|role inferred)\)/i, '');
    const p = a.priorities[0] || null;
    const allSettled = a.conditions.length && a.conditions.every(c => groupOf(c.status) === 'settled');
    const tag = p ? prTag(p) : allSettled ? TAG.settled : TAG.known;
    const what = a.conditions.slice(0, 3).map(c => c.short).join(', ').toLowerCase();
    const summary = p ? [doctor, p.status === 'waiting' ? 'Waiting on the next step.' : p.nextStep].filter(Boolean).join('. ')
      : [doctor, what.charAt(0).toUpperCase() + what.slice(1)].filter(Boolean).join('. ');
    return { ...a, doctor, now: Boolean(p), priority: p, tag, summary };
  }).sort((x, y) => (y.now - x.now) || ((x.priority?.n ?? 99) - (y.priority?.n ?? 99)));
}

// "Three things are in hand this week. Everything else is known and looked after."
const NUM = ['No', 'One', 'Two', 'Three', 'Four', 'Five'];
export function todayLine(canon = {}) {
  const n = (canon.priorities || []).filter(p => p.status !== 'done').length;
  if (!n) return 'Nothing needs you today. Everything in your record is known and looked after.';
  return `${NUM[n] || n} thing${n === 1 ? ' is' : 's are'} in hand this week. Everything else is known and looked after.`;
}

// The story so far for one area: what she, her family or her doctors have
// written about it, newest first, from Notes (however it got there: the app,
// a long note, or typed straight into the Sheet) and from each condition's
// own notes. Taps and chat questions are left out: they are not the story.
const SKIP_TAGS = new Set(['meds-taken', 'concern']);
const clean = t => String(t || '').split('\nDATA: ')[0].split('\nRID: ')[0].replace(/\nJID: \S+$/, '')
  .replace(/^(DIPTI SAYS|REPORTED|MEDICINE CHANGE|FACT|SYMPTOM|FOUND OUT):\s*/i, '').trim();
const who = n => (n.by === 'Dipti' ? 'You' : n.by || 'Someone');
const KIND = { journal: 'wrote', 'dipti-says': 'noted', 'symptom-log': 'logged', record: 'noted', fact: 'noted', 'found-out': 'found out' };

export function storyFor(canon = {}, areaId) {
  const a = AREAS.find(x => x.id === areaId);
  if (!a || areaId === 'everyday') return [];
  const out = [];
  for (const n of canon.notes || []) {
    if (SKIP_TAGS.has(n.tag) || n.by === 'claude-test') continue;
    const text = clean(n.text);
    if (text.length < 12 || !a.re.test(text)) continue;
    out.push({ ts: n.tsUTC || '', title: `${who(n)} ${KIND[n.tag] || 'added'}`, text });
  }
  for (const c of canon.conditions || []) {
    if (areaOf(c).id !== areaId || !c.notes) continue;
    out.push({ ts: String(c.updated || c.since || ''), title: `About ${String(c.aliases || c.name).split(/\s*;\s*/)[0].toLowerCase()}`, text: String(c.notes) });
  }
  // Dates come back from the Sheet in more than one form; compare as time.
  const t = v => { const d = Date.parse(v); return Number.isNaN(d) ? 0 : d; };
  return out.sort((x, y) => t(y.ts) - t(x.ts));
}
