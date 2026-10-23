// Today: her three priorities, a 30-second check-in, and quick logging.
// On a phone it is one calm screen; on a wide screen the same place shows
// the fuller overview (dashboard.js). Everything comes from her Sheet.
import { priorities, questionsByDoctor, STATUS } from './record-model.js';
import { SYMPTOMS, WHEN, SEVERITY, TAGS, WORRY, symptomLevel, noteText, localDay, lastCheckin, TZ } from './dipti-model.js';
import { CONTACTS_SELF, CONTACTS, SICK_DAY } from './triage.js';
import { DOCTOR } from './persona.js';
import { renderDashboard } from './dashboard.js';
import { factsToday, writesFor, needsEdit, applyLocal, nextAppointment, whenText, dayOf } from './facts-model.js';

let ctx, root, flowOpen = false;
const $ = (s, el = root) => el.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
export const MIC = '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const CAM = '<svg viewBox="0 0 24 24"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.6"/></svg>';
const PILL = '<svg viewBox="0 0 24 24"><rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M9.2 8l5.6 8"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';

export function mountToday(el, context) { root = el; ctx = context; render(); }
export function refreshToday() { if (root && !flowOpen) render(); }

const contacts = () => (ctx.me().dipti ? CONTACTS_SELF : CONTACTS);
const you = () => ctx.me().dipti;

