const Transaction = require('../models/Transaction');
const TransactionService = require('../services/transactionService');
const { successResponse, errorResponse } = require('../utils/response');
const { transactionValidation } = require('../utils/validators');

// @desc    Get all transactions
// @route   GET /api/transactions
// @access  Private
const getTransactions = async (req, res, next) => {
  try {
    const filters = req.query;
    const result = await TransactionService.getTransactions(req.user._id, filters);

    successResponse(res, 'Transactions retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
const getTransaction = async (req, res, next) => {
  try {
    const transaction = await TransactionService.getTransactionById(req.params.id, req.user._id);

    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404);
    }

    successResponse(res, 'Transaction retrieved successfully', { transaction });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new transaction
// @route   POST /api/transactions
// @access  Private
const createTransaction = async (req, res, next) => {
  try {
    const { error } = transactionValidation.validate(req.body);
    if (error) {
      return errorResponse(res, error.details[0].message, 400);
    }

    const transaction = await TransactionService.createTransaction(req.user._id, req.body);

    successResponse(res, 'Transaction created successfully', { transaction }, 201);
  } catch (error) {
    next(error);
  }
};

const bulkCreateTransactions = async (req, res, next) => {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return errorResponse(res, 'Please provide a non-empty transactions array', 400);
    }

    for (const transaction of transactions) {
      const { error } = transactionValidation.validate(transaction);
      if (error) {
        return errorResponse(res, `Invalid transaction: ${error.details[0].message}`, 400);
      }
    }

    const createdTransactions = await TransactionService.bulkCreateTransactions(req.user._id, transactions);
    successResponse(res, 'Transactions created successfully', { transactions: createdTransactions }, 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private
const updateTransaction = async (req, res, next) => {
  try {
    const { error } = transactionValidation.fork(
      ['amount', 'description', 'category', 'type'],
      (schema) => schema.optional()
    ).validate(req.body);
    if (error) {
      return errorResponse(res, error.details[0].message, 400);
    }

    const transaction = await TransactionService.updateTransaction(req.params.id, req.user._id, req.body);

    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404);
    }

    successResponse(res, 'Transaction updated successfully', { transaction });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await TransactionService.deleteTransaction(req.params.id, req.user._id);

    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404);
    }

    successResponse(res, 'Transaction deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get transaction summary
// @route   GET /api/transactions/summary
// @access  Private
const getTransactionSummary = async (req, res, next) => {
  try {
    const period = req.query.period || 'month';
    const summary = await TransactionService.getTransactionSummary(req.user._id, period);

    successResponse(res, 'Transaction summary retrieved successfully', { summary });
  } catch (error) {
    next(error);
  }
};

// @desc    Get monthly trends
// @route   GET /api/transactions/trends
// @access  Private
const getMonthlyTrends = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const trends = await TransactionService.getMonthlyTrends(req.user._id, months);

    successResponse(res, 'Monthly trends retrieved successfully', { trends });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk delete transactions
// @route   DELETE /api/transactions/bulk
// @access  Private
const bulkDeleteTransactions = async (req, res, next) => {
  try {
    const { transactionIds } = req.body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return errorResponse(res, 'Please provide an array of transaction IDs', 400);
    }

    const deletedCount = await TransactionService.bulkDeleteTransactions(transactionIds, req.user._id);

    successResponse(res, `${deletedCount} transactions deleted successfully`, { deletedCount });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTransactions,
  getTransaction,
  createTransaction,
  bulkCreateTransactions,
  updateTransaction,
  deleteTransaction,
  getTransactionSummary,
  getMonthlyTrends,
  bulkDeleteTransactions
};
