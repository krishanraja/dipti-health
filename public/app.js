import { mountToday, refreshToday, factFlow } from '/js/today.js';
import { mountRecord, refreshRecord, recordHome, recordSpoke, openSheet } from '/js/record.js';
import { resultsText } from '/js/speech.js';
import { canRecord, startRecording, transcribeBlob } from '/js/recorder.js';
import { mountConditions, refreshConditions, conditionsHome, openCondition } from '/js/conditions.js';
import { mountChat, refreshChat, sendToChat, checkPending, stopSpeaking, photoToChat, showChat } from '/js/chat.js';
import { person, matchPerson } from '/js/people.js';
import { briefText } from '/js/brief.js';
import { DOCTOR } from '/js/persona.js';

/* ---------------- tiny helpers ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('dipti.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('dipti.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
// The person on this device: Dipti, or family helping out.
const me = () => person({ role: session.role, who: store.get('who', ''), roster: store.get('people', []) });
const who = () => (me().dipti ? 'Dipti' : me().name || 'app').slice(0, 40);
const isWide = () => matchMedia('(min-width: 1024px)').matches;

let toastTimer;
// A short note at the bottom. A tick when something is done or saved, an
// amber clock when it is waiting to sync, nothing for plain information.
const TICK = '<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>';
const CLOCK = '<svg viewBox="0 0 24 24"><path d="M12 7v5l3 2"/></svg>';
function toast(msg, ms = 2600) {
  const t = $('#toast');
  const text = String(msg).replace(/\s*✓\s*$/, '').replace(/\s*✓\s*/g, ' ');
  const kind = /will sync|waiting/i.test(text) ? 'wait' : /✓|saved|noted|checked|marked|added|updated|copied|done|glad/i.test(msg) ? 'ok' : '';
  t.innerHTML = `${kind ? `<span class="t-ic ${kind === 'wait' ? 'wait' : ''}">${kind === 'wait' ? CLOCK : TICK}</span>` : ''}<span>${esc(text)}</span>`;
  t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

async function api(path, { method = 'GET', body, timeout = 15000 } = {}) {
  const r = await fetch(path, {
    method, credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  const data = await r.json().catch(() => ({ ok: false, error: 'bad response' }));
  if (r.status === 401) { showLogin(); throw Object.assign(new Error('login required'), { status: 401 }); }
  if (!r.ok || data.ok === false) throw Object.assign(new Error(data.error || 'request failed'), { status: r.status, data });
  return data;
}

/* ---------------- sync state + offline write queue ---------------- */
let canon = store.get('canon', null);
let syncError = '';
let session = {};

function setSync(kind, text) {
  const s = $('#sync'); s.className = 'sync ' + kind; s.querySelector('span').textContent = text;
}

function refreshAll() { refreshToday(); refreshRecord(); refreshConditions(); refreshChat(); sheetLink(); }
function sheetLink() {
  const a = $('#sheetLink'), url = canon?.sheetUrl;
  a.hidden = !url; if (url) a.href = url;
}

async function loadCanon() {
  if (!session.sheetConfigured) { setSync('warn', 'Sheet not connected'); refreshAll(); return; }
  setSync('', 'Syncing');
  try {
    canon = await api('/api/canon', { timeout: 30000 });
    store.set('canon', canon);
    syncError = '';
    setSync('ok', 'Up to date');
    refreshAll();
  } catch (e) {
    if (e.status === 401) return;
    // Kept so a tap on the status says what went wrong, in plain words.
    syncError = e.name === 'TimeoutError' ? 'The Sheet took too long to answer.' : e.status ? `The Sheet said: ${String(e.message).replace(/^sheet API: /, '')}` : 'No internet connection.';
    setSync(canon ? 'warn' : 'bad', canon ? 'Showing saved copy' : 'Offline');
  }
}

// Writes never get lost: failures wait in a queue and retry next time.
async function save(action, payload) {
  try {
    const out = await api('/api/write', { method: 'POST', body: { action, payload, by: who() } });
    return { ok: true, out };
  } catch (e) {
    if (e.status === 401) return { ok: false };
    const q = store.get('queue', []); q.push({ action, payload, by: who(), ts: Date.now() }); store.set('queue', q);
    setSync('warn', `${q.length} waiting to save`);
    return { ok: false, queued: true };
  }
}
// Add a note to the local copy straight away so screens reflect it, then save.
async function addNote(tag, text) {
  if (canon) { (canon.notes || (canon.notes = [])).push({ tsUTC: new Date().toISOString(), by: who(), tag, text }); store.set('canon', canon); }
  return save('note', { text, tag });
}

async function flushQueue() {
  const q = store.get('queue', []);
  if (!q.length || !session.sheetConfigured) return;
  const left = [];
  for (const item of q) {
    try { await api('/api/write', { method: 'POST', body: item }); } catch (e) { left.push(item); }
  }
  store.set('queue', left);
  if (!left.length) toast('Saved everything that was waiting');
}
addEventListener('online', () => flushQueue().then(loadCanon));
$('#sync').addEventListener('click', () => {
  if (syncError) toast(`${syncError} Trying again now.`, 4200);
  flushQueue().then(loadCanon);
});

/* ---------------- login / boot ---------------- */
function showLogin() {
  $('#app').hidden = true; $('#login').hidden = false;
  $('#loginCode').hidden = false; $('#loginWho').hidden = true;
  setTimeout(() => $('#code').focus(), 50);
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#loginMsg'); msg.textContent = '';
  const btn = e.submitter || $('#loginForm .btn'); btn.disabled = true;
  try {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: $('#code').value }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { msg.textContent = j.error || 'That code is not right'; $('#code').select(); return; }
    $('#code').value = '';
    if (Array.isArray(j.people)) store.set('people', j.people);
    if (j.askWho) return askWho();
    boot();
  } catch { msg.textContent = 'No connection. Try again.'; }
  finally { btn.disabled = false; }
});

