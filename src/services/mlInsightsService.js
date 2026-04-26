const path = require('path');
const { spawn } = require('child_process');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

const DISCRETIONARY_CATEGORIES = new Set([
  'Shopping',
  'Entertainment',
  'Travel',
  'Food & Dining',
  'Other',
]);

const ESSENTIAL_CATEGORIES = new Set([
  'Bills & Utilities',
  'Healthcare',
  'Education',
  'Transportation',
]);

function monthKeyFromDate(dateInput) {
  const date = new Date(dateInput);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildEmptyMonth(month) {
  return {
    month,
    income: 0,
    expenses: 0,
    savings: 0,
    remainingBalance: 0,
    savingsRate: 0,
    expenseToIncomeRatio: 0,
    topCategoryShare: 0,
    discretionaryShare: 0,
    essentialShare: 0,
    transactionCount: 0,
    categoryTotals: {},
  };
}

function finalizeMonthSummary(monthSummary, runningBalance) {
  const categoryEntries = Object.entries(monthSummary.categoryTotals || {}).sort((a, b) => b[1] - a[1]);
  const topCategoryAmount = categoryEntries[0]?.[1] || 0;
  const discretionaryAmount = categoryEntries
    .filter(([category]) => DISCRETIONARY_CATEGORIES.has(category))
    .reduce((sum, [, amount]) => sum + amount, 0);
  const essentialAmount = categoryEntries
    .filter(([category]) => ESSENTIAL_CATEGORIES.has(category))
    .reduce((sum, [, amount]) => sum + amount, 0);

  const income = monthSummary.income;
  const expenses = monthSummary.expenses;
  const savings = income - expenses;

  return {
    month: monthSummary.month,
    income,
    expenses,
    savings,
    remainingBalance: runningBalance,
    savingsRate: income > 0 ? savings / income : 0,
    expenseToIncomeRatio: income > 0 ? expenses / income : expenses > 0 ? 1 : 0,
    topCategoryShare: expenses > 0 ? topCategoryAmount / expenses : 0,
    discretionaryShare: expenses > 0 ? discretionaryAmount / expenses : 0,
    essentialShare: expenses > 0 ? essentialAmount / expenses : 0,
    transactionCount: monthSummary.transactionCount,
    topCategory: categoryEntries[0]?.[0] || null,
    categoryTotals: monthSummary.categoryTotals,
  };
}

function buildMonthlyFeatureRows(transactions, openingBalance = 0) {
  const monthlyMap = new Map();

  for (const transaction of transactions) {
    const month = monthKeyFromDate(transaction.date);
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, buildEmptyMonth(month));
    }

    const bucket = monthlyMap.get(month);
    const amount = Number(transaction.amount || 0);

    if (transaction.type === 'income') {
      bucket.income += amount;
    } else if (transaction.type === 'expense') {
      bucket.expenses += amount;
      const category = transaction.category || 'Other';
      bucket.categoryTotals[category] = (bucket.categoryTotals[category] || 0) + amount;
    }

    bucket.transactionCount += 1;
  }

  const orderedMonths = Array.from(monthlyMap.keys()).sort();
  let runningBalance = Number(openingBalance || 0);

  return orderedMonths.map((month) => {
    const summary = monthlyMap.get(month);
    runningBalance += summary.income - summary.expenses;
    return finalizeMonthSummary(summary, runningBalance);
  });
}

function buildCurrentFeatureRow(transactions, currentBalance = 0) {
  const currentMonth = monthKeyFromDate(new Date());
  const currentSummary = buildEmptyMonth(currentMonth);

  for (const transaction of transactions) {
    const amount = Number(transaction.amount || 0);

    if (transaction.type === 'income') {
      currentSummary.income += amount;
    } else if (transaction.type === 'expense') {
      currentSummary.expenses += amount;
      const category = transaction.category || 'Other';
      currentSummary.categoryTotals[category] = (currentSummary.categoryTotals[category] || 0) + amount;
    }

    currentSummary.transactionCount += 1;
  }

  return finalizeMonthSummary(currentSummary, Number(currentBalance || 0));
}

