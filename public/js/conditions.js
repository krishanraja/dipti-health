// Conditions: think about one condition on its own, then see how it connects
// to the rest of her record. Phone: the list, then one condition with two
// views (On its own, How it connects). Wide screens: list, the condition and
// its map side by side. Nothing scrolls: lists page, the map sizes to its box.
import { zoom, linkStory, KINDS, GROUPS } from './conditions-model.js';
import { careAreas, areaOf, storyFor } from './care-model.js';
import { questionsByDoctor } from './record-model.js';
import { openPriority } from './today.js';
import { fmtDate, parseDate, cardLabel } from './metrics.js';
import { pager } from './pager.js';
import { DOCTOR } from './persona.js';

let ctx, root, sel = null, area = null, tab = 'own', node = null, filter = null;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BACK = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

export function mountConditions(el, context) { root = el; ctx = context; render(); }
export function refreshConditions() { if (root) render(); }
export function conditionsHome() { sel = null; area = null; if (root) render(); }
export function openCondition(id) { pick(id); }

const you = () => ctx.me().dipti;
const yours = () => (you() ? 'your' : "Dipti's");

function pick(id) {
  sel = id; tab = 'own'; node = null; filter = null;
  const c = (ctx.canon()?.conditions || []).find(x => (x.key || 'C:' + String(x.name).toLowerCase()) === id);
  if (c) area = areaOf(c).id;
  if (root) render();
}
function pickArea(id) { area = id; sel = null; tab = 'own'; node = null; filter = null; if (root) render(); }

function since(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  if (/^\d{4}$/.test(t)) return t;
  const p = parseDate(t);
  return p ? fmtDate(t, { year: true }).replace(/^\d+ /, '') : t;
}

function render() {
  const canon = ctx.canon();
  if (!canon) {
    root.innerHTML = `<div class="rec-empty"><p class="kicker">My care</p><h3>${ctx.session().sheetConfigured === false ? 'The Sheet is not connected yet' : 'Loading your record'}</h3></div>`;
    return;
  }
  const areas = careAreas(canon);
  if (!areas.length) {
    root.innerHTML = `<div class="rec-empty"><p class="kicker">My care</p><h3>Nothing in the Sheet yet</h3><p class="soft">Add conditions in the Conditions tab and they appear here.</p></div>`;
    return;
  }
  if (area && !areas.some(a => a.id === area)) area = null;
  const all = areas.flatMap(a => a.conditions);
  if (sel && !all.some(c => c.id === sel)) sel = null;
  const wide = ctx.isWide();
  if (wide && !area) area = areas[0].id;
  root.classList.toggle('wide', wide);
  if (wide) return renderWide(canon, areas);
  if (sel) return renderZoom(canon, areas);
  if (area) return renderArea(canon, areas.find(a => a.id === area));
  return renderAreas(areas);
}

/* ---------- the areas ---------- */
const AREA_ICON = {
  tooth: '<path d="M7 4c-2 0-3 2-3 4 0 3 1 4 1.5 7S7 20 8.5 20 10 16 12 16s2 4 3.5 4 2.5-2 3-5S20 11 20 8c0-2-1-4-3-4-2 0-3 1-5 1S9 4 7 4z"/>',
  gut: '<path d="M12 3c4 0 7 3 7 7 0 5-4 11-7 11s-7-6-7-11c0-4 3-7 7-7z"/><path d="M9 11c1 1.5 5 1.5 6 0"/>',
  drop: '<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/>',
  joint: '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M9 9l6 6"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>',
  leaf: '<path d="M5 19c8 0 14-6 14-14C11 5 5 11 5 19z"/><path d="M5 19l7-7"/>',
};
const icon = a => `<span class="area-ic" aria-hidden="true"><svg viewBox="0 0 24 24">${AREA_ICON[a.icon] || AREA_ICON.leaf}</svg></span>`;
const tag = t => `<i class="ctag ${t.tone}">${esc(t.text)}</i>`;

