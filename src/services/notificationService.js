const Notification = require('../models/Notification');
const { emitToUser } = require('../realtime/io');

class NotificationService {
  static async createNotification(userId, payload = {}) {
    if (!userId || !payload?.text) {
      return null;
    }

    const notification = await Notification.create({
      user: userId,
      title: payload.title || 'Activity',
      text: payload.text,
      type: payload.type || 'system',
      source: payload.source || 'server',
      metadata: payload.metadata || {},
      read: false,
    });

    emitToUser(userId, 'notification:new', notification.toObject());
    return notification;
  }

  static async listNotifications(userId, limit = 40) {
    const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 40));
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(parsedLimit);

    const unreadCount = await Notification.countDocuments({ user: userId, read: false });

    return {
      notifications,
      unreadCount,
    };
  }

  static async markAsRead(userId, notificationId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { read: true },
      { new: true }
    );

    if (notification) {
      emitToUser(userId, 'notification:updated', notification.toObject());
    }

    return notification;
  }

  static async markAllAsRead(userId) {
    await Notification.updateMany({ user: userId, read: false }, { read: true });
    emitToUser(userId, 'notification:all-read', { success: true });
    return this.listNotifications(userId);
  }

  static async clearNotifications(userId) {
    await Notification.deleteMany({ user: userId });
    emitToUser(userId, 'notification:cleared', { success: true });
    return { success: true };
  }
}

module.exports = NotificationService;
