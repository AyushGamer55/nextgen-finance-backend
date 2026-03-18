const Budget = require('../models/Budget');
const BudgetService = require('../services/budgetService');
const { successResponse, errorResponse } = require('../utils/response');

// @desc    Get all budgets for user
// @route   GET /api/budgets
// @access  Private
const getBudgets = async (req, res, next) => {
  try {
    const filters = {};
    
    if (req.query.category) filters.category = req.query.category;
    if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';
    if (req.query.startDate && req.query.endDate) {
      filters.startDate = new Date(req.query.startDate);
      filters.endDate = new Date(req.query.endDate);
    }

    const budgets = await BudgetService.getBudgets(req.user._id, filters);
    
    successResponse(res, 'Budgets retrieved successfully', { budgets });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single budget with analysis
// @route   GET /api/budgets/:id
// @access  Private
const getBudget = async (req, res, next) => {
  try {
    const budgetData = await BudgetService.getBudgetWithAnalysis(req.params.id, req.user._id);
    
    if (!budgetData) {
      return errorResponse(res, 'Budget not found', 404);
    }

    successResponse(res, 'Budget retrieved successfully', budgetData);
  } catch (error) {
    next(error);
  }
};

// @desc    Create new budget
// @route   POST /api/budgets
// @access  Private
const createBudget = async (req, res, next) => {
  try {
    const budget = await BudgetService.createBudget(req.user._id, req.body);
    
    successResponse(res, 'Budget created successfully', { budget }, 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update budget
// @route   PUT /api/budgets/:id
// @access  Private
const updateBudget = async (req, res, next) => {
  try {
    const budget = await BudgetService.updateBudget(req.params.id, req.user._id, req.body);
    
    if (!budget) {
      return errorResponse(res, 'Budget not found', 404);
    }

    successResponse(res, 'Budget updated successfully', { budget });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete budget
// @route   DELETE /api/budgets/:id
// @access  Private
const deleteBudget = async (req, res, next) => {
  try {
    const budget = await BudgetService.deleteBudget(req.params.id, req.user._id);
    
    if (!budget) {
      return errorResponse(res, 'Budget not found', 404);
    }

    successResponse(res, 'Budget deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get budget summary for dashboard
// @route   GET /api/budgets/summary
// @access  Private
const getBudgetSummary = async (req, res, next) => {
  try {
    const summary = await BudgetService.getBudgetSummary(req.user._id);
    
    successResponse(res, 'Budget summary retrieved successfully', { summary });
  } catch (error) {
    next(error);
  }
};

// @desc    Sync budget spending with transactions
// @route   POST /api/budgets/sync
// @access  Private
const syncBudgets = async (req, res, next) => {
  try {
    const updatedBudgets = await BudgetService.syncBudgetSpending(req.user._id);
    
    successResponse(res, `Synced ${updatedBudgets.length} budgets`, { 
      updatedBudgets: updatedBudgets.length,
      budgets: updatedBudgets 
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBudgets,
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetSummary,
  syncBudgets
};