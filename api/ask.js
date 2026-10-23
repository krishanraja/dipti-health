// Chat with the doctor. Each message gets an evidence-grounded reply on the spot.
// Order of operations: deterministic red-flag triage first (never depends on
// the model), then a model reply grounded in her record, the research pack in
// her Sheet and the general evidence corpus, streamed as it is written, then
// the message is logged to the sheet and any new facts go into the bank.
import { requireAuth, byFor } from '../lib/auth.js';
import { readCanon, write } from '../lib/sheet.js';
import { corpus, retrieve, refsFor } from '../lib/knowledge.js';
import { complete } from '../lib/ai.js';
import { replyStream } from '../lib/reply-stream.js';
import { RESULTS_RULES, cleanResults, imageBlock, checkImage } from '../lib/photo.js';
import { triage, maxLevel, LEVELS, CONTACTS, CONTACTS_SELF, SICK_DAY } from '../public/js/triage.js';
import { bank, bankText, facts, factNote, FACT_TOPICS } from '../public/js/knowledge-bank.js';
import { localDay, repeatAsk } from '../public/js/dipti-model.js';
import { evidenceText, entitiesIn, related } from '../public/js/evidence.js';
import { person } from '../public/js/people.js';
import { DOCTOR } from '../public/js/persona.js';
import { roster } from '../lib/people.js';

const PII_KEYS = /aadhaar|aadhar|pan\b|passport|nhs number|address|street|phone|mobile|email|dob|birth|pin ?code|postcode|insurance|policy/i;

export function patientContext(canon) {
  if (!canon) return 'Her live record could not be loaded right now. Answer from the evidence corpus and say that her record was unavailable.';
  const profile = Object.entries(canon.profile || {})
    .filter(([k]) => !PII_KEYS.test(k))
    .map(([k, v]) => `${k}: ${v}`).join('\n');
  const rows = (arr, n, fn) => (arr || []).slice(-n).map(fn).join('\n') || '(none recorded)';
  const routine = /^(meds-taken|fact|concern)$/;
  const meds = (canon.medications || []);
  return [
    '## Profile', profile || '(none)',
    '## Her priorities right now (in her order)', rows([...(canon.priorities || [])].sort((a, b) => (+a.rank || 9) - (+b.rank || 9)), 10, p => `- ${p.id} [${p.status}] ${p.title}. Why: ${p.why} Plan: ${String(p.plan).replace(/\n/g, ' / ')} Next step: ${p.nextStep}${p.askWhom ? ' (' + p.askWhom + ')' : ''}`),
    '## Conditions (Doc = in a report; Stated = she said it)', rows(canon.conditions, 40, c => `- ${c.name} [${c.status}, ${c.evidence || '?'}] since ${c.since}. ${c.notes}`),
    '## Medicines: her current list, with what the last written prescription says', rows(meds.filter(m => m.status !== 'stopped'), 40, m => `- ${m.name}${m.generic ? ' (' + m.generic + ')' : ''}: ${m.dose} ${m.timing}. Prescription: ${m.rx || 'not on it'}. For: ${m.purpose}${m.status === 'check' ? ' [CHECK: differs from the prescription]' : ''}`),
    '## Stopped medicines', rows(meds.filter(m => m.status === 'stopped'), 30, m => `- ${m.name}: ${m.dose} ${m.timing}`),
    '## Test results (oldest first)', rows(canon.testResults, 120, t => `- ${t.date} ${t.test}: ${t.result}${t.range ? ' (range ' + t.range + ')' : ''}${t.notes ? ' ' + t.notes : ''}`),
    '## Recent check-ins, scores 0 to 10 (oldest first)', rows(canon.checkins, 8, c => `- ${c.tsLocal}: tooth=${c.tooth} tummy=${c.abdomen} tiredness=${c.fatigue} sleep=${c.sleep} bowels=${c.bowels} mood=${c.mood} -> ${c.verdict}. ${c.notes}`),
    '## Recent logs and notes (oldest first)', rows((canon.notes || []).filter(n => n.by !== 'claude-test' && !routine.test(n.tag)), 20, n => `- ${String(n.tsUTC).slice(0, 10)} [${n.tag}] by ${n.by}: ${String(n.text).replace(/\n(RID|DATA):[\s\S]*$/, '')}`),
    '## Her doctors', rows(canon.clinicians, 20, c => `- ${c.name}: ${c.role}. Looks after: ${c.owns}${c.lastSeen ? '. Last seen ' + c.lastSeen : ''}`),
    '## Open questions for her doctors', rows((canon.questions || []).filter(q => q.status !== 'answered'), 25, q => `- ${q.id} (${q.askWhom}, p${q.priority}): ${q.question}`),
    '## Things in her record that disagree or are unknown', rows((canon.gaps || []).filter(g => g.status !== 'closed'), 20, g => `- ${g.id}: ${g.gap}. Settled by: ${g.whatAnswersIt}`),
    '## Knowledge bank (distilled from every entry since records began)', bankText(bank(canon)),
  ].join('\n');
}

