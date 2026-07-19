// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');

// Get active notifications
router.get('/', authenticateUser, asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from('notifications').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    res.json({ success: true, notifications: data || [] });
}));

// Unread badge count
router.get('/unread-count', authenticateUser, asyncHandler(async (req, res) => {
    const { count, error } = await supabaseAdmin
        .from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('read', false);
    if (error) throw error;
    res.json({ success: true, count: count || 0 });
}));

// Mark read
router.post('/:id/read', authenticateUser, asyncHandler(async (req, res) => {
    const { error } = await supabaseAdmin
        .from('notifications').update({ read: true }).eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true });
}));

// Clear all
router.post('/read-all', authenticateUser, asyncHandler(async (req, res) => {
    const { error } = await supabaseAdmin
        .from('notifications').update({ read: true }).eq('user_id', req.user.id).eq('read', false);
    if (error) throw error;
    res.json({ success: true });
}));

module.exports = router;