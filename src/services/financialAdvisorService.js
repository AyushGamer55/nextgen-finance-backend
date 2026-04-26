const Groq = require('groq-sdk');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { getMlInsightsForUser } = require('./mlInsightsService');

const CURRENCY = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const QUICK_ACTION_LABELS = new Set([
  'analyze my spending',
  'show monthly summary',
  'how can i save money?',
  'give budget advice',
]);

function formatAmount(value) {
  return CURRENCY.format(Number(value || 0));
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function inferDateRange(message = '') {
  const text = String(message || '').toLowerCase();
  const now = new Date();

  if (text.includes('last month') || text.includes('previous month')) {
    const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      label: 'last month',
      startDate: startOfMonth(date),
      endDate: endOfMonth(date),
    };
  }

  if (text.includes('this year') || text.includes('yearly')) {
    return {
      label: 'this year',
      startDate: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
      endDate: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }

  return {
    label: 'this month',
    startDate: startOfMonth(now),
    endDate: endOfMonth(now),
  };
}

async function getTransactionsForRange(userId, startDate, endDate) {
  return Transaction.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: -1, createdAt: -1 });
}

async function getLatestTransaction(userId) {
  return Transaction.findOne({ user: userId }).sort({ date: -1, createdAt: -1 });
}

async function resolveRangeForUser(userId, message) {
  const requestedRange = inferDateRange(message);
  const transactions = await getTransactionsForRange(
    userId,
    requestedRange.startDate,
    requestedRange.endDate,
  );

  if (
    transactions.length > 0 ||
    requestedRange.label !== 'this month'
  ) {
    return { range: requestedRange, transactions };
  }

  const latestTransaction = await getLatestTransaction(userId);
  if (!latestTransaction?.date) {
    return { range: requestedRange, transactions };
  }

  const latestDate = new Date(latestTransaction.date);
  const fallbackRange = {
    label: `latest active month (${latestDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })})`,
    startDate: startOfMonth(latestDate),
    endDate: endOfMonth(latestDate),
  };

  const fallbackTransactions = await getTransactionsForRange(
    userId,
    fallbackRange.startDate,
    fallbackRange.endDate,
  );

  return { range: fallbackRange, transactions: fallbackTransactions };
}

function summarizeTransactions(transactions) {
  const summary = {
    totalIncome: 0,
    totalExpenses: 0,
    totalTransactions: transactions.length,
    savings: 0,
    savingsRate: 0,
    categories: {},
    topExpenseCategory: null,
    averageExpense: 0,
  };

  let expenseCount = 0;

  transactions.forEach((transaction) => {
    if (transaction.type === 'income') {
      summary.totalIncome += transaction.amount;
      return;
    }

    if (transaction.type !== 'expense') {
      return;
    }

    expenseCount += 1;
    summary.totalExpenses += transaction.amount;
    summary.categories[transaction.category] = (summary.categories[transaction.category] || 0) + transaction.amount;
  });

  summary.savings = summary.totalIncome - summary.totalExpenses;
  summary.savingsRate = summary.totalIncome > 0 ? (summary.savings / summary.totalIncome) * 100 : 0;
  summary.averageExpense = expenseCount ? summary.totalExpenses / expenseCount : 0;

  const categoryEntries = Object.entries(summary.categories).sort((a, b) => b[1] - a[1]);
  if (categoryEntries.length > 0) {
    const [name, amount] = categoryEntries[0];
    summary.topExpenseCategory = { name, amount };
  }

  return summary;
}

function detectIntent(message = '') {
  const text = String(message || '').toLowerCase();

  if (/save|saving|reduce spending|cut costs/.test(text)) return 'save';
  if (/budget|budget advice|plan/i.test(text)) return 'budget';
  if (/summary|monthly summary|month summary|overview/.test(text)) return 'summary';
  if (/analyze|analysis|spending|expense breakdown|where did my money go/.test(text)) return 'analysis';
  if (/website|design|frontend|ui|app good|is my website good/.test(text)) return 'non_finance';
  if (/messi|ronaldo|football|soccer|cricket|movie|music|love|hate|relationship|weather|joke|who is better|which is better/.test(text)) return 'non_finance';

  return 'general_finance';
}