export function systemPrompt(canon) {
  const { name } = DOCTOR;
  return `You are ${name}, the doctor inside a private health app used by Dipti. Who she is, where she lives and her whole record are in her profile and record below. A family member (usually Krish) sometimes uses it to help her; you are told who is chatting. A graded research pack about her medicines is below too.

Your character: a young English GP, warm, unhurried and steady, trained in the NHS. Plain British English. Kind and a little light when things are fine; clear and direct when something matters. You know her whole record, so she never has to repeat herself.

How to reply (this is what makes you useful):
- This is a chat. Short, warm, direct. Answer the question first, in plain words. A yes or no question gets "Yes" or "No" first. Never dodge.
- Keep worry in proportion. Your first sentence says plainly how much this needs worrying about, and why, using her own results where they help (for example "Your ultrasound on 6 October showed a normal gallbladder, so..."). Reassure when the evidence supports it, and say so with confidence.
- Give ONE clear next step, with who to contact and the exact words to use. Not a menu.
- Never list possible diagnoses or rare causes. Never speculate about conditions her doctors have not diagnosed. The research pack lists suggestions from past chatbot conversations that were never diagnosed; do not raise them. If something genuinely needs ruling out, say which doctor should look and leave the naming to them.
- Never suggest a new test, supplement or specialist unless it serves one of her priorities and her own record supports it.
- Do not mention anxiety, worry as a condition, health anxiety, or how often she asks. Do not lecture.
- Stay honest. Never play down a real red flag. If her record shows long-term steroids: vomiting, repeated diarrhoea, fever or missed steroid doses mean her steroid sick-day plan and a same-day call to her doctor. ${SICK_DAY}
- The firm limit: she must not start, stop or change any medicine or dose without the doctor who prescribed it. Her current list and her last written prescription disagree in places; when it matters, say which doctor should confirm it, without alarm.
- Her three priorities come first. Link your answer to the right priority and its plan, and point to the next step already in the plan rather than inventing a new one.
- Small talk, thanks or a simple follow-up gets a short reply with empty lists.
- India and UK context: Indian brand names, Indian specialist titles (for teeth, an endodontist is an MDS in Conservative Dentistry and Endodontics), and both sets of emergency numbers (India 112 or 108; UK 999, or 111 for advice).

Sources:
- Start from her record, her research pack and the general evidence corpus below.
- Use web search and web fetch only when they would make the reply better (a question nothing below covers). Search is limited to trusted medical sites.
- Cite the research pack by its id (for example "IX01"), the corpus by its reference number, or a web page by its exact URL. Use "general" for well-known medical knowledge. Never invent studies, numbers or links. Grade D evidence is a signal only; grade E is reasoned from her record and needs a doctor to confirm.

The knowledge bank gets better with every chat. In "learned", record durable facts about Dipti stated in THE LATEST MESSAGE (or shown in a photo) that are not already in the knowledge bank: a symptom and how often, a medicine change, an appointment, a doctor's answer. Write each as a short dated statement, e.g. "Tooth pain eased after the night guard (Nov 2026)". If it updates a fact already in the bank, put the old fact's exact text in "replaces". Never record your own advice or guesses. Usually zero or one fact; at most three.

${RESULTS_RULES}

Reading age 12 (strict): short sentences, mostly under 15 words, everyday words. Explain any medical word in brackets the first time, e.g. "endodontist (a root-canal specialist)".

Return ONLY a JSON object, no markdown fences, with exactly these keys, "reply" first. Hard limits: reply at most 90 words; every list item at most 22 words; at most 3 items per list.
{
  "reply": "Your chat message: how much to worry and why, then the answer, specific to her, ending with one short question only if one missing detail would change your advice.",
  "urgency": "routine" | "soon" | "urgent" | "emergency",
  "doNow": ["The one next step (occasionally two), naming who, what and how. Empty for small talk."],
  "watchFor": ["Only genuine signs that would make this more urgent, and what to do then. Usually one."],
  "askTheDoctor": ["Precise questions for the right doctor, ready to read aloud."],
  "evidence": [{"point": "A short factual claim behind the reply.", "ref": "research pack id, corpus reference number, a full URL from your web search, or 'general'"}],
  "usedFromRecord": ["Up to 4 short facts from her record you relied on."],
  "replies": ["2 to 4 things this person is most likely to say next, in their own voice, 2 to 8 words each, genuinely different."],
  "learned": [{"topic": "${FACT_TOPICS.join('" | "')}", "fact": "Short dated fact.", "replaces": "exact old fact text, or empty"}],
  "results": [{"date": "YYYY-MM-DD or empty", "test": "Test name", "result": "Value with unit", "range": "", "lab": "", "notes": ""}],
  "limits": "One short sentence on what cannot be known without examining her. Empty for small talk."
}
"results" stays empty unless a photo is attached.

# Her research pack (from her Sheet: interactions, medicines, labs, recommendations; most serious first)
${evidenceText(canon?.evidence || [], canon?.sources || [])}

# General evidence corpus (no patient data)
${corpus().body || '(none)'}`;
}

