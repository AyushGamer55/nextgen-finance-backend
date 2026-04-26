const CATEGORY_KEYWORDS = [
  { match: /salary|payroll|bonus|freelance|refund received|interest credited/i, category: 'Income', type: 'income' },
  { match: /zomato|swiggy|restaurant|cafe|coffee|food|dining|pizza|burger/i, category: 'Food & Dining', type: 'expense' },
  { match: /amazon|flipkart|myntra|ajio|shopping|store|mall/i, category: 'Shopping', type: 'expense' },
  { match: /rent|landlord|housing|maintenance bill|mortgage/i, category: 'Bills & Utilities', type: 'expense' },
  { match: /uber|ola|metro|bus|fuel|petrol|diesel|taxi|transport/i, category: 'Transportation', type: 'expense' },
  { match: /netflix|spotify|movie|bookmyshow|game|entertainment/i, category: 'Entertainment', type: 'expense' },
  { match: /hospital|pharmacy|doctor|medicine|health|clinic/i, category: 'Healthcare', type: 'expense' },
  { match: /course|tuition|college|school|udemy|education/i, category: 'Education', type: 'expense' },
  { match: /flight|hotel|trip|travel|holiday/i, category: 'Travel', type: 'expense' },
  { match: /sip|mutual fund|investment|saving|fd|deposit/i, category: 'Savings', type: 'expense' },
  { match: /transfer|upi to self|bank transfer/i, category: 'Transfer', type: 'transfer' },
];

const CATEGORY_ALIASES = new Map([
  ['food', 'Food & Dining'],
  ['food & dining', 'Food & Dining'],
  ['dining', 'Food & Dining'],
  ['restaurant', 'Food & Dining'],
  ['transport', 'Transportation'],
  ['transportation', 'Transportation'],
  ['travel', 'Travel'],
  ['shopping', 'Shopping'],
  ['shop', 'Shopping'],
  ['entertainment', 'Entertainment'],
  ['bills', 'Bills & Utilities'],
  ['bill', 'Bills & Utilities'],
  ['utilities', 'Bills & Utilities'],
  ['housing', 'Bills & Utilities'],
  ['rent', 'Bills & Utilities'],
  ['health', 'Healthcare'],
  ['healthcare', 'Healthcare'],
  ['medical', 'Healthcare'],
  ['education', 'Education'],
  ['study', 'Education'],
  ['savings', 'Savings'],
  ['saving', 'Savings'],
  ['investment', 'Savings'],
  ['investments', 'Savings'],
  ['income', 'Income'],
  ['salary', 'Income'],
  ['credit', 'Income'],
  ['transfer', 'Transfer'],
  ['other', 'Other'],
]);

function normalizeCategoryName(rawCategory, type) {
  const normalized = String(rawCategory || '').trim().toLowerCase();

  if (type === 'income') return 'Income';
  if (type === 'transfer') return 'Transfer';
  if (!normalized) return 'Other';

  return CATEGORY_ALIASES.get(normalized) || 'Other';
}

function inferCategory(description = '', fallbackCategory, fallbackType) {
  const normalized = String(description || '').trim();

  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.match.test(normalized)) {
      return {
        category: rule.category,
        type: fallbackType === 'transfer' ? 'transfer' : fallbackType || rule.type,
      };
    }
  }

  return {
    category: normalizeCategoryName(fallbackCategory, fallbackType),
    type: fallbackType || 'expense',
  };
}

function shouldInfer(category) {
  const normalized = String(category || '').trim().toLowerCase();
  return !normalized || normalized === 'other' || !CATEGORY_ALIASES.has(normalized);
}

module.exports = {
  inferCategory,
  normalizeCategoryName,
  shouldInferCategory: shouldInfer,
};