function detectSocialIntent(message = '') {
  const text = String(message || '').trim().toLowerCase();

  if (/\b(tell me about yourself|who are you|what are you)\b/.test(text)) return 'about';
  if (/\b(i love you|love you|you are so cute|cute|bad boy|good boy|sweet|handsome|pretty)\b/.test(text)) return 'affection';
  if (/\b(hello|hi|hey|yo|sup)\b/.test(text)) return 'greeting';

  return null;
}

function detectResponseStyle(message = '') {
  const text = String(message || '').trim().toLowerCase();

  if (QUICK_ACTION_LABELS.has(text)) {
    return 'detailed';
  }

  if (/who are you|tell me about yourself|what are you|you are so cute|cute|hello|hi|hey/.test(text)) {
    return 'brief';
  }

  return 'brief';
}

function buildRuleInsights(currentSummary, previousSummary) {
  const insights = [];
  const categoryEntries = Object.entries(currentSummary.categories).sort((a, b) => b[1] - a[1]);

  if (currentSummary.topExpenseCategory && currentSummary.totalExpenses > 0) {
    const share = Math.round((currentSummary.topExpenseCategory.amount / currentSummary.totalExpenses) * 100);
    insights.push(`Your highest expense is ${currentSummary.topExpenseCategory.name} (${CURRENCY.format(currentSummary.topExpenseCategory.amount)}), about ${share}% of spending.`);
    if (share >= 35) {
      insights.push(`${currentSummary.topExpenseCategory.name} is taking a heavy share of your budget, so small cuts there will move the needle fastest.`);
    }
  }

  const foodSpend = currentSummary.categories['Food & Dining'] || 0;
  if (foodSpend > 0 && currentSummary.totalExpenses > 0) {
    const foodShare = Math.round((foodSpend / currentSummary.totalExpenses) * 100);
    insights.push(`Food spending is ${CURRENCY.format(foodSpend)}, around ${foodShare}% of your total expenses.`);
    insights.push(`Cutting food spending by 15% could save about ${CURRENCY.format(foodSpend * 0.15)}.`);
  }

  if (previousSummary && previousSummary.totalExpenses > 0) {
    const change = ((currentSummary.totalExpenses - previousSummary.totalExpenses) / previousSummary.totalExpenses) * 100;
    if (Math.abs(change) >= 10) {
      insights.push(`Your total expenses are ${Math.abs(change).toFixed(0)}% ${change > 0 ? 'higher' : 'lower'} than the previous period.`);
    }

    const previousFood = previousSummary.categories['Food & Dining'] || 0;
    if (previousFood > 0 && foodSpend > 0) {
      const foodChange = ((foodSpend - previousFood) / previousFood) * 100;
      if (Math.abs(foodChange) >= 10) {
        insights.push(`Food spending is ${Math.abs(foodChange).toFixed(0)}% ${foodChange > 0 ? 'higher' : 'lower'} than the previous period.`);
      }
    }
  }

  if (currentSummary.savings < 0) {
    insights.push(`You are overspending by ${CURRENCY.format(Math.abs(currentSummary.savings))} in this period.`);
  } else if (currentSummary.savings > 0) {
    insights.push(`You are saving ${CURRENCY.format(currentSummary.savings)} after expenses this period.`);
    insights.push(`Your savings rate is about ${Math.round(currentSummary.savingsRate)}% of income right now.`);
  }

  if (categoryEntries.length > 1) {
    const [first, second] = categoryEntries;
    if (first[1] - second[1] > 2000) {
      insights.push(`${first[0]} stands out clearly above your next expense category, so trimming there will have the biggest impact.`);
    }
  }

  return insights.slice(0, 6);
}

