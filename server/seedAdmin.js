
if (!globalThis.crypto) { globalThis.crypto = require('crypto'); }

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the User Schema directly in the script just to be safe
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'student' }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

const seedAdmin = async () => {
  try {
    console.log('Attempting to connect to:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🟢 Connected to Database...');

    const adminExists = await User.findOne({ email: 'admin@roehampton.ac.uk' });
    if (adminExists) {
      console.log('⚠️ Admin account already exists! Try logging in now.');
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash('Admin123!', 10);

    const admin = new User({
      name: 'System Admin',
      email: 'admin@roehampton.ac.uk',
      password: hashedPassword,
      role: 'admin'
    });

    await admin.save();
    console.log('✅ Master Admin Account created successfully!');
    console.log('---------------------------------');
    console.log('Email: admin@roehampton.ac.uk');
    console.log('Pass:  Admin123!');
    console.log('---------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

seedAdmin();