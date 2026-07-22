// routes/listingRoutes.js
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase'); // Retained solely for Supabase Storage bucket uploads
const pool = require('../config/cockroach'); // CockroachDB Connection Pool
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const { verifyTurnstile, uploadLimiter } = require('../middleware/security');
const { verifyProductWithAI, generateProductInsights } = require('../services/productAIService');

// Public: Get all listings
router.get('/', asyncHandler(async (req, res) => {
    // Query products from CockroachDB
    const productsResult = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    const products = productsResult.rows;

    // Query images from CockroachDB
    const imagesResult = await pool.query('SELECT product_id, image_url FROM product_images');
    const images = imagesResult.rows;

    const imageMap = {};
    images.forEach(img => {
        if (!imageMap[img.product_id]) imageMap[img.product_id] = img.image_url;
    });

    const enriched = products.map(p => ({
        ...p,
        image_url: imageMap[p.id] || 'https://placehold.co/600x400?text=UniThrift'
    }));

    res.json({ success: true, products: enriched });
}));

// Public: Fetch standard single product details
router.get('/:id', asyncHandler(async (req, res) => {
    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (productResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Item not found.' });
    }
    res.json({ success: true, product: productResult.rows[0] });
}));

// Public: Fetch product images
router.get('/:id/images', asyncHandler(async (req, res) => {
    const imagesResult = await pool.query('SELECT * FROM product_images WHERE product_id = $1', [req.params.id]);
    res.json({ success: true, images: imagesResult.rows });
}));

// Public: Fetch product reviews
router.get('/:id/reviews', asyncHandler(async (req, res) => {
    const reviewsResult = await pool.query(
        'SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at ASC',
        [req.params.id]
    );
    res.json({ success: true, reviews: reviewsResult.rows });
}));

// Private: Submit rating review
router.post('/:id/reviews', authenticateUser, asyncHandler(async (req, res) => {
    const rating = Number(req.body.rating);
    const text = req.body.review_text?.trim().slice(0, 1000);

    if (!rating || rating < 1 || rating > 5 || !text) {
        return res.status(400).json({ success: false, message: 'Valid rating (1-5) and review message are required.' });
    }

    const insertQuery = `
        INSERT INTO reviews (product_id, user_id, rating, review_text)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `;
    const result = await pool.query(insertQuery, [req.params.id, req.user.id, rating, text]);

    res.json({ success: true, review: result.rows[0] });
}));

// Public: Get product AI recommendations & summaries
router.get('/:id/ai-insights', asyncHandler(async (req, res) => {
    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (productResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Item listing not found.' });
    }
    const product = productResult.rows[0];

    const reviewsResult = await pool.query('SELECT rating, review_text FROM reviews WHERE product_id = $1', [req.params.id]);
    const reviews = reviewsResult.rows;
    const reviewCount = reviews.length;

    let cachedInsights = product.ai_insights;
    if (typeof cachedInsights === 'string') {
        try { cachedInsights = JSON.parse(cachedInsights); } catch (_) {}
    }

    // Return cached insights if review structures match
    if (cachedInsights && product.ai_insights_review_count === reviewCount) {
        return res.json({ success: true, insights: cachedInsights });
    }

    const insights = await generateProductInsights(product, reviews);

    await pool.query(
    'UPDATE products SET ai_insights = $1, ai_insights_review_count = $2 WHERE id = $3',
    [insights, reviewCount, product.id]
);

    res.json({ success: true, insights });
}));

// Private: My listings
router.get('/my/listings', authenticateUser, asyncHandler(async (req, res) => {
    const productsResult = await pool.query(
        'SELECT * FROM products WHERE user_id = $1 ORDER BY created_at DESC',
        [req.user.id]
    );
    const products = productsResult.rows;

    const ids = products.map(p => p.id);
    const imageMap = {};
    if (ids.length > 0) {
        // Enforce explicit static type casting for UUID array mapping inside CockroachDB
        const imagesResult = await pool.query(
            'SELECT product_id, image_url FROM product_images WHERE product_id = ANY($1::uuid[])',
            [ids]
        );
        imagesResult.rows.forEach(img => {
            if (!imageMap[img.product_id]) imageMap[img.product_id] = img.image_url;
        });
    }

    const enriched = products.map(p => ({
        ...p,
        image_url: imageMap[p.id] || 'https://placehold.co/600x400?text=UniThrift'
    }));

    res.json({ success: true, products: enriched });
}));

// Private: Upload image to staging storage bucket (Kept on Supabase Storage)
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

    // Checkout a client from the connection pool to run transaction block safely
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Insert new product record into CockroachDB inside transaction
        const insertProductQuery = `
            INSERT INTO products (
                user_id, title, category, price, condition, description, 
                college_name, contact_no, delivery_date, payment_methods, 
                ai_verified, ai_score
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `;
        const productResult = await client.query(insertProductQuery, [
            req.user.id,
            title,
            category,
            Number(price),
            condition,
            description,
            college_name,
            contact_no,
            delivery_date || null,
            payment_methods,
            !aiResult.fallback,
            aiResult.confidence
        ]);
        const product = productResult.rows[0];

        // Insert associated image records into CockroachDB inside transaction
        const valuesArr = [];
        const valuePlaceholders = [];
        let paramIndex = 1;

        image_urls.forEach(url => {
            valuesArr.push(product.id, url);
            valuePlaceholders.push(`($${paramIndex}, $${paramIndex + 1})`);
            paramIndex += 2;
        });

        const insertImagesQuery = `
            INSERT INTO product_images (product_id, image_url)
            VALUES ${valuePlaceholders.join(', ')}
        `;
        await client.query(insertImagesQuery, valuesArr);

        await client.query('COMMIT');
        res.json({ success: true, product });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

// Private: Mark listing sold
router.patch('/:id/sold', authenticateUser, asyncHandler(async (req, res) => {
    const itemResult = await pool.query('SELECT user_id FROM products WHERE id = $1', [req.params.id]);
    if (itemResult.rows.length === 0 || itemResult.rows[0].user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Attempt to update is_sold and update sold_at timestamp simultaneously if column is in schema
    await pool.query('UPDATE products SET is_sold = true, sold_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ success: true });
}));

// Private: Delete listing
router.delete('/:id', authenticateUser, asyncHandler(async (req, res) => {
    // Checkout a client from the connection pool to run transaction block safely
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const itemResult = await client.query('SELECT user_id FROM products WHERE id = $1', [req.params.id]);
        if (itemResult.rows.length === 0 || itemResult.rows[0].user_id !== req.user.id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        // Delete associations first, then target product
        await client.query('DELETE FROM product_images WHERE product_id = $1', [req.params.id]);
        await client.query('DELETE FROM products WHERE id = $1', [req.params.id]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

module.exports = router;