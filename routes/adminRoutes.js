// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../config/cockroach'); // CockroachDB Connection Pool
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

// Check administrative rights
router.get('/check', authenticateUser, asyncHandler(async (req, res) => {
    const profileResult = await pool.query('SELECT is_admin FROM profiles WHERE id = $1', [req.user.id]);
    res.json({ success: true, isAdmin: !!profileResult.rows[0]?.is_admin });
}));

// Fetch pending verifications
router.get('/verifications', authenticateUser, asyncHandler(async (req, res) => {
    const adminCheck = await pool.query('SELECT is_admin FROM profiles WHERE id = $1', [req.user.id]);
    if (!adminCheck.rows[0]?.is_admin) return res.status(403).json({ success: false, message: 'Access denied.' });

    // Supabase OR condition converted to optimized relational logic
    const verificationsResult = await pool.query(`
        SELECT id, username, college_id_url, student_verified, pan_url, payment_qr_url, seller_verified, updated_at
        FROM profiles
        WHERE (college_id_url IS NOT NULL AND student_verified = FALSE)
           OR (pan_url IS NOT NULL AND payment_qr_url IS NOT NULL AND seller_verified = FALSE)
    `);

    res.json({ success: true, pending: verificationsResult.rows });
}));

// Review action (Approve / Reject) (uses decoupled notification service layer)
router.post('/verifications/:userId/:type/:action', authenticateUser, asyncHandler(async (req, res) => {
    const adminCheck = await pool.query('SELECT is_admin FROM profiles WHERE id = $1', [req.user.id]);
    if (!adminCheck.rows[0]?.is_admin) return res.status(403).json({ success: false, message: 'Access denied.' });

    const { userId, type, action } = req.params;
    if (!['student', 'seller'].includes(type) || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid action parameters.' });
    }

    const isApproved = action === 'approve';

    if (type === 'student') {
        if (isApproved) {
            await pool.query('UPDATE profiles SET student_verified = TRUE, updated_at = NOW() WHERE id = $1', [userId]);
        } else {
            await pool.query('UPDATE profiles SET student_verified = FALSE, college_id_url = NULL, updated_at = NOW() WHERE id = $1', [userId]);
        }
    } else {
        if (isApproved) {
            await pool.query('UPDATE profiles SET seller_verified = TRUE, updated_at = NOW() WHERE id = $1', [userId]);
        } else {
            await pool.query('UPDATE profiles SET seller_verified = FALSE, pan_url = NULL, payment_qr_url = NULL, updated_at = NOW() WHERE id = $1', [userId]);
        }
    }

    const reviewMessage = isApproved 
        ? `Your ${type === 'student' ? 'Student' : 'Seller'} verification status has been approved!` 
        : `Your ${type === 'student' ? 'Student' : 'Seller'} verification document was rejected. Please re-upload a clear file.`;

    // Create database notification record using service helper
    await createNotification(userId, reviewMessage, 'system');

    res.json({ success: true });
}));

module.exports = router;