function extractJson(text) {
  const t = String(text || '').replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '');
  const start = t.indexOf('{'), end = t.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('model did not return JSON');
  return JSON.parse(t.slice(start, end + 1));
}

const str = (x, n = 2000) => String(x ?? '').trim().slice(0, n);
export function clean(a) {
  const arr = (x, n) => (Array.isArray(x) ? x : []).map(v => typeof v === 'string' ? v.trim() : v).filter(Boolean).slice(0, n);
  const reply = str(a.reply || a.headline);
  return {
    urgency: LEVELS.includes(a.urgency) ? a.urgency : 'soon',
    reply, headline: reply,
    doNow: arr(a.doNow, 3), watchFor: arr(a.watchFor, 3), askTheDoctor: arr(a.askTheDoctor, 3),
    evidence: arr(a.evidence, 4).filter(e => e && e.point),
    usedFromRecord: arr(a.usedFromRecord, 4),
    replies: arr(a.replies, 4).filter(r => typeof r === 'string').map(r => r.slice(0, 60)),
    learned: arr(a.learned, 3).filter(f => f && typeof f.fact === 'string' && f.fact.trim()).map(f => ({ topic: FACT_TOPICS.includes(f.topic) ? f.topic : 'other', fact: str(f.fact, 300), replaces: str(f.replaces, 300) })),
    results: Array.isArray(a.results) ? a.results : [],
    limits: str(a.limits, 400),
  };
}

// Keep only links the model actually retrieved, corpus references, or
// research-pack ids that exist in her Sheet. Never an invented one.
export function withSources(answer, webSources = [], canon = null) {
  const { refs } = corpus();
  const seen = new Map(webSources.map(w => [w.url.replace(/\/$/, ''), w]));
  const pack = Object.fromEntries((canon?.evidence || []).map(r => [String(r.id).toUpperCase(), r]));
  const srcs = Object.fromEntries((canon?.sources || []).map(s => [s.id, s]));
  answer.evidence = answer.evidence.map(e => {
    const ref = String(e.ref || '').trim();
    if (/^https?:\/\//.test(ref)) {
      const w = seen.get(ref.replace(/\/$/, ''));
      return w ? { point: e.point, ref: 'web', title: w.title, url: w.url } : { point: e.point, ref: 'general' };
    }
    const row = pack[ref.toUpperCase()];
    if (row) {
      const first = String(row.sources || '').split(/[\s,;|]+/).map(id => srcs[id]).find(s => s?.url);
      return { point: e.point, ref: row.id, title: row.title || row.id, grade: row.grade || '', ...(first ? { url: first.url } : {}) };
    }
    const id = ref.replace(/[^\d]/g, '');
    const r = refs[id];
    return r ? { point: e.point, ref: id, title: r.title, url: r.url, grade: r.grade } : { point: e.point, ref: 'general' };
  });
  return answer;
}

