const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getTransaction,
  createTransaction,
  bulkCreateTransactions,
  updateTransaction,
  deleteTransaction,
  getTransactionSummary,
  getMonthlyTrends,
  bulkDeleteTransactions
} = require('../controllers/transactionController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// @route   GET /api/transactions
router.get('/', getTransactions);

// @route   GET /api/transactions/summary
router.get('/summary', getTransactionSummary);

// @route   GET /api/transactions/trends
router.get('/trends', getMonthlyTrends);

// @route   POST /api/transactions
router.post('/', createTransaction);

// @route   POST /api/transactions/bulk
router.post('/bulk', bulkCreateTransactions);

// @route   DELETE /api/transactions/bulk
router.delete('/bulk', bulkDeleteTransactions);

// @route   GET /api/transactions/:id
router.get('/:id', getTransaction);

// @route   PUT /api/transactions/:id
router.put('/:id', updateTransaction);

// @route   DELETE /api/transactions/:id
router.delete('/:id', deleteTransaction);

module.exports = router;