function render() {
  const canon = ctx.canon();
  if (ctx.isWide()) { root.classList.add('wide'); return renderDashboard(root, { ...ctx, openPriority, startCheckin, logSymptom, tablets, factFlow }); }
  root.classList.remove('wide');
  if (!canon) {
    root.innerHTML = `<div class="rec-empty"><p class="kicker">Today</p><h3>${ctx.session().sheetConfigured === false ? 'The Sheet is not connected yet' : 'Loading your record'}</h3></div>`;
    return;
  }
  const pr = priorities(canon).filter(p => p.status !== 'done').slice(0, 3);
  const ci = lastCheckin(canon);
  const day = localDay(new Date());
  const checkedToday = ci && localDay(ci.ts) === day;
  const medsToday = (canon.notes || []).some(n => n.tag === TAGS.meds && localDay(n.tsUTC) === day);
  const hour = +new Date().toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: TZ });
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  const name = you() ? 'Dipti' : ctx.me().name || '';
  const next = nextAppointment(canon);
  const facts = factsToday(canon);

  root.innerHTML = `<div class="fit today-home">
    <div class="hello"><h1>${esc(hello)}${name ? ', ' + esc(name) : ''}</h1><p class="${next ? '' : 'drop'}">${next ? `<b>Next:</b> ${esc(next.with)}, ${esc(whenText(next.date, next.time))}` : esc(date)}</p></div>
    <p class="kicker">${you() ? 'Your' : "Dipti's"} priorities</p>
    <div class="prios">${pr.map((p, i) => `<button class="prio ${i === 0 ? 'lead' : ''}" data-p="${esc(p.id)}">
        <span class="prio-top"><span class="prio-n">${i + 1}</span><b>${esc(p.title)}</b><i class="chip ${p.statusInfo.tone}">${esc(p.statusInfo.label)}</i></span>
        ${p.nextStep ? `<span class="prio-next${i === 0 ? '' : ' drop'}"><small>Next step</small>${esc(p.nextStep)}</span>` : ''}
      </button>`).join('') || '<p class="soft">No priorities in the Sheet yet. Add them in the Priorities tab.</p>'}</div>
    ${checkedToday
      ? `<button class="kc checkin done" data-check><span><small>Today's check-in ✓</small><b>Tooth ${ci.tooth} · Tummy ${ci.abdomen} · Tiredness ${ci.fatigue}</b></span>${CHEV}</button>`
      : `<button class="kc checkin" data-check><span><small>30 seconds</small><b>How are you today?</b></span><span class="go">Check in</span></button>`}
    ${facts.length ? `<button class="kc facts" data-facts><span><small>Still right? · ${facts.length} quick check${facts.length === 1 ? '' : 's'}</small><b>${esc(facts[0].question)}</b></span>${CHEV}</button>` : ''}
    <div class="quick">
      <button class="qk" data-log>${PLUS}<span>Log a symptom</span></button>
      <button class="qk" data-photo>${CAM}<span>Photo of a result</span></button>
      <button class="qk ${medsToday ? 'on' : ''}" data-meds>${PILL}<span>${medsToday ? 'Tablets ✓' : 'Tablets taken'}</span></button>
    </div>
  </div>`;
  root.querySelectorAll('[data-p]').forEach(b => b.onclick = () => openPriority(b.dataset.p));
  $('[data-check]').onclick = startCheckin;
  $('[data-log]').onclick = logSymptom;
  $('[data-photo]').onclick = () => ctx.addPhoto();
  $('[data-meds]').onclick = tablets;
  root.querySelector('[data-facts]')?.addEventListener('click', () => factFlow(facts));
  requestAnimationFrame(() => ctx.fit($('.fit')));
}

async function tablets() {
  const day = localDay(new Date());
  const canon = ctx.canon() || {};
  if ((canon.notes || []).some(n => n.tag === TAGS.meds && localDay(n.tsUTC) === day)) { ctx.toast('Already ticked today ✓'); return; }
  const r = await ctx.addNote(TAGS.meds, noteText('MEDS: taken', { day }));
  ctx.toast(r.ok ? 'Noted ✓' : 'Saved on this device, will sync');
  render();
}

/* ---------- one priority ---------- */
export function openPriority(id) {
  const canon = ctx.canon() || {};
  const p = priorities(canon).find(x => x.id === id);
  if (!p) return;
  const qs = questionsByDoctor(canon).filter(g => p.askWhom && g.who.toLowerCase().includes(p.askWhom.toLowerCase().split(/[,(]/)[0].trim())).flatMap(g => g.questions).slice(0, 4);
  // What it is and where it stands first; the plan and questions page below;
  // the actions stay fixed at the bottom.
  ctx.openSheet(`<p class="kicker">Priority ${esc(p.rank || '')}</p><h3 class="sheet-title">${esc(p.title)}</h3>
    <div data-pages="${esc(p.title)}">
      ${p.nextStep ? `<div class="answer-box"><p class="kicker">Next step</p><p>${esc(p.nextStep)}</p></div>` : ''}
      ${p.why ? `<p class="soft">${esc(p.why)}</p>` : ''}
      ${p.steps.length ? `<p class="kicker" data-keep>The plan</p>${p.steps.map((s, i) => `<p class="qline"><span class="prio-n">${i + 1}</span>${esc(s)}</p>`).join('')}` : ''}
      ${qs.length ? `<p class="kicker" data-keep>To ask ${esc(p.askWhom)}</p>${qs.map(q => `<p class="qline dotq">${esc(q.question)}</p>`).join('')}` : ''}
    </div>
    <div class="sheet-foot"><p class="kicker">How is it going?</p><div class="choose" role="group" aria-label="How is it going?">${Object.entries(STATUS).map(([k, v]) => `<button class="st-${k}" data-st="${k}" aria-pressed="${p.status === k}"><i></i>${esc(v.label)}</button>`).join('')}</div>
    <div class="row"><button class="btn tinted" data-edit>Change next step</button><button class="btn" data-ask>Ask ${esc(DOCTOR.first)}</button></div></div>`, (sheet, close) => {
    sheet.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => {
      if (b.dataset.st === p.status) return;
      sheet.querySelectorAll('[data-st]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      savePriority(canon, p, { status: b.dataset.st });
    });
    sheet.querySelector('[data-ask]').onclick = () => { close(); ctx.openAsk(`About ${you() ? 'my' : "Dipti's"} ${p.title.toLowerCase()}: what is the most useful thing to do next?`); };
    sheet.querySelector('[data-edit]').onclick = () => { close(); editNextStep(canon, p); };
  });
}

function editNextStep(canon, p) {
  ctx.openSheet(`<p class="kicker">${esc(p.title)}</p><h3 class="sheet-title">What is the next step?</h3>
    <textarea id="nextStep" rows="3" maxlength="300" placeholder="e.g. Appointment booked for Tuesday">${esc(p.nextStep)}</textarea>
    <div class="row"><button class="btn ghost" data-close>Cancel</button><button class="btn primary grow" data-save>Save</button></div>`, (sheet, close) => {
    sheet.querySelector('[data-save]').onclick = () => {
      const nextStep = sheet.querySelector('#nextStep').value.trim();
      close();
      if (nextStep !== p.nextStep) savePriority(canon, p, { nextStep });
    };
  });
}

async function savePriority(canon, p, change) {
  const row = (canon.priorities || []).find(x => x.id === p.id); if (row) Object.assign(row, change);
  Object.assign(p, change);
  const r = await ctx.save('priority', { id: p.id, ...change });
  ctx.toast(r.ok ? 'Saved to your Sheet' : 'Saved on this device, will sync');
  refreshToday(); if (r.ok) ctx.reload();
}

/* ---------- full-screen flows (check-in, log) ---------- */
function flow(html, mount) {
  flowOpen = true;
  let layer = document.querySelector('.flow');
  if (!layer) { layer = document.createElement('div'); layer.className = 'flow'; document.body.appendChild(layer); }
  layer.innerHTML = `<div class="flow-inner">${html}</div>`;
  mount?.(layer);
  layer.querySelector('[data-x]')?.addEventListener('click', closeFlow);
}
function closeFlow() { document.querySelector('.flow')?.remove(); flowOpen = false; render(); }
const head = (step, total) => `<div class="flow-top"><button class="back" data-back aria-label="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>Back</button>${total ? `<span>${step} of ${total}</span>` : ''}<button class="icon-btn" data-x aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;

