// Conditions: think about one condition on its own, then see how it connects
// to the rest of her record. Phone: the list, then one condition with two
// views (On its own, How it connects). Wide screens: list, the condition and
// its map side by side. Nothing scrolls: lists page, the map sizes to its box.
import { conditionList, zoom, linkStory, KINDS, GROUPS } from './conditions-model.js';
import { fmtDate, parseDate, cardLabel } from './metrics.js';
import { pager } from './pager.js';
import { DOCTOR } from './persona.js';

let ctx, root, sel = null, tab = 'own', node = null, filter = null;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BACK = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

export function mountConditions(el, context) { root = el; ctx = context; render(); }
export function refreshConditions() { if (root) render(); }
export function conditionsHome() { sel = null; if (root) render(); }
export function openCondition(id) { pick(id); }

const you = () => ctx.me().dipti;
const yours = () => (you() ? 'your' : "Dipti's");

function pick(id) { sel = id; tab = 'own'; node = null; filter = null; if (root) render(); }

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
    root.innerHTML = `<div class="rec-empty"><p class="kicker">Conditions</p><h3>${ctx.session().sheetConfigured === false ? 'The Sheet is not connected yet' : 'Loading your record'}</h3></div>`;
    return;
  }
  const groups = conditionList(canon);
  const all = groups.flatMap(g => g.items);
  if (!all.length) {
    root.innerHTML = `<div class="rec-empty"><p class="kicker">Conditions</p><h3>No conditions in the Sheet yet</h3><p class="soft">Add them in the Conditions tab and they appear here.</p></div>`;
    return;
  }
  if (sel && !all.some(c => c.id === sel)) sel = null;
  const wide = ctx.isWide();
  if (wide && !sel) sel = all[0].id;
  root.classList.toggle('wide', wide);
  if (wide) return renderWide(canon, groups);
  if (!sel) return renderList(groups);
  return renderZoom(canon);
}

/* ---------- the list ---------- */
function listItems(groups) {
  const items = [];
  groups.forEach(g => {
    items.push({ html: `<p class="kicker">${esc(g.label)}</p>`, keep: true });
    g.items.forEach(c => items.push({ html: `<button class="crow" data-c="${esc(c.id)}" ${c.id === sel ? 'aria-current="true"' : ''}>
      <span class="crow-top"><b>${esc(c.short)}</b>${c.priority ? `<i class="chip accent">Priority ${c.priority.n}</i>` : ''}</span>
      ${c.plain ? `<small class="crow-plain">${esc(c.plain.split(/(?<=\.)\s/)[0])}</small>` : ''}
      <span class="crow-meta">${c.countLine ? `${esc(c.countLine)} · ` : ''}${c.evidence === 'Doc' ? 'from a report' : you() ? 'you said' : 'Dipti said'}</span>
    </button>`, id: c.id }));
  });
  return items;
}

function wireList(body) {
  body.querySelectorAll('[data-c]').forEach(b => b.onclick = () => pick(b.dataset.c));
}

function renderList(groups) {
  root.innerHTML = `<div class="cv">
    <div class="hello"><h1>${you() ? 'Your' : "Dipti's"} conditions</h1><p>Tap one to look at it on its own, and see what it connects to.</p></div>
    <div class="cv-list"></div></div>`;
  pager(root.querySelector('.cv-list'), listItems(groups), { onRender: wireList, label: 'Conditions' });
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
  if (z.meds.length || z.results.length) {
    items.push({ html: `<section class="zsec"><p class="kicker">In ${yours()} record</p>
      ${z.meds.map(({ med }) => `<div class="zrow"><span><b>${esc(med.name)}</b>${med.generic ? ` <small>${esc(med.generic)}</small>` : ''}</span><small>${esc(`${med.dose} ${med.timing}`.trim())}</small></div>`).join('')}
      ${z.results.map(r => { const l = cardLabel(r); return `<div class="zrow"><span><b>${esc(r.def.short)}</b> <small>${esc(fmtDate(r.last.date, { year: true }))}</small></span><span>${r.points.slice(-3).map(p => `${p.below ? '<' : ''}${p.value}`).join(' → ')} <small>${esc(r.def.unit)}</small>${l.text ? ` <i class="chip ${l.tone}">${esc(l.text)}</i>` : ''}</span></div>`; }).join('')}
    </section>` });
  }
  if (z.questions.length) {
    items.push({ html: `<section class="zsec"><p class="kicker">Questions${z.doctor ? ' for ' + esc(z.doctor.name) : ''}</p>
      <ol class="plan-steps">${z.questions.slice(0, 3).map(q => `<li>${esc(q.question)}</li>`).join('')}</ol>
      ${z.questions.length > 3 ? `<button class="link" data-allq>All ${z.questions.length} questions ${CHEV}</button>` : ''}</section>` });
  }
  if (c.notes) items.push({ html: `<section class="zsec"><p class="kicker">From ${yours()} record</p><p class="soft">${esc(c.notes)}</p></section>` });
  return items;
}

