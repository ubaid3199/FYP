const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['upload', 'submission', 'registration', 'grading', 'system'],
    required: true
  },
  description: { type: String, required: true }, // e.g., "Sarah submitted Final Essay"
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' // Who triggered this activity?
  }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);