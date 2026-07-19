// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { authLimiter, verifyTurnstile } = require('../middleware/security');
const { generateOTP, hashOTP, verifyOTP, createExpiry } = require('../services/otpService');
const { sendVerificationOTP } = require('../services/emailService');

// Google OAuth URL generator
router.post('/google', asyncHandler(async (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    const { data, error } = await supabaseAdmin.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${origin}/marketplace` }
    });
    if (error) throw error;
    res.json({ success: true, url: data.url });
}));

// Session Refresh Token Endpoint
router.post('/refresh', asyncHandler(async (req, res) => {
    const { refresh_token } = req.body;
    if (!refresh_token) {
        return res.status(400).json({ success: false, message: 'Refresh token is required.' });
    }
    const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token });
    if (error || !data.session) {
        return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
    }
    res.json({
        success: true,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
    });
}));

// Sign Up Route (Turnstile Protected)
router.post('/signup', authLimiter, verifyTurnstile, asyncHandler(async (req, res) => {
    const username = req.body.username?.trim().toLowerCase();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: 'All registration fields are required.' });
    }

    const { data: signUpData, error } = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: { data: { username } }
    });
    if (error) throw error;

    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = createExpiry(10); // 10 mins lifetime

    await supabaseAdmin.from('email_verifications').delete().eq('email', email);
    const { error: otpError } = await supabaseAdmin.from('email_verifications').insert({
        email,
        user_id: signUpData?.user?.id,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempts: 0
    });
    if (otpError) throw otpError;

    await sendVerificationOTP(email, otp);

    res.status(201).json({ success: true, message: 'Account registered. OTP verification sent.', email });
}));

// Verify OTP
router.post('/verify-otp', asyncHandler(async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    const otp = req.body.otp?.trim();

    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Email and OTP token are required.' });
    }

    const { data: record, error } = await supabaseAdmin
        .from('email_verifications')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;

    if (!record) {
        return res.status(400).json({ success: false, message: 'Verification records not found.' });
    }

    if (new Date(record.expires_at) < new Date()) {
        await supabaseAdmin.from('email_verifications').delete().eq('id', record.id);
        return res.status(400).json({ success: false, message: 'This code has expired. Please request a new one.' });
    }

    if (!verifyOTP(otp, record.otp_hash)) {
        await supabaseAdmin.from('email_verifications').update({ attempts: record.attempts + 1 }).eq('id', record.id);
        return res.status(400).json({ success: false, message: 'Incorrect verification code.' });
    }

    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(record.user_id, {
        email_confirm: true
    });
    if (confirmError) throw confirmError;

    await supabaseAdmin.from('email_verifications').delete().eq('id', record.id);
    res.json({ success: true, message: 'Email verified. You can now log in.' });
}));

// Resend OTP
router.post('/resend-otp', asyncHandler(async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const { data: existing, error } = await supabaseAdmin
        .from('email_verifications')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;

    if (!existing) {
        return res.status(400).json({ success: false, message: 'No pending verification records found.' });
    }

    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = createExpiry(10);

    await supabaseAdmin.from('email_verifications').delete().eq('email', email);
    await supabaseAdmin.from('email_verifications').insert({
        email,
        user_id: existing.user_id,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempts: 0
    });

    await sendVerificationOTP(email, otp);
    res.json({ success: true, message: 'A new verification code has been dispatched.' });
}));

// Login Route
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
    let loginIdentifier = req.body.loginIdentifier?.trim();
    let password = req.body.password;

    if (!loginIdentifier || !password) {
        return res.status(400).json({ success: false, message: 'All login credentials are required.' });
    }

    let targetEmail = loginIdentifier;
    if (!targetEmail.includes('@')) {
        const { data: emailResult, error: searchError } = await supabaseAdmin
            .rpc('get_email_by_username', { search_username: targetEmail });
        if (searchError || !emailResult) {
            return res.status(400).json({ success: false, message: 'No registered user matches that username.' });
        }
        targetEmail = emailResult;
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email: targetEmail, password });
    if (error) {
        if (/confirm/i.test(error.message || '')) {
            return res.status(403).json({
                success: false,
                needs_verification: true,
                email: targetEmail,
                message: 'Email confirmation required.'
            });
        }
        throw error;
    }

    res.json({
        success: true,
        message: 'Welcome back!',
        token: data.session.access_token,
        refresh_token: data.session.refresh_token
    });
}));

module.exports = router;