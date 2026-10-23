// The wide-screen overview: one screen, three columns, answering "what needs
// me, and what has changed". Now (priorities, check-in, questions by doctor),
// Medicines (her list beside the prescription), Trends (scores and results).
// Any card opens a side panel with the detail and the evidence behind it.
// Simplicity rules: at most 3 items per card before "more", one accent
// colour, urgency colours only for genuine flags.
import { priorities, medicines, questionsByDoctor, openGaps, historyEvents } from './record-model.js';
import { resultCards, fmtDate, cardLabel } from './metrics.js';
import { lastCheckin, scoreSeries, localDay, TZ } from './dipti-model.js';
import { entitiesIn, related, sourcesFor, GRADE_LABEL } from './evidence.js';
import { DOCTOR } from './persona.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

// Calm words for how soon something in the research pack wants discussing.
const WHEN_TO_RAISE = { critical: 'Raise with your doctor soon', high: 'Raise at your next appointment', moderate: 'Worth a mention', low: 'Good to know' };

// A tiny line chart. points: [{value}], optional range band {low, high}.
export function spark(points, { w = 120, h = 34, min = null, max = null, band = null } = {}) {
  if (!points.length) return '';
  const vals = points.map(p => p.value);
  const lo = min ?? Math.min(...vals, band?.low ?? Infinity), hi = max ?? Math.max(...vals, band?.high ?? -Infinity);
  const span = hi - lo || 1;
  const x = i => points.length === 1 ? w / 2 : 3 + i * (w - 6) / (points.length - 1);
  const y = v => h - 3 - (v - lo) / span * (h - 6);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const b = band && band.high != null ? `<rect x="0" y="${y(Math.min(band.high, hi)).toFixed(1)}" width="${w}" height="${Math.max(1, y(Math.max(band.low ?? lo, lo)) - y(Math.min(band.high, hi))).toFixed(1)}" class="sp-band"/>` : '';
  const last = points.length - 1;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${b}<path d="${d}" class="sp-line"/><circle cx="${x(last).toFixed(1)}" cy="${y(points[last].value).toFixed(1)}" r="3" class="sp-dot"/></svg>`;
}

let ctx, root;

export function renderDashboard(el, context) {
  root = el; ctx = context;
  const canon = ctx.canon();
  if (!canon) {
    root.innerHTML = `<div class="rec-empty"><p class="kicker">Overview</p><h3>${ctx.session().sheetConfigured === false ? 'The Sheet is not connected yet' : 'Loading your record'}</h3></div>`;
    return;
  }
  const you = ctx.me().dipti;
  const pr = priorities(canon).filter(p => p.status !== 'done');
  const ci = lastCheckin(canon);
  const checkedToday = ci && localDay(ci.ts) === localDay(new Date());
  const meds = medicines(canon);
  const qg = questionsByDoctor(canon);
  const gaps = openGaps(canon);
  const cards = resultCards(canon.testResults || []);
  const hist = historyEvents(canon).slice(0, 4);
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  const AREAS = [['tooth', 'Tooth'], ['abdomen', 'Tummy'], ['fatigue', 'Tiredness']];

  root.innerHTML = `<div class="dash">
    <section class="col">
      <div class="dash-hello"><h1>${you ? 'Hello Dipti' : `Hello ${esc(ctx.me().name || '')}`}</h1><p>${esc(date)}</p></div>
      <article class="dcard prio-card">
        <p class="kicker">${you ? 'Your' : "Dipti's"} priorities</p>
        ${pr.slice(0, 3).map((p, i) => `<button class="dp" data-p="${esc(p.id)}">
          <span class="dp-top"><span class="prio-n">${i + 1}</span><b>${esc(p.title)}</b><i class="chip ${p.statusInfo.tone}">${esc(p.statusInfo.label)}</i></span>
          ${p.nextStep ? `<span class="dp-next">${esc(p.nextStep)}</span>` : ''}
          ${p.steps.length ? `<span class="dp-plan">${p.steps.slice(0, 3).map(s => `<span>${esc(s)}</span>`).join('')}${p.steps.length > 3 ? `<span class="more">+${p.steps.length - 3} more</span>` : ''}</span>` : ''}
        </button>`).join('') || '<p class="soft">No priorities yet. Add them in the Priorities tab of the Sheet.</p>'}
      </article>
      <article class="dcard">
        <div class="dc-head"><p class="kicker">Today's check-in</p>${checkedToday ? '<span class="ok-text">Done ✓</span>' : ''}</div>
        <div class="scores">${AREAS.map(([k, l]) => { const s = scoreSeries(canon, k); return `<div class="score-mini"><span>${l}</span><b>${s.length ? s[s.length - 1].value : '–'}<small>/10</small></b>${spark(s, { w: 90, h: 26, min: 0, max: 10 })}</div>`; }).join('')}</div>
        ${checkedToday ? '' : '<button class="btn primary" data-check>Check in now (30 seconds)</button>'}
        <div class="row"><button class="btn" data-log>Log a symptom</button><button class="btn" data-meds>Tablets taken</button></div>
      </article>
      <article class="dcard">
        <p class="kicker">Questions, by doctor</p>
        ${qg.slice(0, 3).map(g => `<button class="dq" data-q="${esc(g.who)}"><b>${esc(g.who)}</b><span>${esc(g.questions[0].question)}</span>${g.questions.length > 1 ? `<small>+${g.questions.length - 1} more</small>` : ''}</button>`).join('') || '<p class="soft">No open questions.</p>'}
        ${qg.length > 3 ? `<button class="link" data-more="questions">All ${qg.length} doctors ${CHEV}</button>` : ''}
      </article>
    </section>

    <section class="col">
      <article class="dcard grow">
        <div class="dc-head"><p class="kicker">Medicines now</p>${meds.differ ? `<span class="soft small">${meds.differ} to confirm with the prescriber</span>` : ''}</div>
        <table class="medtab"><thead><tr><th>Medicine</th><th>Dose and time</th><th>For</th></tr></thead><tbody>
        ${meds.current.map((m, i) => `<tr data-m="${i}" tabindex="0"><td><b>${esc(m.name)}</b>${m.generic ? `<small>${esc(m.generic)}</small>` : ''}</td><td>${esc(`${m.dose} ${m.timing}`.trim())}${m.differs ? `<small class="ask">Prescription: ${esc(m.rx || 'not on it')}</small>` : ''}</td><td>${esc(m.purpose)}</td></tr>`).join('') || '<tr><td colspan="3" class="soft">No medicines in the Sheet yet.</td></tr>'}
        </tbody></table>
        ${meds.stopped.length ? `<button class="link" data-more="meds">${meds.stopped.length} stopped medicines ${CHEV}</button>` : ''}
      </article>
      <article class="dcard">
        <p class="kicker">Things to clear up</p>
        ${gaps.slice(0, 3).map(g => `<button class="dq" data-g="${esc(g.id)}"><span>${esc(g.gap)}</span>${g.whatAnswersIt ? `<small>${esc(g.whatAnswersIt)}</small>` : ''}</button>`).join('') || '<p class="soft">Nothing open.</p>'}
        ${gaps.length > 3 ? `<button class="link" data-more="gaps">All ${gaps.length} ${CHEV}</button>` : ''}
      </article>
    </section>

    <section class="col">
      <article class="dcard grow">
        <p class="kicker">Results over time</p>
        <div class="trends">${cards.slice(0, 8).map(c => `<button class="tr" data-r="${c.key}">
          <span class="tr-l"><b>${esc(c.def.short)}</b><small>${esc(fmtDate(c.last.date, { year: true }))}</small></span>
          ${spark(c.points, { band: c.last.range })}
          <span class="tr-v"><b>${c.last.below ? '<' : ''}${c.last.value}</b><small>${esc(c.def.unit)}</small></span>
          <i class="chip ${cardLabel(c).tone}">${esc(cardLabel(c).text || '–')}</i>
        </button>`).join('') || '<p class="soft">No results yet.</p>'}</div>
      </article>
      <article class="dcard">
        <p class="kicker">Recently</p>
        <div class="recent">${hist.map(e => `<div class="rc"><small>${esc(e.date)}</small><span><b>${esc(e.title)}</b> ${esc(e.detail)}</span></div>`).join('') || '<p class="soft">Nothing yet.</p>'}</div>
        <button class="link" data-more="history">Full history ${CHEV}</button>
      </article>
    </section>
  </div>`;

  root.querySelectorAll('[data-p]').forEach(b => b.onclick = () => ctx.openPriority(b.dataset.p));
  root.querySelector('[data-check]')?.addEventListener('click', ctx.startCheckin);
  root.querySelector('[data-log]').onclick = ctx.logSymptom;
  root.querySelector('[data-meds]').onclick = ctx.tablets;
  root.querySelectorAll('[data-q]').forEach(b => b.onclick = () => questionsPanel(b.dataset.q));
  root.querySelectorAll('[data-g]').forEach(b => b.onclick = () => gapPanel(b.dataset.g));
  root.querySelectorAll('[data-m]').forEach(r => { const open = () => medPanel(meds.current[+r.dataset.m]); r.onclick = open; r.onkeydown = e => { if (e.key === 'Enter') open(); }; });
  root.querySelectorAll('[data-r]').forEach(b => b.onclick = () => resultPanel(cards.find(c => c.key === b.dataset.r)));
  root.querySelectorAll('[data-more]').forEach(b => b.onclick = () => { ctx.go('record'); ctx.recordSpoke?.(b.dataset.more); });
}

/* ---------- side panel ---------- */
function panel(title, body, mount) {
  document.querySelector('.panel-wrap')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'panel-wrap';
  wrap.innerHTML = `<aside class="panel" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="panel-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="panel-body">${body}</div></aside>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.onclick = e => { if (e.target === wrap) close(); };
  wrap.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  const onKey = e => { if (e.key === 'Escape') { close(); removeEventListener('keydown', onKey); } };
  addEventListener('keydown', onKey);
  mount?.(wrap, close);
}

