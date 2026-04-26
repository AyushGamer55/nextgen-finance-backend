const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMonthlyFeatureRows } = require('../services/mlInsightsService');

test('buildMonthlyFeatureRows creates monthly training data from transactions', () => {
  const rows = buildMonthlyFeatureRows([
    {
      type: 'income',
      amount: 50000,
      date: '2026-01-05T00:00:00.000Z',
    },
    {
      type: 'expense',
      amount: 15000,
      category: 'Bills & Utilities',
      date: '2026-01-15T00:00:00.000Z',
    },
    {
      type: 'expense',
      amount: 5000,
      category: 'Shopping',
      date: '2026-02-05T00:00:00.000Z',
    },
    {
      type: 'income',
      amount: 52000,
      date: '2026-02-12T00:00:00.000Z',
    },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].month, '2026-01');
  assert.equal(rows[0].income, 50000);
  assert.equal(rows[0].expenses, 15000);
  assert.equal(rows[0].savings, 35000);
  assert.equal(rows[1].month, '2026-02');
  assert.equal(rows[1].topCategory, 'Shopping');
  assert.ok(rows[1].expenseToIncomeRatio > 0);
});
