// Invented record for local runs, screenshots and the simulation. It has the
// shape of Dipti's Sheet but none of her data: names, doses and values are
// made up. Real data lives only in her private Google Sheet.
const DAY = 86400000;
const iso = d => new Date(Date.now() - d * DAY).toISOString();

export function fixture() {
  const checkins = [];
  for (let d = 13; d >= 1; d--) {
    checkins.push({ tsUTC: iso(d), tsLocal: iso(d).slice(0, 16).replace('T', ' '), by: 'Dipti', tooth: String(Math.max(2, 8 - Math.floor((13 - d) / 3))), abdomen: String(3 + (d % 3)), fatigue: String(6 + (d % 2)), sleep: d % 3 ? 'ok' : 'poor', bowels: 'normal', mood: 'ok', verdict: 'Steady', notes: '' });
  }
  return {
    meta: { schema: 'v1' },
    profile: { summary: 'Woman, about 50. Example profile for local testing.', city: 'Pune', phone: 'MUST-NOT-LEAK' },
    priorities: [
      { id: 'P1', rank: '1', title: 'Tooth pain', status: 'now', why: 'Hurts to bite, even soft food.', plan: 'See an endodontist this week for a second opinion\nAsk for a bite test and a fresh X-ray\nAsk whether a crown would protect the tooth\nNight guard for grinding', nextStep: 'Book an endodontist appointment this week', askWhom: 'Dr Example (dentist)', updated: '' },
      { id: 'P2', rank: '2', title: 'Right-side tummy pain', status: 'waiting', why: 'Seven weeks; scan and bloods were clear.', plan: 'Get the stool test results\nAsk for a plan for the pain', nextStep: 'Call the clinic for the stool test results', askWhom: 'Dr Sample (gastro)', updated: '' },
      { id: 'P3', rank: '3', title: 'Tiredness', status: 'now', why: 'Tired all day, most days.', plan: 'Same bedtime every night\nAsk which medicines add to tiredness\nAsk about an adrenal test before any steroid change', nextStep: 'Ask at the next endocrine visit', askWhom: 'Dr Placeholder (endocrine)', updated: '' },
    ],
    conditions: [
      { name: 'Example autoimmune condition', status: 'long-term', since: '2024', evidence: 'Stated', notes: 'Example only', source: 'mock', updated: '', key: 'COND_EX1', aliases: 'Autoimmune example; liver', plain: 'An invented long-term condition, kept calm with Medicine A.' },
      { name: 'Example liver finding', status: 'watching', since: '2026-10-06', evidence: 'Doc', notes: 'Example ultrasound finding', source: 'mock', updated: '', key: 'COND_EX2', aliases: 'Liver finding', plain: 'An invented scan finding that is being watched.' },
      { name: 'Example tooth pain', status: 'watching', since: '2026-09-01', evidence: 'Doc', notes: 'Example dental note', source: 'mock', updated: '', key: 'COND_EX3', aliases: 'Tooth pain; dental', plain: 'Invented pain on biting, being looked into.' },
      { name: 'Example settled finding', status: 'settled', since: '2025', evidence: 'Doc', notes: 'Back to normal', source: 'mock', updated: '', key: 'COND_EX4', aliases: 'Settled example', plain: 'An invented finding that is back in range.' },
    ],
    medications: [
      { name: 'Medicine A', generic: 'alphazole', dose: '10 mg', timing: 'morning', rx: 'Same', purpose: 'Example', status: 'current', source: 'mock', updated: '' },
      { name: 'Medicine B', generic: 'betamine', dose: '20 mg', timing: 'morning and night', rx: '10 mg at night', purpose: 'Example pain', status: 'check', source: 'mock', updated: '' },
      { name: 'Medicine C', generic: 'gammacet', dose: '½ tablet', timing: 'morning', rx: 'Not on it', purpose: 'Example', status: 'check', source: 'mock', updated: '' },
      { name: 'Supplement D', generic: 'vitamin mix', dose: '1 tablet', timing: 'after lunch', rx: 'Same', purpose: 'Supplement', status: 'current', source: 'mock', updated: '' },
      { name: 'Old medicine E', generic: 'epsilonol', dose: '5 mg', timing: 'night', rx: '', purpose: 'Example', status: 'stopped', source: 'mock', updated: '' },
    ],
    testResults: [
      { date: '2026-04-10', test: 'GGT', result: '80 U/L', range: '5-38', lab: 'Example Labs', notes: '', source: 'mock' },
      { date: '2026-06-10', test: 'GGT', result: '90 U/L', range: '5-38', lab: 'Example Labs', notes: '', source: 'mock' },
      { date: '2026-10-05', test: 'GGT', result: '100 U/L', range: '5-38', lab: 'Example Labs', notes: '', source: 'mock' },
      { date: '2026-04-10', test: 'HbA1c', result: '6.2 %', range: '4.2-5.7', lab: 'Example Labs', notes: '', source: 'mock' },
      { date: '2026-10-05', test: 'HbA1c', result: '5.6 %', range: '4.2-5.7', lab: 'Example Labs', notes: '', source: 'mock' },
      { date: '2026-04-10', test: 'Vitamin D 25-OH', result: '25 ng/mL', range: '30-100', lab: 'Example Labs', notes: '', source: 'mock' },
      { date: '2026-10-05', test: 'Vitamin D 25-OH', result: '60 ng/mL', range: '30-100', lab: 'Example Labs', notes: '', source: 'mock' },
      { date: '2026-04-10', test: 'Cortisol, morning', result: '<1 ug/dL', range: '6.6-22.6', lab: 'Example Labs', notes: '', source: 'mock' },
      { date: '2026-10-05', test: 'Cortisol, morning', result: '1.5 ug/dL', range: '6.6-22.6', lab: 'Example Labs', notes: '', source: 'mock' },
    ],
    checkins,
    questions: [
      { id: 'Q1', question: 'Would a crown protect the tooth?', askWhom: 'Dr Example (dentist)', priority: '1', status: 'open', answer: '', updated: '' },
      { id: 'Q2', question: 'Can you do a bite test and a fresh X-ray?', askWhom: 'Dr Example (dentist)', priority: '1', status: 'open', answer: '', updated: '' },
      { id: 'Q3', question: 'What did the stool tests show?', askWhom: 'Dr Sample (gastro)', priority: '2', status: 'open', answer: '', updated: '' },
      { id: 'Q4', question: 'Should I have an adrenal test before any steroid change?', askWhom: 'Dr Placeholder (endocrine)', priority: '2', status: 'open', answer: '', updated: '' },
    ],
    gaps: [
      { id: 'G1', gap: 'Two medicine lists disagree for Medicine B', whatAnswersIt: 'The prescriber', stepToClose: 'Show both lists at the next visit', status: 'open', updated: '' },
      { id: 'G2', gap: 'Was the tooth root-canal treated?', whatAnswersIt: 'The dentist', stepToClose: 'Ask the dentist', status: 'open', updated: '' },
    ],
    clinicians: [
      { name: 'Dr Example', role: 'Dentist', owns: 'Tooth pain', contact: '', lastSeen: '', notes: '' },
      { name: 'Dr Sample', role: 'Gastroenterologist', owns: 'Tummy pain, liver', contact: '', lastSeen: '', notes: '' },
      { name: 'Dr Placeholder', role: 'Endocrinologist', owns: 'Steroids, sugar, tiredness', contact: '', lastSeen: '', notes: '' },
    ],
    evidence: [
      { id: 'MED_A', kind: 'medication', title: 'Medicine A (alphazole)', severity: '', grade: '', appliesWhen: 'both', entities: 'MED_A', text: 'Medicine A (alphazole), example notes.', sources: 'S1', plain: 'Medicine A' },
      { id: 'MED_B', kind: 'medication', title: 'Medicine B (betamine)', severity: '', grade: '', appliesWhen: 'both', entities: 'MED_B', text: 'Medicine B (betamine), example notes.', sources: 'S1', plain: 'Medicine B' },
      { id: 'LAB_GGT', kind: 'lab', title: 'GGT', severity: '', grade: 'A', appliesWhen: 'both', entities: 'LAB_GGT', text: 'Example lab notes.', sources: 'S1', plain: 'GGT' },
      { id: 'MAP_SYM_TIRED', kind: 'symptom_attribution', title: 'What can add to: Tiredness', severity: '', grade: 'E', appliesWhen: 'both', entities: 'SYM_TIRED MED_B', text: 'Example list of causes, never shown.', sources: '', plain: 'Tiredness' },
      { id: 'MED_OLD', kind: 'name', title: 'Old medicine E (epsilonol)', severity: '', grade: '', appliesWhen: '', entities: 'MED_OLD', text: '', sources: '', plain: 'Old medicine E (stopped)' },
      { id: 'IX01', kind: 'interaction', title: 'Example: steroid cover when unwell', severity: 'critical', grade: 'A', appliesWhen: 'both', entities: 'MED_A COND_EX1 SYM_TIRED', text: 'Example interaction text for testing.', sources: 'S1', ask: 'Example technical question for the doctor?', plain: 'Medicine A and how tired you feel affect each other (example).', askPlain: 'What should I do with Medicine A when I am unwell?' },
      { id: 'IX02', kind: 'interaction', title: 'Example: liver tests on Medicine B', severity: 'high', grade: 'B', appliesWhen: 'both', entities: 'MED_B COND_EX1 COND_EX2 LAB_GGT MED_OLD', text: 'Example interaction text two.', sources: 'S1', plain: 'Medicine B is processed by the liver, so liver tests matter (example).', askPlain: 'Is Medicine B still right for my liver?' },
      { id: 'REC_1', kind: 'recommendation', title: 'Example recommendation', severity: '', grade: 'A', appliesWhen: 'both', entities: 'IX01', text: 'Carry a steroid card (example).', sources: 'S1' },
    ],
    sources: [{ id: 'S1', type: 'guideline', grade: 'A', title: 'Example guideline', year: '2024', url: 'https://example.org/guideline' }],
    notes: [
      { tsUTC: iso(3), by: 'Dipti', tag: 'symptom-log', text: 'SYMPTOM: Tooth or gum pain, earlier today, moderate. Biting bread\nDATA: {"symptom":"tooth","when":"today","severity":"moderate","note":"Biting bread","level":"routine"}' },
      { tsUTC: iso(2), by: 'Krish', tag: 'fact', text: 'FACT: Dentist wants a specialist opinion (example)\nDATA: {"topic":"care","from":"chat"}' },
    ],
  };
}
