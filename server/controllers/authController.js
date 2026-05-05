const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. BACKEND LOGIN LOGIC
const loginUser = async (req, res) => {
  console.log('\n--- 🚨 NEW LOGIN ATTEMPT 🚨 ---');
  console.log('1. Raw data received from frontend:', req.body);

  const email = req.body.email?.trim();
  const password = req.body.password;

  try {
    const user = await User.findOne({ email });
    console.log('2. Did we find the user in the database?', user ? `YES (${user.email})` : 'NO');

    if (!user) {
      console.log('❌ Blocked: Email not found.');
      return res.status(401).json({ message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('3. Did the password match?', isMatch ? 'YES' : 'NO');

    if (!isMatch) {
      console.log('❌ Blocked: Wrong password.');
      return res.status(401).json({ message: 'Wrong password.' });
    }

    console.log('✅ LOGIN SUCCESSFUL! Generating Token...');
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    
    res.status(200).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('🔥 SERVER CRASH:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// 2. BACKEND REGISTER LOGIC
const registerUser = async (req, res) => {
  res.status(200).json({ message: "Register endpoint active" });
};

// EXPORT BOTH
module.exports = { loginUser, registerUser };