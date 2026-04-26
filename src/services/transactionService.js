const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const User = require('../models/User');
const NotificationService = require('./notificationService');
const { inferCategory, normalizeCategoryName, shouldInferCategory } = require('./transactionCategorizer');

class TransactionService {
  static async recalculateUserBalance(userId) {
    const transactions = await Transaction.find({ user: userId }).select('type amount');

    const balance = transactions.reduce((total, transaction) => {
      if (transaction.type === 'income') return total + transaction.amount;
      if (transaction.type === 'expense') return total - transaction.amount;
      return total;
    }, 0);

    await User.findByIdAndUpdate(userId, { balance });
    return balance;
  }

  static normalizeImportedTransaction(row = {}) {
    const inspection = this.inspectImportedTransaction(row);
    return inspection.accepted ? inspection.transaction : null;
  }

  static inspectImportedTransaction(row = {}) {
    const amountCandidates = [
      row.amount,
      row.value,
      row.Amount,
      row.amt,
      row.transaction_amount,
      row.credit,
      row.debit,
    ];
    const descriptionCandidates = [
      row.description,
      row.narration,
      row.name,
      row.merchant,
      row.payee,
      row.details,
      row.particulars,
      row.memo,
      row.note,
    ];
    const dateCandidates = [
      row.date,
      row.Date,
      row.transaction_date,
      row.txn_date,
      row.posted_date,
      row.value_date,
    ];

    const rawAmount = amountCandidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
    const parsedAmount = Number(String(rawAmount ?? 0).replace(/[^0-9.-]/g, ''));
    const amount = Number.isFinite(parsedAmount) ? Math.abs(parsedAmount) : 0;

    const description = descriptionCandidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
      || 'Imported transaction';

    const rawDate = dateCandidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    const rawType = String(
      row.type ??
      row.transaction_type ??
      row.Type ??
      row.txn_type ??
      ''
    ).toLowerCase();

    const signedAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
    const inferredType = rawType.includes('income') || rawType.includes('credit') || rawType.includes('salary') || rawType.includes('deposit')
      ? 'income'
      : rawType.includes('transfer')
        ? 'transfer'
        : signedAmount < 0
          ? 'expense'
          : 'expense';

    const rawCategory =
      row.category ??
      row.spending_group ??
      row.Category ??
      row.CategoryName ??
      row.group ??
      'Other';

    const categorization = shouldInferCategory(rawCategory)
      ? inferCategory(description, rawCategory, inferredType)
      : { category: normalizeCategoryName(rawCategory, inferredType), type: inferredType };

    if (amount <= 0) {
      return {
        accepted: false,
        reason: 'Amount must be greater than zero',
      };
    }

    return {
      accepted: true,
      inferredCategory: normalizeCategoryName(rawCategory, inferredType) !== categorization.category || shouldInferCategory(rawCategory),
      transaction: {
        amount,
        description: String(description).trim().slice(0, 200),
        category: categorization.category,
        type: categorization.type,
        date,
        paymentMethod: 'other',
        tags: [],
        isRecurring: false,
      },
    };
  }

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

    const page = parseInt(filters.page, 10) || 1;
    const limit = parseInt(filters.limit, 10) || 20;
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
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async getTransactionById(transactionId, userId) {
    return Transaction.findOne({ _id: transactionId, user: userId })
      .populate('budget', 'name category amount spent');
  }

  static async createTransaction(userId, transactionData, options = {}) {
    const categorization = shouldInferCategory(transactionData.category)
      ? inferCategory(transactionData.description, transactionData.category, transactionData.type)
      : {
          category: normalizeCategoryName(transactionData.category, transactionData.type),
          type: transactionData.type,
        };

    const transaction = new Transaction({
      ...transactionData,
      category: categorization.category,
      type: categorization.type,
      user: userId,
    });

    if (transaction.type === 'expense' && transaction.budget) {
      const budget = await Budget.findOne({ _id: transaction.budget, user: userId });
      if (budget) {
        budget.spent += transaction.amount;
        await budget.save();
      }
    }

    const savedTransaction = await transaction.save();

    if (!options.skipNotification) {
      await NotificationService.createNotification(userId, {
        title: 'Transaction recorded',
        text: `${savedTransaction.type === 'income' ? 'Income' : savedTransaction.type === 'expense' ? 'Expense' : 'Transfer'} of ${savedTransaction.amount.toLocaleString('en-IN')} was recorded under ${savedTransaction.category}.`,
        type: 'transaction',
        source: 'transactions',
        metadata: {
          transactionId: savedTransaction._id,
          kind: 'created',
        },
      });
    }

    return savedTransaction;
  }

  static async bulkCreateTransactions(userId, transactions = []) {
    const createdTransactions = [];

    for (const transactionData of transactions) {
      const transaction = await this.createTransaction(userId, transactionData, { skipNotification: true });
      createdTransactions.push(transaction);
    }

    await this.recalculateUserBalance(userId);
    if (createdTransactions.length > 0) {
      await NotificationService.createNotification(userId, {
        title: 'Transactions added',
        text: `${createdTransactions.length} transactions were added to your account.`,
        type: 'transaction',
        source: 'transactions',
        metadata: {
          count: createdTransactions.length,
          kind: 'bulk_created',
        },
      });
    }

    return createdTransactions;
  }

