const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');

class TransactionService {
  // Get all transactions for a user
  static async getTransactions(userId, filters = {}) {
    const query = { user: userId };

    if (filters.category) query.category = filters.category;
    if (filters.type) query.type = filters.type;
    if (filters.paymentMethod) query.paymentMethod = filters.paymentMethod;
    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) query.date.$gte = new Date(filters.startDate);
      if (filters.endDate) query.date.$lte = new Date(filters.endDate);
    }
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      query.amount = {};
      if (filters.minAmount !== undefined) query.amount.$gte = filters.minAmount;
      if (filters.maxAmount !== undefined) query.amount.$lte = filters.maxAmount;
    }
    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find(query)
      .populate('budget', 'name category')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments(query);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Get transaction by ID
  static async getTransactionById(transactionId, userId) {
    return await Transaction.findOne({ _id: transactionId, user: userId })
      .populate('budget', 'name category amount spent');
  }

  // Create new transaction
  static async createTransaction(userId, transactionData) {
    const transaction = new Transaction({
      ...transactionData,
      user: userId
    });

    // If it's an expense and a budget is specified, update budget spending
    if (transaction.type === 'expense' && transaction.budget) {
      const budget = await Budget.findOne({ _id: transaction.budget, user: userId });
      if (budget) {
        budget.spent += transaction.amount;
        await budget.save();
      }
    }

    return await transaction.save();
  }

  // Update transaction
  static async updateTransaction(transactionId, userId, updateData) {
    const transaction = await Transaction.findOne({ _id: transactionId, user: userId });
    if (!transaction) return null;

    const oldAmount = transaction.amount;
    const oldType = transaction.type;
    const oldBudget = transaction.budget;

    // Update transaction
    Object.assign(transaction, updateData);
    await transaction.save();

    // Update budget spending if amount or budget changed
    if (transaction.type === 'expense') {
      // Remove old spending
      if (oldBudget && (oldType === 'expense' || oldType === 'income')) {
        const oldBudgetDoc = await Budget.findOne({ _id: oldBudget, user: userId });
        if (oldBudgetDoc) {
          oldBudgetDoc.spent -= oldAmount;
          await oldBudgetDoc.save();
        }
      }

      // Add new spending
      if (transaction.budget) {
        const newBudgetDoc = await Budget.findOne({ _id: transaction.budget, user: userId });
        if (newBudgetDoc) {
          newBudgetDoc.spent += transaction.amount;
          await newBudgetDoc.save();
        }
      }
    }

    return transaction;
  }

  // Delete transaction
  static async deleteTransaction(transactionId, userId) {
    const transaction = await Transaction.findOne({ _id: transactionId, user: userId });
    if (!transaction) return null;

    // Update budget spending
    if (transaction.type === 'expense' && transaction.budget) {
      const budget = await Budget.findOne({ _id: transaction.budget, user: userId });
      if (budget) {
        budget.spent -= transaction.amount;
        await budget.save();
      }
    }

    await transaction.remove();
    return transaction;
  }

  // Get transaction summary
  static async getTransactionSummary(userId, period = 'month') {
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        endDate = new Date();
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const transactions = await Transaction.find({
      user: userId,
      date: { $gte: startDate, $lte: endDate }
    });

    const summary = {
      period,
      startDate,
      endDate,
      totalTransactions: transactions.length,
      totalIncome: 0,
      totalExpenses: 0,
      netAmount: 0,
      categoryBreakdown: {},
      paymentMethodBreakdown: {},
      topExpenses: []
    };

    transactions.forEach(transaction => {
      if (transaction.type === 'income') {
        summary.totalIncome += transaction.amount;
      } else if (transaction.type === 'expense') {
        summary.totalExpenses += transaction.amount;
        
        // Category breakdown
        if (!summary.categoryBreakdown[transaction.category]) {
          summary.categoryBreakdown[transaction.category] = 0;
        }
        summary.categoryBreakdown[transaction.category] += transaction.amount;
      }

      // Payment method breakdown
      if (!summary.paymentMethodBreakdown[transaction.paymentMethod]) {
        summary.paymentMethodBreakdown[transaction.paymentMethod] = 0;
      }
      summary.paymentMethodBreakdown[transaction.paymentMethod] += transaction.amount;
    });

    summary.netAmount = summary.totalIncome - summary.totalExpenses;

    // Get top expenses
    summary.topExpenses = transactions
      .filter(t => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return summary;
  }

  // Get monthly trends
  static async getMonthlyTrends(userId, months = 6) {
    const trends = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: date, $lte: endDate }
      });

      const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      trends.push({
        month: date.toISOString().slice(0, 7), // YYYY-MM format
        income,
        expenses,
        net: income - expenses,
        transactionCount: transactions.length
      });
    }

    return trends;
  }

  // Bulk delete transactions
  static async bulkDeleteTransactions(transactionIds, userId) {
    const transactions = await Transaction.find({
      _id: { $in: transactionIds },
      user: userId
    });

    for (const transaction of transactions) {
      // Update budget spending
      if (transaction.type === 'expense' && transaction.budget) {
        const budget = await Budget.findOne({ _id: transaction.budget, user: userId });
        if (budget) {
          budget.spent -= transaction.amount;
          await budget.save();
        }
      }
    }

    const result = await Transaction.deleteMany({
      _id: { $in: transactionIds },
      user: userId
    });

    return result.deletedCount;
  }
}

module.exports = TransactionService;