// routes/aiRoutes.js
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');
const { chatbotLimiter } = require('../middleware/security');
const { chatbotChatTurn } = require('../services/productAIService');

// UniBot Chatbot Endpoint
router.post('/chatbot/message', authenticateUser, chatbotLimiter, asyncHandler(async (req, res) => {
    const message = req.body.message?.trim().slice(0, 2000);
    if (!message) return res.status(400).json({ success: false, message: 'Message text is required.' });

    let history = Array.isArray(req.body.history) ? req.body.history : [];
    history = history
        .filter(h => h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string')
        .slice(-12);

    const reply = await chatbotChatTurn(message, history);

    // Retrieve standard inventory candidates to match user search parameters
    const { data: products } = await supabaseAdmin.from('products').select('*').eq('is_sold', false);
    const tokens = message.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    let matches = [];

    if (products && tokens.length > 0) {
        matches = products.filter(p => {
            return tokens.some(t => 
                p.title.toLowerCase().includes(t) || 
                p.description.toLowerCase().includes(t) || 
                p.category.toLowerCase().includes(t)
            );
        }).slice(0, 4);
    }

    if (matches.length > 0) {
        const { data: images } = await supabaseAdmin.from('product_images').select('product_id, image_url').in('product_id', matches.map(m => m.id));
        const imageMap = {};
        (images || []).forEach(img => {
            if (!imageMap[img.product_id]) imageMap[img.product_id] = img.image_url;
        });
        matches = matches.map(m => ({ ...m, image_url: imageMap[m.id] || 'https://placehold.co/600x400?text=UniThrift' }));
    }

    res.json({ success: true, reply, products: matches });
}));

module.exports = router;