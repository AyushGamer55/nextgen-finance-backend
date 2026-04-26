const express = require('express');
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
router.delete('/', clearNotifications);

module.exports = router;
