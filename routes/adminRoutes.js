// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

// Check administrative rights
router.get('/check', authenticateUser, asyncHandler(async (req, res) => {
    const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', req.user.id).maybeSingle();
    res.json({ success: true, isAdmin: !!profile?.is_admin });
}));

// Fetch pending verifications
router.get('/verifications', authenticateUser, asyncHandler(async (req, res) => {
    const { data: adminCheck } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', req.user.id).maybeSingle();
    if (!adminCheck?.is_admin) return res.status(403).json({ success: false, message: 'Access denied.' });

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, username, college_id_url, student_verified, pan_url, payment_qr_url, seller_verified, updated_at')
        .or('and(college_id_url.not.is.null,student_verified.eq.false),and(pan_url.not.is.null,payment_qr_url.not.is.null,seller_verified.eq.false)');
    if (error) throw error;

    res.json({ success: true, pending: data || [] });
}));

// Review action (Approve / Reject) (uses decoupled notification service layer)
router.post('/verifications/:userId/:type/:action', authenticateUser, asyncHandler(async (req, res) => {
    const { data: adminCheck } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', req.user.id).maybeSingle();
    if (!adminCheck?.is_admin) return res.status(403).json({ success: false, message: 'Access denied.' });

    const { userId, type, action } = req.params;
    if (!['student', 'seller'].includes(type) || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid action parameters.' });
    }

    const targetField = type === 'student' ? 'student_verified' : 'seller_verified';
    const isApproved = action === 'approve';

    const update = {
        [targetField]: isApproved,
        updated_at: new Date()
    };

    if (!isApproved) {
        if (type === 'student') update.college_id_url = null;
        else { update.pan_url = null; update.payment_qr_url = null; }
    }

    const { error } = await supabaseAdmin.from('profiles').update(update).eq('id', userId);
    if (error) throw error;

    const reviewMessage = isApproved 
        ? `Your ${type === 'student' ? 'Student' : 'Seller'} verification status has been approved!` 
        : `Your ${type === 'student' ? 'Student' : 'Seller'} verification document was rejected. Please re-upload a clear file.`;

    // Create database notification record using service helper
    await createNotification(userId, reviewMessage, 'system');

    res.json({ success: true });
}));

module.exports = router;