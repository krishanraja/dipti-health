/**
 * Dipti's health companion - data-layer API.
 * Bound to Dipti's canon Google Sheet. The Sheet is the source of truth: the
 * app reads and writes it here, and Dipti can open it and read it directly.
 *
 * Setup (once): Extensions > Apps Script, paste this file, run setup() and
 * read the secret it prints in the execution log, then Deploy > New
 * deployment > Web app: Execute as Me, Who has access: Anyone. The secret
 * (Project Settings > Script properties > APP_SECRET) gates every call.
 *
 * NOTE for the web app client: POST with Content-Type: text/plain
 * (avoids CORS preflight, which Apps Script cannot answer).
 * GET ?secret=..&action=read|ping works without preflight.
 */

var APP_SECRET_DEFAULT = '__APP_SECRET__'; // local emulator only
var TZ = 'Asia/Kolkata';

// Every tab, its headers (row 1 in the Sheet) and the keys the app reads.
// Order matters: it is the column order.
var TABS = {
  Meta:          { mode: 'overwrite', cols: [['Key', 'key'], ['Value', 'value']] },
  Profile:       { mode: 'overwrite', cols: [['Key', 'key'], ['Value', 'value'], ['Source', 'source'], ['UpdatedAt', 'updated'], ['Verified', 'verified']] },
  Priorities:    { mode: 'overwrite', cols: [['ID', 'id'], ['Rank', 'rank'], ['Title', 'title'], ['Status', 'status'], ['WhyItMatters', 'why'], ['Plan', 'plan'], ['NextStep', 'nextStep'], ['AskWhom', 'askWhom'], ['UpdatedAt', 'updated']] },
  Conditions:    { mode: 'overwrite', cols: [['Condition', 'name'], ['Status', 'status'], ['Since', 'since'], ['Evidence', 'evidence'], ['Notes', 'notes'], ['Source', 'source'], ['UpdatedAt', 'updated']] },
  Medications:   { mode: 'overwrite', cols: [['Name', 'name'], ['Generic', 'generic'], ['Dose', 'dose'], ['Timing', 'timing'], ['Prescribed8Oct', 'rx'], ['Purpose', 'purpose'], ['Status', 'status'], ['Source', 'source'], ['UpdatedAt', 'updated']] },
  TestResults:   { mode: 'append', cols: [['Date', 'date'], ['Test', 'test'], ['Result', 'result'], ['Range', 'range'], ['Lab', 'lab'], ['Notes', 'notes'], ['Source', 'source']] },
  CheckIns:      { mode: 'append', cols: [['TimestampUTC', 'tsUTC'], ['TimestampLocal', 'tsLocal'], ['By', 'by'], ['Tooth', 'tooth'], ['Abdomen', 'abdomen'], ['Fatigue', 'fatigue'], ['Sleep', 'sleep'], ['Bowels', 'bowels'], ['Mood', 'mood'], ['Verdict', 'verdict'], ['Notes', 'notes']] },
  Questions:     { mode: 'overwrite', cols: [['ID', 'id'], ['Question', 'question'], ['AskWhom', 'askWhom'], ['Priority', 'priority'], ['Status', 'status'], ['Answer', 'answer'], ['UpdatedAt', 'updated']] },
  KnowledgeGaps: { mode: 'overwrite', cols: [['ID', 'id'], ['Gap', 'gap'], ['WhatAnswersIt', 'whatAnswersIt'], ['StepToClose', 'stepToClose'], ['Status', 'status'], ['UpdatedAt', 'updated']] },
  Clinicians:    { mode: 'overwrite', cols: [['Name', 'name'], ['Role', 'role'], ['Owns', 'owns'], ['Contact', 'contact'], ['LastSeen', 'lastSeen'], ['Notes', 'notes']] },
  Evidence:      { mode: 'overwrite', cols: [['ID', 'id'], ['Kind', 'kind'], ['Title', 'title'], ['Severity', 'severity'], ['Grade', 'grade'], ['AppliesWhen', 'appliesWhen'], ['Entities', 'entities'], ['AskYourDoctor', 'ask'], ['Text', 'text'], ['Sources', 'sources']] },
  Sources:       { mode: 'overwrite', cols: [['ID', 'id'], ['Type', 'type'], ['Grade', 'grade'], ['Title', 'title'], ['Year', 'year'], ['URL', 'url']] },
  Notes:         { mode: 'append', cols: [['TimestampUTC', 'tsUTC'], ['By', 'by'], ['Text', 'text'], ['Tag', 'tag']] },
  Changelog:     { mode: 'append', cols: [['TimestampUTC', 'ts'], ['Tab', 'tab'], ['Key', 'key'], ['OldValue', 'old'], ['NewValue', 'new'], ['By', 'by'], ['Source', 'source']] }
};

