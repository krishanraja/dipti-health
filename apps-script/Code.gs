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
// Columns are found by their header text, so a column added later, or moved
// by hand in the Sheet, still lines up. setup() adds any header that is
// missing, at the end of the tab, without touching existing rows.
var TABS = {
  Meta:          { mode: 'overwrite', cols: [['Key', 'key'], ['Value', 'value']] },
  Profile:       { mode: 'overwrite', cols: [['Key', 'key'], ['Value', 'value'], ['Source', 'source'], ['UpdatedAt', 'updated'], ['Verified', 'verified']] },
  Priorities:    { mode: 'overwrite', cols: [['ID', 'id'], ['Rank', 'rank'], ['Title', 'title'], ['Status', 'status'], ['WhyItMatters', 'why'], ['Plan', 'plan'], ['NextStep', 'nextStep'], ['AskWhom', 'askWhom'], ['UpdatedAt', 'updated'], ['CheckedAt', 'checked']] },
  Appointments:  { mode: 'overwrite', cols: [['ID', 'id'], ['Date', 'date'], ['Time', 'time'], ['With', 'with'], ['Where', 'where'], ['For', 'for'], ['Status', 'status'], ['Notes', 'notes'], ['UpdatedAt', 'updated'], ['CheckedAt', 'checked']] },
  Conditions:    { mode: 'overwrite', cols: [['Condition', 'name'], ['Status', 'status'], ['Since', 'since'], ['Evidence', 'evidence'], ['Notes', 'notes'], ['Source', 'source'], ['UpdatedAt', 'updated'], ['Key', 'key'], ['AlsoCalled', 'aliases'], ['Plain', 'plain']] },
  Medications:   { mode: 'overwrite', cols: [['Name', 'name'], ['Generic', 'generic'], ['Dose', 'dose'], ['Timing', 'timing'], ['Prescribed8Oct', 'rx'], ['Purpose', 'purpose'], ['Status', 'status'], ['Source', 'source'], ['UpdatedAt', 'updated'], ['CheckedAt', 'checked']] },
  TestResults:   { mode: 'append', cols: [['Date', 'date'], ['Test', 'test'], ['Result', 'result'], ['Range', 'range'], ['Lab', 'lab'], ['Notes', 'notes'], ['Source', 'source']] },
  CheckIns:      { mode: 'append', cols: [['TimestampUTC', 'tsUTC'], ['TimestampLocal', 'tsLocal'], ['By', 'by'], ['Tooth', 'tooth'], ['Abdomen', 'abdomen'], ['Fatigue', 'fatigue'], ['Sleep', 'sleep'], ['Bowels', 'bowels'], ['Mood', 'mood'], ['Verdict', 'verdict'], ['Notes', 'notes']] },
  Questions:     { mode: 'overwrite', cols: [['ID', 'id'], ['Question', 'question'], ['AskWhom', 'askWhom'], ['Priority', 'priority'], ['Status', 'status'], ['Answer', 'answer'], ['UpdatedAt', 'updated']] },
  KnowledgeGaps: { mode: 'overwrite', cols: [['ID', 'id'], ['Gap', 'gap'], ['WhatAnswersIt', 'whatAnswersIt'], ['StepToClose', 'stepToClose'], ['Status', 'status'], ['UpdatedAt', 'updated']] },
  Clinicians:    { mode: 'overwrite', cols: [['Name', 'name'], ['Role', 'role'], ['Owns', 'owns'], ['Contact', 'contact'], ['LastSeen', 'lastSeen'], ['Notes', 'notes']] },
  Evidence:      { mode: 'overwrite', cols: [['ID', 'id'], ['Kind', 'kind'], ['Title', 'title'], ['Severity', 'severity'], ['Grade', 'grade'], ['AppliesWhen', 'appliesWhen'], ['Entities', 'entities'], ['AskYourDoctor', 'ask'], ['Text', 'text'], ['Sources', 'sources'], ['Plain', 'plain'], ['AskPlain', 'askPlain']] },
  Sources:       { mode: 'overwrite', cols: [['ID', 'id'], ['Type', 'type'], ['Grade', 'grade'], ['Title', 'title'], ['Year', 'year'], ['URL', 'url']] },
  Notes:         { mode: 'append', cols: [['TimestampUTC', 'tsUTC'], ['By', 'by'], ['Text', 'text'], ['Tag', 'tag']] },
  Changelog:     { mode: 'append', cols: [['TimestampUTC', 'ts'], ['Tab', 'tab'], ['Key', 'key'], ['OldValue', 'old'], ['NewValue', 'new'], ['By', 'by'], ['Source', 'source']] }
};

