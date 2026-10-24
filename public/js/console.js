// The input console: one place for everything Dipti adds to her record.
// Opened from the round + (phones) or "+ Add" (wide screens). Each choice is
// one short flow that ends on the same "saved" screen. The long note ("Write
// or talk it through") is the one editor allowed to scroll, because a spoken
// update can run for pages.
import { flow, closeFlow, head, startCheckin, logSymptom, tablets, wireMic, MIC, CAM, PILL, PLUS, ICO } from './today.js';
import { addAppointment } from './record.js';
import { medicines } from './record-model.js';
import { localDay, TAGS } from './dipti-model.js';
import { DOCTOR } from './persona.js';
import { pager } from './pager.js';

let ctx;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const you = () => ctx.me().dipti;
const today = () => new Date().toISOString().slice(0, 10);

const I = {
  feel: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5c1.9 2 5.1 2 7 0M9 10h.01M15 10h.01"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  med: '<svg viewBox="0 0 24 24"><rect x="5" y="9" width="14" height="11" rx="2.5"/><path d="M8 9V6.5A1.5 1.5 0 0 1 9.5 5h5A1.5 1.5 0 0 1 16 6.5V9M12 12v5M9.5 14.5h5"/></svg>',
  result: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 15h9"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  q: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8h.01"/></svg>',
};

export function mountConsole(context) { ctx = context; }

// Keep a long note safe on this device until it is saved.
const DRAFT = 'holistic.journalDraft';
const draft = {
  get() { try { return localStorage.getItem(DRAFT) || ''; } catch { return ''; } },
  set(v) { try { v ? localStorage.setItem(DRAFT, v) : localStorage.removeItem(DRAFT); } catch { /* private mode */ } },
};

export function openConsole(start) {
  if (start === 'journal') return journal();
  const canon = ctx.canon() || {};
  const day = localDay(new Date());
  const checked = (canon.checkins || []).some(c => localDay(c.tsUTC || c.tsLocal) === day);
  const meds = (canon.notes || []).some(n => n.tag === TAGS.meds && localDay(n.tsUTC) === day);
    const hasDraft = draft.get().trim().length > 0;
  const tiles = [
    ['journal', I.pen, 'Write or talk it through', hasDraft ? 'Your draft is waiting' : 'However long it needs to be'],
    ['checkin', I.feel, 'How I feel today', checked ? 'Done today ✓' : '30 seconds'],
    ['symptom', PLUS, 'A symptom', 'What, when, how bad'],
    ['tablets', PILL, 'Tablets taken', meds ? 'Ticked today ✓' : 'One tap'],
    ['med', I.med, 'A medicine change', 'Stopped, started or new dose'],
    ['result', I.result, 'A test result', 'Photo or type it in'],
    ['appt', I.cal, 'An appointment', 'Who and when'],
    ['question', I.q, 'A question for a doctor', 'For the next visit'],
  ];
  // The long note leads (it is how she talks); tablets is a one-tap row.
  const tab = tiles.splice(3, 1)[0];
  tiles.push(tab);
  flow(`<div class="flow-top"><span class="ctitle">Add to ${you() ? 'my' : "Dipti's"} record</span><button class="icon-btn" data-x aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="console">${tiles.map(([k, ic, t, s]) => `<button class="ct ct-${k}${/✓/.test(s) ? ' done' : ''}" data-c="${k}"><span class="ct-ic">${ic}</span><b>${esc(t)}</b><small>${esc(s)}</small></button>`).join('')}</div>`, l => {
    l.classList.add('console-layer');
    l.querySelectorAll('[data-c]').forEach(b => b.onclick = () => run(b.dataset.c));
  });
}

function run(k) {
  const canon = ctx.canon() || {};
  if (k === 'checkin') return startCheckin();
  if (k === 'symptom') return logSymptom();
  if (k === 'tablets') { closeFlow(); return tablets(); }
  if (k === 'appt') { closeFlow(); return addAppointment(canon); }
  if (k === 'med') return medChange(canon);
  if (k === 'result') return resultEntry();
  if (k === 'question') return question(canon);
  if (k === 'journal') return journal();
}

// The same last screen for every entry.
function saved(r, title, extra = '') {
  flow(`<div class="flow-top"><span></span><button class="icon-btn" data-x aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="saved"><div class="fb-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></div>
    <h1>${esc(title)}</h1><p class="soft">${r.ok ? `Saved to ${you() ? 'your' : 'her'} Sheet.` : r.outdated ? 'Saved on this device. The Sheet needs its latest script before it can take this.' : 'Saved on this device. It will send when you are online.'}</p></div>
    <div class="row">${extra}<button class="btn primary grow" data-again>Add something else</button></div>`, l => {
    l.querySelector('[data-again]').onclick = openConsole;
  });
  if (r.ok) ctx.reload?.();
}

