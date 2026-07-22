// routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase'); // Storage buckets remain on Supabase
const pool = require('../config/cockroach'); // CockroachDB Connection Pool
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');
const { uploadImage, uploadDoc } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/security');

// Get authenticated user profile
router.get('/', authenticateUser, asyncHandler(async (req, res) => {
    const profileResult = await pool.query('SELECT * FROM profiles WHERE id = $1', [req.user.id]);
    const profile = profileResult.rows[0];

    res.json({
        success: true,
        username: profile?.username || req.user.email.split('@')[0],
        email: req.user.email,
        created_at: req.user.created_at,
        profile: profile || {}
    });
}));

// Save text-based profile updates
router.post('/save', authenticateUser, asyncHandler(async (req, res) => {
    const college_name = req.body.college_name?.trim().slice(0, 200) || '';
    const location_name = req.body.location_name?.trim().slice(0, 200) || '';
    const address = req.body.address?.trim().slice(0, 500) || '';

    // Standard ON CONFLICT DO UPDATE upsert execution for CockroachDB compatibility [11.1]
    const upsertQuery = `
        INSERT INTO profiles (id, college_name, location_name, address, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (id) DO UPDATE SET
            college_name = EXCLUDED.college_name,
            location_name = EXCLUDED.location_name,
            address = EXCLUDED.address,
            updated_at = EXCLUDED.updated_at
    `;
    await pool.query(upsertQuery, [req.user.id, college_name, location_name, address]);

    res.json({ success: true });
}));

// Upload and set dynamic avatar with proactive garbage collection [1.10]
router.post('/avatar', authenticateUser, uploadLimiter, uploadImage.single('avatar'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file uploaded.' });

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = `${req.user.id}_avatar_${Date.now()}.${ext}`;

    // Proactively query and delete the old avatar from storage to avoid orphan files [1.10]
    const profileResult = await pool.query('SELECT avatar_url FROM profiles WHERE id = $1', [req.user.id]);
    const oldAvatarUrl = profileResult.rows[0]?.avatar_url;
    if (oldAvatarUrl) {
        const oldFile = oldAvatarUrl.split('/').pop();
        await supabaseAdmin.storage.from('avatars').remove([oldFile]).catch(() => {});
    }

    const { error: uploadError } = await supabaseAdmin.storage
        .from('avatars')
        .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage.from('avatars').getPublicUrl(fileName);

    const upsertQuery = `
        INSERT INTO profiles (id, avatar_url, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (id) DO UPDATE SET
            avatar_url = EXCLUDED.avatar_url,
            updated_at = EXCLUDED.updated_at
    `;
    await pool.query(upsertQuery, [req.user.id, publicUrl]);

    res.json({ success: true, url: publicUrl });
}));

// Submit student verification card
router.post('/verify/student', authenticateUser, uploadLimiter, uploadDoc.single('collegeId'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No college ID file found.' });

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = `${req.user.id}_college_id_${Date.now()}.${ext}`;

    // Proactively delete any existing student ID card from storage first [1.10]
    const profileResult = await pool.query('SELECT college_id_url FROM profiles WHERE id = $1', [req.user.id]);
    const oldUrl = profileResult.rows[0]?.college_id_url;
    if (oldUrl) {
        const oldFile = oldUrl.split('/').pop();
        await supabaseAdmin.storage.from('verification').remove([oldFile]).catch(() => {});
    }

    const { error: uploadError } = await supabaseAdmin.storage
        .from('verification')
        .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage.from('verification').getPublicUrl(fileName);

    const upsertQuery = `
        INSERT INTO profiles (id, college_id_url, student_verified, updated_at)
        VALUES ($1, $2, FALSE, NOW())
        ON CONFLICT (id) DO UPDATE SET
            college_id_url = EXCLUDED.college_id_url,
            student_verified = EXCLUDED.student_verified,
            updated_at = EXCLUDED.updated_at
    `;
    await pool.query(upsertQuery, [req.user.id, publicUrl]);

    res.json({ success: true, url: publicUrl });
}));

