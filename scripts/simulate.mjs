// End-to-end simulation of Dipti (and Krish helping) using Steady, against
// the real apps-script/Code.gs (run in the emulator) and the real API
// handlers. Invented data only (scripts/fixture.mjs). Usage: node scripts/simulate.mjs
//
// 1. Seeds the invented record plus a few weeks of earlier history.
// 2. Drives the HTTP API as Dipti's phone and as Krish's laptop, with the
//    same payloads the screens send.
// 3. Reads the raw sheet tabs back and checks every new row, cell by cell.
// 4. Checks the knowledge bank, the doctor's context and the summaries.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { TAGS, noteText, symptomLevel, noteData, repeatAsk } from '../public/js/dipti-model.js';
import { bank, bankText, bankSize, factNote } from '../public/js/knowledge-bank.js';
import { historyEvents, priorities, medicines } from '../public/js/record-model.js';
import { briefText } from '../public/js/brief.js';
import { patientContext } from '../api/ask.js';
import { fixture } from './fixture.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 3100 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`, SHEET = `http://127.0.0.1:${PORT + 1}`;
const DAY = 86400000, now = Date.now();
const ago = d => new Date(now - d * DAY).toISOString();

/* ---------- 1. the record plus earlier history ---------- */
const seed = fixture();
for (let d = 28; d >= 1; d--) if (d % 2) seed.notes.push({ tsUTC: ago(d), by: 'Dipti', tag: TAGS.meds, text: noteText('MEDS: taken', {}) });
seed.notes.push({ tsUTC: ago(27), by: 'Dipti', tag: 'fact', text: factNote({ topic: 'history', fact: 'Oldest note in the record: two earlier teeth cracked (example)' }).text });
seed.notes.push({ tsUTC: ago(20), by: 'Dipti', tag: TAGS.symptom, text: noteText('SYMPTOM: Tooth or gum pain, this week, moderate', { symptom: 'tooth', when: 'week', severity: 'moderate', note: '', level: 'routine' }) });
seed.notes.push({ tsUTC: ago(9), by: 'Krish', tag: 'fact', text: factNote({ topic: 'care', fact: 'Endodontist suggested by the dentist is away for 3 months (Oct 2026)' }).text });
for (let i = 0; i < 25; i++) seed.notes.push({ tsUTC: ago(8 - i * 0.2), by: 'Dipti', tag: TAGS.says, text: `DIPTI SAYS: filler note ${i}` });
seed.notes.sort((a, b) => a.tsUTC.localeCompare(b.tsUTC));
const seedFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'steady-sim-')), 'seed.json');
fs.writeFileSync(seedFile, JSON.stringify(seed));

/* ---------- 2. the app ---------- */
const server = spawn(process.execPath, [path.join(root, 'scripts', 'dev-server.mjs')], {
  env: { ...process.env, MOCK_SHEET: '1', MOCK_AI: '1', MOCK_CANON_FILE: seedFile, PORT: String(PORT), ACCESS_CODE: 'Sim-Family-1!', DIPTI_CODE: 'Sim-Dipti-2', TZ: 'Asia/Kolkata' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((res, rej) => { server.stdout.on('data', d => { if (String(d).includes('http://')) res(); }); server.on('exit', c => rej(new Error('server exited ' + c))); });

const results = [];
const check = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); } };

async function device(code, persona) {
  const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
  const j = await r.json();
  let cookie = r.headers.get('set-cookie').split(';')[0];
  if (persona) {
    const p = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ persona }) });
    cookie = p.headers.get('set-cookie').split(';')[0];
  }
  const call = async (p, body) => {
    const res = await fetch(BASE + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    if (p === '/api/ask') return (await res.text()).trim().split('\n').map(l => JSON.parse(l));
    return { status: res.status, ...(await res.json()) };
  };
  return { login: j, call, write: (action, payload, by) => call('/api/write', { action, payload, by }) };
}

const wrong = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'dipti' }) });
const dip = await device('sim-dipti-2');
const kri = await device('SIM-FAMILY-1!', 'family');
check('a guessed code is refused', () => assert.equal(wrong.status, 401));
check("Dipti's code opens as Dipti; the family code asks who is using it", () => {
  assert.equal(dip.login.role, 'dipti'); assert.equal(dip.login.askWho, false);
  assert.equal(kri.login.askWho, true);
});
const ds = await dip.call('/api/session'), ks = await kri.call('/api/session');
check('sessions carry the right role', () => { assert.equal(ds.role, 'dipti'); assert.equal(ks.role, 'family'); });

