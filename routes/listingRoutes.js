// routes/listingRoutes.js
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const { verifyTurnstile, uploadLimiter } = require('../middleware/security');
const { verifyProductWithAI, generateProductInsights } = require('../services/productAIService');

// Public: Get all listings
router.get('/', asyncHandler(async (req, res) => {
    const { data: products, error } = await supabaseAdmin
        .from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    const { data: images } = await supabaseAdmin.from('product_images').select('product_id, image_url');
    const imageMap = {};
    (images || []).forEach(img => {
        if (!imageMap[img.product_id]) imageMap[img.product_id] = img.image_url;
    });

    const enriched = (products || []).map(p => ({
        ...p,
        image_url: imageMap[p.id] || 'https://placehold.co/600x400?text=UniThrift'
    }));

    res.json({ success: true, products: enriched });
}));

// Public: Fetch standard single product details
router.get('/:id', asyncHandler(async (req, res) => {
    const { data: product, error } = await supabaseAdmin
        .from('products').select('*').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ success: false, message: 'Item not found.' });
    res.json({ success: true, product });
}));

// Public: Fetch product images
router.get('/:id/images', asyncHandler(async (req, res) => {
    const { data: images, error } = await supabaseAdmin
        .from('product_images').select('*').eq('product_id', req.params.id);
    if (error) throw error;
    res.json({ success: true, images: images || [] });
}));

// Public: Fetch product reviews
router.get('/:id/reviews', asyncHandler(async (req, res) => {
    const { data: reviews, error } = await supabaseAdmin
        .from('reviews').select('*').eq('product_id', req.params.id).order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ success: true, reviews: reviews || [] });
}));

// Private: Submit rating review
router.post('/:id/reviews', authenticateUser, asyncHandler(async (req, res) => {
    const rating = Number(req.body.rating);
    const text = req.body.review_text?.trim().slice(0, 1000);

    if (!rating || rating < 1 || rating > 5 || !text) {
        return res.status(400).json({ success: false, message: 'Valid rating (1-5) and review message are required.' });
    }

    const { data, error } = await supabaseAdmin
        .from('reviews').insert({ product_id: req.params.id, user_id: req.user.id, rating, review_text: text }).select().single();
    if (error) throw error;

    res.json({ success: true, review: data });
}));

// Public: Get product AI recommendations & summaries
router.get('/:id/ai-insights', asyncHandler(async (req, res) => {
    const { data: product } = await supabaseAdmin.from('products').select('*').eq('id', req.params.id).single();
    if (!product) return res.status(404).json({ success: false, message: 'Item listing not found.' });

    const { data: reviews } = await supabaseAdmin.from('reviews').select('rating, review_text').eq('product_id', req.params.id);
    const reviewCount = (reviews || []).length;

    // Return cached insights if review structures match
    if (product.ai_insights && product.ai_insights_review_count === reviewCount) {
        return res.json({ success: true, insights: product.ai_insights });
    }

    const insights = await generateProductInsights(product, reviews || []);
    await supabaseAdmin.from('products').update({ ai_insights: insights, ai_insights_review_count: reviewCount }).eq('id', product.id);

    res.json({ success: true, insights });
}));

// Private: My listings
router.get('/my/listings', authenticateUser, asyncHandler(async (req, res) => {
    const { data: products, error } = await supabaseAdmin
        .from('products').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (error) throw error;

    const ids = (products || []).map(p => p.id);
    const imageMap = {};
    if (ids.length > 0) {
        const { data: images } = await supabaseAdmin.from('product_images').select('product_id, image_url').in('product_id', ids);
        (images || []).forEach(img => {
            if (!imageMap[img.product_id]) imageMap[img.product_id] = img.image_url;
        });
    }

    const enriched = (products || []).map(p => ({
        ...p,
        image_url: imageMap[p.id] || 'https://placehold.co/600x400?text=UniThrift'
    }));

    res.json({ success: true, products: enriched });
}));

// Private: Upload image to staging storage bucket
router.post('/upload-image', authenticateUser, uploadLimiter, uploadImage.single('image'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = `${req.user.id}_listing_${Date.now()}.${ext}`;

    const { error } = await supabaseAdmin.storage
        .from('product-images').upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
    if (error) throw error;

    const { data: { publicUrl } } = supabaseAdmin.storage.from('product-images').getPublicUrl(fileName);
    res.json({ success: true, url: publicUrl });
}));

// Private: Create new listing
router.post('/create', authenticateUser, verifyTurnstile, asyncHandler(async (req, res) => {
    const { title, category, price, condition, description, college_name, contact_no, delivery_date, payment_methods, image_urls } = req.body;

    if (!title || !category || !price || !image_urls || image_urls.length === 0) {
        return res.status(400).json({ success: false, message: 'Missing required listing information.' });
    }

    const aiResult = await verifyProductWithAI(title, description, image_urls);
    if (!aiResult.verified) {
        return res.status(400).json({ success: false, message: `Advisory Moderation Rejected: ${aiResult.reason}` });
    }

    const { data: product, error } = await supabaseAdmin
        .from('products')
        .insert({
            user_id: req.user.id,
            title,
            category,
            price: Number(price),
            condition,
            description,
            college_name,
            contact_no,
            delivery_date,
            payment_methods,
            ai_verified: !aiResult.fallback,
            ai_score: aiResult.confidence
        })
        .select().single();
    if (error) throw error;

    await supabaseAdmin.from('product_images').insert(
        image_urls.map(url => ({ product_id: product.id, image_url: url }))
    );

    res.json({ success: true, product });
}));

// Private: Mark listing sold
router.patch('/:id/sold', authenticateUser, asyncHandler(async (req, res) => {
    const { data: item } = await supabaseAdmin.from('products').select('user_id').eq('id', req.params.id).single();
    if (!item || item.user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { error } = await supabaseAdmin.from('products').update({ is_sold: true }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
}));

// Private: Delete listing
router.delete('/:id', authenticateUser, asyncHandler(async (req, res) => {
    const { data: item } = await supabaseAdmin.from('products').select('user_id').eq('id', req.params.id).single();
    if (!item || item.user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await supabaseAdmin.from('product_images').delete().eq('product_id', req.params.id);
    const { error } = await supabaseAdmin.from('products').delete().eq('id', req.params.id);
    if (error) throw error;

    res.json({ success: true });
}));

module.exports = router;