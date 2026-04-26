const test = require('node:test');
const assert = require('node:assert/strict');

const { buildImportPreview } = require('../services/importPreviewService');

test('buildImportPreview separates accepted and skipped rows', () => {
  const preview = buildImportPreview([
    { amount: '1000', type: 'income', category: 'salary', description: 'Monthly salary', date: '2026-04-01' },
    { amount: '0', type: 'expense', category: 'food', description: 'Bad row', date: '2026-04-02' },
  ]);

  assert.ok(preview.previewId);
  assert.equal(preview.summary.totalRows, 2);
  assert.equal(preview.summary.acceptedRows, 1);
  assert.equal(preview.summary.skippedRows, 1);
  assert.equal(preview.acceptedRows[0].normalized.type, 'income');
  assert.equal(preview.skippedRows[0].reason, 'Amount must be greater than zero');
});

test('buildImportPreview counts inferred categories', () => {
  const preview = buildImportPreview([
    { amount: '450', type: 'expense', category: 'misc', description: 'Zomato order', date: '2026-03-15' },
  ]);

  assert.equal(preview.summary.acceptedRows, 1);
  assert.equal(preview.summary.inferredCategories, 1);
});
