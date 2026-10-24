// A warmer wording of Dipti's note to a doctor. The phone builds the draft
// from her Sheet (public/js/brief.js) and shows it at once; this only offers
// a better-worded version, checked to keep exactly the same facts.
import { requireAuth } from '../lib/auth.js';
import { complete } from '../lib/ai.js';
import { keepsFacts, NOTE_SYSTEM } from '../lib/note.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const { draft = '', parts = {} } = req.body || {};
  if (!draft || String(draft).length > 1500) return res.status(400).json({ ok: false, error: 'No note' });
  try {
    const out = await complete({ req, system: NOTE_SYSTEM, user: `Draft:\n${draft}`, web: false, effort: 'low', maxTokens: 800 });
    const text = String(out.text || '').trim();
    if (!keepsFacts(draft, text, parts)) return res.status(200).json({ ok: true, text: draft, kept: 'draft' });
    return res.status(200).json({ ok: true, text });
  } catch (e) {
    return res.status(200).json({ ok: true, text: draft, kept: 'draft' });
  }
}
