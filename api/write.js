import { requireAuth, byFor } from '../lib/auth.js';
import { write, WRITE_ACTIONS } from '../lib/sheet.js';

export default async function handler(req, res) {
  const role = requireAuth(req, res);
  if (!role) return;
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const { action, payload, by, opId } = req.body || {};
  if (!WRITE_ACTIONS.includes(action)) return res.status(400).json({ ok: false, error: 'unknown action' });
  // Whatever Dipti adds is always attributed to her.
  try {
    const out = await write(action, payload || {}, byFor(role, by), { opId: String(opId || '').slice(0, 64) });
    return res.status(200).json(out);
  } catch (e) {
    // 422: the Sheet refused this write; retrying will not help. 502: try again later.
    return res.status(e.rejected ? 422 : 502).json({ ok: false, error: e.message, code: e.code || 'SHEET_ERROR', rejected: Boolean(e.rejected) });
  }
}
