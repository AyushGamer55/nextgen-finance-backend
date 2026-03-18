const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');
const { updateUserValidation } = require('../utils/validators');

// @desc    Get current user
// @route   GET /api/users/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    successResponse(res, 'User profile retrieved successfully', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
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

    const { name, email } = req.body;

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
      { name, email },
      { new: true, runValidators: true }
    );

    successResponse(res, 'User profile updated successfully', {
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        balance: updatedUser.balance,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
  updateUser
};