const tabsBefore = await (await fetch(SHEET + '/__tabs')).json();
const canonBefore = await dip.call('/api/canon');
const bankBefore = bank(canonBefore);

// Dipti's phone, the way the Today screen sends it
const sent = [];
const dNote = async (tag, text) => { sent.push(['Dipti', tag, text]); return dip.write('note', { text, tag }); };
const outs = [];
const log = { symptom: 'tooth', when: 'today', severity: 'moderate', note: 'Sharp when I bit into bread' };
log.level = symptomLevel(log);
outs.push(await dNote(TAGS.symptom, noteText(`SYMPTOM: Tooth or gum pain, earlier today, moderate. ${log.note}`, log)));
outs.push(await dNote(TAGS.meds, noteText('MEDS: taken', { day: 'today' })));
outs.push(await dNote(TAGS.says, 'DIPTI SAYS: Booked the endodontist for Tuesday'));
const spoof = await dip.write('note', { text: 'DIPTI SAYS: pretending to be Krish', tag: TAGS.says }, 'Krish');
sent.push(['Dipti', TAGS.says, 'DIPTI SAYS: pretending to be Krish']);
const ci1 = await dip.write('checkin', { answers: { tooth: 7, abdomen: 3, fatigue: 6, sleep: 'ok', bowels: 'normal', mood: 'ok' }, notes: 'Tooth worse after dinner' });
const ci2 = await dip.write('checkin', { answers: { tooth: 7, abdomen: 3, fatigue: 6, sleep: 'poor', bowels: 'diarrhoea', mood: 'low' }, notes: '' });
const ciBad = await dip.write('checkin', { answers: { tooth: 12, abdomen: 3, fatigue: 6, sleep: 'ok', bowels: 'normal', mood: 'ok' } });
outs.push(await dip.write('priority', { id: 'P1', status: 'waiting', nextStep: 'Endodontist on Tuesday' }));
const photo = await dip.call('/api/photo', { image: { type: 'image/jpeg', data: 'A'.repeat(400) } });
for (const r of photo.results.filter(x => !x.duplicate)) {
  outs.push(await dip.write('testResult', { date: r.date, test: r.test, result: r.result, range: r.range, lab: r.lab, notes: r.notes }));
}

// Krish's laptop, the way the dashboard sends it
outs.push(await kri.write('note', { text: 'Called the clinic; stool results due Friday', tag: 'note' }, 'Krish'));
sent.push(['Krish', 'note', 'Called the clinic; stool results due Friday']);
const qAdd = await kri.write('question', { question: 'Can the endodontist see her this week?', askWhom: 'Dr Example (dentist)', priority: '1' }, 'Krish');
outs.push(qAdd, await kri.write('question', { id: 'Q3', status: 'answered', answer: 'No infection; results normal' }, 'Krish'));
outs.push(await kri.write('gap', { id: 'G2', status: 'closed' }, 'Krish'));
outs.push(await kri.write('medication', { name: 'Medicine C', status: 'stopped' }, 'Krish'));
outs.push(await kri.write('clinician', { name: 'Dr New Endo', role: 'Endodontist', owns: 'Tooth' }, 'Krish'));
const badPrio = await kri.write('priority', { id: 'P2', status: 'panicking' }, 'Krish');

// Chats: Dipti asks, then asks the same thing again; Krish asks about her
const t1 = await dip.call('/api/ask', { message: 'Why does my tooth hurt when I bite?', thread: [], threadId: 'simthread1', rid: 'simrid1' });
const canonMid = await dip.call('/api/canon');
const repeats = repeatAsk(canonMid, 'My tooth still hurts when I bite, why?');
const t2 = await dip.call('/api/ask', { message: 'My tooth still hurts when I bite, why?', thread: [], threadId: 'simthread1', rid: 'simrid2' });
const t3 = await kri.call('/api/ask', { message: 'What is the plan for her tummy pain?', thread: [], by: 'Krish', threadId: 'simthread3', rid: 'simrid3' });
const t4 = await dip.call('/api/ask', { message: 'I have been vomiting since this morning', thread: [], threadId: 'simthread4', rid: 'simrid4' });

