"""Builds the first version of Dipti's Google Sheet as an .xlsx file.

Inputs live OUTSIDE this public repo:
  record.json   her record, transcribed from the health corpus, dental report and calls
  plain.json    (beside record.json) plain-language words: each condition's key, short
                names and summary; each entity's everyday label; each interaction's
                plain meaning and the question in her own words
  kb/           the research pack (knowledge_base.json, rag_chunks.jsonl)
Outputs (also outside the repo):
  Dipti-canon.xlsx   import into Google Sheets (one tab per Sheet tab, headers from data/schema.json)
  canon.json         the same data in the app's canon shape, for local rendering only

Usage: python3 -I scripts/build_seed.py <record.json> <kb dir> <out dir>
"""
import json
import os
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = '2026-10-23'

# canon key -> (tab, keys in the tab's column order). Must match TABS in apps-script/Code.gs.
COLS = {
    'Meta': ['key', 'value'],
    'Profile': ['key', 'value', 'source', 'updated', 'verified'],
    'Priorities': ['id', 'rank', 'title', 'status', 'why', 'plan', 'nextStep', 'askWhom', 'updated', 'checked'],
    'Appointments': ['id', 'date', 'time', 'with', 'where', 'for', 'status', 'notes', 'updated', 'checked'],
    'Conditions': ['name', 'status', 'since', 'evidence', 'notes', 'source', 'updated', 'key', 'aliases', 'plain'],
    'Medications': ['name', 'generic', 'dose', 'timing', 'rx', 'purpose', 'status', 'source', 'updated', 'checked'],
    'TestResults': ['date', 'test', 'result', 'range', 'lab', 'notes', 'source'],
    'CheckIns': ['tsUTC', 'tsLocal', 'by', 'tooth', 'abdomen', 'fatigue', 'sleep', 'bowels', 'mood', 'verdict', 'notes'],
    'Questions': ['id', 'question', 'askWhom', 'priority', 'status', 'answer', 'updated'],
    'KnowledgeGaps': ['id', 'gap', 'whatAnswersIt', 'stepToClose', 'status', 'updated'],
    'Clinicians': ['name', 'role', 'owns', 'contact', 'lastSeen', 'notes'],
    'Evidence': ['id', 'kind', 'title', 'severity', 'grade', 'appliesWhen', 'entities', 'ask', 'text', 'sources', 'plain', 'askPlain'],
    'Sources': ['id', 'type', 'grade', 'title', 'year', 'url'],
    'Notes': ['tsUTC', 'by', 'text', 'tag'],
    'Changelog': ['ts', 'tab', 'key', 'old', 'new', 'by', 'source'],
}
CANON_KEY = {'Priorities': 'priorities', 'Appointments': 'appointments', 'Conditions': 'conditions', 'Medications': 'medications', 'TestResults': 'testResults',
             'CheckIns': 'checkins', 'Questions': 'questions', 'KnowledgeGaps': 'gaps', 'Clinicians': 'clinicians',
             'Evidence': 'evidence', 'Sources': 'sources', 'Notes': 'notes', 'Changelog': 'changelog'}