var CHECKIN_ENUMS = {
  sleep: ['good', 'ok', 'poor'],
  bowels: ['normal', 'loose', 'diarrhoea', 'constipated'],
  mood: ['ok', 'low', 'very-low']
};

/* ---------- plumbing ---------- */

function appSecret() {
  if (typeof PropertiesService !== 'undefined') {
    var s = PropertiesService.getScriptProperties().getProperty('APP_SECRET');
    if (s) return s;
  }
  return APP_SECRET_DEFAULT;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function nowUTC() { return new Date().toISOString(); }
function nowLocal() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }

function sh(name) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!s) throw new Error('missing tab: ' + name);
  return s;
}

function getRows(name) {
  var s = sh(name);
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).getValues();
}

// 0-based column index -> 1-based row number of first match, or -1
function findRow(name, colIdx, val) {
  var r = getRows(name);
  for (var i = 0; i < r.length; i++) {
    if (String(r[i][colIdx]).trim().toLowerCase() === String(val).trim().toLowerCase()) return i + 2;
  }
  return -1;
}

// 1-based column number for a key in a tab.
function col(tab, key) {
  var cols = TABS[tab].cols;
  for (var i = 0; i < cols.length; i++) if (cols[i][1] === key) return i + 1;
  throw new Error('no column ' + key + ' in ' + tab);
}

function logChange(tab, key, oldV, newV, by, source) {
  sh('Changelog').appendRow([nowUTC(), tab, String(key), String(oldV), String(newV), by || 'app', source || 'app']);
}

function err(msg) { return json({ ok: false, error: msg }); }

function need(obj, fields) {
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (obj[f] === undefined || obj[f] === null || String(obj[f]).trim() === '') {
      return 'missing field: ' + f;
    }
  }
  return null;
}

function inEnum(v, allowed) { return allowed.indexOf(v) !== -1; }

// Update the given fields on an existing row, logging each change.
function updateFields(tab, row, p, keys, label, by) {
  var s = sh(tab);
  keys.forEach(function (k) {
    if (p[k] === undefined) return;
    var c = col(tab, k);
    var oldV = s.getRange(row, c).getValue();
    if (String(oldV) === String(p[k])) return;
    s.getRange(row, c).setValue(p[k]);
    logChange(tab, label + '.' + k, oldV, p[k], by, 'app');
  });
  try { s.getRange(row, col(tab, 'updated')).setValue(nowUTC().slice(0, 10)); } catch (e) { /* tab has no UpdatedAt */ }
}

/* ---------- read: whole canon ---------- */

function readCanon() {
  function kv(name) {
    var o = {};
    getRows(name).forEach(function (r) { o[String(r[0])] = String(r[1]); });
    return o;
  }
  function arr(name) {
    var keys = TABS[name].cols.map(function (c) { return c[1]; });
    return getRows(name).map(function (r) {
      var o = {};
      keys.forEach(function (k, i) { o[k] = r[i] === undefined ? '' : String(r[i]); });
      return o;
    });
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    ok: true,
    meta: kv('Meta'),
    profile: kv('Profile'),
    priorities: arr('Priorities'),
    conditions: arr('Conditions'),
    medications: arr('Medications'),
    testResults: arr('TestResults'),
    checkins: arr('CheckIns'),
    questions: arr('Questions'),
    gaps: arr('KnowledgeGaps'),
    clinicians: arr('Clinicians'),
    evidence: arr('Evidence'),
    sources: arr('Sources'),
    notes: arr('Notes'),
    changelog: arr('Changelog').slice(-100), // last 100 only; full history lives in the sheet
    sheetUrl: ss.getUrl ? ss.getUrl() : '',
    serverTimeUTC: nowUTC(),
    serverTimeLocal: nowLocal()
  };
}

/* ---------- check-in verdict ---------- */

// a: {tooth, abdomen, fatigue (0-10), sleep, bowels, mood}; prev: same, or null.
// Act-today is kept for what genuinely needs a same-day call: repeated
// diarrhoea on long-term steroids (sick-day rules) or pain at 9-10.
function computeVerdict(a, prev) {
  if (a.bowels === 'diarrhoea') return 'Act-today';
  if (a.tooth >= 9 || a.abdomen >= 9) return 'Act-today';
  var changed = a.mood === 'very-low' || a.bowels === 'loose';
  if (prev) {
    ['tooth', 'abdomen', 'fatigue'].forEach(function (k) {
      if (a[k] - Number(prev[k] || 0) >= 2) changed = true;
    });
  }
  return changed ? 'Changed' : 'Steady';
}

