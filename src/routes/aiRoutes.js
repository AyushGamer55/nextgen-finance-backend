const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { chatWithAdvisor } = require('../controllers/aiController');

const router = express.Router();

router.use(protect);

router.post('/chat', chatWithAdvisor);

module.exports = router;
