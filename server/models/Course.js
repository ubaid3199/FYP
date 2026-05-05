const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  code: { type: String, required: true, unique: true }, // e.g., "CS101"
  description: { type: String },
  instructor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' // Links to a Lecturer
  },
  students: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' // Links to enrolled Students
  }],
  status: { 
    type: String, 
    enum: ['active', 'archived', 'draft'], 
    default: 'active' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);