/* ---------- id helpers ---------- */

function nextId(tab, prefix) {
  var n = 1;
  getRows(tab).forEach(function (x) {
    var m = new RegExp('^' + prefix + '(\\d+)$').exec(String(x[0]));
    if (m) n = Math.max(n, parseInt(m[1], 10) + 1);
  });
  return prefix + n;
}

/* ---------- actions ---------- */

var ACTIONS = {
  checkin: function (p, by) {
    var a = p.answers || {};
    var bad = need(a, ['tooth', 'abdomen', 'fatigue', 'sleep', 'bowels', 'mood']);
    if (bad) return err(bad);
    var scores = {};
    ['tooth', 'abdomen', 'fatigue'].forEach(function (k) { scores[k] = Number(a[k]); });
    for (var k in scores) {
      if (!(scores[k] >= 0 && scores[k] <= 10) || Math.round(scores[k]) !== scores[k]) return err('invalid value for ' + k + ': ' + a[k]);
    }
    for (var e in CHECKIN_ENUMS) {
      if (!inEnum(a[e], CHECKIN_ENUMS[e])) return err('invalid value for ' + e + ': ' + a[e]);
    }
    var prevRows = getRows('CheckIns');
    var last = prevRows.length ? prevRows[prevRows.length - 1] : null;
    var prev = last ? { tooth: last[3], abdomen: last[4], fatigue: last[5] } : null;
    var answers = { tooth: scores.tooth, abdomen: scores.abdomen, fatigue: scores.fatigue, sleep: a.sleep, bowels: a.bowels, mood: a.mood };
    var verdict = computeVerdict(answers, prev);
    var tsU = nowUTC(), tsL = nowLocal();
    sh('CheckIns').appendRow([tsU, tsL, by, scores.tooth, scores.abdomen, scores.fatigue, a.sleep, a.bowels, a.mood, verdict, p.notes || '']);
    return json({ ok: true, verdict: verdict, timestampUTC: tsU, timestampLocal: tsL });
  },

  note: function (p, by) {
    var bad = need(p, ['text']);
    if (bad) return err(bad);
    var tsU = nowUTC();
    sh('Notes').appendRow([tsU, by, p.text, p.tag || '']);
    return json({ ok: true, timestampUTC: tsU });
  },

  testResult: function (p, by) {
    var bad = need(p, ['date', 'test', 'result']);
    if (bad) return err(bad);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return err('date must be YYYY-MM-DD');
    sh('TestResults').appendRow([p.date, p.test, p.result, p.range || '', p.lab || '', p.notes || '', by]);
    return json({ ok: true });
  },

  question: function (p, by) {
    var s = sh('Questions');
    if (p.id) {
      var r = findRow('Questions', 0, p.id);
      if (r < 0) return err('unknown question id: ' + p.id);
      if (p.status && !inEnum(p.status, ['open', 'asked', 'answered'])) return err('invalid status');
      updateFields('Questions', r, p, ['status', 'answer'], p.id, by);
      return json({ ok: true, id: p.id });
    }
    var bad = need(p, ['question']);
    if (bad) return err(bad);
    var id = nextId('Questions', 'Q');
    s.appendRow([id, p.question, p.askWhom || 'her doctor', String(p.priority || '3'), 'open', '', nowUTC().slice(0, 10)]);
    logChange('Questions', id, '(none)', p.question, by, 'app');
    return json({ ok: true, id: id });
  },

  gap: function (p, by) {
    var s = sh('KnowledgeGaps');
    if (p.id) {
      var r = findRow('KnowledgeGaps', 0, p.id);
      if (r < 0) return err('unknown gap id: ' + p.id);
      if (p.status && !inEnum(p.status, ['open', 'in-progress', 'closed'])) return err('invalid status');
      updateFields('KnowledgeGaps', r, p, ['status'], p.id, by);
      return json({ ok: true, id: p.id });
    }
    var bad = need(p, ['gap']);
    if (bad) return err(bad);
    var id = nextId('KnowledgeGaps', 'G');
    s.appendRow([id, p.gap, p.whatAnswersIt || '', p.stepToClose || '', 'open', nowUTC().slice(0, 10)]);
    logChange('KnowledgeGaps', id, '(none)', p.gap, by, 'app');
    return json({ ok: true, id: id });
  },

  // Dipti's priorities: update one by id, or add a new one.
  priority: function (p, by) {
    var s = sh('Priorities');
    if (p.status && !inEnum(p.status, ['now', 'waiting', 'better', 'done'])) return err('invalid status');
    if (p.id) {
      var r = findRow('Priorities', 0, p.id);
      if (r < 0) return err('unknown priority id: ' + p.id);
      updateFields('Priorities', r, p, ['rank', 'title', 'status', 'why', 'plan', 'nextStep', 'askWhom'], p.id, by);
      return json({ ok: true, id: p.id });
    }
    var bad = need(p, ['title']);
    if (bad) return err(bad);
    var id = nextId('Priorities', 'P');
    s.appendRow([id, String(p.rank || getRows('Priorities').length + 1), p.title, p.status || 'now', p.why || '', p.plan || '', p.nextStep || '', p.askWhom || '', nowUTC().slice(0, 10)]);
    logChange('Priorities', id, '(none)', p.title, by, 'app');
    return json({ ok: true, id: id });
  },

  clinician: function (p, by) {
    var bad = need(p, ['name']);
    if (bad) return err(bad);
    var r = findRow('Clinicians', 0, p.name);
    if (r < 0) {
      sh('Clinicians').appendRow([p.name, p.role || '', p.owns || '', p.contact || '', p.lastSeen || '', p.notes || '']);
      logChange('Clinicians', p.name, '(none)', p.role || '', by, 'app');
    } else {
      updateFields('Clinicians', r, p, ['role', 'owns', 'contact', 'lastSeen', 'notes'], p.name, by);
    }
    return json({ ok: true });
  },

  profile: function (p, by) {
    var bad = need(p, ['key', 'value']);
    if (bad) return err(bad);
    var s = sh('Profile');
    var r = findRow('Profile', 0, p.key);
    var today = nowUTC().slice(0, 10);
    if (r < 0) {
      s.appendRow([p.key, p.value, 'app', today, 'no']);
      logChange('Profile', p.key, '(none)', p.value, by, 'app');
    } else {
      var oldV = s.getRange(r, 2).getValue();
      s.getRange(r, 2).setValue(p.value);
      s.getRange(r, 3).setValue('app');
      s.getRange(r, 4).setValue(today);
      s.getRange(r, 5).setValue('no');
      logChange('Profile', p.key, oldV, p.value, by, 'app');
    }
    return json({ ok: true });
  },

  condition: function (p, by) {
    var bad = need(p, ['name']);
    if (bad) return err(bad);
    var r = findRow('Conditions', 0, p.name);
    var today = nowUTC().slice(0, 10);
    if (r < 0) {
      sh('Conditions').appendRow([p.name, p.status || 'active', p.since || today, p.evidence || 'Stated', p.notes || '', 'app', today]);
      logChange('Conditions', p.name, '(none)', p.status || 'active', by, 'app');
    } else {
      updateFields('Conditions', r, p, ['status', 'notes'], p.name, by);
    }
    return json({ ok: true });
  },

  medication: function (p, by) {
    var bad = need(p, ['name']);
    if (bad) return err(bad);
    if (p.status && !inEnum(p.status, ['current', 'stopped', 'check'])) return err('invalid status');
    var r = findRow('Medications', 0, p.name);
    var today = nowUTC().slice(0, 10);
    if (r < 0) {
      sh('Medications').appendRow([p.name, p.generic || '', p.dose || '', p.timing || '', p.rx || '', p.purpose || '', p.status || 'current', 'app', today]);
      logChange('Medications', p.name, '(none)', p.status || 'current', by, 'app');
    } else {
      updateFields('Medications', r, p, ['generic', 'dose', 'timing', 'purpose', 'status'], p.name, by);
    }
    return json({ ok: true });
  }
};

