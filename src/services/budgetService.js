const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');

class BudgetService {
  // Get all budgets for a user
  static async getBudgets(userId, filters = {}) {
    const query = { user: userId };
    
    if (filters.category) query.category = filters.category;
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    if (filters.startDate && filters.endDate) {
      query.startDate = { $gte: filters.startDate };
      query.endDate = { $lte: filters.endDate };
    }

    return await Budget.find(query).sort({ createdAt: -1 });
  }

  // Get budget with spending analysis
  static async getBudgetWithAnalysis(budgetId, userId) {
    const budget = await Budget.findOne({ _id: budgetId, user: userId });
    if (!budget) return null;

    // Get transactions for this budget period
    const transactions = await Transaction.find({
      user: userId,
      category: budget.category,
      date: {
        $gte: budget.startDate,
        $lte: budget.endDate
      }
    }).sort({ date: -1 });

    const totalSpent = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    
    // Update budget spent amount if different
    if (totalSpent !== budget.spent) {
      budget.spent = totalSpent;
      await budget.save();
    }

    return {
      budget,
      transactions,
      analysis: {
        totalTransactions: transactions.length,
        averageTransaction: transactions.length > 0 ? totalSpent / transactions.length : 0,
        remaining: budget.amount - totalSpent,
        percentageUsed: budget.amount > 0 ? Math.round((totalSpent / budget.amount) * 100) : 0,
        isOverBudget: totalSpent > budget.amount,
        daysRemaining: budget.daysRemaining,
        dailySpendingLimit: budget.daysRemaining > 0 ? (budget.amount - totalSpent) / budget.daysRemaining : 0
      }
    };
  }

  // Create new budget
  static async createBudget(userId, budgetData) {
    const budget = new Budget({
      ...budgetData,
      user: userId
    });
    
    return await budget.save();
  }

  // Update budget
  static async updateBudget(budgetId, userId, updateData) {
    const budget = await Budget.findOneAndUpdate(
      { _id: budgetId, user: userId },
      updateData,
      { new: true, runValidators: true }
    );
    
    return budget;
  }

  // Delete budget
  static async deleteBudget(budgetId, userId) {
    return await Budget.findOneAndDelete({ _id: budgetId, user: userId });
  }

  // Get budget summary for dashboard
  static async getBudgetSummary(userId) {
    const budgets = await Budget.find({ user: userId, isActive: true });
    
    const summary = {
      totalBudgets: budgets.length,
      totalBudgeted: budgets.reduce((sum, budget) => sum + budget.amount, 0),
      totalSpent: budgets.reduce((sum, budget) => sum + budget.spent, 0),
      budgetsByCategory: {},
      overBudgetCount: 0,
      onTrackCount: 0
    };

    budgets.forEach(budget => {
      if (!summary.budgetsByCategory[budget.category]) {
        summary.budgetsByCategory[budget.category] = [];
      }
      summary.budgetsByCategory[budget.category].push(budget);

      if (budget.spent > budget.amount) {
        summary.overBudgetCount++;
      } else {
        summary.onTrackCount++;
      }
    });

    summary.remaining = summary.totalBudgeted - summary.totalSpent;
    summary.percentageUsed = summary.totalBudgeted > 0 ? 
      Math.round((summary.totalSpent / summary.totalBudgeted) * 100) : 0;

    return summary;
  }

  // Sync budget spending with transactions
  static async syncBudgetSpending(userId) {
    const budgets = await Budget.find({ user: userId, isActive: true });
    const updatedBudgets = [];

    for (const budget of budgets) {
      const transactions = await Transaction.find({
        user: userId,
        category: budget.category,
        date: {
          $gte: budget.startDate,
          $lte: budget.endDate
        }
      });

      const totalSpent = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
      
      if (totalSpent !== budget.spent) {
        budget.spent = totalSpent;
        await budget.save();
        updatedBudgets.push(budget);
      }
    }

    return updatedBudgets;
  }
}

module.exports = BudgetService;