var APPT_STATUS = ['booked', 'done', 'moved', 'cancelled'];
// Tabs whose rows the fact checker asks about, and the column that names a row.
var CHECKABLE = { Medications: 'name', Priorities: 'id', Appointments: 'id' };

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
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!s) return []; // a tab added in a newer Code.gs, before setup() has run
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).getValues();
}

// Header text -> 0-based column index, read from row 1 of the live tab.
function headerMap(name) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name), m = {};
  if (!s) return m;
  var w = s.getLastColumn();
  if (!w) return m;
  s.getRange(1, 1, 1, w).getValues()[0].forEach(function (h, i) {
    var k = String(h).trim();
    if (k && m[k] === undefined) m[k] = i;
  });
  return m;
}

function headerOf(tab, key) {
  var cols = TABS[tab].cols;
  for (var i = 0; i < cols.length; i++) if (cols[i][1] === key) return cols[i][0];
  throw new Error('no column ' + key + ' in ' + tab);
}

// 1-based column number for a key in a tab.
function col(tab, key) {
  var i = headerMap(tab)[headerOf(tab, key)];
  if (i === undefined) throw new Error('column ' + headerOf(tab, key) + ' is missing from ' + tab + ': run setup()');
  return i + 1;
}

// Every data row as {key: text}, keyed by the app's names.
function rowObjects(name) {
  var m = headerMap(name);
  return getRows(name).map(function (r) {
    var o = {};
    TABS[name].cols.forEach(function (c) {
      var i = m[c[0]];
      o[c[1]] = i === undefined || r[i] === undefined ? '' : String(r[i]);
    });
    return o;
  });
}

// Append one row from {key: value}, each value under its own header.
function appendObj(name, obj) {
  var s = sh(name), m = headerMap(name), row = [];
  for (var i = 0; i < s.getLastColumn(); i++) row.push('');
  TABS[name].cols.forEach(function (c) {
    if (m[c[0]] !== undefined && obj[c[1]] !== undefined && obj[c[1]] !== null) row[m[c[0]]] = obj[c[1]];
  });
  s.appendRow(row);
}

// 1-based row number of the first row whose key column matches val, or -1.
function findRow(name, key, val) {
  var r = rowObjects(name), want = String(val).trim().toLowerCase();
  for (var i = 0; i < r.length; i++) {
    if (String(r[i][key]).trim().toLowerCase() === want) return i + 2;
  }
  return -1;
}

function logChange(tab, key, oldV, newV, by, source) {
  appendObj('Changelog', { ts: nowUTC(), tab: tab, key: String(key), old: String(oldV), new: String(newV), by: by || 'app', source: source || 'app' });
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
  if (TABS[tab].cols.some(function (c) { return c[1] === 'updated'; })) s.getRange(row, col(tab, 'updated')).setValue(nowUTC().slice(0, 10));
  // A change made from a fact check also counts as checked today.
  if (p.checked && CHECKABLE[tab]) s.getRange(row, col(tab, 'checked')).setValue(nowUTC().slice(0, 10));
}

/* ---------- read: whole canon ---------- */

