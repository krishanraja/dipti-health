import test from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeHintEcho, plausible } from '../api/transcribe.js';

test('detects the hint echoed back on silence', () => {
  assert.equal(looksLikeHintEcho('Talking about my health: tooth pain, my dentist, root canal, prednisone'), true);
  assert.equal(looksLikeHintEcho('tooth pain, dentist, root canal, prednisone'), true);
});
test('real questions that use the same words pass', () => {
  assert.equal(looksLikeHintEcho('Should I ask my dentist about a crown for the root canal tooth?'), false);
  assert.equal(looksLikeHintEcho('My tooth hurts when I bite and I feel tired'), false);
});
test('junk from non-speech becomes empty', () => {
  assert.equal(plausible('富岡。'), '');
  assert.equal(plausible('...'), '');
  assert.equal(plausible('Is it okay?'), 'Is it okay?');
});