const SCORE_QS = [
  ['tooth', 'Tooth pain today', 'None', 'Worst ever'],
  ['abdomen', 'Right-side tummy pain today', 'None', 'Worst ever'],
  ['fatigue', 'How tired are you today?', 'Full of energy', 'Completely drained'],
];
const CHOICE_QS = [
  ['sleep', 'How did you sleep?', [['good', 'Well'], ['ok', 'Okay'], ['poor', 'Badly']]],
  ['bowels', 'Your tummy today', [['normal', 'Normal'], ['loose', 'A bit loose'], ['diarrhoea', 'Diarrhoea (3 or more times)'], ['constipated', 'Constipated']]],
  ['mood', 'How are you in yourself?', [['ok', 'Okay'], ['low', 'A bit low'], ['very-low', 'Very low']]],
];

export function startCheckin() {
  const prev = lastCheckin(ctx.canon()) || {};
  const a = {}; let i = 0;
  const total = SCORE_QS.length + CHOICE_QS.length + 1;
  const step = () => {
    if (i < SCORE_QS.length) {
      const [k, q, lo, hi] = SCORE_QS[i];
      const v = a[k] ?? (Number.isFinite(prev[k]) ? prev[k] : 0);
      return flow(`${head(i + 1, total)}<h1>${esc(q)}</h1>
        <div class="score"><output id="sv">${v}</output><input id="sr" type="range" min="0" max="10" step="1" value="${v}" aria-label="${esc(q)}, 0 to 10"><div class="score-ends"><span>0 · ${esc(lo)}</span><span>10 · ${esc(hi)}</span></div></div>
        ${Number.isFinite(prev[k]) ? `<p class="soft">Last time: ${prev[k]}</p>` : ''}
        <button class="btn primary" data-next>Next</button>`, layer => {
        const r = layer.querySelector('#sr'), o = layer.querySelector('#sv');
        r.oninput = () => { o.textContent = r.value; };
        layer.querySelector('[data-next]').onclick = () => { a[k] = +r.value; i++; step(); };
        layer.querySelector('[data-back]').onclick = () => { if (i === 0) closeFlow(); else { i--; step(); } };
      });
    }
    const j = i - SCORE_QS.length;
    if (j < CHOICE_QS.length) {
      const [k, q, opts] = CHOICE_QS[j];
      return flow(`${head(i + 1, total)}<h1>${esc(q)}</h1><div class="opts">${opts.map(([v, l]) => `<button class="o" data-v="${v}" aria-pressed="${a[k] === v}">${esc(l)}</button>`).join('')}</div>`, layer => {
        layer.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { a[k] = b.dataset.v; navigator.vibrate?.(10); i++; step(); });
        layer.querySelector('[data-back]').onclick = () => { i--; step(); };
      });
    }
    flow(`${head(total, total)}<h1>Anything else?</h1><p class="soft">Optional. Something you noticed, or a question for later.</p>
      <textarea id="ciNote" maxlength="1000" placeholder="e.g. tooth worse after dinner"></textarea>
      <div class="row"><button class="micbtn" data-mic aria-pressed="false">${MIC}<span>Speak</span></button><button class="btn primary grow" data-save>Save check-in</button></div>`, layer => {
      const ta = layer.querySelector('#ciNote');
      wireMic(layer.querySelector('[data-mic]'), ta);
      layer.querySelector('[data-back]').onclick = () => { i--; step(); };
      layer.querySelector('[data-save]').onclick = async e => {
        e.target.disabled = true;
        const notes = ta.value.trim();
        const r = await ctx.save('checkin', { answers: a, notes });
        const verdict = r.ok ? r.out.verdict : (a.bowels === 'diarrhoea' ? 'Act-today' : 'Saved offline');
        const canon = ctx.canon();
        if (canon) (canon.checkins || (canon.checkins = [])).push({ tsUTC: new Date().toISOString(), by: ctx.who(), ...a, verdict, notes });
        checkinResult(verdict, a, r.ok);
        if (r.ok) ctx.reload();
      };
    });
  };
  step();
}

