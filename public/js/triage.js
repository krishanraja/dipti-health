// Deterministic red-flag triage. Runs in the browser (instantly, offline) and
// on the server (before any AI call). The AI can raise urgency, never lower it.
// Sources: NHS / Society for Endocrinology steroid emergency guidance and the
// ESE/Endocrine Society 2024 guideline (adrenal crisis), NHS dental abscess
// and liver warning signs (see knowledge/dental-evidence.md and the Evidence
// tab in her Sheet).
//
// Calm by design: ordinary tooth pain, tiredness or a known ache stays
// "routine" or "soon". Only genuine red flags go higher.

export const LEVELS = ['routine', 'soon', 'urgent', 'emergency'];

const RULES = [
  // emergency: call an ambulance
  { level: 'emergency', why: 'Fainting, collapse or not responding',
    re: /(faint(ed)?|pass(ed)? out|collaps|black(ed)? out|lost conscious|unconscious|unresponsive)/i },
  { level: 'emergency', why: 'Struggling to breathe or swallow',
    re: /(can.?t|cannot|couldn.?t|struggling to|hard to|difficulty) (breathe|breathing|swallow|catch (my|her)? ?breath)|gasping|blue lips|throat (closing|swelling)/i },
  { level: 'emergency', why: 'Swelling spreading to the eye, neck or under the tongue',
    re: /(swell|swollen|puffy).{0,40}(eye|neck|throat|under (my|her)? ?tongue|floor of (my|her)? ?mouth)|(eye|neck).{0,20}(swell|swollen)/i },
  { level: 'emergency', why: 'Chest pain with sweating, breathlessness or spreading to the arm or jaw',
    re: /(chest).{0,40}(pain|pressure|tight|heavy|crush).{0,60}(sweat|clammy|breath|arm|jaw|nause)|(pain|pressure).{0,20}chest.{0,40}(right now|won.?t (go|stop)|minutes)/i },
  { level: 'emergency', why: 'Possible stroke signs (face, arm, speech)',
    re: /(face|mouth).{0,20}(droop|drooping|lopsided)|slurr|sudden(ly)? (weak|numb|confus|can.?t see)|one side.{0,20}(weak|numb)/i },
  { level: 'emergency', why: 'Very drowsy, hard to wake, or breathing slowly',
    re: /(can.?t|cannot|hard to) (wake|stay awake)|breathing (very )?slow|very (drowsy|sleepy) and/i },
  // urgent: same-day doctor (steroid sick-day rules, infection on immunosuppression)
  { level: 'urgent', why: 'Vomiting or repeated diarrhoea while on steroids: steroid sick-day rules apply today',
    re: /(vomit|being sick|throwing up|threw up|can.?t keep (anything|food|tablets|my tablets) down)|(diarrh?o?ea|loose (stool|motion)s?|watery (stool|poo)).{0,40}(again|times|all day|keeps|won.?t stop|several|many|\d)/i },
  { level: 'urgent', why: 'Fever or chills while on immune-lowering medicines',
    re: /\b(fever|feverish|high temperature|chills|shivering|rigou?rs)\b|\b(3[89]|40)(\.\d)? ?(°|deg|c\b)/i },
  { level: 'urgent', why: 'Face or jaw swelling with tooth pain',
    re: /(face|cheek|jaw|gum).{0,30}(swell|swollen|puffy)|(swell|swollen|puffy).{0,30}(face|cheek|jaw)|can.?t open (my|her)? ?mouth|pus|abscess/i },
  { level: 'urgent', why: 'Yellow skin or eyes, or dark urine with pale stools',
    re: /(yellow|jaundic).{0,30}(skin|eyes)|(skin|eyes).{0,20}(yellow|jaundic)|dark (urine|pee|wee).{0,40}pale/i },
  { level: 'urgent', why: 'Black stools or blood in vomit or stool',
    re: /(black|tarry) (stool|poo|motion)|vomit(ing|ed)? blood|blood in (my|her)? ?(stool|poo|motion|urine)|bleeding (that )?(won.?t|wouldn.?t) stop/i },
  { level: 'urgent', why: 'Severe tummy pain that is new or much worse',
    re: /(severe|worst|unbearable|excruciating|really bad|much worse).{0,30}(tummy|stomach|abdom|belly|side) ?(pain|ache)?|(tummy|stomach|abdom|belly).{0,20}(pain|ache).{0,30}(severe|unbearable|excruciating|much worse)/i },
  { level: 'urgent', why: 'Stiff muscles, shaking or confusion with a fever (possible medicine reaction)',
    re: /(stiff|rigid|shaking|tremor|twitch|confus|agitat).{0,40}(fever|sweat|hot)|(fever|sweat).{0,40}(stiff|rigid|shaking|tremor|twitch|confus)/i },
  { level: 'urgent', why: 'Missed or ran out of steroid tablets',
    re: /(missed|forgot|ran out|run out|out of|stopped|no more).{0,30}(pred|steroid|wysolone|omnacortil)|(pred|steroid).{0,30}(missed|forgot|ran out|run out|stopped)/i },
  // soon: mention to the right doctor this week
  { level: 'soon', why: 'Dizziness or light-headedness',
    re: /(dizzy|dizziness|light.?headed|woozy|unsteady)/i },
  { level: 'soon', why: 'Diarrhoea (if it becomes repeated, steroid sick-day rules apply)',
    re: /(diarrh?o?ea|loose (stool|motion)s?|runny tummy)/i },
  { level: 'soon', why: 'Possible medicine side effect',
    re: /(side effect|reaction to|since (i|she) started).{0,40}|(tablet|medicine|medication|dose).{0,30}(rash|itch|swell|sick|dizzy)/i },
];