function wireOwn(body) {
  body.querySelectorAll('[data-allq]').forEach(b => b.onclick = () => { ctx.go('record'); ctx.recordSpoke('questions'); });
}

function askAbout(z) {
  return `Tell me about my ${z.short.toLowerCase()} in plain words, and how it connects to the rest of my health.`;
}

function renderZoom(canon) {
  const z = zoom(canon, sel);
  const n = z.links.length;
  root.innerHTML = `<div class="cv zoom tab-${tab}">
    <button class="back" data-home>${BACK}Conditions</button>
    ${head(z)}
    <div class="seg2" role="tablist">
      <button role="tab" data-tab="own" aria-selected="${tab === 'own'}">On its own</button>
      <button role="tab" data-tab="map" aria-selected="${tab === 'map'}">How it connects${n ? ` <span class="seg-n">${n}</span>` : ''}</button>
    </div>
    <div class="cv-body"></div>
    <button class="btn primary" data-ask>Ask ${esc(DOCTOR.name)} about this</button>
  </div>`;
  root.querySelector('[data-home]').onclick = conditionsHome;
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; renderZoom(canon); });
  root.querySelector('[data-ask]').onclick = () => ctx.openAsk(askAbout(z));
  const box = root.querySelector('.cv-body');
  if (tab === 'own') pager(box, ownItems(z), { onRender: wireOwn, label: z.short });
  else mapView(box, z);
}

/* ---------- wide: list | condition | map ---------- */
function renderWide(canon, groups) {
  const z = zoom(canon, sel);
  root.innerHTML = `<div class="cdesk">
    <section class="ccol"><div class="hello"><h1>${you() ? 'Your' : "Dipti's"} conditions</h1><p>Pick one to look at it on its own.</p></div><div class="cv-list"></div></section>
    <section class="ccol">${head(z)}<div class="cv-body"></div><button class="btn primary" data-ask>Ask ${esc(DOCTOR.name)} about this</button></section>
    <section class="ccol map-col"><div class="cv-map"></div></section>
  </div>`;
  const items = listItems(groups);
  pager(root.querySelector('.cv-list'), items, { onRender: wireList, label: 'Conditions', start: Math.max(0, items.findIndex(i => i.id === sel)) });
  pager(root.querySelector('.cv-body'), ownItems(z), { onRender: wireOwn, label: z.short });
  root.querySelector('[data-ask]').onclick = () => ctx.openAsk(askAbout(z));
  mapView(root.querySelector('.cv-map'), z);
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
  if (!filter || (filter !== 'all' && !kinds.includes(filter))) filter = 'all';
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
    const c = z.counts;
    const parts = Object.keys(KINDS).filter(k => c[k]).map(k => `${c[k]} ${KINDS[k].toLowerCase().replace('how you feel', c[k] === 1 ? 'thing you feel' : 'things you feel').replace(/s$/, c[k] === 1 ? '' : 's')}`);
    card.className = 'linkcard hint';
    card.innerHTML = `<p><b>${esc(z.short)}</b> links to ${esc(parts.join(', '))} in ${yours()} record.</p><small>Click a dot to see how.</small>`;
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
