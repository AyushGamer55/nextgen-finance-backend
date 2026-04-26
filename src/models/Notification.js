const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [120, 'Title cannot be more than 120 characters'],
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: [300, 'Notification text cannot be more than 300 characters'],
  },
  type: {
    type: String,
    enum: ['system', 'transaction', 'import', 'budget', 'advisor'],
    default: 'system',
  },
  source: {
    type: String,
    trim: true,
    maxlength: [60, 'Source cannot be more than 60 characters'],
    default: 'server',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  read: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
