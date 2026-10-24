// No-scroll proof. Walks every screen, list page, sheet, panel and flow at
// phone, tablet and desktop sizes (portrait and landscape) and fails if
// anything scrolls, is cut off, or sits outside the window. Two places may
// scroll: the chat thread, and the long-note editor (a spoken update can run
// for pages).
//
// Usage: node scripts/noscroll.mjs <base url> [shots dir] [--quick] [--only=320x568,844x390]
// Run it against the dev server: MOCK_SHEET=1 MOCK_AI=1 node scripts/dev-server.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node-tools/node_modules/playwright');

const BASE = process.argv[2] || 'http://localhost:3000';
const SHOTS = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null;
const QUICK = process.argv.includes('--quick');
const VIEWPORTS = [
  [320, 568], [360, 640], [375, 667], [390, 844], [430, 932], [568, 320], [844, 390],
  [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080],
].filter((_, i) => !QUICK || [0, 5, 8].includes(i));
// --only=320x568,844x390 checks just those sizes.
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
if (ONLY.length) VIEWPORTS.splice(0, VIEWPORTS.length, ...ONLY.map(v => v.split('x').map(Number)));

// Runs in the page: every way content can fail to fit.
function audit() {
  const out = [];
  const name = el => el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '');
  const path = el => { const p = []; for (let e = el; e && e !== document.body && p.length < 4; e = e.parentElement) p.unshift(name(e)); return p.join(' > '); };
  const se = document.scrollingElement;
  if (se.scrollHeight > innerHeight + 1 || se.scrollWidth > innerWidth + 1) out.push('page scrolls');
  // With a sheet, panel or flow open, only that layer is checked: it is what she sees.
  const layer = [...document.querySelectorAll('.flow, .sheet-wrap, .panel-wrap')].pop();
  const visible = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
  for (const el of (layer || document.body).querySelectorAll('*')) {
    if (el.closest('.thread, .suggest, .sr, svg, template, .jbox')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (!visible(el)) continue;
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) out.push('scrolls: ' + path(el));
    if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) out.push('scrolls sideways: ' + path(el));
    const leaf = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || /^(BUTTON|INPUT|TEXTAREA|IMG|A|SELECT)$/.test(el.tagName) || el.matches('svg.map');
    if (!leaf) continue;
    if (el.closest('.pg-over')) { out.push('too tall for a page: ' + path(el.closest('.pg-over'))); continue; }
    if (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.left < -1 || r.top < -1) { out.push('outside the window: ' + path(el)); continue; }
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ac = getComputedStyle(a);
      if (ac.overflowX === 'visible' && ac.overflowY === 'visible') continue;
      const ar = a.getBoundingClientRect();
      if (r.bottom > ar.bottom + 2 || r.top < ar.top - 2 || r.right > ar.right + 2 || r.left < ar.left - 2) { out.push('cut off: ' + path(el)); break; }
    }
    const clamped = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
    if (cs.overflowY === 'hidden' && !clamped && cs.textOverflow !== 'ellipsis' && el.scrollHeight > el.clientHeight + 2 && el.tagName !== 'TEXTAREA') out.push('text cut: ' + path(el));
  }
  return [...new Set(out)];
}

const browser = await chromium.launch();
const failures = [];
let checks = 0;
const wait = (p, ms = 350) => p.waitForTimeout(ms);

