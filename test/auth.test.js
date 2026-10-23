import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET = 'x'.repeat(40);
const auth = await import('../lib/auth.js');
const cookieFrom = res => ({ headers: { cookie: res.h['Set-Cookie'].split(';')[0] } });
const fakeRes = () => ({ h: {}, setHeader(k, v) { this.h[k] = v; } });

test('no passcode in the environment means nobody gets in', () => {
  delete process.env.ACCESS_CODE; delete process.env.DIPTI_CODE;
  assert.equal(auth.configured(), false);
  assert.equal(auth.checkCode('dipti'), null);
  assert.equal(auth.checkCode(''), null);
});
test('the passcode works with any capitalisation', () => {
  process.env.ACCESS_CODE = 'Test-Code-9!';
  assert.equal(auth.checkCode('Test-Code-9!'), 'a');
  assert.equal(auth.checkCode(' test-code-9! '), 'a');
  assert.equal(auth.checkCode('dipti'), null);
  assert.equal(auth.checkCode('Test-Code-9'), null);
});
test('persona rides in the session; changing the passcode logs everyone out', () => {
  process.env.ACCESS_CODE = 'Test-Code-9!';
  const r = fakeRes(); auth.issueCookie(r, 'dipti', 'a');
  assert.deepEqual(auth.session(cookieFrom(r)), { role: 'dipti', via: 'a' });
  const f = fakeRes(); auth.issueCookie(f, 'family', 'a');
  assert.equal(auth.isAuthed(cookieFrom(f)), 'family');
  process.env.ACCESS_CODE = 'Something-else';
  assert.equal(auth.session(cookieFrom(r)), null);
  process.env.ACCESS_CODE = 'Test-Code-9!';
});
test('a tampered session is rejected', () => {
  const r = fakeRes(); auth.issueCookie(r, 'family', 'a');
  const [payload, sig] = r.h['Set-Cookie'].split(';')[0].split('=')[1].split('.');
  const p = JSON.parse(Buffer.from(payload, 'base64url'));
  const forged = Buffer.from(JSON.stringify({ ...p, r: 'dipti' })).toString('base64url');
  assert.equal(auth.session({ headers: { cookie: `dipti_session=${forged}.${sig}` } }), null);
});
test("Dipti's own code opens straight as Dipti, even with no family code", () => {
  delete process.env.ACCESS_CODE;
  process.env.DIPTI_CODE = 'Namaste-7';
  assert.equal(auth.configured(), true);
  assert.equal(auth.checkCode('namaste-7'), 'k');
  const r = fakeRes(); auth.issueCookie(r, 'dipti', 'k');
  assert.equal(auth.isAuthed(cookieFrom(r)), 'dipti');
  process.env.ACCESS_CODE = 'Test-Code-9!';
  delete process.env.DIPTI_CODE;
  assert.equal(auth.isAuthed(cookieFrom(r)), false);
});
test('Dipti is always the author of what she adds; Krish of what he adds', () => {
  assert.equal(auth.byFor('dipti', 'Krish'), 'Dipti');
  assert.equal(auth.byFor('family', 'Krish'), 'Krish');
  assert.equal(auth.byFor('family', ''), 'app');
});
