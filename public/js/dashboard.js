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
import { pager, autoPages } from './pager.js';
import { todayLine } from './care-model.js';

const PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
import { openSheet } from './record.js';
import { factsToday, nextAppointment, whenText } from './facts-model.js';

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
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  const AREAS = [['tooth', 'Tooth'], ['abdomen', 'Tummy'], ['fatigue', 'Tiredness']];
  const facts = factsToday(canon);
  const next = nextAppointment(canon);

  // Each column: fixed cards, plus one card that pages when the window is short.
  root.innerHTML = `<div class="dash">
    <section class="col">
      <div class="dash-hello"><p class="lbl">${esc(date)}${next ? ` · Next: ${esc(next.with)}, ${esc(whenText(next.date, next.time))}` : ''}</p><h1>${you ? 'Hello Dipti.' : `Hello ${esc(ctx.me().name || '')}.`}</h1><p class="lede">${esc(todayLine(canon))}</p></div>
      <article class="dcard flex prio-card">
        <p class="kicker">This week</p>
        <div class="dlist" data-list="prios"></div>
      </article>
      ${facts.length ? `<article class="dcard flex facts-card">
        <div class="dc-head"><p class="kicker">Still right?</p><span class="soft small">${facts.length} quick check${facts.length === 1 ? '' : 's'}</span></div>
        <div class="dlist" data-list="facts"></div>
      </article>` : ''}
      <article class="dcard">
        <div class="dc-head"><p class="kicker">Today's check-in</p>${checkedToday ? '<span class="ok-text">Done ✓</span>' : ''}</div>
        <div class="scores">${AREAS.map(([k, l]) => { const s = scoreSeries(canon, k); return `<div class="score-mini"><span>${l}</span><b>${s.length ? s[s.length - 1].value : '–'}<small>/10</small></b>${spark(s, { w: 90, h: 26, min: 0, max: 10 })}</div>`; }).join('')}</div>
        ${checkedToday ? '' : '<button class="btn primary" data-check>Check in now (30 seconds)</button>'}
        <div class="row"><button class="btn" data-add>${PEN}Write an update</button><button class="btn" data-log>Log a symptom</button></div>
      </article>
    </section>

    <section class="col">
      <article class="dcard flex">
        <div class="dc-head"><p class="kicker">Medicines now</p>${meds.differ ? '<span class="soft small">A few to confirm with the prescriber</span>' : ''}</div>
        <div class="medrow medhead"><span>Medicine</span><span>Dose and time</span><span>For</span></div>
        <div class="dlist" data-list="meds"></div>
        ${meds.stopped.length ? `<button class="link" data-more="medicines">Medicines you have stopped ${CHEV}</button>` : ''}
      </article>
      <article class="dcard flex">
        <p class="kicker">Questions, by doctor</p>
        <div class="dlist" data-list="qs"></div>
      </article>
    </section>

    <section class="col">
      <article class="dcard flex">
        <p class="kicker">Results over time</p>
        <div class="dlist" data-list="results"></div>
      </article>
      <article class="dcard flex">
        <p class="kicker">To tidy up <span class="soft small">· nothing urgent</span></p>
        <div class="dlist" data-list="gaps"></div>
      </article>
    </section>
  </div>`;

  const lists = {
    prios: pr.map((p, i) => `<button class="dp" data-p="${esc(p.id)}">
      <span class="dp-top"><b>${esc(String(p.title).replace(/\s*\(.*\)\s*$/, ''))}</b><i class="ctag ${p.status === 'waiting' ? 'wait' : p.status === 'better' ? 'ok' : 'hand'}">${p.status === 'waiting' ? 'Waiting' : p.status === 'better' ? 'Getting better' : 'In hand'}</i></span>
      ${p.nextStep ? `<span class="dp-next">${i === 0 ? '<span class="lbl">Today\'s one step</span> ' : ''}${esc(p.nextStep)}</span>` : ''}
    </button>`),
    meds: meds.current.map((m, i) => `<button class="medrow" data-m="${i}"><span><b>${esc(m.name)}</b>${m.generic ? `<small>${esc(m.generic)}</small>` : ''}</span><span>${esc(`${m.dose} ${m.timing}`.trim())}${m.differs ? `<small class="ask">Prescription: ${esc(m.rx || 'not on it')}</small>` : ''}</span><span>${esc(String(m.purpose || '').split(/[.;]\s/)[0])}</span></button>`),
    qs: qg.map(g => `<button class="dq" data-q="${esc(g.who)}"><b>${esc(g.who)}</b><span>${esc(g.questions[0].question)}</span>${g.questions.length > 1 ? '<small>and more for later</small>' : ''}</button>`),
    results: cards.map(c => `<button class="tr" data-r="${c.key}">
      <span class="tr-l"><b>${esc(c.def.short)}</b><small>${esc(fmtDate(c.last.date, { year: true }))}</small></span>
      ${spark(c.points, { band: c.last.range })}
      <span class="tr-v"><b>${c.last.below ? '<' : ''}${c.last.value}</b><small>${esc(c.def.unit)}</small></span>
      <i class="ctag ${['ok', 'accent'].includes(cardLabel(c).tone) ? 'ok' : 'quiet'}">${esc(cardLabel(c).text || 'One reading')}</i>
    </button>`),
  };
  lists.facts = facts.map((f, i) => `<button class="dq" data-fact="${i}"><span>${esc(f.question)}</span>${f.says ? `<small>${esc(f.says)}</small>` : ''}</button>`);
  lists.gaps = gaps.map(g => `<button class="dq" data-g="${esc(g.id)}"><span>${esc(g.gap)}</span></button>`);
  const EMPTY = { facts: 'All checked.', gaps: 'Nothing open.', prios: 'No priorities yet. Add them in the Priorities tab of the Sheet.', meds: 'No medicines in the Sheet yet.', qs: 'No open questions.', results: 'No results yet.' };
  root.querySelectorAll('[data-list]').forEach(el => {
    const k = el.dataset.list;
    pager(el, (lists[k].length ? lists[k] : [`<p class="soft">${EMPTY[k]}</p>`]).map(html => ({ html })), { label: k });
  });

  // One delegated listener: list items are redrawn on every page turn.
  root.onclick = e => {
    if (e.target.closest('[data-add]')) return ctx.openConsole?.('journal');
    const t = e.target.closest('[data-fact], [data-p], [data-check], [data-log], [data-meds], [data-q], [data-g], [data-m], [data-r], [data-more]');
    if (!t) return;
    const d = t.dataset;
    if (d.fact !== undefined) ctx.factFlow(facts.slice(+d.fact));
    else if (d.p !== undefined) ctx.openPriority(d.p);
    else if (d.check !== undefined) ctx.startCheckin();
    else if (d.log !== undefined) ctx.logSymptom();
    else if (d.meds !== undefined) ctx.tablets();
    else if (d.q !== undefined) questionsPanel(d.q);
    else if (d.g !== undefined) gapPanel(d.g);
    else if (d.m !== undefined) medPanel(meds.current[+d.m]);
    else if (d.r !== undefined) resultPanel(cards.find(c => c.key === d.r));
    else if (d.more !== undefined) { ctx.go('record'); ctx.recordSpoke?.(d.more); }
  };
}

