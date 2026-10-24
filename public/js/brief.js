// A short note Dipti can send a doctor, in her own voice. Never a record dump:
// a greeting, one or two sentences on what it is about, the one fact a doctor
// must not miss (steroids), at most two questions, and her name. Built only
// from her Sheet. Pure; unit tested. /api/note may make the wording warmer but
// keeps exactly these facts and questions (lib/note.js checks it).
import { priorities, medicines, questionsByDoctor } from './record-model.js';

const has = (hay, needle) => Boolean(needle) && String(hay || '').toLowerCase().includes(String(needle).toLowerCase());
const STEROID = /prednis|hydrocortisone|dexameth|methylpred|deflazacort|wysolone|omnacortil/i;

// Her record is often written to her ("your dentist"); a note is written by her.
export function firstPerson(s) {
  return String(s || '')
    .replace(/\byou are\b/gi, 'I am')
    .replace(/\byou're\b/gi, "I'm")
    .replace(/\byou've\b/gi, "I've")
    .replace(/\byours\b/gi, 'mine')
    .replace(/\bYour\b/g, 'My').replace(/\byour\b/g, 'my')
    .replace(/\b(to|for|with|at|tell|give|help|gives|tells|helps|let) you\b/gi, '$1 me')
    .replace(/\byou\b/gi, 'I');
}

function firstSentence(s, max = 200) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  const one = m ? m[1] : t.replace(/[,;:\s]*$/, '') + (t ? '.' : '');
  return one.length > max ? one.slice(0, max).replace(/\s+\S*$/, '') + '…' : one;
}

const doctorFor = (canon, name) => (canon.clinicians || []).find(x => x.name === name) || null;
// Words that carry meaning, so "Teeth and gums" matches "Tooth pain".
const STOP = new Set(['with', 'from', 'that', 'this', 'pain', 'your', 'about', 'and', 'the', 'right', 'left', 'side', 'upper', 'lower', 'full', 'body']);
const keys = s => String(s || '').toLowerCase().match(/[a-z]{4,}/g)?.filter(w => !STOP.has(w)).map(w => (w === 'teeth' ? 'tooth' : w.replace(/(es|s)$/, ''))) || [];
const overlap = (a, b) => { const k = new Set(keys(b)); return keys(a).some(w => k.has(w)); };
const forDoc = (doc, askWhom, title) => !doc || has(askWhom, doc.name) || (doc.role && has(askWhom, doc.role)) || (askWhom && has(doc.name, askWhom.split(/[,(]/)[0].trim())) || overlap(title, doc.owns) || overlap(title, doc.role);

// The parts of the note, so /api/note can check a rewrite kept them.
export function noteParts(canon = {}, { doctor = null } = {}) {
  const doc = doctor ? doctorFor(canon, doctor) : null;
  const pr = priorities(canon).filter(p => p.status !== 'done');
  const topic = pr.find(p => forDoc(doc, p.askWhom, p.title)) || (doc ? null : pr[0]) || null;
  const groups = questionsByDoctor(canon);
  const mine = doc ? groups.filter(g => has(g.who, doc.name) || has(g.who, doc.role) || has(doc.name, g.who)) : groups;
  const questions = mine.flatMap(g => g.questions).sort((a, b) => (+a.priority || 9) - (+b.priority || 9)).slice(0, 2).map(q => q.question.trim());
  const steroid = medicines(canon).current.find(m => STEROID.test(`${m.name} ${m.generic || ''}`));
  return {
    to: doc ? doc.name : '',
    about: topic ? topic.title.replace(/\s*\(.*\)\s*$/, '') : '',
    context: topic?.why ? firstPerson(firstSentence(topic.why)) : '',
    critical: steroid ? `I take ${steroid.name}${steroid.dose ? ` (${[steroid.dose, steroid.timing].filter(Boolean).join(', ')})` : ''}, so please keep the steroid in mind.` : '',
    questions,
    from: String(canon.profile?.preferredName || canon.profile?.name || 'Dipti').split(' ')[0],
  };
}

export function noteText(parts) {
  const greet = parts.to ? `Hello ${parts.to},` : 'Hello,';
  const L = [greet, ''];
  const open = parts.about ? `I'm writing about my ${parts.about.charAt(0).toLowerCase() + parts.about.slice(1)}.` : "I'm writing with a quick question.";
  L.push([open, parts.context].filter(Boolean).join(' '));
  if (parts.critical) L.push('', parts.critical);
  if (parts.questions.length === 1) L.push('', `Could you help me with one thing: ${parts.questions[0]}`);
  else if (parts.questions.length) L.push('', 'Could you help me with two things?', ...parts.questions.map((q, i) => `${i + 1}. ${q}`));
  L.push('', 'Thank you so much.', parts.from);
  return L.join('\n');
}

export function doctorNote(canon = {}, opts = {}) { return noteText(noteParts(canon, opts)); }
