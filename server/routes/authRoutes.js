const express = require('express');
const router = express.Router();
// Destructure the functions from the controller
const { loginUser, registerUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Ensure these functions actually exist
router.post('/login', loginUser);
router.post('/register', registerUser);

// Get current user profile from JWT
router.get('/me', protect, (req, res) => {
	res.status(200).json({ user: req.user });
});

module.exports = router;