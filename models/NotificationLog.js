const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
  email: { type: String, required: true },
  strength: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
