// routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');
const { uploadImage, uploadDoc } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/security');

// Get authenticated user profile
router.get('/', authenticateUser, asyncHandler(async (req, res) => {
    const { data: profile, error } = await supabaseAdmin
        .from('profiles').select('*').eq('id', req.user.id).maybeSingle();
    if (error) throw error;
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

    const { error } = await supabaseAdmin
        .from('profiles')
        .upsert({ id: req.user.id, college_name, location_name, address, updated_at: new Date() });
    if (error) throw error;
    res.json({ success: true });
}));

// Upload and set dynamic avatar
router.post('/avatar', authenticateUser, uploadLimiter, uploadImage.single('avatar'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file uploaded.' });

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = `${req.user.id}_avatar_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
        .from('avatars')
        .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage.from('avatars').getPublicUrl(fileName);
    const { error: dbError } = await supabaseAdmin
        .from('profiles')
        .upsert({ id: req.user.id, avatar_url: publicUrl, updated_at: new Date() });
    if (dbError) throw dbError;

    res.json({ success: true, url: publicUrl });
}));

// Submit student verification card
router.post('/verify/student', authenticateUser, uploadLimiter, uploadDoc.single('collegeId'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No college ID file found.' });

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = `${req.user.id}_college_id_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
        .from('verification')
        .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage.from('verification').getPublicUrl(fileName);
    const { error: dbError } = await supabaseAdmin
        .from('profiles')
        .upsert({ id: req.user.id, college_id_url: publicUrl, student_verified: false, updated_at: new Date() });
    if (dbError) throw dbError;

    res.json({ success: true, url: publicUrl });
}));

// Submit seller documents (PAN + QR)
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
    const { error: panErr } = await supabaseAdmin.storage
        .from('verification').upload(panName, panFile.buffer, { contentType: panFile.mimetype });
    if (panErr) throw panErr;

    const qrExt = qrFile.originalname.split('.').pop().toLowerCase();
    const qrName = `${req.user.id}_qr_${Date.now()}.${qrExt}`;
    const { error: qrErr } = await supabaseAdmin.storage
        .from('verification').upload(qrName, qrFile.buffer, { contentType: qrFile.mimetype });
    if (qrErr) throw qrErr;

    const { data: { publicUrl: panUrl } } = supabaseAdmin.storage.from('verification').getPublicUrl(panName);
    const { data: { publicUrl: qrUrl } } = supabaseAdmin.storage.from('verification').getPublicUrl(qrName);

    const { error: dbError } = await supabaseAdmin.from('profiles').upsert({
        id: req.user.id,
        pan_url: panUrl,
        payment_qr_url: qrUrl,
        seller_verified: false,
        updated_at: new Date()
    });
    if (dbError) throw dbError;

    res.json({ success: true, pan_url: panUrl, qr_url: qrUrl });
}));

// Remove verification documents
router.delete('/verify/:type', authenticateUser, asyncHandler(async (req, res) => {
    const { type } = req.params;
    const targets = {
        student: { col: 'college_id_url', reset: { student_verified: false } },
        pan: { col: 'pan_url', reset: { seller_verified: false } },
        qr: { col: 'payment_qr_url', reset: { seller_verified: false } }
    };

    const target = targets[type];
    if (!target) return res.status(400).json({ success: false, message: 'Invalid verification document.' });

    const { data: profile } = await supabaseAdmin.from('profiles').select(target.col).eq('id', req.user.id).single();
    if (profile?.[target.col]) {
        const file = profile[target.col].split('/').pop();
        await supabaseAdmin.storage.from('verification').remove([file]);
    }

    const { error } = await supabaseAdmin.from('profiles')
        .update({ [target.col]: null, ...target.reset, updated_at: new Date() })
        .eq('id', req.user.id);
    if (error) throw error;

    res.json({ success: true });
}));

// Private: Fetch My listings
router.get('/my-listings', authenticateUser, asyncHandler(async (req, res) => {
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

module.exports = router;