const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['admin', 'student', 'lecturer'], 
    default: 'student' 
  },
  lastActive: { 
    type: Date, 
    default: Date.now 
  },
  enrollmentStatus: { 
    type: String, 
    enum: ['active', 'suspended', 'at-risk'], 
    default: 'active' 
  }
}, { timestamps: true });

// Corrected Middleware: Removed 'next' because it is an async function
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Export the model once
module.exports = mongoose.model('User', userSchema);