function checkinResult(verdict, a, ok) {
  const map = {
    Steady: ['routine', 'Steady', 'Nothing has changed for the worse. Keep going with your plan.'],
    Changed: ['soon', 'Something changed', 'Not an emergency. Worth mentioning to the right doctor this week.'],
    'Act-today': ['urgent', 'Call your doctor today', a.bowels === 'diarrhoea' ? SICK_DAY : 'Pain this strong needs a same-day word with your doctor or dentist.'],
  };
  const [lvl, title, body] = map[verdict] || ['soon', 'Saved on this device', 'It will reach your Sheet when you are back online.'];
  const c = contacts()[lvl];
  flow(`<section class="kc level ${lvl}"><h1>${esc(title)}</h1><p>${esc(body)}</p>
    ${lvl === 'urgent' ? `<div class="who">${c.lines.map(l => `<span>${esc(l)}</span>`).join('')}</div>` : ''}
    <p class="meta">${ok ? 'Saved to your Sheet.' : 'Saved on this device. It will send when you are online.'}</p></section>
    <div class="row"><button class="btn" data-ask>Talk it through</button><button class="btn primary grow" data-x>Done</button></div>`, layer => {
    layer.querySelector('[data-ask]').onclick = () => { closeFlow(); ctx.openAsk(`I just checked in: tooth ${a.tooth}, tummy ${a.abdomen}, tiredness ${a.fatigue}, sleep ${a.sleep}. Anything I should do today?`); };
  });
}

