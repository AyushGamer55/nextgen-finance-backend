const express = require('express');
const router = express.Router();
const {
  simulateTransfer,
  getTransferHistory,
  getTransferStats
} = require('../controllers/transferController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// @route   POST /api/transfers/simulate
router.post('/simulate', simulateTransfer);

// @route   GET /api/transfers/history
router.get('/history', getTransferHistory);

// @route   GET /api/transfers/stats
router.get('/stats', getTransferStats);

module.exports = router;