/* ---------- side panel ---------- */
// body: the detail, one block per child, paged to fit. foot: the actions,
// always visible under it.
function panel(title, body, mount, foot = '') {
  document.querySelector('.panel-wrap')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'panel-wrap';
  wrap.innerHTML = `<aside class="panel" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="panel-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="panel-body" data-pages="${esc(title)}">${body}</div>${foot ? `<div class="panel-foot">${foot}</div>` : ''}</aside>`;
  document.body.appendChild(wrap);
  autoPages(wrap);
  wrap.addEventListener('click', e => { const ev = e.target.closest('[data-ev]'); if (ev) evidenceSheet(ev.dataset.ev); });
  const close = () => wrap.remove();
  wrap.onclick = e => { if (e.target === wrap) close(); };
  wrap.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  const onKey = e => { if (e.key === 'Escape') { close(); removeEventListener('keydown', onKey); } };
  addEventListener('keydown', onKey);
  mount?.(wrap, close);
}

function sheetLine(tab) {
  const url = ctx.canon()?.sheetUrl;
  return url ? `<a class="link" href="${esc(url)}" target="_blank" rel="noopener">Open the ${esc(tab)} tab</a>` : '';
}

// The detail behind one research-pack row, on its own sheet.
function evidenceSheet(id) {
  const canon = ctx.canon() || {};
  const r = (canon.evidence || []).find(x => x.id === id);
  if (!r) return;
  const src = sourcesFor(r, canon.sources || []).slice(0, 3);
  openSheet(`<p class="kicker">From your research pack</p><h3 class="sheet-title">${esc(r.askPlain || r.ask || r.plain || 'Background')}</h3>
    <div data-pages="Detail">${String(r.text || '').split(/(?<=\.)\s+(?=[A-Z])/).reduce((a, x) => { const l = a[a.length - 1]; if (l && (l + x).length < 260) a[a.length - 1] = l + ' ' + x; else a.push(x); return a; }, []).map(x => `<p>${esc(x)}</p>`).join('')}
    ${src.length ? `<p class="meta">${src.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title.slice(0, 70))}</a>`).join(' · ')}</p>` : ''}</div>
    <p class="meta">${esc(WHEN_TO_RAISE[r.severity] || 'Background')}${r.grade ? ' · ' + esc(GRADE_LABEL[r.grade] || 'Grade ' + r.grade) : ''}</p>
    <button class="btn primary" data-close>Close</button>`);
}

// Research-pack rows behind something, told calmly: when to raise it, and how strong the evidence is.
function evidenceHtml(rows) {
  const canon = ctx.canon() || {};
  // Lists of possible causes are for the doctor's reasoning, not for this panel.
  rows = rows.filter(r => r.kind !== 'symptom_attribution' && r.kind !== 'name');
  if (!rows.length) return '';
  return `<p class="kicker" data-keep>From your research pack</p>${rows.slice(0, 4).map(r => {
    const ask = r.askPlain || r.ask;
    return `<button class="evd" data-ev="${esc(r.id)}">${ask ? `<b>Worth asking: ${esc(ask)}</b>` : `<b>${esc(r.plain && r.kind === 'interaction' ? r.plain : r.kind === 'medication' || r.kind === 'lab' ? 'Notes on this from the research' : 'Background from the research')}</b>`}<small>${esc(WHEN_TO_RAISE[r.severity] || 'Background')}${r.grade ? ' · ' + esc(GRADE_LABEL[r.grade] || 'Grade ' + r.grade) : ''} · tap for the detail</small></button>`;
  }).join('')}`;
}

function askButton(text) { return `<button class="btn primary grow" data-askdoc="${esc(text)}">Ask ${esc(DOCTOR.name)} about this</button>`; }
function wireAsk(wrap, close) { wrap.querySelector('[data-askdoc]')?.addEventListener('click', e => { close(); ctx.openAsk(e.target.dataset.askdoc); }); }

function medPanel(m) {
  const canon = ctx.canon() || {};
  const ids = entitiesIn(`${m.name} ${m.generic}`, canon.evidence || []);
  const rows = related(canon.evidence || [], ids, 4);
  panel(m.name, `
    <dl class="facts"><dt>Generic</dt><dd>${esc(m.generic || '–')}</dd><dt>Dose and time</dt><dd>${esc(`${m.dose} ${m.timing}`.trim() || '–')}</dd>
    <dt>Last prescription</dt><dd>${esc(m.rx || 'Not on it')}</dd><dt>For</dt><dd>${esc(m.purpose || '–')}</dd></dl>
    ${m.differs ? '<p class="answer-box">Your list and your last written prescription differ here. Ask the doctor who prescribes it to confirm which is right. Do not change a dose until they do.</p>' : ''}
    ${evidenceHtml(rows)}`, wireAsk, `${askButton(`About ${m.name}: is there anything I should know or ask?`)}${sheetLine('Medications')}`);
}

function resultPanel(c) {
  const canon = ctx.canon() || {};
  const rows = related(canon.evidence || [], entitiesIn(c.def.label, canon.evidence || []), 3);
  panel(c.def.label, `
    <div class="big-spark">${spark(c.points, { w: 520, h: 120, band: c.last.range })}</div>
    <p>${esc(c.def.plain)}${c.last.range ? ` <span class="meta">Lab range ${c.last.range.low ?? ''}${c.last.range.low != null && c.last.range.high != null ? ' to ' : ''}${c.last.range.high ?? ''} ${esc(c.def.unit)}.</span>` : ''}</p>
    ${[...c.points].reverse().map(p => `<div class="prow"><span>${esc(fmtDate(p.date, { year: true }))}</span><b>${p.below ? '<' : p.above ? '>' : ''}${p.value} ${esc(c.def.unit)}</b></div>`).join('')}
    ${evidenceHtml(rows)}`, wireAsk, `${askButton(`What does my ${c.def.label} trend mean, in plain words?`)}${sheetLine('TestResults')}`);
}

function questionsPanel(who) {
  const g = questionsByDoctor(ctx.canon() || {}).find(x => x.who === who);
  if (!g) return;
  panel(who, g.questions.map((q, i) => `<p class="qline"><span class="prio-n">${i + 1}</span>${esc(q.question)}</p>`).join(''), (wrap, close) => {
    wrap.querySelector('[data-brief]').onclick = () => { close(); const doc = (ctx.canon()?.clinicians || []).find(c => who.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(who.toLowerCase())); ctx.shareBrief(doc ? doc.name : ''); };
  }, `<button class="btn primary grow" data-brief>Write a note to ${esc(who.replace(/\s*\(.*\)\s*$/, ''))}</button>${sheetLine('Questions')}`);
}

function gapPanel(id) {
  const g = (ctx.canon()?.gaps || []).find(x => x.id === id);
  if (!g) return;
  panel('To clear up', `<p>${esc(g.gap)}</p>${g.whatAnswersIt ? `<p class="meta">What settles it: ${esc(g.whatAnswersIt)}</p>` : ''}${g.stepToClose ? `<p class="answer-box">${esc(g.stepToClose)}</p>` : ''}`, (wrap, close) => {
    wrap.querySelector('[data-done]').onclick = async () => {
      close(); g.status = 'closed';
      const r = await ctx.save('gap', { id, status: 'closed' });
      ctx.toast(r.ok ? 'Marked as cleared up' : 'Saved on this device, will sync');
      renderDashboard(root, ctx);
    };
  }, `<button class="btn primary grow" data-done>Mark as cleared up</button>${sheetLine('KnowledgeGaps')}`);
}
