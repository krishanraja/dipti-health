// Checks a warmer rewrite of Dipti's note to a doctor (public/js/brief.js)
// before it is shown. The rewrite may change wording only: no new numbers, no
// extra questions, same doctor, same sign-off, still short.
const nums = s => (String(s).match(/\d+(?:\.\d+)?/g) || []);

export function keepsFacts(draft, rewrite, parts = {}) {
  const r = String(rewrite || '').trim();
  if (!r || r.length > 1100) return false;
  const allowed = new Set(nums(draft));
  if (nums(r).some(n => !allowed.has(n))) return false;
  const q = (r.match(/\?/g) || []).length;
  if (q > Math.max(2, (String(draft).match(/\?/g) || []).length)) return false;
  if (parts.to && !r.includes(parts.to)) return false;
  if (parts.from && !r.trimEnd().endsWith(parts.from)) return false;
  return true;
}

export const NOTE_SYSTEM = `You polish a short message that Dipti will send to one of her doctors. Write it in her own voice: first person, warm, polite, a little inquiring, plain British English, like a thoughtful patient writing to someone she trusts.

Rules:
- Keep every fact, medicine, dose and question exactly as given. Add nothing: no new facts, numbers, symptoms, diagnoses or questions.
- At most two questions, the same ones as the draft.
- Under 110 words. No headings, no lists of more than two items, no medical jargon she would not use.
- Start with the same greeting line and end with "Thank you so much." then her first name on its own line, as in the draft.
- Never mention anxiety, worry levels or AI.

Return only the message text.`;