function areaItems(areas) {
  const items = [];
  const now = areas.filter(a => a.now), rest = areas.filter(a => !a.now);
  if (now.length) items.push({ html: '<p class="lbl">Being looked into now</p>', keep: true });
  now.forEach(a => items.push({ html: areaRow(a) }));
  if (rest.length) items.push({ html: '<p class="lbl">Known and looked after</p>', keep: true });
  rest.forEach(a => items.push({ html: areaRow(a) }));
  return items;
}
const areaRow = a => `<button class="area-row" data-area="${a.id}" ${a.id === area ? 'aria-current="true"' : ''}>${icon(a)}<span class="area-t"><b>${esc(a.label)}</b><small>${esc(a.summary)}</small></span>${tag(a.tag)}</button>`;

function renderAreas(areas) {
  root.innerHTML = `<div class="cv care">
    <div class="hello"><h1>${you() ? 'Your' : "Dipti's"} care</h1><p>Each part of ${you() ? 'you' : 'her'} has someone looking after it.</p></div>
    <div class="cv-list"></div></div>`;
  pager(root.querySelector('.cv-list'), areaItems(areas), { label: 'Care', onRender: b => b.querySelectorAll('[data-area]').forEach(x => x.onclick = () => pickArea(x.dataset.area)) });
}

