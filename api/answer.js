// Recover a reply the phone missed (connection dropped mid-wait).
import { requireAuth } from '../lib/auth.js';
import { readCanon, readAnswer } from '../lib/sheet.js';
import { CONTACTS } from '../public/js/triage.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  const q = req.query?.rid ?? new URL(req.url, 'http://x').searchParams.get('rid');
  const rid = String(q || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
  if (!rid) return res.status(400).json({ ok: false, error: 'missing rid' });
  try {
    let found = await readAnswer(rid).catch(() => null);
    if (!found || (!found.ok && /unknown action/.test(found.error || ''))) {
      // An older Code.gs without the answer action: the reply is in its Notes row.
      const canon = await readCanon({ timeoutMs: 20000 });
      const note = (canon.notes || []).filter(n => String(n.text).includes(`\nRID: ${rid}\n`)).pop();
      found = note ? { ok: true, note: String(note.text).split('\nDATA: ')[0], data: String(note.text).split('\nDATA: ')[1] || '' } : { ok: false };
    }
    if (!found.ok || !found.data) return res.status(404).json({ ok: false, pending: true });
    const data = JSON.parse(found.data);
    const concern = (String(found.note || '').match(/^CONCERN:\s*([\s\S]*?)\nURGENCY:/) || [, ''])[1];
    const answer = { replies: [], learned: [], results: [], ...data.answer };
    answer.reply ||= answer.headline || '';
    return res.status(200).json({ ok: true, rid, threadId: data.threadId || '', concern, answer, source: data.source, contacts: CONTACTS[answer.urgency], saved: true, recovered: true, triage: { level: answer.urgency, reasons: [] } });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e.message).slice(0, 160) });
  }
}
