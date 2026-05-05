const User = require('../models/User');

const getAllStudents = async (req, res) => {
  try {
    // Find everyone with the role of 'student'. 
    // .select('-password') ensures we don't accidentally send passwords to the frontend!
    const students = await User.find({ role: 'student' }).select('-password');
    res.status(200).json(students);
  } catch (error) {
    console.error('🔥 Error fetching students:', error);
    res.status(500).json({ message: 'Server error while fetching students' });
  }
};

module.exports = { getAllStudents };