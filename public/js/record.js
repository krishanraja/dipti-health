// My record: a hub of tiles, each opening one list. Everything is read from
// her Google Sheet, and each list links to its tab so she can read it there.
import { priorities, medicines, questionsByDoctor, openGaps, historyEvents } from './record-model.js';
import { resultCards, fmtDate, cardLabel } from './metrics.js';

let ctx, root, view = 'home';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BACK = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
const CHEV = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';

export function mountRecord(el, context) { root = el; ctx = context; render(); }
export function refreshRecord() { if (root) render(); }
export function recordHome() { view = 'home'; if (root) render(); }
export function recordSpoke(v) { view = v; if (root) render(); }

export function openSheet(html, mount) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.onclick = e => { if (e.target === wrap) close(); };
  wrap.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  mount?.(wrap.querySelector('.sheet'), close);
  return close;
}

const you = () => ctx.me().dipti;
const sheetUrl = () => ctx.canon()?.sheetUrl || '';
function spoke(title, tab, body) {
  root.innerHTML = `<div class="spoke">
    <div class="spoke-head"><button class="back" data-home>${BACK}Record</button><h2>${esc(title)}</h2></div>
    <div class="spoke-list">${body}
      ${sheetUrl() && tab ? `<a class="sheet-tab" href="${esc(sheetUrl())}" target="_blank" rel="noopener">See this in your Sheet (${esc(tab)} tab) ${CHEV}</a>` : ''}
    </div></div>`;
  root.querySelector('[data-home]').onclick = recordHome;
}

