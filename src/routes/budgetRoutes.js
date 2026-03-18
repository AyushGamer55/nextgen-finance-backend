const express = require('express');
const router = express.Router();
const {
  getBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetSummary,
  syncBudgets
} = require('../controllers/budgetController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// @route   GET /api/budgets
router.get('/', getBudgets);

// @route   GET /api/budgets/summary
router.get('/summary', getBudgetSummary);

// @route   POST /api/budgets/sync
router.post('/sync', syncBudgets);

// @route   POST /api/budgets
router.post('/', createBudget);

// @route   GET /api/budgets/:id
router.get('/:id', getBudget);

// @route   PUT /api/budgets/:id
router.put('/:id', updateBudget);

// @route   DELETE /api/budgets/:id
router.delete('/:id', deleteBudget);

module.exports = router;