// Server-side proxy to the Apps Script API bound to the canon Google Sheet.
// The secret never reaches the browser.
export const WRITE_ACTIONS = ['checkin', 'note', 'testResult', 'question', 'gap', 'profile', 'condition', 'medication', 'priority', 'clinician', 'appointment', 'check', 'feedback', 'journal'];

function cfg() {
  const url = process.env.SHEET_API_URL;
  const secret = process.env.SHEET_API_SECRET;
  if (!secret || !url) {
    const e = new Error('SHEET_API_URL and SHEET_API_SECRET must both be set in Vercel');
    e.code = 'NO_SECRET';
    throw e;
  }
  return { url, secret };
}

async function parse(r) {
  const text = await r.text();
  // Trust the body, not the status: Apps Script errors can come back as HTML.
  try { return JSON.parse(text); }
  catch { throw new Error(`sheet API returned non-JSON (HTTP ${r.status}): ${text.slice(0, 120)}`); }
}

// Google Sheets turns typed text into dates and times: "2026-11-08" becomes a
// date cell, "14:30" a time cell, and an older Code.gs then sends them as
// "Sat Dec 30 1899 14:30:00 GMT+0553 (India Standard Time)", in the script's
// own time zone, which can even land on the day before. This puts every such
// value back the way it was typed, on Dipti's clock: "2026-11-08", "14:30",
// "2026-11-08 14:30", or an ISO time for the UTC timestamp columns.
const SHEET_TZ = 'Asia/Kolkata';
const JS_DATE = /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4}/;
const UTC_KEYS = new Set(['tsUTC', 'ts']);
export function cleanCell(v, key = '') {
  if (typeof v !== 'string' || !JS_DATE.test(v)) return v;
  const t = Date.parse(v.replace(/ \(.*\)$/, ''));
  if (Number.isNaN(t)) return v;
  if (UTC_KEYS.has(key)) return new Date(t).toISOString();
  // A time on its own sits on 30 Dec 1899, where time zone history differs
  // between Google and everyone else: keep the clock time as written.
  if (/ 1899 /.test(v)) return v.slice(16, 21);
  // Round to the minute: the 1899 time zone offsets carry stray seconds.
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: SHEET_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(Math.round(t / 60000) * 60000)).map(x => [x.type, x.value]));
  const day = `${p.year}-${p.month}-${p.day}`, time = `${p.hour}:${p.minute}`;
  return time === '00:00' ? day : `${day} ${time}`;
}
export function cleanCanon(canon) {
  const out = { ...canon };
  for (const [k, v] of Object.entries(canon)) {
    if (Array.isArray(v)) out[k] = v.map(r => (r && typeof r === 'object' ? Object.fromEntries(Object.entries(r).map(([c, x]) => [c, cleanCell(x, c)])) : r));
    else if (v && typeof v === 'object') out[k] = Object.fromEntries(Object.entries(v).map(([c, x]) => [c, cleanCell(x)]));
  }
  return out;
}

// Apps Script can take several seconds to wake; allow for it.
export async function readCanon({ timeoutMs = 25000 } = {}) {
  const { url, secret } = cfg();
  const r = await fetch(`${url}?action=read&secret=${encodeURIComponent(secret)}`,
    { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  const body = await parse(r);
  if (!body.ok) throw new Error('sheet API: ' + (body.error || 'unknown error'));
  return cleanCanon(body);
}

// The full saved reply for one chat (falls back to the whole read on an
// older Code.gs that has no answer action).
export async function readAnswer(rid, { timeoutMs = 20000 } = {}) {
  const { url, secret } = cfg();
  const r = await fetch(`${url}?action=answer&rid=${encodeURIComponent(rid)}&secret=${encodeURIComponent(secret)}`,
    { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  return parse(r);
}

// The script's version and the actions it knows (Code.gs ping).
export async function pingSheet({ timeoutMs = 6000 } = {}) {
  const { url, secret } = cfg();
  const r = await fetch(`${url}?action=ping&secret=${encodeURIComponent(secret)}`, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  return parse(r);
}
export async function readJournal(jid, { timeoutMs = 15000 } = {}) {
  const { url, secret } = cfg();
  const r = await fetch(`${url}?action=journal&jid=${encodeURIComponent(jid)}&secret=${encodeURIComponent(secret)}`, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  return parse(r);
}

// Actions only the server makes (never accepted from /api/write).
const SERVER_ACTIONS = ['chat'];

// opId: the same id for every retry of one write, so the Sheet applies it once.
// A write the Sheet refuses on its content throws with e.rejected = true:
// retrying it can never succeed. Anything else may succeed later.
export async function write(action, payload, by = 'app', { timeoutMs = 15000, opId = '' } = {}) {
  if (!WRITE_ACTIONS.includes(action) && !SERVER_ACTIONS.includes(action)) throw new Error('action not allowed: ' + action);
  const { url, secret } = cfg();
  // text/plain avoids a CORS preflight; Apps Script answers POST with a 302
  // that fetch follows as GET to the echo URL, which carries the result.
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret, action, by, payload, opId }),
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await parse(r);
  if (!body.ok) {
    const e = new Error('sheet API: ' + (body.error || 'unknown error'));
    const msg = String(body.error || '');
    // An older Code.gs without this action: not her mistake, and retrying
    // will work once the script is updated, so keep it queued.
    e.outdated = /^unknown action/.test(msg);
    e.rejected = !e.outdated && !/^(server error|bad secret)/.test(msg);
    throw e;
  }
  return body;
}
