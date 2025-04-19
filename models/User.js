const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  notifyInterval: { type: Number, default: 30 }, // 分単位
  lastNotifiedAt: { type: Date, default: null }
});

module.exports = mongoose.model('User', userSchema);