function runPythonMlPipeline(payload) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', 'ml', 'pipeline.py');
    const pythonCommand = process.env.PYTHON_BIN || 'python';
    const child = spawn(pythonCommand, [scriptPath], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python ML pipeline exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout || '{}'));
      } catch (error) {
        reject(new Error(`Unable to parse ML pipeline output: ${error.message}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function checkMlRuntime() {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'ml', 'pipeline.py');
    const pythonCommand = process.env.PYTHON_BIN || 'python';
    const child = spawn(
      pythonCommand,
      ['-c', 'import json, importlib.util; print(json.dumps({"sklearn": bool(importlib.util.find_spec("sklearn"))}))'],
      {
        cwd: path.join(__dirname, '..', '..'),
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      resolve({
        ready: false,
        pythonCommand,
        scriptPath,
        sklearn: false,
        error: error.message,
      });
    });

    child.on('close', (code) => {
      if (code !== 0) {
        resolve({
          ready: false,
          pythonCommand,
          scriptPath,
          sklearn: false,
          error: stderr.trim() || `Python check exited with code ${code}`,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout || '{}');
        resolve({
          ready: true,
          pythonCommand,
          scriptPath,
          sklearn: Boolean(parsed.sklearn),
          error: null,
        });
      } catch (error) {
        resolve({
          ready: false,
          pythonCommand,
          scriptPath,
          sklearn: false,
          error: `Unable to parse ML runtime check: ${error.message}`,
        });
      }
    });
  });
}

function buildRuleBasedMlFallback(monthlyRows, currentRow) {
  const avgExpenses = monthlyRows.length
    ? monthlyRows.reduce((sum, row) => sum + row.expenses, 0) / monthlyRows.length
    : currentRow.expenses;
  const overspending = currentRow.expenses > currentRow.income || currentRow.savings < 0;
  const nextMonthExpense = avgExpenses;

  let segment = 'Moderate spender';
  if (currentRow.expenseToIncomeRatio >= 0.85 || currentRow.discretionaryShare >= 0.45) {
    segment = 'High spender';
  } else if (currentRow.expenseToIncomeRatio <= 0.45 && currentRow.savingsRate >= 0.3) {
    segment = 'Low spender';
  }

  return {
    overspending: {
      prediction: overspending ? 'Likely to overspend' : 'Spending looks under control',
      probability: overspending ? 0.7 : 0.25,
      riskLevel: overspending ? 'high' : 'low',
      labelRule: 'expenses > income OR savings < 0 OR remaining balance below safety threshold',
      model: 'Rule-based fallback',
    },
    behavior: {
      segment,
      cluster: segment === 'High spender' ? 2 : segment === 'Low spender' ? 0 : 1,
      model: 'Rule-based fallback',
    },
    trend: {
      nextMonthExpense: Math.round(nextMonthExpense),
      slope: 0,
      direction: 'stable',
      model: 'Rule-based fallback',
    },
    training: {
      sampleCount: monthlyRows.length,
      syntheticCount: 0,
    },
  };
}

async function getMlInsightsForUser(userId) {
  const [transactions, user] = await Promise.all([
    Transaction.find({ user: userId }).sort({ date: 1, createdAt: 1 }).lean(),
    User.findById(userId).select('balance').lean(),
  ]);

  const runningBalance = Number(user?.balance || 0);
  const monthlyRows = buildMonthlyFeatureRows(transactions, 0);
  const currentRow = monthlyRows.length
    ? {
      ...monthlyRows[monthlyRows.length - 1],
      remainingBalance: runningBalance,
    }
    : buildCurrentFeatureRow(transactions, runningBalance);

  if (!monthlyRows.length) {
    return {
      monthlyRows: [],
      currentRow,
      ml: buildRuleBasedMlFallback([], currentRow),
    };
  }

  try {
    const ml = await runPythonMlPipeline({
      rows: monthlyRows,
      current: currentRow,
    });

    return {
      monthlyRows,
      currentRow,
      ml,
    };
  } catch (error) {
    console.error('ML pipeline fallback triggered:', error.message);
    return {
      monthlyRows,
      currentRow,
      ml: buildRuleBasedMlFallback(monthlyRows, currentRow),
    };
  }
}

module.exports = {
  buildMonthlyFeatureRows,
  buildCurrentFeatureRow,
  getMlInsightsForUser,
  checkMlRuntime,
};
