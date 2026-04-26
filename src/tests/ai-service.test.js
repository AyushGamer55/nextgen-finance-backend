const test = require('node:test');
const assert = require('node:assert/strict');

const { summarizeTransactions, buildRuleInsights, inferDateRange } = require('../services/financialAdvisorService');

test('inferDateRange defaults to this month', () => {
  const range = inferDateRange('show monthly summary');
  assert.equal(range.label, 'this month');
});

test('summarizeTransactions computes income, expenses, and savings rate inputs', () => {
  const summary = summarizeTransactions([
    { type: 'income', amount: 60000 },
    { type: 'expense', amount: 10000, category: 'Food & Dining' },
    { type: 'expense', amount: 15000, category: 'Bills & Utilities' },
  ]);

  assert.equal(summary.totalIncome, 60000);
  assert.equal(summary.totalExpenses, 25000);
  assert.equal(summary.savings, 35000);
  assert.equal(summary.topExpenseCategory.name, 'Bills & Utilities');
});

test('buildRuleInsights highlights dominant categories and savings', () => {
  const currentSummary = {
    totalIncome: 60000,
    totalExpenses: 25000,
    savings: 35000,
    savingsRate: 58,
    categories: {
      'Bills & Utilities': 15000,
      'Food & Dining': 10000,
    },
    topExpenseCategory: {
      name: 'Bills & Utilities',
      amount: 15000,
    },
  };

  const insights = buildRuleInsights(currentSummary, null);
  assert.ok(insights.some((item) => item.includes('highest expense')));
  assert.ok(insights.some((item) => item.includes('savings rate')));
});
