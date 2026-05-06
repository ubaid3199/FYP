const express = require('express');
const router = express.Router();

const { protect, adminOnly } = require('../middleware/authMiddleware');
const { listQuickLinks, createQuickLink, deleteQuickLink } = require('../controllers/quickLinkController');

// Anyone logged in can read (students need this for their dashboard)
router.get('/', protect, listQuickLinks);

// Admin can create & delete
router.post('/', protect, adminOnly, createQuickLink);
router.delete('/:id', protect, adminOnly, deleteQuickLink);

module.exports = router;
