// Who is using the app. Dipti is "you"; anyone else (Krish, family helping
// out) is talked to by name, and Dipti is "Dipti" to them. The optional
// family list lives in Vercel env PEOPLE (this repo is public), e.g.
// [{"name":"Krish"}]. Pure functions; browser, server and tests.

const clean = (s, n = 40) => String(s ?? '').replace(/[^\p{L}\p{N} '.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, n);
const key = s => clean(s).toLowerCase();

export function parseRoster(raw) {
  let list = raw;
  if (typeof raw === 'string') { try { list = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(list)) return [];
  return list.map(p => ({
    name: clean(p?.name), aliases: (Array.isArray(p?.aliases) ? p.aliases : []).map(a => clean(a)).filter(Boolean).slice(0, 6),
    patient: p?.patient === true,
  })).filter(p => p.name).slice(0, 20);
}

export function matchPerson(roster, name) {
  const k = key(name);
  if (!k) return null;
  return (roster || []).find(p => key(p.name) === k || p.aliases.some(a => key(a) === k)) || null;
}

// The person on this phone. role comes from the session; who from the phone.
//   her / herPoss: labels in this person's voice ("Dipti", "Dipti's", or "my")
//   doc / docPoss: how the doctor refers to Dipti when talking to them
export function person({ role, who, roster } = {}) {
  if (role === 'dipti') {
    return { id: 'dipti', name: 'Dipti', dipti: true, known: true, her: 'me', herPoss: 'my', doc: 'you', docPoss: 'your' };
  }
  const match = matchPerson(roster, who);
  const name = match?.name || clean(who);
  if (match?.patient || key(name) === 'dipti') return person({ role: 'dipti' });
  return { id: name ? 'p-' + key(name).replace(/[^a-z0-9]+/g, '-') : 'family', name, dipti: false, known: Boolean(name), her: 'Dipti', herPoss: "Dipti's", doc: 'Dipti', docPoss: "Dipti's" };
}