  static async updateTransaction(transactionId, userId, updateData) {
    const transaction = await Transaction.findOne({ _id: transactionId, user: userId });
    if (!transaction) return null;

    const oldAmount = transaction.amount;
    const oldType = transaction.type;
    const oldBudget = transaction.budget;

    const nextCategory = updateData.category !== undefined ? updateData.category : transaction.category;
    const nextType = updateData.type !== undefined ? updateData.type : transaction.type;
    const nextDescription = updateData.description !== undefined ? updateData.description : transaction.description;
    const categorization = shouldInferCategory(nextCategory)
      ? inferCategory(nextDescription, nextCategory, nextType)
      : {
          category: normalizeCategoryName(nextCategory, nextType),
          type: nextType,
        };

    Object.assign(transaction, updateData, {
      category: categorization.category,
      type: categorization.type,
    });
    await transaction.save();

    if (transaction.type === 'expense') {
      if (oldBudget && (oldType === 'expense' || oldType === 'income')) {
        const oldBudgetDoc = await Budget.findOne({ _id: oldBudget, user: userId });
        if (oldBudgetDoc) {
          oldBudgetDoc.spent -= oldAmount;
          await oldBudgetDoc.save();
        }
      }

      if (transaction.budget) {
        const newBudgetDoc = await Budget.findOne({ _id: transaction.budget, user: userId });
        if (newBudgetDoc) {
          newBudgetDoc.spent += transaction.amount;
          await newBudgetDoc.save();
        }
      }
    }

    await NotificationService.createNotification(userId, {
      title: 'Transaction updated',
      text: `${transaction.description} is now ${transaction.amount.toLocaleString('en-IN')} in ${transaction.category}.`,
      type: 'transaction',
      source: 'transactions',
      metadata: {
        transactionId: transaction._id,
        kind: 'updated',
      },
    });

    return transaction;
  }

  static async deleteTransaction(transactionId, userId) {
    const transaction = await Transaction.findOne({ _id: transactionId, user: userId });
    if (!transaction) return null;

    if (transaction.type === 'expense' && transaction.budget) {
      const budget = await Budget.findOne({ _id: transaction.budget, user: userId });
      if (budget) {
        budget.spent -= transaction.amount;
        await budget.save();
      }
    }

    const deletedText = `${transaction.description} for ${transaction.amount.toLocaleString('en-IN')} was deleted.`;

    await transaction.deleteOne();
    await this.recalculateUserBalance(userId);
    await NotificationService.createNotification(userId, {
      title: 'Transaction deleted',
      text: deletedText,
      type: 'transaction',
      source: 'transactions',
      metadata: {
        transactionId: transaction._id,
        kind: 'deleted',
      },
    });

    return transaction;
  }

  static async getTransactionSummary(userId, period = 'month') {
    const now = new Date();
    let startDate;
    let endDate;

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
      date: { $gte: startDate, $lte: endDate },
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
      topExpenses: [],
    };

    transactions.forEach((transaction) => {
      if (transaction.type === 'income') {
        summary.totalIncome += transaction.amount;
      } else if (transaction.type === 'expense') {
        summary.totalExpenses += transaction.amount;
        if (!summary.categoryBreakdown[transaction.category]) {
          summary.categoryBreakdown[transaction.category] = 0;
        }
        summary.categoryBreakdown[transaction.category] += transaction.amount;
      }

      if (!summary.paymentMethodBreakdown[transaction.paymentMethod]) {
        summary.paymentMethodBreakdown[transaction.paymentMethod] = 0;
      }
      summary.paymentMethodBreakdown[transaction.paymentMethod] += transaction.amount;
    });

    summary.netAmount = summary.totalIncome - summary.totalExpenses;
    summary.topExpenses = transactions
      .filter((t) => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return summary;
  }

  static async getMonthlyTrends(userId, months = 6) {
    const trends = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: date, $lte: endDate },
      });

      const income = transactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      trends.push({
        month: date.toISOString().slice(0, 7),
        income,
        expenses,
        net: income - expenses,
        transactionCount: transactions.length,
      });
    }

    return trends;
  }

  static async bulkDeleteTransactions(transactionIds, userId) {
    const transactions = await Transaction.find({
      _id: { $in: transactionIds },
      user: userId,
    });

    for (const transaction of transactions) {
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
      user: userId,
    });

    await this.recalculateUserBalance(userId);
    if (result.deletedCount > 0) {
      await NotificationService.createNotification(userId, {
        title: 'Transactions removed',
        text: `${result.deletedCount} transactions were removed from your account.`,
        type: 'transaction',
        source: 'transactions',
        metadata: {
          count: result.deletedCount,
          kind: 'bulk_deleted',
        },
      });
    }
    return result.deletedCount;
  }

  static async replaceUserTransactionsFromImport(userId, rows = []) {
    await Transaction.deleteMany({ user: userId });
    await User.findByIdAndUpdate(userId, { balance: 0 });

    const importedTransactions = [];

    for (const row of rows) {
      const normalized = this.normalizeImportedTransaction(row);
      if (!normalized?.amount) {
        continue;
      }

      const transaction = await this.createTransaction(userId, normalized, { skipNotification: true });
      importedTransactions.push(transaction);
    }

    await this.recalculateUserBalance(userId);
    await NotificationService.createNotification(userId, {
      title: 'Import complete',
      text: `${importedTransactions.length} transactions were imported into your account.`,
      type: 'import',
      source: 'upload',
      metadata: {
        count: importedTransactions.length,
      },
    });
    return importedTransactions;
  }
}

module.exports = TransactionService;
