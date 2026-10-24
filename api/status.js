// Is the Sheet's script current? Shown in settings, so Krish can tell at a
// glance whether the latest Code.gs is deployed.
import { requireAuth } from '../lib/auth.js';
import { pingSheet } from '../lib/sheet.js';

export const SHEET_VERSION = '2026-10-24b';
export const NEEDED = ['feedback', 'journal', 'chat', 'check', 'appointment'];

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  try {
    const p = await pingSheet();
    const actions = Array.isArray(p.actions) ? p.actions : [];
    const missing = NEEDED.filter(a => !actions.includes(a));
    return res.status(200).json({ ok: true, version: p.version || 'older', current: !missing.length && p.version >= SHEET_VERSION, missing });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.code === 'NO_SECRET' ? 'Sheet not connected' : 'Sheet not reachable' });
  }
}
