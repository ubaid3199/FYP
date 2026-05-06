const mongoose = require('mongoose');

const quickLinkSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    href: { type: String, required: true, trim: true, maxlength: 2048 },
    audience: {
      type: String,
      enum: ['student', 'admin', 'both'],
      default: 'student',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('QuickLink', quickLinkSchema);