def build(record, kb_dir, plain):
    kb = json.load(open(os.path.join(kb_dir, 'knowledge_base.json')))
    chunks = [json.loads(line) for line in open(os.path.join(kb_dir, 'rag_chunks.jsonl')) if line.strip()]
    src = 'Health corpus 23 Oct 2026'
    c = {k: [] for k in CANON_KEY.values()}
    c['meta'] = record['meta']
    c['profile'] = record['profile']

    for p in record['priorities']:
        c['priorities'].append({**p, 'updated': TODAY})
    for name, status, since, ev, notes in record['conditions']:
        key, aliases, words = plain['conditions'][name]
        # Status groups the Conditions tab: long-term, watching, or settled.
        status = 'long-term' if name in plain['longTerm'] else 'settled' if status == 'resolved' else 'watching'
        c['conditions'].append({'name': name, 'status': status, 'since': since, 'evidence': ev, 'notes': notes, 'source': src, 'updated': TODAY,
                                'key': key, 'aliases': aliases, 'plain': words})
    for name, generic, dose, timing, rx, purpose, status, note in record['medications']:
        c['medications'].append({'name': name, 'generic': generic, 'dose': dose, 'timing': timing, 'rx': rx,
                                 'purpose': purpose + (f'. {note}' if note else ''), 'status': status, 'source': '23 Oct list vs 8 Oct prescription', 'updated': TODAY})
    for name, generic, dose, timing, purpose in record['stopped']:
        c['medications'].append({'name': name, 'generic': generic, 'dose': dose, 'timing': timing, 'rx': '', 'purpose': purpose, 'status': 'stopped', 'source': src, 'updated': TODAY})
    for date, test, result, rng, lab, notes in record['tests']:
        c['testResults'].append({'date': date, 'test': test, 'result': result, 'range': rng, 'lab': lab, 'notes': notes, 'source': src})
    for i, (who, prio, q) in enumerate(record['questions'], 1):
        c['questions'].append({'id': f'Q{i}', 'question': q, 'askWhom': who, 'priority': prio, 'status': 'open', 'answer': '', 'updated': TODAY})
    for i, (gap, what, step) in enumerate(record['gaps'], 1):
        c['gaps'].append({'id': f'G{i}', 'gap': gap, 'whatAnswersIt': what, 'stepToClose': step, 'status': 'open', 'updated': TODAY})
    c['clinicians'] = record['clinicians']
    # Past visits on record become done appointments, so the list starts with history.
    seen = sorted((d['lastSeen'], d['name']) for d in record['clinicians'] if d.get('lastSeen'))
    for i, (date, name) in enumerate(seen, 1):
        c['appointments'].append({'id': f'A{i}', 'date': date, 'time': '', 'with': name, 'where': '', 'for': '', 'status': 'done',
                                  'notes': 'From the record', 'updated': TODAY, 'checked': TODAY})
    for date, text in record['symptoms']:
        c['notes'].append({'tsUTC': f'{date}T06:30:00.000Z', 'by': 'Dipti', 'text': f'REPORTED: {text}', 'tag': 'record'})
    for date, text in record['regimen']:
        c['notes'].append({'tsUTC': f'{date}T06:00:00.000Z', 'by': 'Record', 'text': f'MEDICINE CHANGE: {text}', 'tag': 'record'})
    c['notes'].sort(key=lambda n: n['tsUTC'])

    # Research pack -> Evidence rows. Titles name the entity, so the app can
    # match a question to the rows about it.
    meds = {m['id']: m for m in kb['medications_current']}
    labs = {l['id']: l for l in kb['labs']}
    ixs = {i['id']: i for i in kb['interactions']}
    syms = {s['id']: s for s in kb['symptoms']}
    recs = {f"REC_{r['priority']}": r for r in kb['recommendations']}
    for ch in chunks:
        cid, kind = ch['chunk_id'], ch['kind']
        ask = ''
        if kind == 'medication' and cid in meds:
            m = meds[cid]; title = f"{m['brand']} ({m['generic']})"
        elif kind == 'lab' and cid in labs:
            title = labs[cid]['name']
        elif kind == 'interaction' and cid in ixs:
            title = ixs[cid]['title']
            qs = ixs[cid].get('clinician_questions') or []
            ask = (qs if isinstance(qs, list) else [qs])[0] if qs else ''
        elif kind == 'symptom_attribution':
            sid = (ch.get('entities') or [''])[0]
            title = f"What can add to: {syms.get(sid, {}).get('name', sid)}"
        elif kind == 'recommendation' and cid in recs:
            title = recs[cid]['action'][:120]
            ask = recs[cid]['action']
        else:
            title = cid
        ents = ch.get('entities') or []
        words, ask_plain = '', ''
        if kind == 'interaction':
            words, ask_plain = plain['interactions'][cid]
        elif kind in ('medication', 'lab', 'symptom_attribution'):
            words = plain['labels'].get(ents[0] if ents else cid, '')
        c['evidence'].append({'id': cid, 'kind': kind, 'title': title, 'severity': ch.get('severity', ''), 'grade': ch.get('evidence', ''),
                              'appliesWhen': ch.get('applies_when', ''), 'entities': ' '.join(ents), 'ask': ask,
                              'text': ch['text'], 'sources': ' '.join(ch.get('source_ids') or []), 'plain': words, 'askPlain': ask_plain})
    # Every entity an interaction names gets an everyday label. Entities with
    # no row of their own (past medicines, some symptoms) get a short 'name' row.
    labelled = {(r['entities'].split() or [''])[0] for r in c['evidence'] if r['kind'] in ('medication', 'lab', 'symptom_attribution')}
    full = {m['id']: m['name'] for m in kb['medications_historical']} | {s['id']: s['name'] for s in kb['symptoms']} | {l['id']: l['name'] for l in kb['labs']}
    wanted = sorted({e for i in kb['interactions'] for e in i['members'] if not e.startswith('COND_')} - labelled)
    for e in wanted:
        c['evidence'].append({'id': e, 'kind': 'name', 'title': full.get(e, e), 'severity': '', 'grade': '', 'appliesWhen': '', 'entities': e,
                              'ask': '', 'text': '', 'sources': '', 'plain': plain['labels'][e], 'askPlain': ''})
    for s in kb['sources']:
        c['sources'].append({'id': s['id'], 'type': s.get('type', ''), 'grade': s.get('grade', ''), 'title': s.get('title', ''), 'year': str(s.get('year', '')), 'url': s.get('url', '')})
    return c


