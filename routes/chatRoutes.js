// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');
const { createNotification, broadcastRealtimeEvent } = require('../services/notificationService');

// Create or get active conversation room
router.post('/room', authenticateUser, asyncHandler(async (req, res) => {
    const { product_id, buyer_id } = req.body;
    if (!product_id) return res.status(400).json({ success: false, message: 'Product ID required.' });

    const { data: product } = await supabaseAdmin.from('products').select('user_id').eq('id', product_id).single();
    if (!product) return res.status(404).json({ success: false, message: 'Item listing not found.' });

    if (product.user_id === req.user.id) {
        if (buyer_id) {
            const { data: existing } = await supabaseAdmin
                .from('chat_rooms')
                .select('id')
                .eq('product_id', product_id)
                .eq('buyer_id', buyer_id)
                .maybeSingle();
            if (!existing) return res.status(404).json({ success: false, message: 'Active buyer conversation not found.' });
            return res.json({ success: true, room_id: existing.id });
        }

        const { data: rooms } = await supabaseAdmin.from('chat_rooms').select('id, buyer_id').eq('product_id', product_id);
        if (!rooms || rooms.length === 0) {
            return res.status(404).json({ success: false, message: 'No buyers have initiated chat yet.' });
        }
        if (rooms.length === 1) {
            return res.json({ success: true, room_id: rooms[0].id });
        }
        return res.status(400).json({ success: false, code: 'MULTIPLE_BUYERS', message: 'Select user chat.' });
    }

    const { data: existing } = await supabaseAdmin
        .from('chat_rooms').select('id')
        .eq('product_id', product_id).eq('buyer_id', req.user.id).maybeSingle();

    if (existing) return res.json({ success: true, room_id: existing.id });

    const { data: room, error } = await supabaseAdmin
        .from('chat_rooms')
        .insert({ product_id, buyer_id: req.user.id, seller_id: product.user_id })
        .select().single();
    if (error) throw error;

    res.json({ success: true, room_id: room.id });
}));

// Fetch user active room list
router.get('/rooms', authenticateUser, asyncHandler(async (req, res) => {
    const { data: rooms, error } = await supabaseAdmin
        .from('chat_rooms')
        .select('id, created_at, product_id, products(title), buyer_id, seller_id')
        .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
        .order('created_at', { ascending: false });
    if (error) throw error;

    const enriched = (rooms || []).map(r => ({
        ...r,
        role: r.buyer_id === req.user.id ? 'Buyer' : 'Seller'
    }));
    res.json({ success: true, rooms: enriched });
}));

// Fetch room messages
router.get('/rooms/:room_id/messages', authenticateUser, asyncHandler(async (req, res) => {
    const { data: room } = await supabaseAdmin.from('chat_rooms').select('buyer_id, seller_id').eq('id', req.params.room_id).single();
    if (!room || (room.buyer_id !== req.user.id && room.seller_id !== req.user.id)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { data: messages, error } = await supabaseAdmin
        .from('messages').select('*').eq('room_id', req.params.room_id).order('created_at', { ascending: true });
    if (error) throw error;

    res.json({ success: true, messages: messages || [] });
}));

// Send message (uses decoupled notification & realtime broadcast service layers)
router.post('/rooms/:room_id/messages', authenticateUser, asyncHandler(async (req, res) => {
    const text = req.body.message_text?.trim();
    if (!text) return res.status(400).json({ success: false, message: 'Message text cannot be empty.' });

    const { data: room } = await supabaseAdmin.from('chat_rooms').select('buyer_id, seller_id').eq('id', req.params.room_id).single();
    if (!room || (room.buyer_id !== req.user.id && room.seller_id !== req.user.id)) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { data: msg, error } = await supabaseAdmin
        .from('messages').insert({ room_id: req.params.room_id, sender_id: req.user.id, message_text: text }).select().single();
    if (error) throw error;

    const recipient = room.buyer_id === req.user.id ? room.seller_id : room.buyer_id;
    const { data: profile } = await supabaseAdmin.from('profiles').select('username').eq('id', req.user.id).single();
    const senderName = profile?.username || 'Student';

    // Broadcast instant socket event through the service layer
    await broadcastRealtimeEvent(recipient, 'new_msg_alert', { msg: text, senderName, roomId: req.params.room_id });

    // Save fallback database notification record through the service layer
    await createNotification(
        recipient,
        `New message from ${senderName}: "${text.slice(0, 80)}"`,
        'message',
        req.params.room_id
    );

    res.json({ success: true, message: msg });
}));

module.exports = router;