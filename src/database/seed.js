const mongoose = require('mongoose');
const User = require('../models/User');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const connectDB = require('../config/db');

require('dotenv').config();

// Sample data
const users = [
  {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    balance: 5000
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: 'password123',
    balance: 3000
  }
];

const budgets = [
  {
    name: 'Monthly Food Budget',
    description: 'Groceries and dining out',
    amount: 800,
    category: 'Food & Dining',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31')
  },
  {
    name: 'Transportation Budget',
    description: 'Gas, public transport, and car maintenance',
    amount: 400,
    category: 'Transportation',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31')
  },
  {
    name: 'Entertainment Budget',
    description: 'Movies, games, and hobbies',
    amount: 200,
    category: 'Entertainment',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31')
  }
];

const transactions = [
  {
    amount: 150,
    description: 'Grocery shopping at Whole Foods',
    category: 'Food & Dining',
    type: 'expense',
    date: new Date('2024-01-15'),
    paymentMethod: 'credit_card',
    tags: ['groceries', 'weekly']
  },
  {
    amount: 45,
    description: 'Dinner at Italian restaurant',
    category: 'Food & Dining',
    type: 'expense',
    date: new Date('2024-01-18'),
    paymentMethod: 'debit_card',
    tags: ['dining', 'italian']
  },
  {
    amount: 60,
    description: 'Gas station fill-up',
    category: 'Transportation',
    type: 'expense',
    date: new Date('2024-01-10'),
    paymentMethod: 'debit_card',
    tags: ['gas', 'car']
  },
  {
    amount: 25,
    description: 'Movie tickets',
    category: 'Entertainment',
    type: 'expense',
    date: new Date('2024-01-20'),
    paymentMethod: 'cash',
    tags: ['movies', 'cinema']
  },
  {
    amount: 3000,
    description: 'Monthly salary',
    category: 'Income',
    type: 'income',
    date: new Date('2024-01-01'),
    paymentMethod: 'bank_transfer',
    tags: ['salary', 'monthly']
  },
  {
    amount: 500,
    description: 'Freelance project payment',
    category: 'Income',
    type: 'income',
    date: new Date('2024-01-15'),
    paymentMethod: 'bank_transfer',
    tags: ['freelance', 'project']
  }
];

const seedDatabase = async () => {
  try {
    console.log('🌱 Seeding database...');

    // Clear existing data
    await User.deleteMany();
    await Budget.deleteMany();
    await Transaction.deleteMany();

    console.log('🧹 Cleared existing data');

    // Create users
    const createdUsers = [];
    for (const userData of users) {
      const user = await User.create(userData);
      createdUsers.push(user);
      console.log(`👤 Created user: ${user.name}`);
    }

    // Create budgets for first user
    const userBudgets = [];
    for (const budgetData of budgets) {
      const budget = await Budget.create({
        ...budgetData,
        user: createdUsers[0]._id
      });
      userBudgets.push(budget);
      console.log(`💰 Created budget: ${budget.name}`);
    }

    // Create transactions for first user
    for (const transactionData of transactions) {
      const transaction = await Transaction.create({
        ...transactionData,
        user: createdUsers[0]._id,
        // Link some transactions to budgets
        budget: transactionData.category === 'Food & Dining' ? userBudgets[0]._id :
                transactionData.category === 'Transportation' ? userBudgets[1]._id :
                transactionData.category === 'Entertainment' ? userBudgets[2]._id : null
      });
      console.log(`💸 Created transaction: ${transaction.description}`);
    }

    // Update budget spending based on transactions
    for (const budget of userBudgets) {
      const budgetTransactions = await Transaction.find({
        user: createdUsers[0]._id,
        category: budget.category,
        date: {
          $gte: budget.startDate,
          $lte: budget.endDate
        }
      });

      budget.spent = budgetTransactions.reduce((sum, t) => sum + t.amount, 0);
      await budget.save();
      console.log(`📊 Updated budget spending: ${budget.name} - $${budget.spent}`);
    }

    console.log('✅ Database seeded successfully!');
    console.log('\n📋 Sample login credentials:');
    console.log('Email: john@example.com, Password: password123');
    console.log('Email: jane@example.com, Password: password123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    process.exit();
  }
};

// Run seeder
connectDB().then(() => {
  seedDatabase();
});