function readCanon() {
  function kv(name) {
    var o = {};
    rowObjects(name).forEach(function (r) { if (r.key) o[r.key] = r.value; });
    return o;
  }
  var arr = rowObjects;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    ok: true,
    meta: kv('Meta'),
    profile: kv('Profile'),
    priorities: arr('Priorities'),
    appointments: arr('Appointments'),
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
  rowObjects(tab).forEach(function (x) {
    var m = new RegExp('^' + prefix + '(\\d+)$').exec(x.id);
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
    var prevRows = rowObjects('CheckIns');
    var prev = prevRows.length ? prevRows[prevRows.length - 1] : null;
    var answers = { tooth: scores.tooth, abdomen: scores.abdomen, fatigue: scores.fatigue, sleep: a.sleep, bowels: a.bowels, mood: a.mood };
    var verdict = computeVerdict(answers, prev);
    var tsU = nowUTC(), tsL = nowLocal();
    appendObj('CheckIns', { tsUTC: tsU, tsLocal: tsL, by: by, tooth: scores.tooth, abdomen: scores.abdomen, fatigue: scores.fatigue, sleep: a.sleep, bowels: a.bowels, mood: a.mood, verdict: verdict, notes: p.notes || '' });
    return json({ ok: true, verdict: verdict, timestampUTC: tsU, timestampLocal: tsL });
  },

  note: function (p, by) {
    var bad = need(p, ['text']);
    if (bad) return err(bad);
    var tsU = nowUTC();
    appendObj('Notes', { tsUTC: tsU, by: by, text: p.text, tag: p.tag || '' });
    return json({ ok: true, timestampUTC: tsU });
  },

  testResult: function (p, by) {
    var bad = need(p, ['date', 'test', 'result']);
    if (bad) return err(bad);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return err('date must be YYYY-MM-DD');
    appendObj('TestResults', { date: p.date, test: p.test, result: p.result, range: p.range || '', lab: p.lab || '', notes: p.notes || '', source: by });
    return json({ ok: true });
  },

  question: function (p, by) {
    if (p.id) {
      var r = findRow('Questions', 'id', p.id);
      if (r < 0) return err('unknown question id: ' + p.id);
      if (p.status && !inEnum(p.status, ['open', 'asked', 'answered'])) return err('invalid status');
      updateFields('Questions', r, p, ['status', 'answer'], p.id, by);
      return json({ ok: true, id: p.id });
    }
    var bad = need(p, ['question']);
    if (bad) return err(bad);
    var id = nextId('Questions', 'Q');
    appendObj('Questions', { id: id, question: p.question, askWhom: p.askWhom || 'her doctor', priority: String(p.priority || '3'), status: 'open', answer: '', updated: nowUTC().slice(0, 10) });
    logChange('Questions', id, '(none)', p.question, by, 'app');
    return json({ ok: true, id: id });
  },

  gap: function (p, by) {
    if (p.id) {
      var r = findRow('KnowledgeGaps', 'id', p.id);
      if (r < 0) return err('unknown gap id: ' + p.id);
      if (p.status && !inEnum(p.status, ['open', 'in-progress', 'closed'])) return err('invalid status');
      updateFields('KnowledgeGaps', r, p, ['status'], p.id, by);
      return json({ ok: true, id: p.id });
    }
    var bad = need(p, ['gap']);
    if (bad) return err(bad);
    var id = nextId('KnowledgeGaps', 'G');
    appendObj('KnowledgeGaps', { id: id, gap: p.gap, whatAnswersIt: p.whatAnswersIt || '', stepToClose: p.stepToClose || '', status: 'open', updated: nowUTC().slice(0, 10) });
    logChange('KnowledgeGaps', id, '(none)', p.gap, by, 'app');
    return json({ ok: true, id: id });
  },

  // Dipti's priorities: update one by id, or add a new one.
  priority: function (p, by) {
    if (p.status && !inEnum(p.status, ['now', 'waiting', 'better', 'done'])) return err('invalid status');
    if (p.id) {
      var r = findRow('Priorities', 'id', p.id);
      if (r < 0) return err('unknown priority id: ' + p.id);
      updateFields('Priorities', r, p, ['rank', 'title', 'status', 'why', 'plan', 'nextStep', 'askWhom'], p.id, by);
      return json({ ok: true, id: p.id });
    }
    var bad = need(p, ['title']);
    if (bad) return err(bad);
    var id = nextId('Priorities', 'P');
    appendObj('Priorities', { id: id, rank: String(p.rank || getRows('Priorities').length + 1), title: p.title, status: p.status || 'now', why: p.why || '', plan: p.plan || '', nextStep: p.nextStep || '', askWhom: p.askWhom || '', updated: nowUTC().slice(0, 10) });
    logChange('Priorities', id, '(none)', p.title, by, 'app');
    return json({ ok: true, id: id });
  },

  clinician: function (p, by) {
    var bad = need(p, ['name']);
    if (bad) return err(bad);
    var r = findRow('Clinicians', 'name', p.name);
    if (r < 0) {
      appendObj('Clinicians', { name: p.name, role: p.role || '', owns: p.owns || '', contact: p.contact || '', lastSeen: p.lastSeen || '', notes: p.notes || '' });
      logChange('Clinicians', p.name, '(none)', p.role || '', by, 'app');
    } else {
      updateFields('Clinicians', r, p, ['role', 'owns', 'contact', 'lastSeen', 'notes'], p.name, by);
    }
    return json({ ok: true });
  },

  // Appointments: update one by id, or add a new one.
  appointment: function (p, by) {
    if (p.status && !inEnum(p.status, APPT_STATUS)) return err('invalid status');
    if (p.date && !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return err('date must be YYYY-MM-DD');
    if (p.id) {
      var r = findRow('Appointments', 'id', p.id);
      if (r < 0) return err('unknown appointment id: ' + p.id);
      updateFields('Appointments', r, p, ['date', 'time', 'with', 'where', 'for', 'status', 'notes'], p.id, by);
      return json({ ok: true, id: p.id });
    }
    var bad = need(p, ['date', 'with']);
    if (bad) return err(bad);
    var id = nextId('Appointments', 'A'), today = nowUTC().slice(0, 10);
    appendObj('Appointments', { id: id, date: p.date, time: p.time || '', with: p.with, where: p.where || '', for: p.for || '', status: p.status || 'booked', notes: p.notes || '', updated: today, checked: today });
    logChange('Appointments', id, '(none)', p.with + ' ' + p.date, by, 'app');
    return json({ ok: true, id: id });
  },

  // The fact checker: "still right" for one row. Changes go through the
  // tab's own action (with checked: true); this only records the check.
  check: function (p, by) {
    var keyCol = CHECKABLE[p.tab];
    if (!keyCol) return err('cannot check tab: ' + p.tab);
    var bad = need(p, ['key']);
    if (bad) return err(bad);
    var r = findRow(p.tab, keyCol, p.key);
    if (r < 0) return err('unknown ' + p.tab + ' row: ' + p.key);
    var today = nowUTC().slice(0, 10);
    sh(p.tab).getRange(r, col(p.tab, 'checked')).setValue(today);
    logChange(p.tab, rowObjects(p.tab)[r - 2][keyCol] + '.checked', '', 'still right', by, 'fact check');
    return json({ ok: true, checked: today });
  },

  profile: function (p, by) {
    var bad = need(p, ['key', 'value']);
    if (bad) return err(bad);
    var s = sh('Profile');
    var r = findRow('Profile', 'key', p.key);
    var today = nowUTC().slice(0, 10);
    if (r < 0) {
      appendObj('Profile', { key: p.key, value: p.value, source: 'app', updated: today, verified: 'no' });
      logChange('Profile', p.key, '(none)', p.value, by, 'app');
    } else {
      var oldV = s.getRange(r, col('Profile', 'value')).getValue();
      s.getRange(r, col('Profile', 'value')).setValue(p.value);
      s.getRange(r, col('Profile', 'source')).setValue('app');
      s.getRange(r, col('Profile', 'updated')).setValue(today);
      s.getRange(r, col('Profile', 'verified')).setValue('no');
      logChange('Profile', p.key, oldV, p.value, by, 'app');
    }
    return json({ ok: true });
  },

  condition: function (p, by) {
    var bad = need(p, ['name']);
    if (bad) return err(bad);
    var r = findRow('Conditions', 'name', p.name);
    var today = nowUTC().slice(0, 10);
    if (r < 0) {
      appendObj('Conditions', { name: p.name, status: p.status || 'watching', since: p.since || today, evidence: p.evidence || 'Stated', notes: p.notes || '', source: 'app', updated: today, aliases: p.aliases || '', plain: p.plain || '' });
      logChange('Conditions', p.name, '(none)', p.status || 'watching', by, 'app');
    } else {
      updateFields('Conditions', r, p, ['status', 'notes', 'aliases', 'plain'], p.name, by);
    }
    return json({ ok: true });
  },

  medication: function (p, by) {
    var bad = need(p, ['name']);
    if (bad) return err(bad);
    if (p.status && !inEnum(p.status, ['current', 'stopped', 'check'])) return err('invalid status');
    var r = findRow('Medications', 'name', p.name);
    var today = nowUTC().slice(0, 10);
    if (r < 0) {
      appendObj('Medications', { name: p.name, generic: p.generic || '', dose: p.dose || '', timing: p.timing || '', rx: p.rx || '', purpose: p.purpose || '', status: p.status || 'current', source: 'app', updated: today });
      logChange('Medications', p.name, '(none)', p.status || 'current', by, 'app');
    } else {
      updateFields('Medications', r, p, ['generic', 'dose', 'timing', 'purpose', 'status'], p.name, by);
    }
    return json({ ok: true });
  }
};

/* ---------- one-time setup (run from the Apps Script editor) ---------- */

// Creates any missing tab with its header row, adds any missing column
// header at the end of an existing tab, and makes a secret if there is none.
// Safe to run again: existing rows and values are never touched.
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach(function (name) {
    var s = ss.getSheetByName(name);
    if (!s) {
      s = ss.insertSheet(name);
      s.appendRow(TABS[name].cols.map(function (c) { return c[0]; }));
      s.setFrozenRows(1);
      Logger.log('Added tab ' + name);
      return;
    }
    var added = upgradeTab(name);
    if (added.length) Logger.log('Added to ' + name + ': ' + added.join(', '));
  });
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('APP_SECRET')) props.setProperty('APP_SECRET', Utilities.getUuid() + Utilities.getUuid().slice(0, 8));
  Logger.log('APP_SECRET (put this in Vercel as SHEET_API_SECRET): ' + props.getProperty('APP_SECRET'));
}

function upgradeTab(name) {
  var s = sh(name), m = headerMap(name), added = [];
  TABS[name].cols.forEach(function (c) {
    if (m[c[0]] !== undefined) return;
    s.getRange(1, s.getLastColumn() + 1).setValue(c[0]);
    added.push(c[0]);
  });
  return added;
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