/* ---------- a medicine change ---------- */
function medChange(canon) {
  const cur = medicines(canon).current;
  const m = {};
  const step1 = () => flow(`${head()}<h1>Which medicine?</h1>
    <div class="pick" data-pick></div>`, l => {
    l.querySelector('[data-back]').onclick = openConsole;
    const items = [...cur.map(x => ({ v: x.name, t: x.name, s: [x.dose, x.timing].filter(Boolean).join(' · ') })), { v: '', t: 'A new medicine', s: 'Not on my list yet' }];
    // Her list can be long: it pages, two to a row, never scrolls.
    pager(l.querySelector('[data-pick]'), items.map(i => ({ html: `<button class="o pk" data-m="${esc(i.v)}"><b>${esc(i.t)}</b>${i.s ? `<small>${esc(i.s)}</small>` : ''}</button>` })), {
      label: 'Medicines',
      onRender: body => body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { m.name = b.dataset.m; m.isNew = !m.name; m.isNew ? step3() : step2(); }),
    });
  });
  const step2 = () => flow(`${head()}<p class="kicker">${esc(m.name)}</p><h1>What changed?</h1><div class="opts">
      <button class="o" data-ch="stopped">I stopped it</button><button class="o" data-ch="dose">The dose or time changed</button><button class="o" data-ch="check">I'm not sure it's right</button></div>`, l => {
    l.querySelector('[data-back]').onclick = step1;
    l.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => {
      m.change = b.dataset.ch;
      if (m.change === 'dose') return step3();
      save({ name: m.name, status: m.change === 'stopped' ? 'stopped' : 'check', checked: true }, m.change === 'stopped' ? `${m.name} marked as stopped` : `${m.name} marked to check`);
    });
  });
  const step3 = () => {
    const was = cur.find(x => x.name === m.name) || {};
    flow(`${head()}<h1>${m.isNew ? 'The new medicine' : `New dose for ${esc(m.name)}`}</h1>
      <div class="form">
        ${m.isNew ? '<label>Name<input id="mName" maxlength="60" placeholder="e.g. Vitamin D3" autocomplete="off"></label>' : ''}
        <label>Dose<input id="mDose" maxlength="60" value="${esc(m.isNew ? '' : was.dose || '')}" placeholder="e.g. 10 mg"></label>
        <label>When<input id="mTime" maxlength="60" value="${esc(m.isNew ? '' : was.timing || '')}" placeholder="e.g. morning, after food"></label>
      </div>
      <button class="btn primary" data-save>Save</button>`, l => {
      l.querySelector('[data-back]').onclick = m.isNew ? step1 : step2;
      (l.querySelector('#mName') || l.querySelector('#mDose')).focus();
      l.querySelector('[data-save]').onclick = () => {
        const v = id => l.querySelector(id)?.value.trim() || '';
        const name = m.isNew ? v('#mName') : m.name;
        if (!name) { ctx.toast('Add the medicine name'); return; }
        save({ name, dose: v('#mDose'), timing: v('#mTime'), status: 'current', checked: true }, m.isNew ? `${name} added` : `${name} updated`);
      };
    });
  };
  async function save(payload, title) {
    const r = await ctx.save('medication', payload);
    const list = (canon.medications ||= []);
    const row = list.find(x => x.name === payload.name);
    if (row) Object.assign(row, payload); else list.push({ ...payload });
    saved(r, title);
  }
  step1();
}

/* ---------- a test result ---------- */
function resultEntry() {
  const step1 = () => flow(`${head()}<h1>A test result</h1><div class="opts">
      <button class="o io" data-r="photo">${CAM}<span><b>Take a photo</b><small>${esc(DOCTOR.first)} reads it and checks with you</small></span></button>
      <button class="o io" data-r="type">${I.pen}<span><b>Type it in</b><small>One result at a time</small></span></button></div>`, l => {
    l.querySelector('[data-back]').onclick = openConsole;
    l.querySelector('[data-r="photo"]').onclick = () => { closeFlow(); ctx.addPhoto(); };
    l.querySelector('[data-r="type"]').onclick = step2;
  });
  const step2 = () => flow(`${head()}<h1>Type the result</h1>
    <div class="form">
      <label>Test<input id="rTest" maxlength="60" placeholder="e.g. HbA1c, ALT, Vitamin D" autocomplete="off"></label>
      <label>Result<input id="rVal" maxlength="40" placeholder="e.g. 5.8 % or 42 U/L"></label>
      <div class="row"><label>Date<input id="rDate" type="date" value="${today()}"></label><label>Lab (optional)<input id="rLab" maxlength="60"></label></div>
    </div>
    <button class="btn primary" data-save>Save result</button>`, l => {
    l.querySelector('[data-back]').onclick = step1;
    l.querySelector('#rTest').focus();
    l.querySelector('[data-save]').onclick = async () => {
      const v = id => l.querySelector(id).value.trim();
      const p = { test: v('#rTest'), result: v('#rVal'), date: v('#rDate'), lab: v('#rLab') };
      if (!p.test || !p.result || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) { ctx.toast('Add the test, the result and the date'); return; }
      const r = await ctx.save('testResult', p);
      (ctx.canon().testResults ||= []).push(p);
      saved(r, `${p.test} saved`);
    };
  });
  step1();
}

