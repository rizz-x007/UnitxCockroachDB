// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../config/cockroach'); // CockroachDB Connection Pool
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');

// Get active notifications (Retrieve 50 most recent)
router.get('/', authenticateUser, asyncHandler(async (req, res) => {
    const result = await pool.query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
        [req.user.id]
    );
    res.json({ success: true, notifications: result.rows });
}));

// Unread badge count
router.get('/unread-count', authenticateUser, asyncHandler(async (req, res) => {
    // Column "read" is wrapped in double quotes to protect the SQL reserved word
    const result = await pool.query(
        'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND "read" = FALSE',
        [req.user.id]
    );
    res.json({ success: true, count: result.rows[0].count });
}));

// Mark read
router.post('/:id/read', authenticateUser, asyncHandler(async (req, res) => {
    await pool.query(
        'UPDATE notifications SET "read" = TRUE WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
    );
    res.json({ success: true });
}));

// Clear all (Mark all unread notifications as read)
router.post('/read-all', authenticateUser, asyncHandler(async (req, res) => {
    await pool.query(
        'UPDATE notifications SET "read" = TRUE WHERE user_id = $1 AND "read" = FALSE',
        [req.user.id]
    );
    res.json({ success: true });
}));

module.exports = router;