export function fallbackAnswer(message, level, reasons, self = true) {
  const C = self ? CONTACTS_SELF : CONTACTS;
  const hits = level === 'routine' ? retrieve(message, 1) : [];
  const snippet = hits.length
    ? `${hits[0].heading}: ${hits[0].text.replace(/\[\d+(?:,\s*\d+)*\]/g, '').replace(/\s+/g, ' ').slice(0, 260).replace(/\s\S*$/, '')}...`
    : '';
  const reply = level === 'routine'
    ? `I can't reach my full notes right now, so this is the closest part of the guide. Nothing in what you said is a warning sign. ${snippet}`.trim()
    : `${C[level].title}. ${reasons[0] || ''}. I'm offline right now, so this is from the warning-sign rules only.`;
  return {
    urgency: level, reply, headline: reply,
    doNow: C[level].lines, watchFor: [], askTheDoctor: [],
    evidence: hits.flatMap(h => refsFor(h.text).slice(0, 2)).map(r => ({ point: r.title, ref: r.id, title: r.title, url: r.url })),
    usedFromRecord: [], replies: level === 'emergency' ? ['I have called for help', 'I am on my own'] : ['Try again', 'What should I ask my doctor?'],
    learned: [], results: [], limits: 'Rule-based reply only; not personalised to her record.',
  };
}

// Who is chatting, and how to refer to Dipti to them.
export function speakerContext(me) {
  if (me.dipti) return 'Dipti herself. Talk to her directly as "you" and "your" ("your tooth"). Never talk about her in the third person.';
  const name = me.name || 'A family member';
  return `${name}, family helping Dipti. Talk to ${name} by name and refer to her as "Dipti" ("Dipti's tooth"). Suggested replies are in ${name}'s voice ("Dipti's tooth"). ${name} may not be in the same country as Dipti.`;
}

function transcript(thread = [], who) {
  const turns = (Array.isArray(thread) ? thread : []).slice(-12)
    .map(t => `${t.role === 'doctor' || t.role === 'leffy' ? DOCTOR.name : who}: ${str(t.text, 700)}`).join('\n');
  return turns || '(this is the first message)';
}

// When she has asked about the same thing recently: point back to the plan.
export function repeatNote(n) {
  if (!n) return '';
  return `\n\n# Context for you (do not mention it)\nThis topic already came up ${n === 1 ? 'once' : n + ' times'} in the last 24 hours and was answered. Unless something new or worse is described, answer briefly and kindly, recap the plan in one line, and point to the next step and the appointment that will settle it. Do not re-analyse it from scratch or add new possibilities.`;
}