// Submit seller documents (PAN + QR) with safe compensating cleanup [1.10]
router.post('/verify/seller', authenticateUser, uploadLimiter, uploadDoc.fields([
    { name: 'panCard', maxCount: 1 },
    { name: 'paymentQr', maxCount: 1 }
]), asyncHandler(async (req, res) => {
    if (!req.files?.panCard || !req.files?.paymentQr) {
        return res.status(400).json({ success: false, message: 'Both PAN card and payment QR are required.' });
    }

    const panFile = req.files.panCard[0];
    const qrFile = req.files.paymentQr[0];

    const panExt = panFile.originalname.split('.').pop().toLowerCase();
    const panName = `${req.user.id}_pan_${Date.now()}.${panExt}`;

    const qrExt = qrFile.originalname.split('.').pop().toLowerCase();
    const qrName = `${req.user.id}_qr_${Date.now()}.${qrExt}`;

    // Proactively query and delete any old verification files [1.10]
    const profileResult = await pool.query('SELECT pan_url, payment_qr_url FROM profiles WHERE id = $1', [req.user.id]);
    const oldProfile = profileResult.rows[0];
    if (oldProfile?.pan_url) {
        const oldPan = oldProfile.pan_url.split('/').pop();
        await supabaseAdmin.storage.from('verification').remove([oldPan]).catch(() => {});
    }
    if (oldProfile?.payment_qr_url) {
        const oldQr = oldProfile.payment_qr_url.split('/').pop();
        await supabaseAdmin.storage.from('verification').remove([oldQr]).catch(() => {});
    }

    // Upload files sequentially with strict rollback cleanup if part of it fails [1.10]
    const { error: panErr } = await supabaseAdmin.storage
        .from('verification').upload(panName, panFile.buffer, { contentType: panFile.mimetype });
    if (panErr) throw panErr;

    try {
        const { error: qrErr } = await supabaseAdmin.storage
            .from('verification').upload(qrName, qrFile.buffer, { contentType: qrFile.mimetype });
        if (qrErr) throw qrErr;
    } catch (err) {
        // Compensating Cleanup: delete successfully uploaded PAN if QR fails [1.10]
        await supabaseAdmin.storage.from('verification').remove([panName]).catch(() => {});
        throw err;
    }

    const { data: { publicUrl: panUrl } } = supabaseAdmin.storage.from('verification').getPublicUrl(panName);
    const { data: { publicUrl: qrUrl } } = supabaseAdmin.storage.from('verification').getPublicUrl(qrName);

    const upsertQuery = `
        INSERT INTO profiles (id, pan_url, payment_qr_url, seller_verified, updated_at)
        VALUES ($1, $2, $3, FALSE, NOW())
        ON CONFLICT (id) DO UPDATE SET
            pan_url = EXCLUDED.pan_url,
            payment_qr_url = EXCLUDED.payment_qr_url,
            seller_verified = EXCLUDED.seller_verified,
            updated_at = EXCLUDED.updated_at
    `;
    await pool.query(upsertQuery, [req.user.id, panUrl, qrUrl]);

    res.json({ success: true, pan_url: panUrl, qr_url: qrUrl });
}));

// Remove verification documents
router.delete('/verify/:type', authenticateUser, asyncHandler(async (req, res) => {
    const { type } = req.params;
    const targets = {
        student: { col: 'college_id_url', reset: 'student_verified = FALSE' },
        pan: { col: 'pan_url', reset: 'seller_verified = FALSE' },
        qr: { col: 'payment_qr_url', reset: 'seller_verified = FALSE' }
    };

    const target = targets[type];
    if (!target) return res.status(400).json({ success: false, message: 'Invalid verification document.' });

    const profileResult = await pool.query(
        `SELECT college_id_url, pan_url, payment_qr_url FROM profiles WHERE id = $1`,
        [req.user.id]
    );
    const profile = profileResult.rows[0];

    if (profile?.[target.col]) {
        const file = profile[target.col].split('/').pop();
        await supabaseAdmin.storage.from('verification').remove([file]);
    }

    await pool.query(
        `UPDATE profiles SET ${target.col} = NULL, ${target.reset}, updated_at = NOW() WHERE id = $1`,
        [req.user.id]
    );

    res.json({ success: true });
}));

// Private: Fetch My listings
router.get('/my-listings', authenticateUser, asyncHandler(async (req, res) => {
    const productsResult = await pool.query(
        'SELECT * FROM products WHERE user_id = $1 ORDER BY created_at DESC',
        [req.user.id]
    );
    const products = productsResult.rows;

    const ids = products.map(p => p.id);
    const imageMap = {};
    if (ids.length > 0) {
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

module.exports = router;