// The family code is shared, so the device says who is using it.
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
function whoOptions(current) {
  const family = store.get('people', []).filter(p => !p.patient);
  const opt = (id, ic, cls, title, sub) => `<button class="who-opt" type="button" data-who="${esc(id)}" aria-pressed="${current === id}"><span class="who-ic ${cls}">${ic}</span><span class="who-t"><b>${esc(title)}</b><small>${esc(sub)}</small></span>${CHEVRON}</button>`;
  return opt('dipti', 'D', 'k', "I'm Dipti", 'My day, my record, my doctor')
    + family.map(p => opt(p.name, esc(p.name.charAt(0)), 'f', p.name, "Helping with Dipti's health")).join('')
    + opt('other', '+', 'o', 'Someone else', 'Family or a friend helping out');
}
function askWho() {
  $('#loginCode').hidden = true; $('#loginWho').hidden = false;
  $('#whoName').hidden = true; $('#whoPick').hidden = false;
  $('#whoPick .who-list').innerHTML = whoOptions('');
  $('#nameInput').value = '';
}
async function setPersona(persona) {
  const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ persona }) }).catch(() => null);
  if (!r || !r.ok) { toast('No connection. Try again.'); return false; }
  return true;
}
async function choose(id, { reload = false } = {}) {
  const dipti = id === 'dipti';
  store.set('who', dipti ? '' : id);
  if (!(await setPersona(dipti ? 'dipti' : 'family'))) return;
  if (reload) location.replace('/'); else boot();
}
$('#loginWho').addEventListener('click', e => {
  const b = e.target.closest('[data-who]'); if (!b) return;
  if (b.dataset.who !== 'other') return choose(b.dataset.who);
  $('#whoPick').hidden = true; $('#whoName').hidden = false; setTimeout(() => $('#nameInput').focus(), 50);
});
$('#whoName').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#nameInput').value.trim();
  if (!name) return;
  const match = matchPerson(store.get('people', []), name);
  choose(match?.patient || /^dipti$/i.test(name) ? 'dipti' : (match?.name || name));
});

async function boot() {
  try {
    const r = await fetch('/api/session', { credentials: 'same-origin', signal: AbortSignal.timeout(10000) });
    if (r.status === 401) return showLogin();
    session = await r.json();
    if (Array.isArray(session.people)) store.set('people', session.people);
  } catch {
    if (!canon) return showLogin(); // never seen data on this device; need the network once
    session = { sheetConfigured: true, role: store.get('role', 'dipti') };
  }
  store.set('role', session.role);
  document.body.classList.toggle('as-family', !me().dipti);
  document.querySelectorAll('[data-ask-label]').forEach(s => { s.textContent = `Ask ${DOCTOR.name}`; });
  $('#login').hidden = true; $('#app').hidden = false;
  buildToday(); buildRecord(); buildConditions(); buildChat();
  go(store.get('view', 'today'));
  await flushQueue();
  loadCanon();
  checkPending();
}

