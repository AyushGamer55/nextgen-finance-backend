const express = require('express');
const router = express.Router();
const { getMe, updateUser, lookupUsers } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// @route   GET /api/users/me
router.get('/me', getMe);

// @route   GET /api/users/lookup
router.get('/lookup', lookupUsers);

// @route   PUT /api/users/update
router.put('/update', updateUser);

module.exports = router;
