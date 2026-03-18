const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { successResponse, errorResponse } = require('../utils/response');

// @desc    Simulate transfer between users
// @route   POST /api/transfers/simulate
// @access  Private
const simulateTransfer = async (req, res, next) => {
  try {
    const { recipientEmail, amount, description } = req.body;

    // Validation
    if (!recipientEmail || !amount) {
      return errorResponse(res, 'Recipient email and amount are required', 400);
    }

    if (amount <= 0) {
      return errorResponse(res, 'Transfer amount must be positive', 400);
    }

    if (req.user.email === recipientEmail) {
      return errorResponse(res, 'Cannot transfer to yourself', 400);
    }

    // Check sender balance
    const sender = await User.findById(req.user._id);
    if (sender.balance < amount) {
      return errorResponse(res, 'Insufficient balance', 400);
    }

    // Find recipient
    const recipient = await User.findOne({ email: recipientEmail });
    if (!recipient) {
      return errorResponse(res, 'Recipient not found', 404);
    }

    // Simulate transfer (in real app, this would involve payment processing)
    const transferDescription = description || `Transfer from ${sender.name}`;

    // Create transaction records for both users
    const senderTransaction = await Transaction.create({
      user: sender._id,
      amount,
      description: transferDescription,
      category: 'Transfer',
      type: 'transfer',
      date: new Date(),
      paymentMethod: 'bank_transfer'
    });

    const recipientTransaction = await Transaction.create({
      user: recipient._id,
      amount,
      description: `Transfer from ${sender.name}`,
      category: 'Transfer',
      type: 'income', // Recipient receives as income
      date: new Date(),
      paymentMethod: 'bank_transfer'
    });

    // Update balances
    sender.balance -= amount;
    recipient.balance += amount;

    await sender.save();
    await recipient.save();

    successResponse(res, 'Transfer simulated successfully', {
      transfer: {
        id: `transfer_${Date.now()}`,
        amount,
        sender: {
          id: sender._id,
          name: sender.name,
          email: sender.email
        },
        recipient: {
          id: recipient._id,
          name: recipient.name,
          email: recipient.email
        },
        description: transferDescription,
        timestamp: new Date(),
        status: 'completed'
      },
      senderTransaction,
      recipientTransaction
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get transfer history for user
// @route   GET /api/transfers/history
// @access  Private
const getTransferHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get transfer transactions
    const transfers = await Transaction.find({
      user: req.user._id,
      category: 'Transfer'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const total = await Transaction.countDocuments({
      user: req.user._id,
      category: 'Transfer'
    });

    successResponse(res, 'Transfer history retrieved successfully', {
      transfers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get transfer statistics
// @route   GET /api/transfers/stats
// @access  Private
const getTransferStats = async (req, res, next) => {
  try {
    const transfers = await Transaction.find({
      user: req.user._id,
      category: 'Transfer'
    });

    const stats = {
      totalTransfers: transfers.length,
      totalSent: transfers.reduce((sum, transfer) => sum + transfer.amount, 0),
      averageTransfer: transfers.length > 0 ? 
        transfers.reduce((sum, transfer) => sum + transfer.amount, 0) / transfers.length : 0,
      recentTransfers: transfers.slice(0, 5)
    };

    successResponse(res, 'Transfer statistics retrieved successfully', { stats });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  simulateTransfer,
  getTransferHistory,
  getTransferStats
};