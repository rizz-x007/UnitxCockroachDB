// routes/sellerRoutes.js
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');

// Get single seller info
router.get('/user/:id', asyncHandler(async (req, res) => {
    const { data: profile, error } = await supabaseAdmin
        .from('profiles').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!profile) return res.status(404).json({ success: false, message: 'Seller not found.' });
    res.json({ success: true, seller: profile });
}));

// Get storefront statistics, active listings, and rating summaries
router.get('/seller/:id/profile', asyncHandler(async (req, res) => {
    const sellerId = req.params.id;
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', sellerId).maybeSingle();
    if (!profile) return res.status(404).json({ success: false, message: 'Seller profile not found.' });

    const { data: products } = await supabaseAdmin.from('products').select('*').eq('user_id', sellerId);
    const productIds = (products || []).map(p => p.id);

    const imageMap = {};
    if (productIds.length > 0) {
        const { data: images } = await supabaseAdmin.from('product_images').select('product_id, image_url').in('product_id', productIds);
        (images || []).forEach(img => {
            if (!imageMap[img.product_id]) imageMap[img.product_id] = img.image_url;
        });
    }

    let avgRating = null, count = 0;
    if (productIds.length > 0) {
        const { data: reviews } = await supabaseAdmin.from('reviews').select('rating').in('product_id', productIds);
        count = (reviews || []).length;
        if (count > 0) {
            avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / count;
        }
    }

    const listings = (products || []).map(p => ({
        ...p,
        image_url: imageMap[p.id] || 'https://placehold.co/600x400?text=UniThrift'
    }));

    res.json({
        success: true,
        seller: profile,
        stats: {
            total_listings: listings.length,
            active_listings: listings.filter(p => !p.is_sold).length,
            sold_listings: listings.filter(p => p.is_sold).length,
            rating_avg: avgRating ? Number(avgRating.toFixed(1)) : null,
            rating_count: count,
            member_since: profile.created_at || null
        },
        listings
    });
}));

module.exports = router;