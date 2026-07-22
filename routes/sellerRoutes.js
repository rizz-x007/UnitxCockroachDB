// routes/sellerRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../config/cockroach'); // CockroachDB Connection Pool
const { asyncHandler } = require('../middleware/errorHandler');

// Get single seller info
router.get('/user/:id', asyncHandler(async (req, res) => {
    const profileResult = await pool.query('SELECT * FROM profiles WHERE id = $1', [req.params.id]);
    
    if (profileResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Seller not found.' });
    }
    
    res.json({ success: true, seller: profileResult.rows[0] });
}));

// Get storefront statistics, active listings, and rating summaries
router.get('/seller/:id/profile', asyncHandler(async (req, res) => {
    const sellerId = req.params.id;

    // 1. Fetch Profile
    const profileResult = await pool.query('SELECT * FROM profiles WHERE id = $1', [sellerId]);
    if (profileResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Seller profile not found.' });
    }
    const profile = profileResult.rows[0];

    // 2. OPTIMIZED: Retrieve products along with their primary image URL in a single SQL query
    const productsResult = await pool.query(`
        SELECT p.*, (
            SELECT image_url 
            FROM product_images 
            WHERE product_id = p.id 
            LIMIT 1
        ) AS image_url
        FROM products p
        WHERE p.user_id = $1
        ORDER BY p.created_at DESC
    `, [sellerId]);
    const rawListings = productsResult.rows;

    const listings = rawListings.map(p => ({
        ...p,
        image_url: p.image_url || 'https://placehold.co/600x400?text=UniThrift'
    }));

    // 3. OPTIMIZED: Compute average rating and count directly within SQL
    const ratingResult = await pool.query(`
        SELECT COALESCE(AVG(r.rating), 0)::numeric AS avg_rating, COUNT(r.id)::int AS review_count
        FROM reviews r
        JOIN products p ON r.product_id = p.id
        WHERE p.user_id = $1
    `, [sellerId]);
    
    const { avg_rating, review_count } = ratingResult.rows[0];
    const rating_avg = review_count > 0 ? Number(Number(avg_rating).toFixed(1)) : null;

    res.json({
        success: true,
        seller: profile,
        stats: {
            total_listings: listings.length,
            active_listings: listings.filter(p => !p.is_sold).length,
            sold_listings: listings.filter(p => p.is_sold).length,
            rating_avg: rating_avg,
            rating_count: review_count,
            member_since: profile.created_at || null
        },
        listings
    });
}));

module.exports = router;