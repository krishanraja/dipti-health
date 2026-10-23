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
const MAX_LABELLED = 12;

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
      <button role="tab" data-tab="map" aria-selected="${tab === 'map'}">How it connects${n ? ` (${n})` : ''}</button>
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
function mapView(box, z) {
  const links = z.links;
  if (!links.length) {
    box.innerHTML = `<section class="zsec map-empty"><p class="kicker">How it connects</p>
      <p>Nothing in ${yours()} research pack links ${esc(z.short.toLowerCase())} to the rest of ${yours()} record.</p>
      <p class="soft">So you can look at it on its own. If it changes, ${esc(DOCTOR.name)} can help you think it through.</p></section>`;
    return;
  }
  const kinds = Object.keys(KINDS).filter(k => links.some(l => l.kind === k));
  if (filter === null) filter = links.length > MAX_LABELLED ? kinds[0] : 'all';
  box.innerHTML = `<section class="zsec map-sec">
    <div class="map-top"><p class="kicker">How it connects</p></div>
    ${links.length > MAX_LABELLED
      ? `<div class="chips" role="group" aria-label="Show"><button class="mchip" data-f="all" aria-pressed="${filter === 'all'}">All ${links.length}</button>${kinds.map(k => `<button class="mchip k-${k}" data-f="${k}" aria-pressed="${filter === k}"><i></i>${esc(KINDS[k])} ${links.filter(l => l.kind === k).length}</button>`).join('')}</div>`
      : `<div class="chips legend">${kinds.map(k => `<span class="mchip k-${k}"><i></i>${esc(KINDS[k])}</span>`).join('')}</div>`}
    <div class="map-box"></div>
    <div class="linkcard" aria-live="polite"></div>
  </section>`;
  box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
    filter = b.dataset.f; node = null; mapView(box, z);
  });
  const mb = box.querySelector('.map-box'), card = box.querySelector('.linkcard');
  const shown = filter === 'all' ? links : links.filter(l => l.kind === filter);
  const draw = () => {
    mb.innerHTML = mapSvg(z, shown, mb.clientWidth, mb.clientHeight, filter === 'all' && links.length > MAX_LABELLED);
    mb.querySelectorAll('[data-n]').forEach(g => {
      const choose = () => { node = g.dataset.n; draw(); };
      g.onclick = choose;
      g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } };
    });
    linkCard(card, z, shown.find(l => l.id === node));
  };
  let size = '';
  const ro = new ResizeObserver(() => {
    if (!mb.isConnected) return ro.disconnect();
    const s = `${mb.clientWidth}x${mb.clientHeight}`;
    if (s !== size) { size = s; requestAnimationFrame(draw); }
  });
  ro.observe(mb);
}

function linkCard(card, z, l) {
  if (!l) {
    const c = z.counts;
    const parts = Object.keys(KINDS).filter(k => c[k]).map(k => `${c[k]} ${KINDS[k].toLowerCase().replace('how you feel', c[k] === 1 ? 'thing you feel' : 'things you feel').replace(/s$/, c[k] === 1 ? '' : 's')}`);
    card.className = 'linkcard hint';
    card.innerHTML = `<p><b>${esc(z.short)}</b> links to ${esc(parts.join(', '))} in ${yours()} record.</p><small>Tap a dot to see how.</small>`;
    return;
  }
  const s = linkStory(l);
  card.className = `linkcard k-${l.kind}`;
  card.innerHTML = `<small>${esc(KINDS[l.kind])}</small><b>${esc(l.label)}</b>${s.plain ? `<p>${esc(s.plain)}</p>` : ''}
    ${s.ask ? `<p class="la"><b>Worth asking:</b> ${esc(s.ask)}</p>` : ''}
    <div class="lc-actions">${s.ask ? `<button class="pill" data-lask>Ask ${esc(DOCTOR.first)} this</button>` : ''}${s.more ? `<small>Linked ${s.more + 1} ways in ${yours()} research pack</small>` : ''}</div>`;
  card.querySelector('[data-lask]')?.addEventListener('click', () => ctx.openAsk(s.ask));
}

// Radial map: the condition in the middle, each link round it, labels set
// outside the ring. Sized from the box, so it always fits.
const fitText = (s, max) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s);
function mapSvg(z, nodes, w, h, dotsOnly) {
  if (!w || !h) return '';
  const small = w < 360;
  const fs = small ? 11 : 12.5;
  const chars = small ? 13 : 18;
  const labels = nodes.map(n => fitText(n.label.replace(/\s*\((stopped|earlier|past)\)/, ''), chars));
  const lw = dotsOnly ? 0 : Math.min(Math.max(...labels.map(l => l.length)) * fs * 0.56, w * 0.3);
  const R = Math.max(40, Math.min(w / 2 - lw - 20, h / 2 - 24));
  const cx = w / 2, cy = h / 2;
  const hubR = Math.max(26, Math.min(48, R * 0.38));
  const words = z.short.split(/\s+/);
  const lines = words.length > 1 && z.short.length > 9 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [z.short];
  const longest = Math.max(...lines.map(l => l.length));
  const hfs = Math.max(8.5, Math.min(13, (hubR * 2 - 10) / (longest * 0.58)));
  const pos = nodes.map((n, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / nodes.length; return [cx + R * Math.cos(a), cy + R * Math.sin(a), a]; });
  let s = `<svg class="map" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="How ${esc(z.short)} connects to ${nodes.length} things in the record">`;
  nodes.forEach((n, i) => { s += `<line x1="${cx}" y1="${cy}" x2="${pos[i][0].toFixed(1)}" y2="${pos[i][1].toFixed(1)}" class="${n.id === node ? 'on' : ''}"/>`; });
  s += `<circle cx="${cx}" cy="${cy}" r="${hubR.toFixed(1)}" class="hub"/>`;
  lines.forEach((l, i) => { s += `<text x="${cx}" y="${(cy + (i - (lines.length - 1) / 2) * hfs * 1.15 + hfs * 0.35).toFixed(1)}" text-anchor="middle" class="hubt" style="font-size:${hfs.toFixed(1)}px">${esc(l)}</text>`; });
  nodes.forEach((n, i) => {
    const [x, y, a] = pos[i], on = n.id === node;
    const right = Math.cos(a) > 0.2, left = Math.cos(a) < -0.2;
    const tx = x + (right ? 15 : left ? -15 : 0), ty = y + (right || left ? fs * 0.35 : Math.sin(a) > 0 ? fs + 13 : -15);
    s += `<g class="mn k-${n.kind}${on ? ' sel' : ''}" data-n="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.label)}, ${esc(KINDS[n.kind])}">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="20" class="hit"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${on ? 12 : 9}" class="md"/>
      ${dotsOnly && !on ? '' : `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${right ? 'start' : left ? 'end' : 'middle'}" style="font-size:${fs}px">${esc(labels[i])}</text>`}</g>`;
  });
  return s + '</svg>';
}