// One area: who looks after it, what is next, and each condition in it.
function areaLede(a) {
  const who = a.doctor ? `Looked after by ${a.doctor}.` : `${you() ? 'You and your doctors keep' : 'Dipti and her doctors keep'} an eye on this.`;
  const now = !a.priority ? ' Nothing needs doing right now.' : a.priority.status === 'waiting' ? ' Right now this is waiting on one thing.' : ' There is one next step.';
  return who + now;
}
function areaBody(a) {
  return `${a.priority ? `<button class="next-card" data-prio="${esc(a.priority.id)}"><span class="lbl">What's next</span><b>${esc(a.priority.nextStep || a.priority.title)}</b></button>` : ''}
    <div class="area-list"></div>
    ${a.doctor ? `<div class="area-foot"><button class="btn quiet" data-note="${esc(a.doctor)}">Write a note to ${esc(a.doctor)}</button></div>` : ''}`;
}
// The area's page: its conditions, the story so far (newest first, a tap
// shows the whole note), and at most two questions for whoever looks after it.
function areaItems2(a) {
  const canon = ctx.canon() || {};
  const items = a.conditions.map(c => ({ html: `<button class="cond-row" data-c="${esc(c.id)}" ${c.id === sel ? 'aria-current="true"' : ''}><span class="area-t"><b>${esc(c.short)}</b>${c.line ? `<small>${esc(c.line)}</small>` : ''}</span>${tag(c.tag)}</button>` }));
  const story = storyFor(canon, a.id);
  if (story.length) {
    items.push({ html: '<p class="lbl story-h">The story so far</p>', keep: true });
    story.forEach((x, i) => items.push({ html: `<button class="story-row" data-story="${i}"><span class="story-when">${esc(x.ts ? fmtDate(x.ts, { year: true }) : '')}${x.ts ? ' · ' : ''}${esc(x.title)}</span><span class="story-text">${esc(x.text)}</span></button>` }));
  }
  const g = a.doctor ? questionsByDoctor(canon).filter(q => q.who.startsWith(a.doctor) || a.doctor.startsWith(q.who.split(' (')[0])) : [];
  const qs = g.flatMap(x => x.questions).sort((p, q) => (+p.priority || 9) - (+q.priority || 9)).slice(0, 2);
  if (qs.length) {
    items.push({ html: `<p class="lbl story-h">To ask ${esc(a.doctor)}</p>`, keep: true });
    qs.forEach(q => items.push({ html: `<p class="ask-row">${esc(q.question)}</p>` }));
  }
  return { items, story };
}
function wireArea(box, a) {
  const { items, story } = areaItems2(a);
  pager(box.querySelector('.area-list'), items, {
    label: a.label, onRender: b => {
      b.querySelectorAll('[data-c]').forEach(x => x.onclick = () => pick(x.dataset.c));
      b.querySelectorAll('[data-story]').forEach(x => x.onclick = () => {
        const n = story[+x.dataset.story];
        ctx.openSheet(`<p class="kicker">${esc(n.ts ? fmtDate(n.ts, { year: true }) + ' · ' : '')}${esc(n.title)}</p><h3 class="sheet-title">${esc(a.label)}</h3><div data-pages="Note">${n.text.split(/(?<=[.!?])\s+(?=[A-Z])/).reduce((acc, t) => { const last = acc[acc.length - 1]; if (last && (last + ' ' + t).length < 260) acc[acc.length - 1] = last + ' ' + t; else acc.push(t); return acc; }, []).map(t => `<p class="story-full">${esc(t)}</p>`).join('')}</div>
          <button class="btn primary" data-close>Done</button>`);
      });
    },
  });
  box.querySelector('[data-prio]')?.addEventListener('click', e => openPriority(e.currentTarget.dataset.prio));
  box.querySelector('[data-note]')?.addEventListener('click', e => {
    const name = e.currentTarget.dataset.note;
    const doc = (ctx.canon()?.clinicians || []).find(d => d.name.startsWith(name));
    ctx.shareBrief(doc ? doc.name : '');
  });
}
function renderArea(canon, a) {
  root.innerHTML = `<div class="cv care area-view">
    <button class="back" data-home>${BACK}${you() ? 'Your' : "Dipti's"} care</button>
    <div class="hello"><h1>${esc(a.label)}</h1><p>${esc(areaLede(a))}</p></div>
    ${areaBody(a)}</div>`;
  root.querySelector('[data-home]').onclick = conditionsHome;
  wireArea(root.querySelector('.area-view'), a);
}

/* ---------- one condition ---------- */
function head(z) {
  const full = z.cond.name !== z.short ? `<small class="z-full">In ${yours()} record as: ${esc(z.cond.name)}</small>` : '';
  return `<div class="zhead"><h2>${esc(z.short)}</h2>${z.cond.plain ? `<p>${esc(z.cond.plain)}</p>` : ''}${full}</div>`;
}

function ownItems(z) {
  const c = z.cond;
  const group = Object.fromEntries(GROUPS)[z.group];
  const items = [{ html: `<section class="zsec"><p class="kicker">Where it stands</p><dl class="zfacts">
    <dt>Status</dt><dd>${esc(group)}${z.priority ? ` · <b>priority ${z.priority.n}</b> for ${you() ? 'you' : 'her'} now` : ''}</dd>
    ${since(c.since) ? `<dt>Since</dt><dd>${esc(since(c.since))}</dd>` : ''}
    <dt>Comes from</dt><dd>${c.evidence === 'Doc' ? 'A lab or scan report' : you() ? 'What you said' : 'What Dipti said'}</dd>
    ${z.doctor ? `<dt>Looks after it</dt><dd>${esc(z.doctor.name)}</dd>` : ''}
  </dl></section>` }];
  // Medicines and results: the heading stays with its first row, and the
  // pager fits as many rows on a page as there is room for.
  const rows = [
    ...z.meds.map(({ med }) => `<div class="zrow"><span><b>${esc(med.name)}</b>${med.generic ? ` <small>${esc(med.generic)}</small>` : ''}</span><small>${esc(`${med.dose} ${med.timing}`.trim())}</small></div>`),
    ...z.results.map(r => { const l = cardLabel(r); return `<div class="zrow"><span><b>${esc(r.def.short)}</b> <small>${esc(fmtDate(r.last.date, { year: true }))}</small></span><span>${r.points.slice(-3).map(p => `${p.below ? '<' : ''}${p.value}`).join(' → ')} <small>${esc(r.def.unit)}</small>${l.text ? ` <i class="chip ${l.tone}">${esc(l.text)}</i>` : ''}</span></div>`; }),
  ];
  if (rows.length) {
    items.push({ html: `<p class="kicker zsec-h">In ${yours()} record</p>`, keep: true });
    rows.forEach(r => items.push({ html: `<div class="zsec zsec-row">${r}</div>` }));
  }
  if (z.questions.length) {
    items.push({ html: `<section class="zsec"><p class="kicker">Questions${z.doctor ? ' for ' + esc(z.doctor.name) : ''}</p>
      <ol class="plan-steps">${z.questions.slice(0, 2).map(q => `<li>${esc(q.question)}</li>`).join('')}</ol>
      ${z.questions.length > 2 ? `<button class="link" data-allq>More for later ${CHEV}</button>` : ''}</section>` });
  }
  // Long notes page in pieces of a few sentences, so each page fits.
  if (c.notes) {
    const parts = [], sent = String(c.notes).match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [c.notes];
    for (const x of sent) { if (!parts.length || (parts[parts.length - 1] + x).length > 240) parts.push(x.trim()); else parts[parts.length - 1] += ' ' + x.trim(); }
    parts.forEach((t, i) => items.push({ html: `<section class="zsec"><p class="kicker">From ${yours()} record${parts.length > 1 ? ` (${i + 1} of ${parts.length})` : ''}</p><p class="soft">${esc(t)}</p></section>` }));
  }
  return items;
}

function wireOwn(body) {
  body.querySelectorAll('[data-allq]').forEach(b => b.onclick = () => { ctx.go('record'); ctx.recordSpoke('questions'); });
}

function askAbout(z) {
  return `Tell me about my ${z.short.toLowerCase()} in plain words, and how it connects to the rest of my health.`;
}

// The two views of one condition. "What it's linked to" carries no count:
// a number of links reads as a number of problems.
const tabs = () => `<div class="seg2" role="tablist">
      <button role="tab" data-tab="own" aria-selected="${tab === 'own'}">What it is</button>
      <button role="tab" data-tab="map" aria-selected="${tab === 'map'}">What it's linked to</button>
    </div>`;

function renderZoom(canon, areas = careAreas(canon)) {
  const z = zoom(canon, sel);
  const a = areas.find(x => x.id === area);
  root.innerHTML = `<div class="cv zoom tab-${tab}">
    <button class="back" data-home>${BACK}${esc(a ? a.label : 'Your care')}</button>
    ${head(z)}
    ${tabs()}
    <div class="cv-body"></div>
    <button class="btn primary" data-ask>Ask ${esc(DOCTOR.first)} about this</button>
  </div>`;
  root.querySelector('[data-home]').onclick = () => { sel = null; render(); };
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; renderZoom(canon, areas); });
  root.querySelector('[data-ask]').onclick = () => ctx.openAsk(askAbout(z));
  const box = root.querySelector('.cv-body');
  if (tab === 'own') pager(box, ownItems(z), { onRender: wireOwn, label: z.short });
  else mapView(box, z);
}

/* ---------- wide: areas | the area | one condition ---------- */
// The areas lead; the panel follows the chosen area, and its right half
// follows the chosen condition (the first one until she picks).
function renderWide(canon, areas) {
  const a = areas.find(x => x.id === area) || areas[0];
  if (!sel || !a.conditions.some(c => c.id === sel)) sel = a.conditions[0]?.id || null;
  const z = sel ? zoom(canon, sel) : null;
  root.innerHTML = `<div class="cdesk care-desk">
    <nav class="ccol cside" aria-label="${you() ? 'Your' : "Dipti's"} care"><div class="hello"><h1>${you() ? 'Your' : "Dipti's"} care</h1><p>Each part of ${you() ? 'you' : 'her'} has someone looking after it.</p></div><div class="cv-list"></div></nav>
    <div class="cdetail" aria-live="polite">
      <section class="ccol area-col"><div class="hello"><h2>${esc(a.label)}</h2><p>${esc(areaLede(a))}</p></div>${areaBody(a)}</section>
      <section class="ccol cond-col tab-${tab}">${z ? `${head(z)}${tabs()}<div class="cv-body"></div><button class="btn primary" data-ask>Ask ${esc(DOCTOR.first)} about this</button>` : ''}</section>
    </div>
  </div>`;
  const items = areaItems(areas);
  pager(root.querySelector('.cv-list'), items, { label: 'Care', start: Math.max(0, items.findIndex(i => i.html.includes(`data-area="${a.id}"`))),
    onRender: b => b.querySelectorAll('[data-area]').forEach(x => x.onclick = () => pickArea(x.dataset.area)) });
  wireArea(root.querySelector('.area-col'), a);
  if (!z) return;
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
  root.querySelector('[data-ask]').onclick = () => ctx.openAsk(askAbout(z));
  const box = root.querySelector('.cond-col .cv-body');
  if (tab === 'own') pager(box, ownItems(z), { onRender: wireOwn, label: z.short });
  else mapView(box, z);
}

/* ---------- the map ---------- */
// How it connects. The map takes the panel; the kind chips filter it. On a
// phone a tap opens the link's story in a sheet (with previous and next);
// on a wide screen the story sits under the map.
function mapView(box, z) {
  const links = z.links;
  if (!links.length) {
    box.innerHTML = `<section class="zsec map-empty"><p class="kicker">How it connects</p>
      <p>Nothing in ${yours()} research pack links ${esc(z.short.toLowerCase())} to the rest of ${yours()} record.</p>
      <p class="soft">So you can look at it on its own. If it changes, ${esc(DOCTOR.name)} can help you think it through.</p></section>`;
    return;
  }
  const wide = ctx.isWide();
  const kinds = Object.keys(KINDS).filter(k => links.some(l => l.kind === k));
  const count = k => links.filter(l => l.kind === k).length;
  // Medicines first: the links she can act on. Everything else is one tap away.
  if (!filter || (filter !== 'all' && !kinds.includes(filter))) filter = kinds.includes('med') ? 'med' : kinds.length > 1 ? 'all' : kinds[0];
  box.innerHTML = `<section class="zsec map-sec ${wide ? 'wide' : ''}">
    <div class="chips" role="group" aria-label="Show">${kinds.length > 1 ? `<button class="mchip" data-f="all" aria-pressed="${filter === 'all'}">All ${links.length}</button>` : ''}${kinds.map(k => `<button class="mchip k-${k}" data-f="${k}" aria-pressed="${filter === k || kinds.length === 1}" aria-label="${esc(KINDS[k])}, ${count(k)}"><i></i>${esc(CHIP[k])} ${count(k)}</button>`).join('')}</div>
    <div class="map-box"></div>
    ${wide ? '<div class="linkcard" aria-live="polite"></div>' : `<p class="map-hint">Tap a dot to see how it links to ${esc(z.short.toLowerCase())}.</p>`}
  </section>`;
  box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; node = null; mapView(box, z); });
  const mb = box.querySelector('.map-box'), card = box.querySelector('.linkcard');
  const shown = () => (filter === 'all' ? links : links.filter(l => l.kind === filter));
  const draw = () => {
    const list = shown();
    // "All" with too many to label clearly: start on the biggest group instead.
    if (filter === 'all' && !fitsAll(list.length, mb.clientHeight) && kinds.length > 1) {
      filter = kinds.reduce((a, k) => (count(k) > count(a) ? k : a), kinds[0]);
      return mapView(box, z);
    }
    mb.innerHTML = mapSvg(z, list, mb.clientWidth, mb.clientHeight);
    mb.querySelectorAll('[data-n]').forEach(g => {
      const choose = () => {
        node = g.dataset.n;
        if (wide) { draw(); return; }
        mb.querySelectorAll('.mn').forEach(x => x.classList.toggle('sel', x === g));
        linkSheet(z, list, list.findIndex(l => l.id === node));
      };
      g.onclick = choose;
      g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } };
    });
    if (card) linkCard(card, z, list.find(l => l.id === node));
  };
  let size = '';
  const ro = new ResizeObserver(() => {
    if (!mb.isConnected) return ro.disconnect();
    const s = `${mb.clientWidth}x${mb.clientHeight}`;
    if (s !== size) { size = s; requestAnimationFrame(draw); }
  });
  ro.observe(mb);
}

const ROW_MIN = 30;
// Short names for the filter chips, so they sit on one or two lines.
const CHIP = { med: 'Medicines', result: 'Results', condition: 'Conditions', symptom: 'Symptoms' };
const fitsAll = (n, h) => !h || (h - 16) / Math.ceil(n / 2) >= ROW_MIN;

function storyHtml(l) {
  const s = linkStory(l);
  return `<p class="kicker k-${l.kind}"><i class="kdot"></i>${esc(KINDS[l.kind])}</p><h3 class="sheet-title">${esc(l.label)}</h3>
    ${s.plain ? `<p class="ls-plain">${esc(s.plain)}</p>` : ''}
    ${s.ask ? `<div class="answer-box"><p class="kicker">Worth asking</p><p>${esc(s.ask)}</p></div>` : ''}
    ${s.more ? `<p class="meta">Linked ${s.more + 1} ways in ${yours()} research pack.</p>` : ''}`;
}

// One link's story in a sheet, with previous and next so she can read them all.
function linkSheet(z, list, i) {
  ctx.openSheet(`<div class="ls-body"></div><div class="row ls-nav">
      <button class="btn" data-prev aria-label="Previous link"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <button class="btn primary" data-lask>Ask ${esc(DOCTOR.first)} this</button>
      <button class="btn" data-next aria-label="Next link"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div>`, (sheet, close) => {
    const show = j => {
      i = (j + list.length) % list.length;
      const l = list[i], s = linkStory(l);
      sheet.querySelector('.ls-body').innerHTML = storyHtml(l);
      const ask = sheet.querySelector('[data-lask]');
      ask.hidden = !s.ask;
      ask.onclick = () => { close(); ctx.openAsk(s.ask); };
      node = l.id;
      document.querySelectorAll('#conds .mn').forEach(x => x.classList.toggle('sel', x.dataset.n === l.id));
    };
    sheet.querySelector('[data-prev]').onclick = () => show(i - 1);
    sheet.querySelector('[data-next]').onclick = () => show(i + 1);
    sheet.querySelectorAll('[data-prev], [data-next]').forEach(b => { b.hidden = list.length < 2; });
    show(i);
  });
}

function linkCard(card, z, l) {
  if (!l) {
    card.className = 'linkcard hint';
    card.innerHTML = `<p>The parts of ${yours()} record your doctors think about together with <b>${esc(z.short.toLowerCase())}</b>.</p><small>Click a dot to see how.</small>`;
    return;
  }
  const s = linkStory(l);
  card.className = `linkcard k-${l.kind}`;
  card.innerHTML = `${storyHtml(l)}${s.ask ? `<div class="lc-actions"><button class="btn primary" data-lask>Ask ${esc(DOCTOR.first)} this</button></div>` : ''}`;
  card.querySelector('[data-lask]')?.addEventListener('click', () => ctx.openAsk(s.ask));
}

// Two-column map: the condition in the middle, its links in two columns
// either side, each label on its own row so nothing overlaps. Sized from the
// box, so it always fits.
function mapSvg(z, nodes, w, h) {
  if (!w || !h || !nodes.length) return '';
  const fs = w < 360 ? 12 : 13.5;
  const half = Math.ceil(nodes.length / 2);
  const cols = [nodes.slice(0, half), nodes.slice(half)];
  const rows = Math.max(cols[0].length, cols[1].length);
  const pad = 10, rowH = Math.min(56, (h - pad * 2) / rows);
  const cx = w / 2, cy = h / 2;
  const hubR = Math.max(28, Math.min(46, w * 0.11, h * 0.2));
  const gap = Math.max(26, Math.min(48, w * 0.08));
  const dx = hubR + gap;
  const room = cx - dx - 14 - pad;
  const maxChars = Math.max(6, Math.floor(room / (fs * 0.56)));
  const fitText = t => (t.length > maxChars ? t.slice(0, maxChars - 1).trimEnd() + '…' : t);
  // A long label takes two lines when the row has room, before it is ever cut.
  const twoLines = rowH >= fs * 2.7;
  const labelLines = t => {
    if (t.length <= maxChars || !twoLines) return [fitText(t)];
    const w = t.split(' '); let a = '';
    while (w.length && (a + ' ' + w[0]).trim().length <= maxChars) a = (a + ' ' + w.shift()).trim();
    if (!a) return [fitText(t)];
    return [a, fitText(w.join(' '))];
  };
  const words = z.short.split(/\s+/);
  const lines = words.length > 1 && z.short.length > 9 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [z.short];
  const longest = Math.max(...lines.map(l => l.length));
  const hfs = Math.max(9, Math.min(13.5, (hubR * 2 - 10) / (longest * 0.58)));
  let paths = '', dots = '';
  cols.forEach((col, side) => {
    const sign = side === 0 ? -1 : 1, x = cx + sign * dx;
    const top = cy - (col.length - 1) * rowH / 2;
    col.forEach((n, i) => {
      const y = top + i * rowH, on = n.id === node;
      const x0 = cx + sign * hubR * .92, mid = (x0 + x) / 2;
      paths += `<path d="M${x0.toFixed(1)} ${cy.toFixed(1)} C${mid.toFixed(1)} ${cy.toFixed(1)} ${mid.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}" class="ln${on ? ' on' : ''}" data-for="${esc(n.id)}"/>`;
      const label = labelLines(n.label.replace(/\s*\((stopped|earlier|past)\)/, ''));
      dots += `<g class="mn k-${n.kind}${on ? ' sel' : ''}" data-n="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.label)}, ${esc(KINDS[n.kind])}">
        <rect x="${side === 0 ? pad : x - 12}" y="${(y - rowH / 2).toFixed(1)}" width="${(cx - dx - pad + 24).toFixed(1)}" height="${rowH.toFixed(1)}" class="hit"/>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" class="md"/>
        <text x="${(x + sign * 14).toFixed(1)}" y="${(y + fs * 0.36 - (label.length - 1) * fs * 0.6).toFixed(1)}" text-anchor="${side === 0 ? 'end' : 'start'}" style="font-size:${fs}px">${label.map((t, k) => `<tspan x="${(x + sign * 14).toFixed(1)}" dy="${k ? fs * 1.2 : 0}">${esc(t)}</tspan>`).join('')}</text></g>`;
    });
  });
  let s = `<svg class="map" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="How ${esc(z.short)} connects to ${nodes.length} things in the record">${paths}`;
  s += `<circle cx="${cx}" cy="${cy}" r="${hubR.toFixed(1)}" class="hub"/>`;
  lines.forEach((l, i) => { s += `<text x="${cx}" y="${(cy + (i - (lines.length - 1) / 2) * hfs * 1.15 + hfs * 0.35).toFixed(1)}" text-anchor="middle" class="hubt" style="font-size:${hfs.toFixed(1)}px">${esc(l)}</text>`; });
  return s + dots + '</svg>';
}
