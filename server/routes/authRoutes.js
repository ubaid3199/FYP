const express = require('express');
const router = express.Router();
// Destructure the functions from the controller
const { loginUser, registerUser } = require('../controllers/authController');

// Ensure these functions actually exist
router.post('/login', loginUser);
router.post('/register', registerUser);

module.exports = router;