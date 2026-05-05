const express = require('express');
const router = express.Router();

// A simple test route for your students
router.get('/dashboard', (req, res) => {
  res.json({ message: "Welcome to the student backend API!" });
});

module.exports = router;