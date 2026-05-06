const mongoose = require('mongoose');
const User = require('../models/User');

const ALLOWED_ROLES = new Set(['admin', 'student', 'lecturer']);

const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'name, email, password, and role are required' });
    }

    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'A user with this email already exists' });
    }

    const created = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: String(password),
      role,
    });

    const safe = created.toObject();
    delete safe.password;

    return res.status(201).json(safe);
  } catch (error) {
    console.error('🔥 Error creating user:', error);
    return res.status(500).json({ message: 'Server error while creating user' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    // Prevent admins from deleting themselves by accident
    if (req.user && String(req.user._id) === String(id)) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const deleted = await User.findByIdAndDelete(id).select('-password');
    if (!deleted) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ message: 'User deleted', user: deleted });
  } catch (error) {
    console.error('🔥 Error deleting user:', error);
    return res.status(500).json({ message: 'Server error while deleting user' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, email, password, role, enrollmentStatus } = req.body || {};

    if (role && !ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
      if (existing) {
        return res.status(409).json({ message: 'A user with this email already exists' });
      }
      user.email = normalizedEmail;
    }

    if (typeof name === 'string' && name.trim()) {
      user.name = name.trim();
    }

    if (role) {
      user.role = role;
    }

    if (enrollmentStatus) {
      user.enrollmentStatus = enrollmentStatus;
    }

    // Optional password update
    if (typeof password === 'string' && password.length > 0) {
      user.password = password;
    }

    const saved = await user.save();

    const safe = saved.toObject();
    delete safe.password;

    return res.status(200).json(safe);
  } catch (error) {
    console.error('🔥 Error updating user:', error);
    return res.status(500).json({ message: 'Server error while updating user' });
  }
};

module.exports = {
  createUser,
  deleteUser,
  updateUser,
};
