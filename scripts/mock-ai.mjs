// A scripted stand-in for the model, for local runs and UI tests only
// (dev server with MOCK_AI=1). It returns the same JSON shapes the real
// prompts ask for and streams its text the way the real stream does.
// Invented values only.
const sleep = ms => new Promise(r => setTimeout(r, ms));

function latest(user) {
  const text = Array.isArray(user) ? user.filter(b => b.type === 'text').map(b => b.text).join('\n') : String(user);
  return { text, msg: (text.split(/\n# Latest message from [^\n]*\n/)[1] || text).trim(), image: Array.isArray(user) && user.some(b => b.type === 'image') };
}

const PHOTO_ROWS = [
  { date: '2026-11-02', test: 'GGT', result: '96 U/L', range: '5-38', lab: 'Example Labs', notes: 'H' },
  { date: '2026-11-02', test: 'HbA1c', result: '5.6 %', range: '4.2-5.7', lab: 'Example Labs', notes: '' },
];

const self = text => /Talk to her directly as "you"/.test(text);

function chat(msg, image, prompt) {
  const m = msg.toLowerCase(), you = self(prompt), her = you ? 'your' : "Dipti's", she = you ? 'you' : 'Dipti';
  const repeat = /already came up/.test(prompt);
  if (image) return {
    reply: `Good news on balance. GGT (a liver enzyme) is 96, down from before, and HbA1c is 5.6, back in range. Shall I save these to ${her} record?`,
    urgency: 'routine', doNow: ['Tap Save so the record has the new numbers.'], watchFor: [], askTheDoctor: ['Is the GGT coming down fast enough?'],
    evidence: [{ point: 'GGT is watched as a trend', ref: 'general' }], usedFromRecord: ['GGT above range before'],
    replies: ['Yes, save them', 'What does GGT mean?', 'Thanks'], learned: [], results: PHOTO_ROWS, limits: '',
  };
  // "I stopped Medicine B" / "appointment moved": propose the Sheet change.
  const stopped = /\bstopped ([a-z][\w -]{1,30}?)(?:\s+(?:today|yesterday|last \w+)|[.,!]|$)/i.exec(msg);
  if (stopped) return {
    reply: `Thanks for telling me. Stopping a medicine is something to check with the doctor who prescribed it, so ${you ? 'let them know' : 'Dipti should let them know'}. I can update the Sheet so the list stays right.`,
    urgency: 'routine', doNow: ['Tell the prescriber you have stopped it.'], watchFor: [], askTheDoctor: ['Is it fine to stay off it?'],
    evidence: [], usedFromRecord: [], replies: ['Yes, update it', 'Thanks'], learned: [], results: [], limits: '',
    updates: [{ kind: 'medication', say: `Mark ${stopped[1].trim()} as stopped from today?`, payload: { name: stopped[1].trim(), status: 'stopped' } }],
  };
  if (/swell/.test(m) && /(eye|neck)/.test(m)) return {
    reply: `This needs help now. Swelling spreading from a tooth towards the eye or neck can be a spreading infection. ${you ? 'Go' : 'Dipti should go'} to the nearest emergency department today.`,
    urgency: 'emergency', doNow: ['Go to the hospital emergency department now. Mention long-term steroids.'], watchFor: [], askTheDoctor: [],
    evidence: [{ point: 'Spreading facial swelling is a dental emergency', ref: '1' }], usedFromRecord: ['On long-term steroids'],
    replies: ['I am on my way', 'Who should I call?'], learned: [], results: [], limits: '',
  };
  if (/tooth|bite|molar|dentist/.test(m)) return repeat ? {
    reply: `Same plan as earlier, and it is still the right one. Nothing you have described is new or more urgent. The next step is booking the endodontist (root-canal specialist) this week.`,
    urgency: 'routine', doNow: ['Call the endodontist clinic and ask for the first appointment.'], watchFor: ['Face swelling or fever: see a dentist the same day.'], askTheDoctor: [],
    evidence: [], usedFromRecord: ['Tooth plan in priorities'], replies: ['I have booked it', 'What should I take?', 'Thanks'], learned: [], results: [], limits: '',
  } : {
    reply: `Not an emergency. Pain on biting, with no swelling or fever, fits a cracked tooth, which is common and treatable. The faster route is a second opinion from an endodontist (root-canal specialist) in Pune, rather than waiting three months.`,
    urgency: 'routine', doNow: ['Book an endodontist this week. Ask for a bite test and a fresh X-ray of the tooth.'], watchFor: ['Face swelling or fever: see a dentist the same day.'], askTheDoctor: ['Would a crown protect the tooth?'],
    evidence: [{ point: 'Cracked teeth often do not show on X-rays', ref: '1' }], usedFromRecord: ['Scan suggested a possible hairline crack'],
    replies: ['How do I find one?', 'Can I take a painkiller?', 'What about my steroids?'],
    learned: /night guard|since|every/.test(m) ? [{ topic: 'symptom', fact: 'Tooth pain worst on biting, eases at rest (Nov 2026)' }] : [], results: [], limits: 'Only an examination can confirm a crack.',
  };
  if (/tummy|stomach|liver|abdom|right side/.test(m)) return {
    reply: `Probably not something dangerous. ${you ? 'Your' : "Dipti's"} ultrasound showed a normal gallbladder and no worrying change in the liver, so the common serious causes are already ruled out. It is still worth a clear plan with the gastroenterologist.`,
    urgency: 'soon', doNow: ['Ask the gastroenterologist for the stool test results and a plan for the pain.'], watchFor: ['Yellow eyes, black stools or fever: call the doctor today.'], askTheDoctor: ['What else could cause this pain, and what is the plan?'],
    evidence: [{ point: 'A normal ultrasound rules out gallstones', ref: 'general' }], usedFromRecord: ['Ultrasound normal gallbladder'],
    replies: ['It has been weeks', 'Is it my medicines?', 'Thanks'], learned: [], results: [], limits: 'Only an examination can say more.',
  };
  if (/thank/.test(m)) return { reply: `Any time, ${you ? 'Dipti' : 'and thanks for helping'}. I'm here whenever ${she} needs me.`, urgency: 'routine', doNow: [], watchFor: [], askTheDoctor: [], evidence: [], usedFromRecord: [], replies: ['What is my next step?', 'How are my results?'], learned: [], results: [], limits: '' };
  return {
    reply: `Nothing worrying in that. Tiredness has several causes in ${her} record, and the plan is to look at them one at a time with ${you ? 'your' : 'her'} doctors, starting with sleep.`,
    urgency: 'routine', doNow: ['Keep the same bedtime this week and note your sleep in the check-in.'], watchFor: [], askTheDoctor: ['Could any of my medicines be adding to the tiredness?'],
    evidence: [{ point: 'Several medicines can add to tiredness', ref: 'general' }], usedFromRecord: ['Tiredness is a priority'],
    replies: ['What else can I do?', 'Is it my steroids?', 'Thanks'], learned: [], results: [], limits: '',
  };
}

export async function mockComplete({ system, user, onProgress = () => {}, onText = () => {}, web }) {
  const { msg, image, text: prompt } = latest(user);
  let out;
  if (/"unreadable": "/.test(system)) out = { kind: 'lab report', summary: 'A liver and sugar blood test from 2 November. Both are better than before.', results: PHOTO_ROWS, unreadable: '' };
  else {
    if (web && /cost|price|where/i.test(msg)) { onProgress({ kind: 'search' }); await sleep(300); onProgress({ kind: 'results', n: 5 }); }
    await sleep(400);
    out = chat(msg, image, prompt);
  }
  const text = JSON.stringify(out);
  onText(null); onProgress({ kind: 'writing' });
  for (let i = 0; i < text.length; i += 24) { onText(text.slice(i, i + 24)); await sleep(12); }
  return { text, model: 'mock', tools: 'none', sources: [] };
}