export function logSymptom() {
  const log = {};
  const label = () => SYMPTOMS.find(s => s.id === log.symptom).label;
  const step1 = () => flow(`${head()}<h1>What's happening?</h1><div class="tiles2">${SYMPTOMS.map(s => `<button class="tile2" data-s="${s.id}">${esc(s.label)}</button>`).join('')}</div>`, l => {
    l.querySelector('[data-back]').onclick = closeFlow;
    l.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { log.symptom = b.dataset.s; step2(); });
  });
  const step2 = () => flow(`${head()}<p class="kicker">${esc(label())}</p><h1>When?</h1><div class="opts">${WHEN.map(([v, t]) => `<button class="o" data-w="${v}">${t}</button>`).join('')}</div>`, l => {
    l.querySelector('[data-back]').onclick = step1;
    l.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { log.when = b.dataset.w; step3(); });
  });
  const step3 = () => flow(`${head()}<p class="kicker">${esc(label())}</p><h1>How bad?</h1><div class="opts">${SEVERITY.map(([v, t]) => `<button class="o" data-v="${v}">${t}</button>`).join('')}</div>`, l => {
    l.querySelector('[data-back]').onclick = step2;
    l.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { log.severity = b.dataset.v; step4(); });
  });
  const step4 = () => flow(`${head()}<h1>Anything to add?</h1><p class="soft">What were you doing? How long did it last? Optional.</p>
    <textarea id="note" maxlength="1000" placeholder="e.g. sharp when I bit into bread, lasted a minute"></textarea>
    <div class="row"><button class="micbtn" data-mic aria-pressed="false">${MIC}<span>Speak</span></button><button class="btn primary grow" data-save>Save</button></div>`, l => {
    l.querySelector('[data-back]').onclick = step3;
    const ta = l.querySelector('#note'); wireMic(l.querySelector('[data-mic]'), ta);
    l.querySelector('[data-save]').onclick = async () => {
      log.note = ta.value.trim();
      log.level = symptomLevel(log);
      const w = WHEN.find(x => x[0] === log.when)[1], sev = SEVERITY.find(x => x[0] === log.severity)[1];
      const r = await ctx.addNote(TAGS.symptom, noteText(`SYMPTOM: ${label()}, ${w.toLowerCase()}, ${sev.toLowerCase()}${log.note ? '. ' + log.note : ''}`, log));
      logResult(log, r.ok);
    };
  });
  step1();
}

function logResult(log, ok) {
  const lvl = log.level, wy = WORRY[lvl], c = contacts()[lvl];
  const steroid = ['diarrhoea', 'sick'].includes(log.symptom) && lvl === 'urgent';
  flow(`<section class="kc level ${lvl}"><h1>${esc(wy.title)}</h1><p>${esc(steroid ? SICK_DAY : wy.step)}</p>
    ${lvl === 'urgent' || lvl === 'emergency' ? `<div class="who">${c.lines.map(l => `<span>${esc(l)}</span>`).join('')}</div>` : ''}
    ${lvl === 'emergency' ? '<div class="row"><a class="btn sos" href="tel:112">Call 112</a><a class="btn sos" href="tel:108">Ambulance 108</a></div>' : ''}
    <p class="meta">${ok ? 'Saved to your record.' : 'Saved on this device. It will send when you are online.'}</p></section>
    <div class="row"><button class="btn" data-ask>Ask ${esc(DOCTOR.name)}</button><button class="btn primary grow" data-x>Done</button></div>`, l => {
    l.querySelector('[data-ask]').onclick = () => { closeFlow(); ctx.openAsk(`I just logged: ${SYMPTOMS.find(s => s.id === log.symptom).label.toLowerCase()}, ${log.severity}${log.note ? ', ' + log.note : ''}. What should I do?`); };
  });
}