def write_xlsx(c, path):
    schema = json.load(open(os.path.join(ROOT, 'data', 'schema.json')))['tabs']
    wb = Workbook()
    wb.remove(wb.active)
    head_fill = PatternFill('solid', fgColor='E2F3F0')
    for tab, spec in schema.items():
        ws = wb.create_sheet(tab)
        ws.append(spec['headers'])
        if tab == 'Meta':
            rows = [[k, v] for k, v in c['meta'].items()]
        elif tab == 'Profile':
            rows = [[k, v, 'Health corpus 23 Oct 2026', TODAY, 'yes'] for k, v in c['profile'].items()]
        else:
            rows = [[r.get(k, '') for k in COLS[tab]] for r in c.get(CANON_KEY[tab], [])]
        for r in rows:
            ws.append(['' if v is None else str(v) for v in r])
        for cell in ws[1]:
            cell.font = Font(bold=True); cell.fill = head_fill
        ws.freeze_panes = 'A2'
        for i, h in enumerate(spec['headers'], 1):
            col = ws.cell(row=1, column=i).column_letter
            wide = h in ('Text', 'Plan', 'WhyItMatters', 'Result', 'Notes', 'Gap', 'Question', 'Title', 'Value', 'StepToClose')
            ws.column_dimensions[col].width = 60 if wide else 18
            if wide:
                for cell in ws[col][1:]:
                    cell.alignment = Alignment(wrap_text=True, vertical='top')
        assert [x.value for x in ws[1]] == spec['headers'], tab
    wb.save(path)


if __name__ == '__main__':
    record_path, kb_dir, out = sys.argv[1:4]
    plain = json.load(open(os.path.join(os.path.dirname(os.path.abspath(record_path)), 'plain.json')))
    canon = build(json.load(open(record_path)), kb_dir, plain)
    os.makedirs(out, exist_ok=True)
    write_xlsx(canon, os.path.join(out, 'Dipti-canon.xlsx'))
    json.dump(canon, open(os.path.join(out, 'canon.json'), 'w'), ensure_ascii=False, indent=1)
    print({k: len(v) for k, v in canon.items() if isinstance(v, list)})
