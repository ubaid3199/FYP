const express = require('express');
const router = express.Router();

const { protect, adminOnly } = require('../middleware/authMiddleware');
const { createUser, deleteUser, updateUser } = require('../controllers/userController');

// Admin: create any user (student/lecturer/admin)
router.post('/', protect, adminOnly, createUser);

// Admin: delete any user
router.delete('/:id', protect, adminOnly, deleteUser);

// Admin: update any user
router.put('/:id', protect, adminOnly, updateUser);

module.exports = router;
