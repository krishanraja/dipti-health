import { session, issueCookie } from '../lib/auth.js';
import { aiProvider } from '../lib/ai.js';
import { roster } from '../lib/people.js';

export default function handler(req, res) {
  let s = null;
  try { s = session(req); } catch { /* SESSION_SECRET missing */ }
  if (!s) return res.status(401).json({ ok: false, authed: false });
  const { role } = s;
  // Opening the app renews the month.
  issueCookie(res, role, s.via);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true, authed: true, role,
    sheetConfigured: Boolean(process.env.SHEET_API_SECRET && process.env.SHEET_API_URL),
    ai: aiProvider(req) || 'none',
    people: roster(),
  });
}