async function login(vp, code) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: vp[0] < 1024, isMobile: false });
  const p = await ctx.newPage();
  p.setDefaultTimeout(4000);
  p.on('pageerror', e => failures.push(`${vp.join('x')} page error: ${e.message}`));
  await p.goto(BASE);
  await p.fill('#code', code); await p.click('#loginForm .btn');
  await p.waitForSelector('#app:not([hidden]), #loginWho:not([hidden])', { timeout: 10000 });
  await p.waitForFunction(() => document.querySelector('#sync')?.classList.contains('ok') || document.querySelector('#sync')?.classList.contains('warn'), null, { timeout: 8000 }).catch(() => {});
  await wait(p, 500);
  return p;
}
async function check(p, vp, label) {
  where = `${vp.join('x')} after ${label}`;
  await wait(p, 420);
  checks++;
  const bad = await p.evaluate(audit);
  if (bad.length) {
    failures.push(`${vp.join('x')} ${label}:\n    ${bad.slice(0, 6).join('\n    ')}`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/fail-${vp.join('x')}-${label.replace(/[^a-z0-9]+/gi, '-')}.png` });
  } else if (SHOTS && process.env.ALL_SHOTS) await p.screenshot({ path: `${SHOTS}/${vp.join('x')}-${label.replace(/[^a-z0-9]+/gi, '-')}.png` });
}
const count = (p, s) => p.locator(s).count();
// Taps the first visible match. Something covering it counts as a failure.
let where = '';
const visibleClick = async (p, s) => {
  const l = p.locator(s).filter({ visible: true }).first();
  if (!(await l.count())) return false;
  try { await l.click({ timeout: 2500 }); return true; } catch (e) {
    const by = /<([a-z]+)[^>]*class="([^"]*)"[^>]*>[^\n]*intercepts pointer events/.exec(e.message);
    failures.push(`${where} could not tap ${s}${by ? ` (covered by ${by[1]}.${by[2].split(' ').join('.')})` : ''}`);
    return false;
  }
};

// Every page of the pager inside `scope`, checked one by one.
async function pages(p, vp, label, scope = '.view:not([hidden])') {
  for (let i = 0; i < 12; i++) {
    await check(p, vp, `${label} page ${i + 1}`);
    const sel = scope.split(',').map(x => `${x.trim()} .pg-foot:not([hidden]) [data-next]:not([disabled])`).join(', ');
    if (!(await visibleClick(p, sel))) break;
  }
}
const closeLayer = async p => {
  await p.keyboard.press('Escape'); await wait(p, 120);
  // Whatever is still open is removed, so one failure does not block the rest.
  await p.evaluate(() => document.querySelectorAll('.panel-wrap, .sheet-wrap, .flow').forEach(e => e.remove()));
};

async function phoneRun(p, vp) {
  const nav = name => visibleClick(p, `.nav-btn[data-go="${name}"]`);
  await nav('today'); await check(p, vp, 'today');
  if (await visibleClick(p, '.prio.lead')) { await check(p, vp, 'priority sheet'); await closeLayer(p); }
  if (await visibleClick(p, '.view:not([hidden]) [data-check]')) { await flowWalk(p, vp, 'check-in'); }
  if (await visibleClick(p, '.view:not([hidden]) [data-log]')) { await flowWalk(p, vp, 'log symptom'); }
  if (await visibleClick(p, '.view:not([hidden]) [data-facts]')) { await flowWalk(p, vp, 'still right?'); }
  await nav('record'); await check(p, vp, 'record');
  for (const s of ['priorities', 'medicines', 'results', 'questions', 'gaps', 'appointments', 'doctors', 'history']) {
    await nav('record');
    if (await visibleClick(p, '.back[data-home]')) await wait(p, 150);
    if (!(await visibleClick(p, `.rec-tiles [data-go="${s}"]`))) continue;
    await pages(p, vp, `record ${s}`);
  }
  await nav('record');
  if (await visibleClick(p, '.back[data-home]')) await wait(p, 150);
  if (await visibleClick(p, '.rec-tiles [data-go="appointments"]') && await visibleClick(p, '[data-add-appt]')) { await check(p, vp, 'add an appointment'); await closeLayer(p); }
  await nav('conditions');
  if (await visibleClick(p, '.view:not([hidden]) .back[data-home]')) await wait(p, 150);
  await pages(p, vp, 'conditions list');
  await conditionsWalk(p, vp, false);
  await nav('today');
  await consoleWalk(p, vp, () => visibleClick(p, '#addBtn'));
  await nav('ask'); await check(p, vp, 'ask');
  await feedbackWalk(p, vp, nav);
  await nav('today');
  await layers(p, vp);
}
// The confirm card Ellie shows when she hears a fact has changed.
async function chatUpdate(p, vp) {
  await visibleClick(p, '[data-go="ask"]'); await wait(p, 500);
  if (!(await p.locator('#msg').count())) return;
  // A medicine that is on this record's list, so the proposal is a real one.
  const med = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('dipti.canon')).medications.find(m => m.status !== 'stopped').name; } catch { return ''; } });
  if (!med) return;
  await p.fill('#msg', `I stopped ${med} today.`);
  await visibleClick(p, '#sendBtn');
  await p.waitForSelector('[data-upd-yes]', { timeout: 15000 }).catch(() => failures.push(`${vp.join('x')} no confirm card after a change was reported`));
  await check(p, vp, 'ask: confirm an update');
}

async function flowWalk(p, vp, label) {
  for (let step = 0; step < 9; step++) {
    await check(p, vp, `${label} step ${step + 1}`);
    if (!(await p.locator('.flow').count())) return;
    // Answer the step with its first choice, else move on.
    const choice = p.locator('.flow .o, .flow .tile2, .flow [data-opt]').first();
    const next = p.locator('.flow [data-next], .flow .btn.primary').filter({ visible: true }).first();
    if (await choice.count()) { if (!(await visibleClick(p, '.flow .o, .flow .tile2, .flow [data-opt]'))) break; }
    else if (await next.count()) { if (!(await visibleClick(p, '.flow [data-next], .flow .btn.primary'))) break; }
    else break;
    await wait(p, 200);
  }
  await closeLayer(p);
}

async function conditionsWalk(p, vp, wide) {
  const ids = await p.evaluate(() => [...new Set([...document.querySelectorAll('#conds [data-c]')].map(b => b.dataset.c))]);
  // The list pages; gather every id by turning through them.
  const all = new Set(ids);
  for (let i = 0; i < 12; i++) {
    if (!(await visibleClick(p, '#conds .cv-list .pg-foot:not([hidden]) [data-next]:not([disabled])'))) break;
    await wait(p, 120);
    (await p.evaluate(() => [...document.querySelectorAll('#conds [data-c]')].map(b => b.dataset.c))).forEach(x => all.add(x));
  }
  const list = [...all].slice(0, QUICK ? 4 : 99);
  for (const id of list) {
    await p.evaluate(id => window.__openCondition?.(id), id);
    await wait(p, 200);
    if (!wide) {
      await pages(p, vp, `condition ${id} on its own`, '#conds');
      if (await visibleClick(p, '#conds [data-tab="map"]')) {
        await check(p, vp, `condition ${id} map`);
        if (await visibleClick(p, '#conds .mn')) {
          await check(p, vp, `condition ${id} link sheet`);
          if (await visibleClick(p, '.ls-nav [data-next]')) await check(p, vp, `condition ${id} link sheet, next`);
          await closeLayer(p);
        }
        if (await visibleClick(p, '#conds [data-f="all"]')) await check(p, vp, `condition ${id} map, all`);
      }
    } else {
      await pages(p, vp, `condition ${id}`, '#conds .cdetail .ccol:first-child');
      if (await visibleClick(p, '#conds .mn')) await check(p, vp, `condition ${id}, a dot tapped`);
    }
  }
}

// Feedback: a chip, some words, then sent.
async function feedbackWalk(p, vp, go) {
  if (!(await go('feedback'))) { failures.push(`${vp.join('x')} no Feedback tab`); return; }
  await check(p, vp, 'feedback');
  if (!(await visibleClick(p, '#fb [data-chip]'))) { failures.push(`${vp.join('x')} feedback chip not tappable`); return; }
  await check(p, vp, 'feedback: chip picked');
  await p.fill('#fbText', 'The map was hard to read on my phone. '.repeat(6));
  await check(p, vp, 'feedback: written');
  if (!(await visibleClick(p, '#fb [data-send]'))) { failures.push(`${vp.join('x')} feedback send not tappable`); return; }
  await p.waitForSelector('#fb [data-again]', { timeout: 10000 }).catch(() => failures.push(`${vp.join('x')} feedback did not reach sent`));
  await check(p, vp, 'feedback: sent');
  await visibleClick(p, '#fb [data-again]');
}

// The input console and every entry in it.
async function consoleWalk(p, vp, open) {
  const back = () => visibleClick(p, '.flow [data-back]');
  if (!(await open())) { failures.push(`${vp.join('x')} no way to open the console`); return; }
  await check(p, vp, 'console');
  if (await visibleClick(p, '.flow [data-c="med"]')) {
    await pages(p, vp, 'console: which medicine', '.flow');
    if (await visibleClick(p, '.flow [data-m]:not([data-m=""])')) { await check(p, vp, 'console: what changed');
      if (await visibleClick(p, '.flow [data-ch="dose"]')) { await check(p, vp, 'console: new dose'); await back(); }
      await back(); }
    if (await visibleClick(p, '.flow .pg-foot:not([hidden]) [data-next]:not([disabled])')) await wait(p, 150);
    if (await visibleClick(p, '.flow [data-m=""]')) { await check(p, vp, 'console: a new medicine'); await back(); }
    await back();
  }
  if (await visibleClick(p, '.flow [data-c="result"]')) {
    await check(p, vp, 'console: a test result');
    if (await visibleClick(p, '.flow [data-r="type"]')) { await check(p, vp, 'console: type a result');
      await p.fill('#rTest', 'HbA1c'); await p.fill('#rVal', '5.6 %');
      if (await visibleClick(p, '.flow [data-save]')) { await wait(p, 600); await check(p, vp, 'console: saved'); await visibleClick(p, '.flow [data-again]'); }
    }
  }
  if (await visibleClick(p, '.flow [data-c="question"]')) { await check(p, vp, 'console: a question'); await back(); }
  if (await visibleClick(p, '.flow [data-c="journal"]')) {
    await check(p, vp, 'console: long note');
    await p.fill('#jText', 'Woke up tired and the tooth throbbed all morning. '.repeat(80));
    await check(p, vp, 'console: long note, very long');
    if (await visibleClick(p, '.flow [data-save]')) { await wait(p, 600); await check(p, vp, 'console: long note saved'); }
  }
  await closeLayer(p);
}

async function layers(p, vp) {
  if (await visibleClick(p, '#gearBtn')) { await check(p, vp, 'settings sheet'); await closeLayer(p); }
  if (await visibleClick(p, '#shareBtn')) {
    await pages(p, vp, 'summary: pick a doctor', '.sheet');
    if (await visibleClick(p, '.sheet [data-doc]')) await pages(p, vp, 'summary text', '.sheet');
    await closeLayer(p);
  }
}

async function wideRun(p, vp) {
  const tab = name => visibleClick(p, `.tt[data-go="${name}"]`);
  await tab('today'); await check(p, vp, 'overview');
  for (const [s, label] of [['.dash [data-p]', 'priority'], ['.dash [data-m]', 'medicine panel'], ['.dash [data-r]', 'result panel'], ['.dash [data-q]', 'questions panel'], ['.dash [data-g]', 'gap panel']]) {
    if (await visibleClick(p, s)) { await pages(p, vp, label, '.panel, .sheet'); await closeLayer(p); }
  }
  if (await visibleClick(p, '.dash [data-check]')) await flowWalk(p, vp, 'check-in');
  if (await visibleClick(p, '.dash [data-fact]')) await flowWalk(p, vp, 'still right?');
  await tab('record'); await check(p, vp, 'record');
  for (const s of ['priorities', 'medicines', 'results', 'questions', 'gaps', 'appointments', 'doctors', 'history']) {
    await tab('record');
    if (await visibleClick(p, '.back[data-home]')) await wait(p, 150);
    if (await visibleClick(p, `.rec-tiles [data-go="${s}"]`)) await pages(p, vp, `record ${s}`);
  }
  await tab('conditions'); await check(p, vp, 'conditions');
  await conditionsWalk(p, vp, true);
  await consoleWalk(p, vp, () => visibleClick(p, '#addTop'));
  await tab('ask'); await check(p, vp, 'ask');
  await feedbackWalk(p, vp, tab);
  await tab('today');
  await layers(p, vp);
}

for (const vp of VIEWPORTS) {
  for (const code of QUICK ? ['dipti-local'] : ['dipti-local', 'local']) {
    let p;
    try {
    p = await login(vp, code);
    if (code === 'local') {
      // Family code: the who-picker first, then a quick pass.
      await check(p, vp, 'who is using this');
      await visibleClick(p, '[data-who="Krish"], [data-who]');
      await p.waitForSelector('#app:not([hidden])'); await wait(p, 600);
      await check(p, vp, 'family: first screen');
      await p.context().close();
      continue;
    }
    if (vp[0] >= 1024) await wideRun(p, vp); else await phoneRun(p, vp);
    await chatUpdate(p, vp);
    await p.context().close();
    } catch (e) {
      // A step that could not run is a failure too, never a silent pass.
      failures.push(`${vp.join('x')} ${code}: run stopped: ${String(e.message).split('\n')[0]}`);
      await p?.context().close().catch(() => {});
    }
  }
}
await browser.close();
console.log(`${checks} screens checked at ${VIEWPORTS.length} sizes`);
if (failures.length) {
  console.log(`${failures.length} failed:\n  ` + failures.join('\n  '));
  if (SHOTS) fs.writeFileSync(`${SHOTS}/failures.txt`, failures.join('\n'));
  process.exit(1);
}
console.log('No scrolling, nothing cut off, nothing outside the window.');
