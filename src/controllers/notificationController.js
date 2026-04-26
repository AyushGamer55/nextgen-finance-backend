const NotificationService = require('../services/notificationService');
const { successResponse, errorResponse } = require('../utils/response');

const getNotifications = async (req, res, next) => {
  try {
    const data = await NotificationService.listNotifications(req.user._id, req.query.limit);
    successResponse(res, 'Notifications retrieved successfully', data);
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await NotificationService.markAsRead(req.user._id, req.params.id);
    if (!notification) {
      return errorResponse(res, 'Notification not found', 404);
    }

    successResponse(res, 'Notification marked as read', { notification });
  } catch (error) {
    next(error);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    const data = await NotificationService.markAllAsRead(req.user._id);
    successResponse(res, 'All notifications marked as read', data);
  } catch (error) {
    next(error);
  }
};

const clearNotifications = async (req, res, next) => {
  try {
    await NotificationService.clearNotifications(req.user._id);
    successResponse(res, 'Notifications cleared successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications,
};