/* ---------------- tabs ---------------- */
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.go === 'record' && b.hasAttribute('aria-current')) recordHome();
  if (b.dataset.go === 'conditions' && b.hasAttribute('aria-current')) conditionsHome();
  go(b.dataset.go);
}));
function go(name) {
  if (!['today', 'record', 'conditions', 'ask'].includes(name)) name = 'today';
  store.set('view', name);
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.dataset.view !== name; });
  document.querySelectorAll('[data-go]').forEach(b => { if (b.dataset.go === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (name !== 'ask') stopSpeaking(); else showChat();
  requestAnimationFrame(fitAll);
}

// Shrink text until a no-scroll box fits. Lists that are meant to scroll do not use this.
function fit(box) {
  if (!box || !box.isConnected || !box.clientHeight) return;
  let fs = 18; box.style.setProperty('--fs', fs + 'px');
  while (box.scrollHeight > box.clientHeight + 1 && fs > 12) { fs -= .5; box.style.setProperty('--fs', fs + 'px'); }
  const drops = [...box.querySelectorAll('.drop')];
  while (box.scrollHeight > box.clientHeight + 1 && drops.length) drops.pop().hidden = true;
}
function fitAll() { document.querySelectorAll('.view:not([hidden]) .fit').forEach(fit); }
document.fonts?.ready.then(() => requestAnimationFrame(fitAll)); // text measures differently once fonts load
let wasWide = isWide();
addEventListener('resize', () => {
  requestAnimationFrame(fitAll);
  if (isWide() !== wasWide) { wasWide = isWide(); refreshToday(); refreshConditions(); }
});

/* ---------------- voice: shared dictation for text boxes ---------------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const micBlocked = () => toast('Microphone blocked. Allow it in browser settings, or type.', 4000);

// Records and transcribes on the server; falls back to the browser
// recogniser. Returns stop(), or null.
// onState(true) while recording, ('busy') while transcribing, (false) when done.
function listen(onText, onState) {
  if (canRecord()) {
    let handle = null, done = false;
    startRecording({ onAutoStop: () => stop() }).then(h => { handle = h; onState?.(true); navigator.vibrate?.(15); })
      .catch(e => { done = true; onState?.(false); if (e?.name === 'NotAllowedError') micBlocked(); else toast('Could not start the microphone'); });
    async function stop() {
      if (done || !handle) return; done = true;
      onState?.('busy');
      try {
        const blob = await handle.stop();
        if (handle.silent()) toast("I didn't hear anything. Try again, closer to the phone.");
        else { const text = await transcribeBlob(blob); if (text) onText(text); else toast("Didn't catch that. Try again."); }
      }
      catch { toast("Couldn't turn that into words. Try again, or type."); }
      onState?.(false);
    }
    return () => { stop(); };
  }
  if (!SR) { toast('Voice is not available in this browser. Type instead.'); return null; }
  const r = new SR(); r.lang = 'en-IN'; r.continuous = true; r.interimResults = true;
  let live = true;
  r.onresult = e => onText(resultsText(e));
  r.onerror = e => { if (e.error === 'not-allowed') micBlocked(); };
  r.onend = () => { if (live) { live = false; onState?.(false); } };
  try { r.start(); } catch { return null; }
  onState?.(true); navigator.vibrate?.(15);
  return () => { if (live) { live = false; try { r.stop(); } catch { /* stopped */ } onState?.(false); } };
}

/* ---------------- views ---------------- */
function openAsk(text) { go('ask'); sendToChat(text); }
const ctx = () => ({ canon: () => canon, session: () => session, me, who, save, addNote, toast, fit, listen, openSheet, openAsk, go, isWide, shareBrief, recordSpoke, factFlow, openCondition: id => { go('conditions'); openCondition(id); }, reload: () => loadCanon(), addPhoto: () => { go('ask'); photoToChat(); } });
function buildToday() { mountToday($('#today'), ctx()); }
function buildRecord() { mountRecord($('#rec'), ctx()); }
function buildConditions() { mountConditions($('#conds'), ctx()); }
// Lets the no-scroll check (scripts/noscroll.mjs) open each condition directly.
window.__openCondition = id => { go('conditions'); openCondition(id); };
function buildChat() { mountChat($('#chat'), { ...ctx(), role: () => session.role, people: () => store.get('people', []), choose: id => choose(id, { reload: true }), showLogin, setSomeone: () => settingsSheet() }); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkPending(); });

// Keep the chat composer above the keyboard: iOS does not resize the page.
if (window.visualViewport) {
  const vv = window.visualViewport, rootEl = document.documentElement;
  const onVV = () => {
    rootEl.style.setProperty('--app-h', vv.height + 'px');
    document.body.classList.toggle('kb', innerHeight - vv.height > 140);
    if (vv.offsetTop) window.scrollTo(0, 0);
  };
  vv.addEventListener('resize', onVV); vv.addEventListener('scroll', onVV); onVV();
}