// Streams newline-delimited JSON: {type:'stage'} progress, {type:'delta'}
// reply text as it is written, {type:'ping'} keep-alives, one {type:'answer'},
// then {type:'learned'}. A phone that loses the connection can fetch the saved
// answer later from /api/answer?rid=.
export default async function handler(req, res) {
  const role = requireAuth(req, res);
  if (!role) return;
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const body = req.body || {};
  const image = body.image || null;
  const bad = checkImage(image);
  if (bad) return res.status(400).json({ ok: false, error: bad });
  const message = str(body.message ?? body.concern, 2000) || (image ? 'Here is a photo. What does it show?' : '');
  const by = byFor(role, body.by);
  const rid = String(body.rid || '').replace(/[^a-z0-9]/gi, '').slice(0, 24) || Math.random().toString(36).slice(2, 12);
  const threadId = String(body.threadId || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
  const thread = Array.isArray(body.thread) ? body.thread : [];
  if (message.length < 2) return res.status(400).json({ ok: false, error: 'Say or type something first' });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  let open = true;
  res.on('close', () => { open = false; });
  const send = obj => { if (open) { try { res.write(JSON.stringify(obj) + '\n'); } catch { open = false; } } };
  const ping = setInterval(() => send({ type: 'ping' }), 5000);

  try {
    // The rules floor is this message; with no model, earlier messages count too.
    const rules = triage(message);
    const threadRules = triage([...thread.filter(t => t.role === 'user').map(t => t.text), message].join('\n'));
    send({ type: 'stage', text: image ? 'Looking at the photo' : 'Reading your record', rid, triage: rules });

    let canon = null, recordError = null;
    try { canon = await readCanon({ timeoutMs: 9000 }); }
    catch (e) { recordError = e.code === 'NO_SECRET' ? 'Sheet not connected yet' : 'Her record could not be loaded'; }

    const me = person({ role, who: by === 'app' ? '' : by, roster: roster() });
    const who = me.dipti ? 'Dipti' : me.name || 'Family';
    const ids = entitiesIn(message, canon?.evidence || []);
    const focus = related(canon?.evidence || [], ids, 6);
    const text = `# Who is chatting\n${speakerContext(me)}\n\n# Her live record (from her Google Sheet)\n${patientContext(canon)}\n\n# Research pack items this message touches\n${focus.map(r => `- ${r.id}: ${r.title}`).join('\n') || '(none matched by name)'}\n\n# Rule-based triage already shown\nlevel=${rules.level}; reasons=${rules.reasons.join('; ') || 'none'}\n\n# Conversation so far\n${transcript(thread, who)}${repeatNote(canon ? repeatAsk(canon, message) : 0)}\n\n# Latest message from ${who}${image ? ' (with a photo attached)' : ''}\n${message}`;

    send({ type: 'stage', text: 'Checking your notes' });
    let answer, source, searches = 0, pages = 0;
    const rs = replyStream();
    try {
      const out = await complete({
        req,
        system: systemPrompt(canon),
        user: image ? [imageBlock(image), { type: 'text', text }] : text,
        onText: d => { if (d === null) rs.reset(); else { const add = rs.push(d); if (add) send({ type: 'delta', text: add }); } },
        onProgress: p => {
          if (p.kind === 'search') send({ type: 'stage', text: `Searching trusted medical sites (${++searches})` });
          else if (p.kind === 'results') { pages += p.n; send({ type: 'stage', text: `Found ${pages} trusted pages` }); }
          else if (p.kind === 'fetch' || p.kind === 'read') send({ type: 'stage', text: 'Reading a source in full' });
          else if (p.kind === 'writing') send({ type: 'stage', text: 'Typing' });
        },
      });
      answer = withSources(clean(extractJson(out.text)), out.sources, canon);
      source = { kind: 'ai', model: out.model, web: out.tools, searched: out.sources.length };
    } catch (e) {
      answer = fallbackAnswer(message, maxLevel(rules.level, threadRules.level), (threadRules.reasons.length ? threadRules : rules).reasons, me.dipti);
      console.error(JSON.stringify({ askFallback: e.code || 'ERR', message: String(e.message).slice(0, 200) }));
      source = { kind: 'rules', reason: e.code === 'NO_AI' ? 'AI not configured' : 'AI unavailable: ' + e.message.slice(0, 120) };
    }

    // The model may raise urgency but never lower it below the red-flag rules.
    answer.urgency = maxLevel(answer.urgency, rules.level);
    answer.results = image ? cleanResults(answer.results, canon || {}, localDay(new Date())) : [];
    // Only facts the bank does not hold yet.
    const known = new Set(facts(canon || {}).map(f => f.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()));
    const learned = answer.learned.filter(f => !known.has(f.fact.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()));
    answer.learned = learned;
    const payload = { ok: true, rid, threadId, concern: message, triage: rules, answer, contacts: (me.dipti ? CONTACTS_SELF : CONTACTS)[answer.urgency], source, recordLoaded: Boolean(canon), recordError };

    let saved = false;
    if (canon) {
      try {
        // Full reply kept with its request id, so a dropped connection can recover it.
        await write('note', {
          text: `CONCERN: ${image ? '[photo] ' : ''}${message}\nURGENCY: ${answer.urgency}\nANSWER: ${answer.reply}\nRID: ${rid}\nDATA: ${JSON.stringify({ answer, source, threadId })}`.slice(0, 40000),
          tag: 'concern',
        }, by, { timeoutMs: 10000 });
        saved = true;
      } catch { /* reply still returned; the phone shows not-saved */ }
    }
    send({ type: 'answer', ...payload, saved });

    // Grow the knowledge bank after the reply is on screen.
    if (canon && learned.length) {
      let n = 0;
      for (const f of learned) {
        try { await write('note', factNote(f, image ? 'photo' : 'chat'), by, { timeoutMs: 10000 }); n++; } catch { /* keep going */ }
      }
      send({ type: 'learned', facts: learned, saved: n });
    }
  } catch (e) {
    console.error(JSON.stringify({ askCrash: String(e.message).slice(0, 300) }));
    send({ type: 'error', error: 'Something went wrong on the server. Please try again.' });
  } finally {
    clearInterval(ping);
    if (open) res.end();
  }
}
