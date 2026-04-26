const test = require('node:test');
const assert = require('node:assert/strict');

const { registerValidation, loginValidation } = require('../utils/validators');

test('registerValidation accepts valid payloads', () => {
  const { error } = registerValidation.validate({
    name: 'Ayush',
    email: 'ayush@example.com',
    password: 'secret123',
  });

  assert.equal(error, undefined);
});

test('registerValidation rejects short passwords', () => {
  const { error } = registerValidation.validate({
    name: 'Ayush',
    email: 'ayush@example.com',
    password: '123',
  });

  assert.ok(error);
});

test('loginValidation rejects malformed email', () => {
  const { error } = loginValidation.validate({
    email: 'not-an-email',
    password: 'secret123',
  });

  assert.ok(error);
});
