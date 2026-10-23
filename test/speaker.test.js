import test from 'node:test';
import assert from 'node:assert/strict';
import { speakerContext, repeatNote, systemPrompt, withSources, clean } from '../api/ask.js';
import { person, parseRoster } from '../public/js/people.js';

const roster = parseRoster([{ name: 'Krish' }]);

test('the doctor talks to Dipti directly', () => {
  assert.match(speakerContext(person({ role: 'dipti' })), /Talk to her directly as "you"/);
});
test('family hear "Dipti", by name', () => {
  const t = speakerContext(person({ role: 'family', who: 'krish', roster }));
  assert.match(t, /^Krish, family helping Dipti/);
  assert.match(t, /"Dipti's tooth"/);
});
test('a repeated question gets the back-to-the-plan note, never mentioned to her', () => {
  assert.equal(repeatNote(0), '');
  assert.match(repeatNote(2), /do not mention it[\s\S]*came up 2 times/i);
});
test('the prompt keeps worry in proportion and never names anxiety', () => {
  const p = systemPrompt({ evidence: [], sources: [] });
  assert.match(p, /Keep worry in proportion/);
  assert.match(p, /Never list possible diagnoses/);
  assert.match(p, /Do not mention anxiety/);
  assert.match(p, /never play down a real red flag/i);
});
test('pack ids cite their source; invented links are dropped', () => {
  const canon = { evidence: [{ id: 'IX01', title: 'Crisis risk', grade: 'A', sources: 'S1' }], sources: [{ id: 'S1', url: 'https://example.org/s1' }] };
  const a = withSources(clean({ reply: 'x', evidence: [{ point: 'p', ref: 'IX01' }, { point: 'q', ref: 'https://made.up/' }] }), [], canon);
  assert.deepEqual(a.evidence[0], { point: 'p', ref: 'IX01', title: 'Crisis risk', grade: 'A', url: 'https://example.org/s1' });
  assert.deepEqual(a.evidence[1], { point: 'q', ref: 'general' });
});
