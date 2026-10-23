// Ellie's proposed Sheet updates, checked before Dipti ever sees them.
// The model may only propose recording a change she reported: a medicine
// started, stopped or changed; an appointment booked, moved, done or
// cancelled; a priority easing or sorted. Anything else is dropped. Nothing
// is written until she taps Yes in the chat.
const s = (x, n) => String(x ?? '').trim().slice(0, n);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const same = (a, b) => s(a, 200).toLowerCase() === s(b, 200).toLowerCase();

export function cleanUpdates(list, canon = {}) {
  const out = [];
  for (const u of Array.isArray(list) ? list : []) {
    if (!u || typeof u !== 'object' || out.length >= 2) continue;
    const say = s(u.say, 140);
    const p = u.payload && typeof u.payload === 'object' ? u.payload : {};
    if (!say) continue;
    if (u.kind === 'medication') {
      const name = s(p.name, 80);
      if (!name) continue;
      const known = (canon.medications || []).find(m => same(m.name, name));
      const status = ['current', 'stopped'].includes(p.status) ? p.status : undefined;
      const payload = { name: known ? known.name : name };
      if (status) payload.status = status;
      if (p.dose) payload.dose = s(p.dose, 80);
      if (p.timing) payload.timing = s(p.timing, 80);
      if (!known && status === 'stopped') continue; // nothing to stop
      if (Object.keys(payload).length === 1) continue;
      out.push({ kind: 'medication', action: 'medication', say, payload });
    } else if (u.kind === 'appointment') {
      const status = ['booked', 'done', 'moved', 'cancelled'].includes(p.status) ? p.status : undefined;
      const known = p.id && (canon.appointments || []).find(a => same(a.id, p.id));
      const payload = {};
      if (known) payload.id = known.id;
      if (p.date && DATE.test(p.date)) payload.date = p.date;
      if (p.time) payload.time = s(p.time, 10);
      if (p.with) payload.with = s(p.with, 80);
      if (p.for) payload.for = s(p.for, 120);
      if (status) payload.status = status === 'moved' ? 'booked' : status;
      if (!known && !(payload.date && payload.with)) continue; // a new one needs a date and who
      if (known && Object.keys(payload).length === 1) continue;
      out.push({ kind: 'appointment', action: 'appointment', say, payload });
    } else if (u.kind === 'priority') {
      const known = (canon.priorities || []).find(x => same(x.id, p.id));
      if (!known || !['now', 'waiting', 'better', 'done'].includes(p.status)) continue;
      out.push({ kind: 'priority', action: 'priority', say, payload: { id: known.id, status: p.status } });
    }
  }
  return out;
}