// "No fever", "not vomiting": a sign someone says they do NOT have is not a hit.
const NEGATED = /\b(no|not|without|never|denies|isn.?t|wasn.?t|haven.?t had|hasn.?t had)\s+(any\s+|a\s+|been\s+)?(fever|feverish|temperature|chills|vomit\w*|sick|diarrh?o?ea|swelling|swollen|blood|dizz\w*|faint\w*)\b/gi;

export function triage(text) {
  const t = String(text || '').replace(NEGATED, ' ');
  const hits = RULES.filter(r => r.re.test(t));
  let level = 'routine';
  for (const h of hits) if (LEVELS.indexOf(h.level) > LEVELS.indexOf(level)) level = h.level;
  const reasons = [...new Set(hits.filter(h => h.level === level).map(h => h.why))];
  return { level, reasons };
}

export function maxLevel(a, b) {
  return LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b;
}

// The steroid sick-day reminder (from the Evidence tab, recommendation 1).
// Her doctors set her exact plan; this is the general rule to check with them.
export const SICK_DAY = 'On long-term steroids: never stop prednisone suddenly. With vomiting, repeated diarrhoea or fever, follow the sick-day plan your doctor gave you (usually extra steroid) and call them today. If you cannot keep tablets down, go to an emergency department and show your steroid card.';

// Who to contact, said to Dipti herself. She lives in India and spends about
// three months a year in the UK, so both sets of numbers are given.
export const CONTACTS_SELF = {
  emergency: { title: 'Get help now', lines: ['India: call 112 or 108 for an ambulance. UK: call 999.', 'Tell them you take long-term steroids and show your steroid card.'] },
  urgent: { title: 'Call your doctor today', lines: ['Call the doctor who looks after this today. If you cannot reach them, go to the hospital emergency department.', 'UK: call 111 any time.'] },
  soon: { title: 'Mention it this week', lines: ['Not an emergency. Add it to your questions for the right doctor.'] },
  routine: { title: 'Nothing worrying', lines: ['It is in your record for your next appointment.'] },
};

// The same advice, said to family helping out (who may be in another country).
export const CONTACTS = {
  emergency: { title: 'Get Dipti help now', lines: ['Call Dipti. If she cannot call, someone near her calls 112 or 108 (India) or 999 (UK).', 'Make sure they know she takes long-term steroids.'] },
  urgent: { title: 'Dipti should speak to a doctor today', lines: ['Help her reach the doctor who looks after this today, or the hospital emergency department.', 'UK: 111 any time.'] },
  soon: { title: 'Worth mentioning this week', lines: ['Add it to her questions for the right doctor.'] },
  routine: { title: 'Nothing worrying', lines: ['It is in her record for the next appointment.'] },
};
