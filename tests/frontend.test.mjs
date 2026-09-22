import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl } from '../frontend/src/lib/format.js';
import { isStrongPassword } from '../frontend/src/lib/password.js';
test('proof links reject executable protocols and attribute escapes', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,hello', 'https://x.com/a"b', 'https://x.com/a b', '']) assert.equal(safeUrl(value), '#');
  assert.equal(safeUrl('https://x/y?a=b'), 'https://x/y?a=b');
});
test('password policy requires length, uppercase letter, number and special character', () => {
  for (const value of ['Ab1!', 'password1!', '1234567!', 'Password!!', 'Password12']) assert.equal(isStrongPassword(value), false);
  assert.equal(isStrongPassword('Pangya1!'), true);
});