/* ---------- a question for a doctor ---------- */
function question(canon) {
  const docs = [...new Set((canon.clinicians || []).map(c => c.name))];
  flow(`${head()}<h1>Your question</h1>
    <textarea id="qText" maxlength="400" placeholder="e.g. Can I take paracetamol with my other tablets?"></textarea>
    <label class="form"><span>Who is it for?</span><select id="qWho"><option value="Any doctor">Any doctor</option>${docs.map(d => `<option>${esc(d)}</option>`).join('')}</select></label>
    <div class="row"><button class="micbtn" data-mic aria-pressed="false">${MIC}<span>Speak</span></button><button class="btn primary grow" data-save>Save question</button></div>`, l => {
    l.querySelector('[data-back]').onclick = openConsole;
    const ta = l.querySelector('#qText'); ta.focus();
    wireMic(l.querySelector('[data-mic]'), ta);
    l.querySelector('[data-save]').onclick = async () => {
      const q = ta.value.trim();
      if (q.length < 3) { ctx.toast('Type or say the question first'); return; }
      const r = await ctx.save('question', { question: q, askWhom: l.querySelector('#qWho').value, priority: '2' });
      saved(r, 'Question saved');
    };
  });
}

/* ---------- write or talk it through ---------- */
const words = s => (s.trim() ? s.trim().split(/\s+/).length : 0);
function journal() {
  flow(`<div class="flow-top"><button class="back" data-back aria-label="Back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>Back</button><span class="jstat" aria-live="polite"></span><button class="icon-btn" data-x aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="jhead"><h1>Tell it how it is</h1><p class="soft">How you're feeling, what's happened, what's on your mind. Type, speak, or dictate. It's all kept.</p></div>
    <textarea id="jText" class="jbox" maxlength="20000" placeholder="Start anywhere…">${esc(draft.get())}</textarea>
    <div class="row"><button class="micbtn" data-mic aria-pressed="false">${MIC}<span>Speak</span></button><button class="btn primary grow" data-save>Save to my record</button></div>`, l => {
    l.classList.add('journal-layer');
    const ta = l.querySelector('#jText'), st = l.querySelector('.jstat');
    const show = (msg) => { const n = words(ta.value); st.textContent = n ? `${n} word${n === 1 ? '' : 's'}${msg ? ' · ' + msg : ''}` : ''; };
    let timer = 0;
    const keep = () => { draft.set(ta.value); show('draft kept'); };
    ta.addEventListener('input', () => { show(); clearTimeout(timer); timer = setTimeout(keep, 1200); });
    ta.addEventListener('blur', keep);
    l.querySelector('[data-back]').onclick = () => { keep(); openConsole(); };
    l.querySelector('[data-x]').addEventListener('click', keep, { capture: true });
    show();
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    wireMic(l.querySelector('[data-mic]'), ta);
    l.querySelector('[data-save]').onclick = async e => {
      const text = ta.value.trim();
      if (words(text) < 2) { ctx.toast('Write or say a little first'); return; }
      e.target.disabled = true;
      const jid = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 20);
      const r = await ctx.save('journal', { jid, text });
      if (!r.ok && !r.queued) { e.target.disabled = false; return; }
      draft.set('');
      (ctx.canon().notes ||= []).push({ tsUTC: new Date().toISOString(), by: ctx.who(), tag: 'journal', text: text.slice(0, 400) });
      saved(r, 'Saved, every word', `<button class="btn" data-ellie>${ICO.chat}Ask ${esc(DOCTOR.first)}</button>`);
      document.querySelector('.flow [data-ellie]')?.addEventListener('click', () => {
        closeFlow();
        ctx.openAsk(`Here is an update from me today. Please pick out anything that should change in my record, and ask me before changing it:\n\n${text}`.slice(0, 12000));
      });
    };
  });
}