/* ---------------- summary for a doctor ---------------- */
// The summary in blocks of a few lines; a heading stays with what follows it.
function briefBlocks(text) {
  const out = [];
  text.split(/\n{2,}/).forEach(block => {
    const lines = block.split('\n');
    const head = lines.length > 1 && !/^[-•*]/.test(lines[0]) ? lines.shift() : null;
    if (head) out.push({ text: head, head: true });
    let cur = [];
    for (const l of lines) {
      if (cur.length && (cur.join('\n') + l).length > 170) { out.push({ text: cur.join('\n') }); cur = []; }
      cur.push(l);
    }
    if (cur.length) out.push({ text: cur.join('\n') });
  });
  return out;
}
function shareBrief(doctor = null) {
  const docs = canon?.clinicians || [];
  if (doctor === null && docs.length) {
    return openSheet(`<p class="kicker">Summary for a doctor</p><h3 class="sheet-title">Who is it for?</h3>
      <div class="who-list compact" data-pages="Doctors">${docs.map(d => `<button class="who-opt" data-doc="${esc(d.name)}"><span class="who-ic f">${esc(d.name.replace(/^Dr\.?\s*/i, '').charAt(0))}</span><span class="who-t"><b>${esc(d.name)}</b></span>${CHEVRON}</button>`).join('')}
      <button class="who-opt" data-doc=""><span class="who-ic o">+</span><span class="who-t"><b>Any doctor (everything)</b></span>${CHEVRON}</button></div>
      <button class="btn ghost" data-close>Cancel</button>`, (sheet, close) => {
      sheet.addEventListener('click', e => { const b = e.target.closest('[data-doc]'); if (b) { close(); shareBrief(b.dataset.doc || ''); } });
    });
  }
  const text = briefText(canon || {}, { doctor: doctor || null });
  // The summary is for sending; here it is shown a block at a time.
  openSheet(`<p class="kicker">Summary${doctor ? ' for ' + esc(doctor) : ''}</p><div class="brief" data-pages="Summary">${briefBlocks(text).map(b => `<pre${b.head ? ' data-keep' : ''}>${esc(b.text)}</pre>`).join('')}</div>
    <div class="row"><button class="btn ghost" data-close>Close</button><button class="btn primary grow" data-send>${navigator.share ? 'Send' : 'Copy'}</button></div>`, (sheet, close) => {
    sheet.querySelector('[data-send]').onclick = async () => {
      try {
        if (navigator.share) await navigator.share({ title: 'Health summary', text });
        else { await navigator.clipboard.writeText(text); toast('Copied. Paste it into a message or email.'); }
        close();
      } catch (e) { if (e.name !== 'AbortError') toast('Could not copy on this browser'); }
    };
  });
}
$('#shareBtn').addEventListener('click', () => shareBrief());

/* ---------------- settings ---------------- */
$('#gearBtn').addEventListener('click', () => settingsSheet());
function settingsSheet() {
  const m = me(), listed = store.get('people', []).some(p => !p.patient && p.name === m.name);
  const current = m.dipti ? 'dipti' : listed ? m.name : 'other';
  openSheet(`
  <p class="kicker">Who is using this</p>
  <div class="who-list compact" data-pages="People">${whoOptions(current)}</div>
  <div class="someone" ${current === 'other' ? '' : 'hidden'}>
    <label class="kicker" for="whoNameSet">Your name, shown next to what you add</label>
    <input id="whoNameSet" maxlength="40" placeholder="First name">
  </div>
  ${canon?.sheetUrl ? `<a class="btn" href="${esc(canon.sheetUrl)}" target="_blank" rel="noopener">Open my Google Sheet</a>` : ''}
  <button class="btn" data-out>Log out on this device</button>
  <button class="btn primary" data-close>Done</button>`, (sheet, close) => {
    const w = sheet.querySelector('#whoNameSet'), box = sheet.querySelector('.someone');
    w.value = current === 'other' ? store.get('who', '') : '';
    sheet.addEventListener('click', e => {
      const b = e.target.closest('[data-who]'); if (!b) return;
      if (b.dataset.who === 'other') { box.hidden = false; sheet.querySelectorAll('[data-who]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); w.focus(); return; }
      if (b.dataset.who === current) return;
      choose(b.dataset.who, { reload: true });
    });
    sheet.querySelector('[data-close]').onclick = () => {
      close();
      if (!box.hidden && w.value.trim() && w.value.trim() !== store.get('who', '')) choose(w.value.trim(), { reload: true });
    };
    sheet.querySelector('[data-out]').onclick = async () => { await fetch('/api/login', { method: 'DELETE' }); localStorage.clear(); location.replace('/'); };
  });
}

boot();
