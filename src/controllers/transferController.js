const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { successResponse, errorResponse } = require('../utils/response');
const NotificationService = require('../services/notificationService');
const { buildSandboxIdentity } = require('../utils/accountIdentity');

// @desc    Simulate transfer between users
// @route   POST /api/transfers/simulate
// @access  Private
const simulateTransfer = async (req, res, next) => {
  try {
    const { recipientEmail, recipientUpiId, recipientAccountNumber, amount, description } = req.body;
    const transferAmount = Number(amount);

    // Validation
    if ((!recipientEmail && !recipientUpiId && !recipientAccountNumber) || !transferAmount) {
      return errorResponse(res, 'Recipient and amount are required', 400);
    }

    if (transferAmount <= 0) {
      return errorResponse(res, 'Transfer amount must be positive', 400);
    }

    // Check sender balance
    const sender = await User.findById(req.user._id);
    if (sender.balance < transferAmount) {
      return errorResponse(res, 'Insufficient balance', 400);
    }

    const allRecipients = await User.find({
      _id: { $ne: req.user._id },
    }).select('name email balance');

    const recipient = allRecipients.find((candidate) => {
      const identity = buildSandboxIdentity(candidate);
      return (
        (recipientEmail && candidate.email.toLowerCase() === String(recipientEmail).toLowerCase()) ||
        (recipientUpiId && identity.sandboxUpiId === recipientUpiId) ||
        (recipientAccountNumber && identity.sandboxAccountNumber === recipientAccountNumber)
      );
    });

    if (!recipient) {
      return errorResponse(res, 'Recipient not found', 404);
    }

    if (String(sender._id) === String(recipient._id)) {
      return errorResponse(res, 'Cannot transfer to yourself', 400);
    }

    const transferDescription = description || `Transfer to ${recipient.name}`;

    const senderTransaction = await Transaction.create({
      user: sender._id,
      amount: transferAmount,
      description: transferDescription,
      category: 'Transfer',
      type: 'expense',
      date: new Date(),
      paymentMethod: 'bank_transfer',
    });

    const recipientTransaction = await Transaction.create({
      user: recipient._id,
      amount: transferAmount,
      description: `Transfer from ${sender.name}`,
      category: 'Transfer',
      type: 'income',
      date: new Date(),
      paymentMethod: 'bank_transfer',
    });

    await NotificationService.createNotification(sender._id, {
      title: 'Transfer sent',
      text: `${transferAmount.toLocaleString('en-IN')} sent to ${recipient.name}.`,
      type: 'transaction',
      source: 'transfers',
      metadata: {
        transactionId: senderTransaction._id,
        recipientId: recipient._id,
      },
    });
    await NotificationService.createNotification(recipient._id, {
      title: 'Transfer received',
      text: `${transferAmount.toLocaleString('en-IN')} received from ${sender.name}.`,
      type: 'transaction',
      source: 'transfers',
      metadata: {
        transactionId: recipientTransaction._id,
        senderId: sender._id,
      },
    });

    successResponse(res, 'Transfer simulated successfully', {
      transfer: {
        id: `transfer_${Date.now()}`,
        amount: transferAmount,
        sender: {
          id: sender._id,
          name: sender.name,
          email: sender.email,
          ...buildSandboxIdentity(sender),
        },
        recipient: {
          id: recipient._id,
          name: recipient.name,
          email: recipient.email,
          ...buildSandboxIdentity(recipient),
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

    const sentTransfers = transfers.filter((transfer) => transfer.type === 'expense');
    const receivedTransfers = transfers.filter((transfer) => transfer.type === 'income');
    const stats = {
      totalTransfers: transfers.length,
      totalSent: sentTransfers.reduce((sum, transfer) => sum + transfer.amount, 0),
      totalReceived: receivedTransfers.reduce((sum, transfer) => sum + transfer.amount, 0),
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
