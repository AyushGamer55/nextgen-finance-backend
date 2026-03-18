const express = require('express');
const router = express.Router();
const { getMe, updateUser } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// @route   GET /api/users/me
router.get('/me', getMe);

// @route   PUT /api/users/update
router.put('/update', updateUser);

module.exports = router;