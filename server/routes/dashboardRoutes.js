const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/dashboardController');

// GET /api/dashboard
// Note: In a real app, we'd put your 'protect' middleware here to ensure only admins can see this!
router.get('/', getDashboardData);

module.exports = router;