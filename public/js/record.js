// My record: a hub of tiles, each opening one list. Everything is read from
// her Google Sheet, and each list links to its tab so she can read it there.
import { priorities, medicines, questionsByDoctor, openGaps, historyEvents } from './record-model.js';
import { resultCards, fmtDate, cardLabel } from './metrics.js';
import { pager, autoPages } from './pager.js';
import { appointments, whenText, nextAppointment } from './facts-model.js';

let ctx, root, view = 'home';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BACK = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
const CHEV = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';

export function mountRecord(el, context) { root = el; ctx = context; render(); }
export function refreshRecord() { if (root) render(); }
export function recordHome() { view = 'home'; if (root) render(); }
export function recordSpoke(v) { view = v; if (root) render(); }

// A sheet from the bottom (centred on wide screens). Always a way out: the
// close button, a tap outside, Escape, or a swipe down on a phone.
export function openSheet(html, mount) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="sheet-x" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>${html}</div>`;
  document.body.appendChild(wrap);
  autoPages(wrap); // any [data-pages] block pages instead of scrolling
  const sheet = wrap.querySelector('.sheet');
  const onKey = e => { if (e.key === 'Escape') close(); };
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    removeEventListener('keydown', onKey);
    sheet.style.transform = 'translateY(110%)'; wrap.style.transition = 'opacity .2s'; wrap.style.opacity = '0';
    setTimeout(() => wrap.remove(), 220);
  };
  addEventListener('keydown', onKey);
  wrap.onclick = e => { if (e.target === wrap) close(); };
  wrap.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  // Swipe down to close: follows the finger, closes past a short distance or a quick flick.
  let y0 = null, x0 = 0, t0 = 0, dy = 0;
  sheet.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || e.target.closest('input, textarea, select, .pg-body')) return;
    y0 = e.clientY; x0 = e.clientX; t0 = Date.now(); dy = 0;
  });
  sheet.addEventListener('pointermove', e => {
    if (y0 === null) return;
    const d = e.clientY - y0;
    if (Math.abs(e.clientX - x0) > Math.abs(d) && !dy) { y0 = null; return; }
    dy = Math.max(0, d);
    if (dy > 4) { sheet.classList.add('dragging'); sheet.style.transform = `translateY(${dy}px)`; }
  });
  const end = () => {
    if (y0 === null) return;
    const fast = dy > 40 && Date.now() - t0 < 250;
    y0 = null; sheet.classList.remove('dragging');
    if (dy > 90 || fast) close(); else sheet.style.transform = '';
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
  mount?.(sheet, close);
  return close;
}

const you = () => ctx.me().dipti;
const sheetUrl = () => ctx.canon()?.sheetUrl || '';
// One list. items: [{html, keep}] or html strings; the list pages, never scrolls.
// wire(body) attaches handlers each time a page is drawn.
function spoke(title, tab, items, wire) {
  root.innerHTML = `<div class="spoke">
    <div class="spoke-head"><button class="back" data-home>${BACK}Record</button><h2>${esc(title)}</h2>
    ${sheetUrl() && tab ? `<a class="sheet-tab" href="${esc(sheetUrl())}" target="_blank" rel="noopener" aria-label="Open the ${esc(tab)} tab in your Sheet">In your Sheet ${CHEV}</a>` : ''}</div>
    <div class="spoke-list"></div></div>`;
  root.querySelector('[data-home]').onclick = recordHome;
  const list = items.map(i => (typeof i === 'string' ? { html: i } : i));
  pager(root.querySelector('.spoke-list'), list.length ? list : [{ html: '<p class="soft">Nothing here yet.</p>' }], {
    label: title,
    onRender: body => {
      body.querySelectorAll('[data-brief]').forEach(b => { b.onclick = () => briefFor(b.dataset.brief); });
      wire?.(body);
    },
  });
}
function briefFor(name) {
  const doc = (ctx.canon()?.clinicians || []).find(c => name && (name.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(name.toLowerCase())));
  ctx.shareBrief(doc ? doc.name : '');
}

const SPOKES = {
  priorities: canon => {
    const pr = priorities(canon);
    // Each priority: its card (what, where it stands, next step), then the
    // plan a step at a time, so a long plan pages rather than overflows.
    spoke(you() ? 'My priorities' : "Dipti's priorities", 'Priorities', pr.flatMap((p, i) => [
      { html: `<section class="lcard">
      <div class="lc-top"><span class="prio-n">${i + 1}</span><b>${esc(p.title)}</b><i class="chip ${p.statusInfo.tone}">${esc(p.statusInfo.label)}</i></div>
      ${p.nextStep ? `<p><b>Next step:</b> ${esc(p.nextStep)}</p>` : ''}
      ${p.askWhom ? `<p class="meta">Who to ask: ${esc(p.askWhom)}</p>` : ''}
    </section>`, keep: !!(p.why || p.steps.length) },
      ...(p.why ? [{ html: `<p class="soft why">${esc(p.why)}</p>`, keep: !!p.steps.length }] : []),
      ...p.steps.map((s, j) => `<p class="qline step"><span class="prio-n">${j + 1}</span>${esc(s)}</p>`),
    ]));
  },
  medicines: canon => {
    const m = medicines(canon);
    spoke('Medicines', 'Medications', [
      ...(m.differ ? [`<p class="answer-box">${m.differ} medicine${m.differ === 1 ? '' : 's'} on ${you() ? 'your' : 'her'} list differ${m.differ === 1 ? 's' : ''} from the last written prescription. Ask the prescriber to confirm. No dose changes until they do.</p>`] : []),
      ...m.current.map(x => `<section class="lcard med ${x.differs ? 'differs' : ''}"><div class="lc-top"><b>${esc(x.name)}</b>${x.generic ? `<small>${esc(x.generic)}</small>` : ''}</div>
        <p>${esc(`${x.dose} ${x.timing}`.trim())}${x.purpose ? ` · <span class="soft">${esc(x.purpose)}</span>` : ''}</p>
        ${x.differs ? `<p class="meta ask">Last prescription: ${esc(x.rx || 'not on it')}</p>` : ''}</section>`),
      ...(m.stopped.length ? [{ html: '<p class="kicker">Stopped</p>', keep: true }, ...m.stopped.map(x => `<p class="stopped">${esc(x.name)} <small>${esc(`${x.dose} ${x.timing}`.trim())}</small></p>`)] : []),
    ]);
  },
  results: canon => {
    const cards = resultCards(canon.testResults || []);
    const other = (canon.testResults || []).length;
    spoke('Results', 'TestResults', [...cards.map(c => `<section class="lcard">
      <div class="lc-top"><b>${esc(c.def.label)}</b><i class="chip ${cardLabel(c).tone}">${esc(cardLabel(c).text)}</i></div>
      <p class="series">${c.points.map(p => `<span><b>${p.below ? '<' : ''}${p.value}</b><small>${esc(fmtDate(p.date))}</small></span>`).join('<i>→</i>')} <small>${esc(c.def.unit)}</small></p>
      <p class="soft">${esc(c.def.plain)}</p></section>`), ...(other ? [`<p class="meta">${other} result rows in total. Every one is in the Sheet.</p>`] : [])]);
  },
  questions: canon => {
    const g = questionsByDoctor(canon);
    spoke('Questions for doctors', 'Questions', g.flatMap(x => [
      { html: `<div class="qhead"><b>${esc(x.who)}</b><button class="pill" data-brief="${esc(x.who)}">Summary</button></div>`, keep: true },
      ...x.questions.map(q => `<div class="qrow"><span>${esc(q.question)}${q.status === 'asked' ? ' <i class="chip warm">asked</i>' : ''}</span><button class="tick" data-q="${esc(q.id)}">Answered</button></div>`),
    ]), body => body.querySelectorAll('[data-q]').forEach(b => b.onclick = () => answerSheet(canon, b.dataset.q)));
  },
  gaps: canon => {
    const g = openGaps(canon);
    spoke('To clear up', 'KnowledgeGaps', [`<p class="soft">Places where ${you() ? 'your' : 'her'} records disagree or something is not known yet. Each one has a simple way to settle it.</p>`,
      ...g.map(x => `<section class="lcard"><p><b>${esc(x.gap)}</b></p>${x.whatAnswersIt ? `<p class="meta">Settled by: ${esc(x.whatAnswersIt)}</p>` : ''}${x.stepToClose ? `<p>${esc(x.stepToClose)}</p>` : ''}<button class="tick" data-g="${esc(x.id)}">Cleared up</button></section>`)],
    body => body.querySelectorAll('[data-g]').forEach(b => b.onclick = async () => {
      const row = (canon.gaps || []).find(x => x.id === b.dataset.g); if (row) row.status = 'closed';
      const r = await ctx.save('gap', { id: b.dataset.g, status: 'closed' });
      ctx.toast(r.ok ? 'Marked as cleared up' : 'Saved on this device, will sync'); render();
    }));
  },
  appointments: canon => {
    const a = appointments(canon);
    const card = (x, past) => `<section class="lcard appt ${past ? 'past' : ''}"><div class="lc-top"><b>${esc(x.with)}</b><i class="chip ${x.status === 'cancelled' ? '' : past ? 'ok' : 'accent'}">${esc(past ? { done: 'Done', cancelled: 'Cancelled', moved: 'Moved' }[x.status] || x.status : whenText(x.date, x.time))}</i></div>
      <p>${esc([past ? whenText(x.date, x.time) : '', x.where, x.for].filter(Boolean).join(' · ') || ' ')}</p>${x.notes && x.notes !== 'From the record' ? `<p class="soft">${esc(x.notes)}</p>` : ''}
      ${past ? '' : `<button class="pill" data-appt="${esc(x.id)}">Moved or done?</button>`}</section>`;
    spoke('Appointments', 'Appointments', [
      `<button class="btn primary" data-add-appt>Add an appointment</button>`,
      ...(a.overdue.length || a.upcoming.length ? [{ html: '<p class="kicker">Coming up</p>', keep: true }, ...a.overdue.map(x => card(x, false)), ...a.upcoming.map(x => card(x, false))] : ['<p class="soft">Nothing booked. Add one and it shows on Today, and gets checked the day after.</p>']),
      ...(a.earlier.length ? [{ html: '<p class="kicker">Earlier</p>', keep: true }, ...a.earlier.map(x => card(x, true))] : []),
    ], body => {
      body.querySelector('[data-add-appt]')?.addEventListener('click', () => addAppointment(canon));
      body.querySelectorAll('[data-appt]').forEach(b => b.onclick = () => {
        const f = [...a.upcoming, ...a.overdue].find(x => x.id === b.dataset.appt);
        if (f) ctx.factFlow([{ id: 'Appointments:' + f.id, tab: 'Appointments', key: f.id, kind: 'apptSoon', row: f, question: `${f.with}, ${whenText(f.date, f.time)}: still on?`, says: f.for || '', answers: [['still', 'Yes, still on'], ['moved', 'It moved'], ['done', 'Done, I went'], ['cancelled', 'It was cancelled']] }]);
      });
    });
  },
  doctors: canon => spoke('Doctors', 'Clinicians', (canon.clinicians || []).map(c => `<section class="lcard"><div class="lc-top"><b>${esc(c.name)}</b><small>${esc(c.role)}</small></div>${c.owns ? `<p class="soft">${esc(c.owns)}</p>` : ''}${c.contact ? `<p>${esc(c.contact)}</p>` : ''}<button class="pill" data-brief="${esc(c.name)}">Summary for ${esc(c.name)}</button></section>`)),
  history: canon => {
    const ev = historyEvents(canon).slice(0, 200);
    let last = '';
    const items = [];
    ev.forEach(e => {
      if (e.date !== last) { items.push({ html: `<p class="t-date">${esc(e.date)}</p>`, keep: true }); last = e.date; }
      items.push(`<div class="ev"><i class="ev-kind">${esc({ result: 'Result', asked: 'Asked', symptom: 'Symptom', checkin: 'Check-in', answer: 'Answer', note: 'Note' }[e.kind] || 'Note')}</i><div class="ev-body"><b>${esc(e.title)}</b><span>${esc(e.detail)}${e.count > 1 ? ` (asked ${e.count} times)` : ''}</span></div></div>`);
    });
    spoke('History', 'Notes', items);
  },
};

function addAppointment(canon) {
  const docs = (canon.clinicians || []).map(c => c.name);
  openSheet(`<p class="kicker">New appointment</p><h3 class="sheet-title">Who is it with?</h3>
    <input id="apWith" list="apDocs" maxlength="80" placeholder="e.g. Dentist, or a doctor's name"><datalist id="apDocs">${docs.map(d => `<option value="${esc(d)}">`).join('')}</datalist>
    <div class="row"><input id="apDate" type="date" aria-label="Date"><input id="apTime" maxlength="10" placeholder="Time" aria-label="Time"></div>
    <input id="apFor" maxlength="120" placeholder="What for (optional)">
    <div class="row"><button class="btn ghost" data-close>Cancel</button><button class="btn primary grow" data-save>Save</button></div>`, (sheet, close) => {
    sheet.querySelector('[data-save]').onclick = async () => {
      const v = id => sheet.querySelector(id).value.trim();
      const p = { with: v('#apWith'), date: v('#apDate'), time: v('#apTime'), for: v('#apFor') };
      if (!p.with || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) { ctx.toast('Add who it is with, and the date'); return; }
      close();
      const r = await ctx.save('appointment', p);
      (canon.appointments ||= []).push({ ...p, id: r.out?.id || 'new', status: 'booked', checked: new Date().toISOString().slice(0, 10) });
      ctx.toast(r.ok ? 'Saved to your Sheet' : 'Saved on this device, will sync');
      render(); if (r.ok) ctx.reload();
    };
  });
}

function answerSheet(canon, id) {
  const q = (canon.questions || []).find(x => x.id === id);
  if (!q) return;
  openSheet(`<p class="kicker">${esc(q.askWhom)}</p><h3 class="sheet-title">${esc(q.question)}</h3>
    <label class="kicker" for="ans">What did they say?</label><textarea id="ans" rows="4" maxlength="1000"></textarea>
    <div class="row"><button class="btn ghost" data-close>Cancel</button><button class="btn primary grow" data-save>Save answer</button></div>`, (sheet, close) => {
    sheet.querySelector('[data-save]').onclick = async () => {
      const answer = sheet.querySelector('#ans').value.trim();
      if (!answer) return;
      Object.assign(q, { status: 'answered', answer });
      close();
      const r = await ctx.save('question', { id, status: 'answered', answer });
      ctx.toast(r.ok ? 'Saved to your Sheet' : 'Saved on this device, will sync'); render();
    };
  });
}

function render() {
  const canon = ctx.canon();
  if (!canon) {
    root.innerHTML = `<div class="rec-empty"><p class="kicker">Record</p><h3>${ctx.session().sheetConfigured === false ? 'The Sheet is not connected yet' : 'Loading your record'}</h3></div>`;
    return;
  }
  if (SPOKES[view]) return SPOKES[view](canon);
  const pr = priorities(canon).filter(p => p.status !== 'done');
  const m = medicines(canon);
  const qn = questionsByDoctor(canon).reduce((n, g) => n + g.questions.length, 0);
  const gaps = openGaps(canon).length;
  const rc = resultCards(canon.testResults || []);
  const lastEv = historyEvents(canon)[0];
  const tile = (go, h, big, sub) => `<button class="tile" data-go="${go}"><span class="tile-h">${esc(h)}</span><span class="tile-big ${String(big).length > 4 ? 'sm' : ''}">${esc(big)}</span><span class="tile-sub">${esc(sub)}</span></button>`;
  root.innerHTML = `<div class="rec-home">
    <div class="tiles rec-tiles">
      ${tile('priorities', 'Priorities', pr.length, pr[0] ? pr[0].title : 'none yet')}
      ${tile('medicines', 'Medicines', m.current.length, m.differ ? `${m.differ} to confirm` : 'all match')}
      ${tile('results', 'Results', rc.length, 'measures over time')}
      ${tile('questions', 'Questions', qn, 'for her doctors')}
      ${tile('gaps', 'To clear up', gaps, gaps ? 'open' : 'nothing open')}
      ${tile('doctors', 'Doctors', (canon.clinicians || []).length, 'who looks after what')}
      ${(() => { const n = nextAppointment(canon); return tile('appointments', 'Appointments', appointments(canon).upcoming.length, n ? `next ${n.with}` : 'none booked'); })()}
      ${tile('history', 'History', lastEv ? lastEv.date.replace(/ \d{4}$/, '') : 'None', 'latest entry')}
    </div>
    <div class="row rec-actions">${sheetUrl() ? `<a class="btn sheet-btn grow" href="${esc(sheetUrl())}" target="_blank" rel="noopener">Open my Sheet</a>` : ''}<button class="btn grow" data-brief="">Summary for a doctor</button></div>
  </div>`.replace('for her doctors', you() ? 'for your doctors' : "for Dipti's doctors");
  root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => (b.dataset.go === 'conditions' ? ctx.go('conditions') : recordSpoke(b.dataset.go)));
  root.querySelector('[data-brief]').onclick = () => ctx.shareBrief();
}