function buildMlHighlights(ml) {
  if (!ml) return [];

  const highlights = [];

  if (ml.overspending?.prediction) {
    highlights.push(`- Overspending risk (${ml.overspending.model}): ${ml.overspending.prediction} with probability ${(Number(ml.overspending.probability || 0) * 100).toFixed(0)}%`);
  }

  if (ml.behavior?.segment) {
    highlights.push(`- Spending behavior (${ml.behavior.model}): ${ml.behavior.segment}`);
  }

  if (ml.trend?.nextMonthExpense != null) {
    highlights.push(`- Expense trend (${ml.trend.model}): next month expense forecast ${CURRENCY.format(ml.trend.nextMonthExpense)} and direction ${ml.trend.direction}`);
  }

  return highlights;
}

function buildPrompt({ message, range, currentSummary, previousSummary, insights, currentBalance, intent, responseStyle, ml }) {
  const categories = Object.entries(currentSummary.categories)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => `- ${category}: ${CURRENCY.format(amount)}`)
    .join('\n') || '- No expense categories found';

  const previousSpend = previousSummary ? CURRENCY.format(previousSummary.totalExpenses) : 'N/A';
  const previousSavings = previousSummary ? CURRENCY.format(previousSummary.savings) : 'N/A';
  const mlHighlights = buildMlHighlights(ml).join('\n') || '- ML insights unavailable';

  return `You are a smart, friendly AI financial advisor who gives clear, practical, data-driven advice in a casual tone.
You must answer based on the user's financial data below, not with generic advice.
Intent: ${intent}
Response style: ${responseStyle}

User financial summary for ${range.label}:
- Current balance: ${formatAmount(currentBalance)}
- Total income: ${formatAmount(currentSummary.totalIncome)}
- Total expenses: ${formatAmount(currentSummary.totalExpenses)}
- Savings: ${formatAmount(currentSummary.savings)}
- Transactions: ${currentSummary.totalTransactions}

Category-wise spending:
${categories}

Previous period comparison:
- Previous expenses: ${previousSpend}
- Previous savings: ${previousSavings}

Rule-based insights:
${insights.map((item) => `- ${item}`).join('\n') || '- No major alerts'}

ML model insights:
${mlHighlights}

User question:
${message}

Rules:
- If the user asks about spending, explain the top categories and biggest issue.
- If the user asks for a summary, give a compact monthly snapshot with balance, income, expenses, and savings.
- If the user asks how to save money, give 2-3 concrete savings ideas using the actual categories and amounts.
- If the user asks for budget advice, suggest a simple spending plan using their real data.
- If the user asks something unrelated to finance, politely say you are the finance advisor and redirect them to finance questions.
- If response style is brief, reply in 1-2 short sentences only.
- If response style is detailed, reply in 3 short bullet points only.
- Do not add extra intro text like "Here are three short bullet points".
- Do not be overly flirty, dramatic, or chatty.

Respond in 3 short bullet points. Keep it practical, specific to the data, and avoid generic disclaimers.`;
}

async function generateAiReply(prompt, responseStyle = 'brief') {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

  if (!apiKey) {
    return null;
  }

  const groq = new Groq({ apiKey });

  const response = await groq.chat.completions.create({
    model,
    temperature: 0.4,
    max_tokens: responseStyle === 'detailed' ? 220 : 90,
    messages: [
      {
        role: 'system',
        content: responseStyle === 'detailed'
          ? 'You are a smart financial advisor. Be concise, practical, and use 3 short bullet points when needed.'
          : 'You are a smart financial advisor. Reply very briefly in 1-2 short sentences.',
      },
      { role: 'user', content: prompt },
    ],
  });

  return response.choices?.[0]?.message?.content?.trim() || null;
}

