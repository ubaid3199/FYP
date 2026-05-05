const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  urgency: { type: String, required: true }, // e.g., "Due today", "New"
  urgencyType: { 
    type: String, 
    enum: ['critical', 'info', 'neutral'], 
    default: 'neutral' 
  },
  actionText: { type: String, required: true }, // e.g., "Review", "Approve"
  targetPath: { type: String }, // Where the button should link to (e.g., "/admin/courses")
  isCompleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);