const SPOKES = {
  priorities: canon => {
    const pr = priorities(canon);
    spoke(you() ? 'My priorities' : "Dipti's priorities", 'Priorities', pr.map((p, i) => `<section class="lcard">
      <div class="lc-top"><span class="prio-n">${i + 1}</span><b>${esc(p.title)}</b><i class="chip ${p.statusInfo.tone}">${esc(p.statusInfo.label)}</i></div>
      ${p.why ? `<p class="soft">${esc(p.why)}</p>` : ''}
      ${p.nextStep ? `<p><b>Next step:</b> ${esc(p.nextStep)}</p>` : ''}
      ${p.steps.length ? `<ol class="plan-steps">${p.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${p.askWhom ? `<p class="meta">Who to ask: ${esc(p.askWhom)}</p>` : ''}
    </section>`).join('') || '<p class="soft">No priorities yet.</p>');
  },
  medicines: canon => {
    const m = medicines(canon);
    spoke('Medicines', 'Medications', `
      ${m.differ ? `<p class="answer-box">${m.differ} medicine${m.differ === 1 ? '' : 's'} on ${you() ? 'your' : 'her'} list differ${m.differ === 1 ? 's' : ''} from the last written prescription. Ask the prescriber to confirm. No dose changes until they do.</p>` : ''}
      ${m.current.map(x => `<section class="lcard med ${x.differs ? 'differs' : ''}"><div class="lc-top"><b>${esc(x.name)}</b>${x.generic ? `<small>${esc(x.generic)}</small>` : ''}</div>
        <p>${esc(`${x.dose} ${x.timing}`.trim())}${x.purpose ? ` · <span class="soft">${esc(x.purpose)}</span>` : ''}</p>
        ${x.differs ? `<p class="meta ask">Last prescription: ${esc(x.rx || 'not on it')}</p>` : ''}</section>`).join('') || '<p class="soft">No medicines recorded.</p>'}
      ${m.stopped.length ? `<p class="kicker">Stopped</p>${m.stopped.map(x => `<p class="stopped">${esc(x.name)} <small>${esc(`${x.dose} ${x.timing}`.trim())}</small></p>`).join('')}` : ''}`);
  },
  results: canon => {
    const cards = resultCards(canon.testResults || []);
    const other = (canon.testResults || []).length;
    spoke('Results', 'TestResults', cards.map(c => `<section class="lcard">
      <div class="lc-top"><b>${esc(c.def.label)}</b><i class="chip ${cardLabel(c).tone}">${esc(cardLabel(c).text)}</i></div>
      <p class="series">${c.points.map(p => `<span><b>${p.below ? '<' : ''}${p.value}</b><small>${esc(fmtDate(p.date))}</small></span>`).join('<i>→</i>')} <small>${esc(c.def.unit)}</small></p>
      <p class="soft">${esc(c.def.plain)}</p></section>`).join('') + `<p class="meta">${other} result rows in total. Every one is in the Sheet.</p>`);
  },
  questions: canon => {
    const g = questionsByDoctor(canon);
    spoke('Questions for doctors', 'Questions', g.map(x => `<section class="lcard"><div class="lc-top"><b>${esc(x.who)}</b><button class="pill" data-brief="${esc(x.who)}">Summary</button></div>
      <ol class="plan-steps">${x.questions.map(q => `<li><span>${esc(q.question)}</span> ${q.status === 'asked' ? '<i class="chip warm">asked</i>' : ''}<button class="tick" data-q="${esc(q.id)}">Answered</button></li>`).join('')}</ol></section>`).join('') || '<p class="soft">No open questions.</p>');
    root.querySelectorAll('[data-q]').forEach(b => b.onclick = () => answerSheet(canon, b.dataset.q));
    root.querySelectorAll('[data-brief]').forEach(b => b.onclick = () => {
      const doc = (canon.clinicians || []).find(c => b.dataset.brief.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(b.dataset.brief.toLowerCase()));
      ctx.shareBrief(doc ? doc.name : '');
    });
  },
  gaps: canon => {
    const g = openGaps(canon);
    spoke('To clear up', 'KnowledgeGaps', `<p class="soft">Places where ${you() ? 'your' : 'her'} records disagree or something is not known yet. Each one has a simple way to settle it.</p>` + g.map(x => `<section class="lcard"><p><b>${esc(x.gap)}</b></p>${x.whatAnswersIt ? `<p class="meta">Settled by: ${esc(x.whatAnswersIt)}</p>` : ''}${x.stepToClose ? `<p>${esc(x.stepToClose)}</p>` : ''}<button class="tick" data-g="${esc(x.id)}">Cleared up</button></section>`).join(''));
    root.querySelectorAll('[data-g]').forEach(b => b.onclick = async () => {
      const row = (canon.gaps || []).find(x => x.id === b.dataset.g); if (row) row.status = 'closed';
      const r = await ctx.save('gap', { id: b.dataset.g, status: 'closed' });
      ctx.toast(r.ok ? 'Marked as cleared up' : 'Saved on this device, will sync'); render();
    });
  },
  conditions: canon => spoke('Conditions', 'Conditions', `<p class="meta">"Report" means it is in a lab or scan report. "You said" means it comes from ${you() ? 'you' : 'Dipti'}.</p>` + (canon.conditions || []).map(c => `<section class="lcard"><div class="lc-top"><b>${esc(c.name)}</b><small>${c.evidence === 'Doc' ? 'Report' : c.evidence === 'Stated' ? 'You said' : esc(c.evidence)}</small></div>${c.notes ? `<p class="soft">${esc(c.notes)}</p>` : ''}</section>`).join('')),
  doctors: canon => spoke('Doctors', 'Clinicians', (canon.clinicians || []).map(c => `<section class="lcard"><div class="lc-top"><b>${esc(c.name)}</b><small>${esc(c.role)}</small></div>${c.owns ? `<p class="soft">${esc(c.owns)}</p>` : ''}${c.contact ? `<p>${esc(c.contact)}</p>` : ''}<button class="pill" data-brief="${esc(c.name)}">Summary for ${esc(c.name)}</button></section>`).join('') || '<p class="soft">No doctors recorded.</p>'),
  history: canon => {
    const ev = historyEvents(canon).slice(0, 200);
    let last = '';
    spoke('History', 'Notes', `<div class="timeline">${ev.map(e => { const d = e.date !== last ? `<p class="t-date">${esc(e.date)}</p>` : ''; last = e.date; return `${d}<div class="ev"><i class="ev-kind">${esc({ result: 'Result', asked: 'Asked', symptom: 'Symptom', checkin: 'Check-in', answer: 'Answer', note: 'Note' }[e.kind] || 'Note')}</i><div class="ev-body"><b>${esc(e.title)}</b><span>${esc(e.detail)}${e.count > 1 ? ` (asked ${e.count} times)` : ''}</span></div></div>`; }).join('') || '<p class="soft">Nothing yet.</p>'}</div>`);
  },
};

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
  if (SPOKES[view]) {
    SPOKES[view](canon);
    root.querySelectorAll('[data-brief]').forEach(b => { if (!b.onclick) b.onclick = () => ctx.shareBrief(b.dataset.brief); });
    return;
  }
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
      ${tile('conditions', 'Conditions', (canon.conditions || []).length, 'in your record')}
      ${tile('history', 'History', lastEv ? lastEv.date.replace(/ \d{4}$/, '') : 'None', 'latest entry')}
    </div>
    ${sheetUrl() ? `<a class="btn sheet-btn" href="${esc(sheetUrl())}" target="_blank" rel="noopener">Open my Google Sheet</a>` : ''}
    <button class="btn ghost" data-brief="">Summary for a doctor</button>
  </div>`.replace('for her doctors', you() ? 'for your doctors' : "for Dipti's doctors");
  root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => recordSpoke(b.dataset.go));
  root.querySelector('[data-brief]').onclick = () => ctx.shareBrief();
}

