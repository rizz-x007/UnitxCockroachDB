// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../config/cockroach'); // CockroachDB Connection Pool
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');
const { createNotification, broadcastRealtimeEvent } = require('../services/notificationService');

// Create or get active conversation room
router.post('/room', authenticateUser, asyncHandler(async (req, res) => {
    const { product_id, buyer_id } = req.body;
    if (!product_id) return res.status(400).json({ success: false, message: 'Product ID required.' });

    const productResult = await pool.query('SELECT user_id FROM products WHERE id = $1', [product_id]);
    if (productResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Item listing not found.' });
    }
    const product = productResult.rows[0];

    // If the requester is the owner of the listing
    if (product.user_id === req.user.id) {
        if (buyer_id) {
            const existingResult = await pool.query(
                'SELECT id FROM chat_rooms WHERE product_id = $1 AND buyer_id = $2',
                [product_id, buyer_id]
            );
            if (existingResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Active buyer conversation not found.' });
            }
            return res.json({ success: true, room_id: existingResult.rows[0].id });
        }

        const roomsResult = await pool.query('SELECT id, buyer_id FROM chat_rooms WHERE product_id = $1', [product_id]);
        const rooms = roomsResult.rows;

        if (rooms.length === 0) {
            return res.status(404).json({ success: false, message: 'No buyers have initiated chat yet.' });
        }
        if (rooms.length === 1) {
            return res.json({ success: true, room_id: rooms[0].id });
        }
        return res.status(400).json({ success: false, code: 'MULTIPLE_BUYERS', message: 'Select user chat.' });
    }

    // If the requester is the buyer
    const existingResult = await pool.query(
        'SELECT id FROM chat_rooms WHERE product_id = $1 AND buyer_id = $2',
        [product_id, req.user.id]
    );

    if (existingResult.rows.length > 0) {
        return res.json({ success: true, room_id: existingResult.rows[0].id });
    }

    const roomResult = await pool.query(
        'INSERT INTO chat_rooms (product_id, buyer_id, seller_id) VALUES ($1, $2, $3) RETURNING id',
        [product_id, req.user.id, product.user_id]
    );

    res.json({ success: true, room_id: roomResult.rows[0].id });
}));

// Fetch user active room list
router.get('/rooms', authenticateUser, asyncHandler(async (req, res) => {
    // Single query JOIN instead of nested collections
    const roomsResult = await pool.query(`
        SELECT cr.id, cr.created_at, cr.product_id, p.title AS product_title, cr.buyer_id, cr.seller_id
        FROM chat_rooms cr
        JOIN products p ON cr.product_id = p.id
        WHERE cr.buyer_id = $1 OR cr.seller_id = $1
        ORDER BY cr.created_at DESC
    `, [req.user.id]);

    // Map relational joins back to expected nested metadata objects for frontend consistency
    const enriched = roomsResult.rows.map(r => ({
        id: r.id,
        created_at: r.created_at,
        product_id: r.product_id,
        products: { title: r.product_title },
        buyer_id: r.buyer_id,
        seller_id: r.seller_id,
        role: r.buyer_id === req.user.id ? 'Buyer' : 'Seller'
    }));
    
    res.json({ success: true, rooms: enriched });
}));

// Fetch room messages
router.get('/rooms/:room_id/messages', authenticateUser, asyncHandler(async (req, res) => {
    const roomResult = await pool.query('SELECT buyer_id, seller_id FROM chat_rooms WHERE id = $1', [req.params.room_id]);
    if (roomResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Chat room not found.' });
    }
    const room = roomResult.rows[0];

    if (room.buyer_id !== req.user.id && room.seller_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const messagesResult = await pool.query(
        'SELECT * FROM messages WHERE room_id = $1 ORDER BY created_at ASC',
        [req.params.room_id]
    );

    res.json({ success: true, messages: messagesResult.rows });
}));

// Send message (uses decoupled notification & realtime broadcast service layers)
router.post('/rooms/:room_id/messages', authenticateUser, asyncHandler(async (req, res) => {
    const text = req.body.message_text?.trim();
    if (!text) return res.status(400).json({ success: false, message: 'Message text cannot be empty.' });

    const roomResult = await pool.query('SELECT buyer_id, seller_id FROM chat_rooms WHERE id = $1', [req.params.room_id]);
    if (roomResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Chat room not found.' });
    }
    const room = roomResult.rows[0];

    if (room.buyer_id !== req.user.id && room.seller_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const insertResult = await pool.query(
        'INSERT INTO messages (room_id, sender_id, message_text) VALUES ($1, $2, $3) RETURNING *',
        [req.params.room_id, req.user.id, text]
    );
    const msg = insertResult.rows[0];

    const recipient = room.buyer_id === req.user.id ? room.seller_id : room.buyer_id;
    const profileResult = await pool.query('SELECT username FROM profiles WHERE id = $1', [req.user.id]);
    const senderName = profileResult.rows[0]?.username || 'Student';

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