async function generateOpenChatReply(userMessage) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

  if (!apiKey) {
    return null;
  }

  const groq = new Groq({ apiKey });
  const response = await groq.chat.completions.create({
    model,
    temperature: 0.7,
    max_tokens: 120,
    messages: [
      {
        role: 'system',
        content: 'You are a friendly, concise assistant. Reply naturally to the user. Do not mention finance unless the user asks about finance.',
      },
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  return response.choices?.[0]?.message?.content?.trim() || null;
}

function buildSummaryReply({ range, currentSummary, currentBalance }) {
  return [
    `${range.label} snapshot: balance ${formatAmount(currentBalance)}, income ${formatAmount(currentSummary.totalIncome)}, expenses ${formatAmount(currentSummary.totalExpenses)}, savings ${formatAmount(currentSummary.savings)}.`,
    currentSummary.topExpenseCategory
      ? `Largest expense category is ${currentSummary.topExpenseCategory.name} at ${formatAmount(currentSummary.topExpenseCategory.amount)}.`
      : 'No major expense category was found in this period.',
    `You recorded ${currentSummary.totalTransactions} transactions in this period.`,
  ].join(' ');
}

function buildAnalysisReply({ currentSummary, insights }) {
  return [
    currentSummary.topExpenseCategory
      ? `Your spending is led by ${currentSummary.topExpenseCategory.name} at ${formatAmount(currentSummary.topExpenseCategory.amount)}.`
      : 'I do not see a dominant expense category yet.',
    insights[0] || 'Your expense pattern looks fairly balanced right now.',
    insights[1] || 'If you want, ask me for a savings plan or budget split next.',
  ].join(' ');
}

function buildSavingsReply({ currentSummary, insights }) {
  const topCategory = currentSummary.topExpenseCategory;
  const tenPercentCut = topCategory ? topCategory.amount * 0.1 : 0;

  return [
    topCategory
      ? `Your fastest savings win is cutting ${topCategory.name} by about 10%, which can free roughly ${formatAmount(tenPercentCut)}.`
      : 'Your spending is spread out, so a small trim across discretionary categories will help most.',
    insights.find((item) => /food|save|saving/i.test(item)) || 'Try reducing flexible spending first before touching essentials.',
    currentSummary.savings > 0
      ? `You are already saving ${formatAmount(currentSummary.savings)}, so the goal is to protect and grow that surplus.`
      : `You are not in surplus yet, so the first goal is to close the gap between income and expenses.`,
  ].join(' ');
}

function buildBudgetReply({ currentSummary }) {
  const needsBudget = currentSummary.totalIncome * 0.5;
  const wantsBudget = currentSummary.totalIncome * 0.3;
  const savingsBudget = currentSummary.totalIncome * 0.2;

  return [
    `A simple budget target from your income is: needs ${formatAmount(needsBudget)}, wants ${formatAmount(wantsBudget)}, savings ${formatAmount(savingsBudget)}.`,
    currentSummary.topExpenseCategory
      ? `${currentSummary.topExpenseCategory.name} is your pressure point, so set a cap there first.`
      : 'Start by setting caps on non-essential categories first.',
    `Your actual expenses are ${formatAmount(currentSummary.totalExpenses)}, so use that as the baseline for next month’s plan.`,
  ].join(' ');
}

function buildNonFinanceReply() {
  return 'I am your finance advisor, so ask me about spending, summary, savings, or budget advice.';
}

function buildPersonalityReply(userMessage) {
  const socialIntent = detectSocialIntent(userMessage);

  if (socialIntent === 'about') {
    return 'I am your AI finance advisor. I use your balance, income, expenses, and spending categories to give short, practical money advice.';
  }

  if (socialIntent === 'affection') {
    return 'You are kind. I am here to help with spending, savings, summaries, and budget advice.';
  }

  if (socialIntent === 'greeting') {
    return 'Hi. Ask me about your spending, monthly summary, savings, or budget advice.';
  }

  return null;
}

function buildOffTopicReply(userMessage) {
  const text = String(userMessage || '').trim().toLowerCase();

  if (/\bwebsite|ui|design|frontend|app\b/.test(text)) {
    return 'I am your finance advisor, so I cannot review the website here. Ask me about spending, savings, summary, or budget.';
  }

  return 'I am your finance advisor, so ask me about spending, summary, savings, or budget advice.';
}

function buildFallbackReply({ range, currentSummary, insights, userMessage, currentBalance }) {
  const intent = detectIntent(userMessage);
  const personalityReply = buildPersonalityReply(userMessage);

  if (personalityReply) {
    return personalityReply;
  }

  if (intent === 'non_finance') {
    return buildOffTopicReply(userMessage);
  }

  if (intent === 'summary') {
    return buildSummaryReply({ range, currentSummary, currentBalance });
  }

  if (intent === 'analysis') {
    return buildAnalysisReply({ currentSummary, insights });
  }

  if (intent === 'save') {
    return buildSavingsReply({ currentSummary, insights });
  }

  if (intent === 'budget') {
    return buildBudgetReply({ currentSummary });
  }

  return buildSummaryReply({ range, currentSummary, currentBalance });
}

async function getAdvisorReply(userId, userMessage) {
  const personalityReply = buildPersonalityReply(userMessage);
  if (personalityReply) {
    return {
      reply: personalityReply,
      meta: {
        source: 'social',
      },
    };
  }

  const intent = detectIntent(userMessage);
  if (intent === 'non_finance') {
    try {
      const chatReply = await generateOpenChatReply(userMessage);
      if (chatReply) {
        return {
          reply: chatReply,
          meta: {
            source: 'open_chat',
          },
        };
      }
    } catch (error) {
      console.error('Open chat fallback triggered:', error.message);
    }

    return {
      reply: buildOffTopicReply(userMessage),
      meta: {
        source: 'off_topic_rules',
      },
    };
  }

  const [{ range, transactions: currentTransactions }, user, mlResult] = await Promise.all([
    resolveRangeForUser(userId, userMessage),
    User.findById(userId).select('balance'),
    getMlInsightsForUser(userId),
  ]);
  const currentBalance = user?.balance || 0;

  const previousRangeStart = new Date(range.startDate);
  const previousRangeEnd = new Date(range.endDate);
  const span = range.endDate.getTime() - range.startDate.getTime();
  previousRangeStart.setTime(range.startDate.getTime() - span - 1);
  previousRangeEnd.setTime(range.endDate.getTime() - span - 1);

  const previousTransactions = await getTransactionsForRange(userId, previousRangeStart, previousRangeEnd);
  const currentSummary = summarizeTransactions(currentTransactions);
  const previousSummary = summarizeTransactions(previousTransactions);
  const insights = buildRuleInsights(currentSummary, previousSummary);
  const responseStyle = detectResponseStyle(userMessage);
  const prompt = buildPrompt({
    message: userMessage,
    range,
    currentSummary,
    previousSummary,
    insights,
    currentBalance,
    intent,
    responseStyle,
    ml: mlResult?.ml,
  });

  try {
    const aiReply = await generateAiReply(prompt, responseStyle);
    if (aiReply) {
      return {
        reply: aiReply,
        meta: {
          range,
          summary: currentSummary,
          insights,
          ml: mlResult?.ml || null,
          source: 'ai',
        },
      };
    }
  } catch (error) {
    console.error('AI chat fallback triggered:', error.message);
  }

  return {
    reply: buildFallbackReply({
      range,
      currentSummary,
      insights,
      userMessage,
      currentBalance,
    }),
    meta: {
      range,
      summary: currentSummary,
      insights,
      ml: mlResult?.ml || null,
      source: 'rules',
    },
  };
}

module.exports = {
  inferDateRange,
  summarizeTransactions,
  buildRuleInsights,
  getAdvisorReply,
};
