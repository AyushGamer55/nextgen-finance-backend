const test = require('node:test');
const assert = require('node:assert/strict');

const { checkMlRuntime } = require('../services/mlInsightsService');

test('checkMlRuntime returns a structured status object', async () => {
  const status = await checkMlRuntime();

  assert.equal(typeof status.ready, 'boolean');
  assert.equal(typeof status.sklearn, 'boolean');
  assert.equal(typeof status.pythonCommand, 'string');
  assert.equal(typeof status.scriptPath, 'string');
});