/* ---------- 3. read the sheet back ---------- */
const tabs = await (await fetch(SHEET + '/__tabs')).json();
const canon = await dip.call('/api/canon');
const newRows = name => tabs[name].slice(tabsBefore[name].length);

check('every allowed write succeeded', () => { for (const o of [...outs, spoof, ci1, ci2]) assert.equal(o.ok, true, JSON.stringify(o)); });
check('bad values are refused by the sheet, not stored', () => {
  assert.equal(ciBad.ok, false); assert.match(ciBad.error, /tooth/);
  assert.equal(badPrio.ok, false);
});
check('Notes: each new row matches what was sent, cell by cell', () => {
  const rows = newRows('Notes').filter(r => !['concern', 'fact'].includes(r[3]));
  assert.equal(rows.length, sent.length);
  rows.forEach((r, i) => {
    assert.match(String(r[0]), /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual([r[1], r[3], r[2]], sent[i]); // [by, tag, text]
  });
});
check("Dipti's entries are always hers, whatever name a device sends", () => {
  assert.equal(newRows('Notes').find(x => x[2] === 'DIPTI SAYS: pretending to be Krish')[1], 'Dipti');
});
check('Notes: structured DATA survives the sheet exactly', () => {
  assert.deepEqual(noteData(canon.notes.filter(n => n.tag === TAGS.symptom).pop()), log);
});
check('CheckIns: columns in schema order, India time, verdicts from the sheet', () => {
  const [a, b] = newRows('CheckIns');
  assert.deepEqual(a.slice(2), ['Dipti', 7, 3, 6, 'ok', 'normal', 'ok', 'Changed', 'Tooth worse after dinner']);
  assert.equal(ci1.verdict, 'Changed'); // tooth up from the last seeded check-in
  assert.equal(ci2.verdict, 'Act-today'); // diarrhoea on steroids: sick-day rules
  assert.equal(b[9], 'Act-today');
  // Local time as typed: Sheets turns it into a date cell, the emulator likewise.
  assert.ok(a[1]);
});
check('Priorities: status and next step updated, both audited', () => {
  const p1 = canon.priorities.find(p => p.id === 'P1');
  assert.equal(p1.status, 'waiting'); assert.equal(p1.nextStep, 'Endodontist on Tuesday');
  const ch = newRows('Changelog').map(r => r[2]);
  assert.ok(ch.includes('P1.status') && ch.includes('P1.nextStep'));
});
check('TestResults: photo rows saved with range and unit intact', () => {
  const rows = newRows('TestResults');
  assert.ok(rows.length >= 2);
  const ggt = rows.find(r => r[1] === 'GGT');
  assert.deepEqual([ggt[2], ggt[3], ggt[6]], ['96 U/L', '5-38', 'Dipti']);
});
const again = await dip.call('/api/photo', { image: { type: 'image/jpeg', data: 'B'.repeat(400) } });
check('Re-reading the same result does not duplicate it', () => assert.ok(again.results.every(r => r.duplicate)));
check('Questions, gaps, medicines and doctors: changed by Krish and audited', () => {
  assert.equal(qAdd.id, 'Q5');
  assert.equal(canon.questions.find(q => q.id === 'Q3').status, 'answered');
  assert.equal(canon.gaps.find(g => g.id === 'G2').status, 'closed');
  assert.equal(canon.medications.find(m => m.name === 'Medicine C').status, 'stopped');
  assert.ok(canon.clinicians.some(c => c.name === 'Dr New Endo'));
  const ch = newRows('Changelog').map(r => [r[2], r[5]].join('|'));
  for (const k of ['Q5|Krish', 'Q3.status|Krish', 'Q3.answer|Krish', 'G2.status|Krish', 'Medicine C.status|Krish', 'Dr New Endo|Krish']) assert.ok(ch.includes(k), 'missing ' + k);
});
check('Chat: each message logged once with its reply; devices get the slim copy', () => {
  const concerns = newRows('Notes').filter(r => r[3] === 'concern');
  assert.equal(concerns.length, 4);
  assert.ok(concerns.every(r => /\nRID: simrid\d\nDATA: \{/.test(r[2])));
  assert.deepEqual(concerns.map(r => r[1]), ['Dipti', 'Dipti', 'Krish', 'Dipti']);
  assert.ok(canon.notes.filter(n => n.tag === 'concern').every(n => !/DATA:/.test(n.text)));
});
check('Chat: the repeat question is spotted and answered back-to-the-plan', () => {
  assert.equal(repeats, 1);
  assert.match(t2.find(e => e.type === 'answer').answer.reply, /Same plan/);
});
check('Chat: Krish hears about "Dipti", Dipti hears "you"', () => {
  assert.match(t3.find(e => e.type === 'answer').answer.reply, /Dipti's ultrasound/);
  assert.match(t1.find(e => e.type === 'answer').answer.reply, /Pune/);
});
check('Chat: red flags are never lowered by the model', () => {
  const a = t4.find(e => e.type === 'answer');
  assert.equal(a.triage.level, 'urgent'); assert.equal(a.answer.urgency, 'urgent');
  assert.match(a.contacts.title, /doctor today/);
});
check('Chat: reply streamed, and suggested next replies', () => {
  const a1 = t1.find(e => e.type === 'answer');
  assert.equal(t1.filter(e => e.type === 'delta').map(e => e.text).join(''), a1.answer.reply);
  assert.ok(a1.answer.replies.length >= 2);
});
const rec = await dip.call('/api/answer?rid=simrid2');
check('Recovered reply matches the streamed one', () => assert.equal(rec.answer.reply, t2.find(e => e.type === 'answer').answer.reply));

/* ---------- 4. the knowledge bank, context and summaries ---------- */
const b = bank(canon), hist = historyEvents(canon), ctx = patientContext(canon);
check('Bank: tooth timeline counts old and new logs', () => assert.equal(b.symptoms.find(s => s.id === 'tooth').count, 3));
check('Bank: result trends across reports', () => assert.deepEqual(b.results.find(r => r.key === 'ggt').values.map(v => v.value), [80, 90, 100, 96]));
check('Bank: nothing is forgotten when notes pile up', () => {
  const recent20 = canon.notes.slice(-20).map(n => n.text).join('\n');
  assert.ok(!recent20.includes('Oldest note'), 'test setup: the oldest note should be outside the last 20');
  assert.match(bankText(b, 20000), /Oldest note in the record/);
});
check("Doctor's context: priorities, both medicine lists, never a phone number", () => {
  assert.match(ctx, /## Her priorities right now/);
  assert.match(ctx, /Endodontist on Tuesday/);
  assert.match(ctx, /Prescription: 10 mg at night\. For: Example pain \[CHECK/);
  assert.doesNotMatch(ctx, /MUST-NOT-LEAK/);
});
check('History: logs, check-ins, chats and answers all appear', () => {
  const kinds = new Set(hist.map(e => e.kind));
  for (const k of ['symptom', 'note', 'checkin', 'asked', 'answer', 'result']) assert.ok(kinds.has(k), 'missing ' + k);
});
check('Priorities and medicines read back for the screens', () => {
  assert.equal(priorities(canon)[0].id, 'P1');
  assert.equal(medicines(canon).differ, 1); // Medicine C was stopped by Krish
});
check('A summary for the dentist carries only the dentist\'s questions', () => {
  const t = briefText(canon, { doctor: 'Dr Example' });
  assert.match(t, /Can the endodontist see her this week\?/);
  assert.doesNotMatch(t, /stool/i);
});
const grew = { before: bankSize(bankBefore), after: bankSize(b) };
check('Bank grew from this session', () => assert.ok(grew.after > grew.before));

server.kill();
const pass = results.filter(r => r[0] === 'PASS').length;
for (const r of results) console.log(`${r[0]}  ${r[1]}${r[2] ? '  -> ' + r[2] : ''}`);
console.log(`\nRows written this session: ${Object.keys(tabs).map(k => `${k} +${tabs[k].length - tabsBefore[k].length}`).filter(s => !s.endsWith('+0')).join(', ')}`);
console.log(`Knowledge bank: ${grew.before} -> ${grew.after} things known`);
console.log(`${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