/* ---------- one-time setup (run from the Apps Script editor) ---------- */

// Creates any missing tab with its header row, and a secret if there is none.
// Safe to run again: existing tabs and rows are never touched.
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach(function (name) {
    if (ss.getSheetByName(name)) return;
    var s = ss.insertSheet(name);
    s.appendRow(TABS[name].cols.map(function (c) { return c[0]; }));
    s.setFrozenRows(1);
  });
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('APP_SECRET')) props.setProperty('APP_SECRET', Utilities.getUuid() + Utilities.getUuid().slice(0, 8));
  Logger.log('APP_SECRET (put this in Vercel as SHEET_API_SECRET): ' + props.getProperty('APP_SECRET'));
}

/* ---------- entry points ---------- */

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.secret !== appSecret()) return err('bad secret');
    if (p.action === 'ping') return json({ ok: true, time: nowUTC() });
    if (p.action === 'read') return json(readCanon());
    return err('unknown action');
  } catch (ex) {
    return err('server error: ' + ex.message);
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.secret !== appSecret()) return err('bad secret');
    var fn = ACTIONS[body.action];
    if (!fn) return err('unknown action: ' + body.action);
    return fn(body.payload || {}, body.by || 'app');
  } catch (ex) {
    return err('server error: ' + ex.message);
  }
}
