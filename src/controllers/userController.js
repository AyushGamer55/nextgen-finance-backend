const User = require('../models/User');
const TransactionService = require('../services/transactionService');
const { successResponse, errorResponse } = require('../utils/response');
const { updateUserValidation } = require('../utils/validators');
const { buildSandboxIdentity } = require('../utils/accountIdentity');

// @desc    Get current user
// @route   GET /api/users/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    await TransactionService.recalculateUserBalance(req.user._id);
    const user = await User.findById(req.user._id);

    successResponse(res, 'User profile retrieved successfully', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        phone: user.phone,
        bio: user.bio,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        ...buildSandboxIdentity(user),
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/update
// @access  Private
const updateUser = async (req, res, next) => {
  try {
    // Validate input
    const { error } = updateUserValidation.validate(req.body);
    if (error) {
      return errorResponse(res, error.details[0].message, 400);
    }

    const { name, email, phone, bio, avatar } = req.body;

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (existingUser) {
        return errorResponse(res, 'Email already in use', 400);
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { name, email, phone, bio, avatar },
      { new: true, runValidators: true }
    );

    successResponse(res, 'User profile updated successfully', {
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        balance: updatedUser.balance,
        phone: updatedUser.phone,
        bio: updatedUser.bio,
        avatar: updatedUser.avatar,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        ...buildSandboxIdentity(updatedUser),
      }
    });
  } catch (error) {
    next(error);
  }
};

const lookupUsers = async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query || query.length < 2) {
      return successResponse(res, 'User lookup ready', { users: [] });
    }

    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [{ email: regex }, { name: regex }],
    })
      .select('name email balance createdAt')
      .limit(8);

    successResponse(res, 'Users retrieved successfully', {
      users: users.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        phone: user.phone,
        bio: user.bio,
        avatar: user.avatar,
        ...buildSandboxIdentity(user),
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
  updateUser,
  lookupUsers,
};