function sheetLine(tab) {
  const url = ctx.canon()?.sheetUrl;
  return url ? `<a class="link" href="${esc(url)}" target="_blank" rel="noopener">Open the ${esc(tab)} tab in your Sheet</a>` : '';
}

// Research-pack rows behind something, told calmly: when to raise it, and how strong the evidence is.
function evidenceHtml(rows) {
  const canon = ctx.canon() || {};
  // Lists of possible causes are for the doctor's reasoning, not for this panel.
  rows = rows.filter(r => r.kind !== 'symptom_attribution');
  if (!rows.length) return '';
  return `<div class="ev-list"><p class="kicker">From your research pack</p>${rows.slice(0, 4).map(r => {
    const src = sourcesFor(r, canon.sources || []).slice(0, 2);
    return `<details class="evd"><summary>${r.ask ? `<b>Worth asking: ${esc(r.ask)}</b>` : `<b>${esc(r.kind === 'medication' || r.kind === 'lab' ? 'Notes on this from the research' : 'Background from the research')}</b>`}<small>${esc(WHEN_TO_RAISE[r.severity] || 'Background')}${r.grade ? ' · ' + esc(GRADE_LABEL[r.grade] || 'Grade ' + r.grade) : ''} · tap for the detail</small></summary>
      <p>${esc(r.text)}</p>${src.length ? `<p class="meta">${src.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title.slice(0, 70))}</a>`).join(' · ')}</p>` : ''}</details>`;
  }).join('')}</div>`;
}

function askButton(text) { return `<button class="btn" data-askdoc="${esc(text)}">Ask ${esc(DOCTOR.name)} about this</button>`; }
function wireAsk(wrap, close) { wrap.querySelector('[data-askdoc]')?.addEventListener('click', e => { close(); ctx.openAsk(e.target.dataset.askdoc); }); }

function medPanel(m) {
  const canon = ctx.canon() || {};
  const ids = entitiesIn(`${m.name} ${m.generic}`, canon.evidence || []);
  const rows = related(canon.evidence || [], ids, 4);
  panel(m.name, `
    <dl class="facts"><dt>Generic</dt><dd>${esc(m.generic || '–')}</dd><dt>Dose and time</dt><dd>${esc(`${m.dose} ${m.timing}`.trim() || '–')}</dd>
    <dt>Last prescription</dt><dd>${esc(m.rx || 'Not on it')}</dd><dt>For</dt><dd>${esc(m.purpose || '–')}</dd></dl>
    ${m.differs ? '<p class="answer-box">Your list and your last written prescription differ here. Ask the doctor who prescribes it to confirm which is right. Do not change a dose until they do.</p>' : ''}
    ${evidenceHtml(rows)}
    ${askButton(`About ${m.name}: is there anything I should know or ask?`)}
    ${sheetLine('Medications')}`, wireAsk);
}

function resultPanel(c) {
  const canon = ctx.canon() || {};
  const rows = related(canon.evidence || [], entitiesIn(c.def.label, canon.evidence || []), 3);
  panel(c.def.label, `
    <div class="big-spark">${spark(c.points, { w: 520, h: 120, band: c.last.range })}</div>
    <table class="medtab"><thead><tr><th>Date</th><th>Result</th></tr></thead><tbody>${[...c.points].reverse().map(p => `<tr><td>${esc(fmtDate(p.date, { year: true }))}</td><td>${p.below ? '<' : p.above ? '>' : ''}${p.value} ${esc(c.def.unit)}</td></tr>`).join('')}</tbody></table>
    ${c.last.range ? `<p class="meta">Lab range ${c.last.range.low ?? ''}${c.last.range.low != null && c.last.range.high != null ? ' to ' : ''}${c.last.range.high ?? ''} ${esc(c.def.unit)}</p>` : ''}
    <p>${esc(c.def.plain)}</p>
    ${evidenceHtml(rows)}
    ${askButton(`What does my ${c.def.label} trend mean, in plain words?`)}
    ${sheetLine('TestResults')}`, wireAsk);
}

function questionsPanel(who) {
  const g = questionsByDoctor(ctx.canon() || {}).find(x => x.who === who);
  if (!g) return;
  panel(who, `<ol class="plan-steps">${g.questions.map(q => `<li>${esc(q.question)}</li>`).join('')}</ol>
    <button class="btn primary" data-brief>Make a summary for ${esc(who)}</button>${sheetLine('Questions')}`, (wrap, close) => {
    wrap.querySelector('[data-brief]').onclick = () => { close(); const doc = (ctx.canon()?.clinicians || []).find(c => who.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(who.toLowerCase())); ctx.shareBrief(doc ? doc.name : ''); };
  });
}

function gapPanel(id) {
  const g = (ctx.canon()?.gaps || []).find(x => x.id === id);
  if (!g) return;
  panel('To clear up', `<p>${esc(g.gap)}</p>${g.whatAnswersIt ? `<p class="meta">What settles it: ${esc(g.whatAnswersIt)}</p>` : ''}${g.stepToClose ? `<p class="answer-box">${esc(g.stepToClose)}</p>` : ''}
    <button class="btn" data-done>Mark as cleared up</button>${sheetLine('KnowledgeGaps')}`, (wrap, close) => {
    wrap.querySelector('[data-done]').onclick = async () => {
      close(); g.status = 'closed';
      const r = await ctx.save('gap', { id, status: 'closed' });
      ctx.toast(r.ok ? 'Marked as cleared up' : 'Saved on this device, will sync');
      renderDashboard(root, ctx);
    };
  });
}
