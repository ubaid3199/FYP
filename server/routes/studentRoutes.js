const express = require('express');
const router = express.Router();
const { getAllStudents } = require('../controllers/studentController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Admin: list students
router.get('/', protect, adminOnly, getAllStudents);

// A simple test route for your students
router.get('/dashboard', (req, res) => {
  res.json({ message: "Welcome to the student backend API!" });
});

module.exports = router;