/* ---------- the fact checker: "still right?" ---------- */
// One fact a screen: the question, what the Sheet says, and a tap to answer.
// A change asks for the new details on a second screen. Writes go to the
// Sheet straight away and to the device's copy, so nothing is asked twice.
export function factFlow(list) {
  if (!list?.length) return;
  let i = 0, worse = [];
  const total = list.length;
  const apply = async (f, answer, edit) => {
    const { writes, said, worse: w } = writesFor(f, answer, edit);
    const canon = ctx.canon();
    if (canon) applyLocal(canon, writes);
    if (w) worse.push(f);
    let queued = false;
    for (const x of writes) {
      const r = x.action === 'note' ? await ctx.addNote(x.payload.tag, x.payload.text) : await ctx.save(x.action, x.payload);
      if (!r.ok) queued = true;
    }
    ctx.toast(queued ? 'Saved on this device, will sync' : said || 'Saved');
    i++; step();
  };
  const step = () => {
    if (i >= total) return done();
    const f = list[i];
    flow(`${head(i + 1, total)}<p class="kicker">Still right?</p><h1>${esc(f.question)}</h1>
      ${f.says ? `<p class="soft">${esc(f.says)}</p>` : ''}
      <div class="opts">${f.answers.map(([v, l]) => `<button class="o" data-a="${v}">${esc(l)}</button>`).join('')}</div>
      <button class="btn ghost" data-skip>Not now</button>`, l => {
      l.querySelector('[data-back]').onclick = () => { if (i === 0) closeFlow(); else { i--; step(); } };
      l.querySelector('[data-skip]').onclick = () => { i++; step(); };
      l.querySelectorAll('[data-a]').forEach(b => b.onclick = () => (needsEdit(f, b.dataset.a) ? editStep(f, b.dataset.a) : apply(f, b.dataset.a)));
    });
  };
  const editStep = (f, answer) => {
    const med = f.kind === 'med';
    flow(`${head(i + 1, total)}<p class="kicker">${esc(med ? f.key : f.row.with)}</p><h1>${med ? 'What is it now?' : 'When is it now?'}</h1>
      ${med
        ? `<label class="kicker" for="fDose">Dose</label><input id="fDose" class="finput" value="${esc(f.row.dose)}" placeholder="e.g. 20 mg">
           <label class="kicker" for="fTime">When</label><input id="fTime" class="finput" value="${esc(f.row.timing)}" placeholder="e.g. morning and night">`
        : `<label class="kicker" for="fDate">New date</label><input id="fDate" class="finput" type="date" value="${esc(f.row.date)}">
           <label class="kicker" for="fTime">Time (optional)</label><input id="fTime" class="finput" value="${esc(f.row.time)}" placeholder="e.g. 10:30">`}
      <button class="btn primary" data-save>Save</button>`, l => {
      l.querySelector('[data-back]').onclick = step;
      l.querySelector('[data-save]').onclick = () => {
        const v = id => l.querySelector(id)?.value.trim();
        const edit = med ? { dose: v('#fDose'), timing: v('#fTime') } : { date: v('#fDate'), time: v('#fTime') };
        if (!med && !/^\d{4}-\d{2}-\d{2}$/.test(edit.date || '')) { ctx.toast('Pick the new date'); return; }
        apply(f, answer, edit);
      };
    });
  };
  const done = () => {
    const w = worse[0];
    flow(`<section class="kc level routine"><h1>${w ? 'Thanks. Noted.' : 'All checked ✓'}</h1>
      <p>${w ? `You said ${esc(w.row.title.replace(/\s*\(.*?\)\s*/g, ' ').trim().toLowerCase())} is worse. Logging it gives ${esc(DOCTOR.first)} and your doctors the detail.` : `Your Sheet is up to date. Thank you${you() ? '' : ' for helping'}.`}</p></section>
      <div class="row">${w ? `<button class="btn" data-log2>Log it</button>` : ''}<button class="btn primary grow" data-x>Done</button></div>`, l => {
      l.querySelector('[data-log2]')?.addEventListener('click', () => { closeFlow(); logSymptom(); });
    });
  };
  step();
}

// A mic button that adds what she says to a text box.
let micStop = null;
export function wireMic(btn, ta) {
  btn.onclick = () => {
    if (micStop) { micStop(); micStop = null; return; }
    const base = ta.value ? ta.value.trim() + ' ' : '';
    micStop = ctx.listen(text => { ta.value = base + text; }, on => {
      btn.setAttribute('aria-pressed', String(on === true)); btn.disabled = on === 'busy';
      btn.querySelector('span').textContent = on === true ? 'Stop' : on === 'busy' ? 'Writing…' : 'Speak';
      if (on === false) micStop = null;
    });
  };
}
