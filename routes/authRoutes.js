// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase'); // Auth tiers remain on Supabase
const pool = require('../config/cockroach'); // CockroachDB Connection Pool
const { asyncHandler } = require('../middleware/errorHandler');
const { authLimiter, verifyTurnstile } = require('../middleware/security');
const { generateOTP, hashOTP, verifyOTP, createExpiry } = require('../services/otpService');
const { sendVerificationOTP } = require('../services/emailService');

// Google OAuth URL generator (Controlled via Supabase SDK workflows)
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

// Sign Up Route (Turnstile & Database Transaction Protected with Compounding Rollback Cleanup)
router.post('/signup', authLimiter, verifyTurnstile, asyncHandler(async (req, res) => {
    const username = req.body.username?.trim().toLowerCase();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: 'All registration fields are required.' });
    }

    // Step 1: Sign up user on Supabase auth tier
    const { data: signUpData, error } = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: { data: { username } }
    });
    if (error) throw error;

    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = createExpiry(10); // 10 mins lifetime

    // Step 2: Open a transaction block to register metadata stub and OTP parameters to CockroachDB [11.1]
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create the base public user record to profiles table [11.1]
        await client.query(
            'INSERT INTO profiles (id, username, email) VALUES ($1, $2, $3)',
            [signUpData?.user?.id, username, email]
        );

        // Store active OTP confirmation token in email_verifications [11.1]
        await client.query('DELETE FROM email_verifications WHERE email = $1', [email]);
        await client.query(
            'INSERT INTO email_verifications (email, user_id, otp_hash, expires_at, attempts) VALUES ($1, $2, $3, $4, 0)',
            [email, signUpData?.user?.id, otpHash, expiresAt]
        );

        await client.query('COMMIT');
    } catch (dbErr) {
        await client.query('ROLLBACK');

        // Compensating Cleanup: Delete newly created Supabase user if Cockroach transaction aborts [1.10]
        if (signUpData?.user?.id) {
            await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id).catch(cleanErr => {
                console.error('Failed to clear orphaned Auth profile on SQL rollback:', cleanErr.message);
            });
        }
        throw dbErr;
    } finally {
        client.release();
    }

    await sendVerificationOTP(email, otp);

    res.status(201).json({ success: true, message: 'Account registered. OTP verification sent.', email });
}));

// Verify OTP with strict brute-force lockout safety [11.1]
router.post('/verify-otp', asyncHandler(async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    const otp = req.body.otp?.trim();

    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Email and OTP token are required.' });
    }

    const verificationResult = await pool.query(
        'SELECT * FROM email_verifications WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
        [email]
    );
    const record = verificationResult.rows[0];

    if (!record) {
        return res.status(400).json({ success: false, message: 'Verification records not found.' });
    }

    // Brute-force lockout safety check [11.1]
    if (record.attempts >= 5) {
        await pool.query('DELETE FROM email_verifications WHERE id = $1', [record.id]);
        return res.status(400).json({ success: false, message: 'Too many failed verification attempts. Please request a new code.' });
    }

    if (new Date(record.expires_at) < new Date()) {
        await pool.query('DELETE FROM email_verifications WHERE id = $1', [record.id]);
        return res.status(400).json({ success: false, message: 'This code has expired. Please request a new one.' });
    }

    if (!verifyOTP(otp, record.otp_hash)) {
        await pool.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [record.id]);
        return res.status(400).json({ success: false, message: 'Incorrect verification code.' });
    }

    // Retain Supabase's confirmation state update for auth validation
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(record.user_id, {
        email_confirm: true
    });
    if (confirmError) throw confirmError;

    await pool.query('DELETE FROM email_verifications WHERE id = $1', [record.id]);
    res.json({ success: true, message: 'Email verified. You can now log in.' });
}));

// Resend OTP
router.post('/resend-otp', asyncHandler(async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const verificationResult = await pool.query(
        'SELECT * FROM email_verifications WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
        [email]
    );
    const existing = verificationResult.rows[0];

    if (!existing) {
        return res.status(400).json({ success: false, message: 'No pending verification records found.' });
    }

    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = createExpiry(10);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query('DELETE FROM email_verifications WHERE email = $1', [email]);
        await client.query(
            'INSERT INTO email_verifications (email, user_id, otp_hash, expires_at, attempts) VALUES ($1, $2, $3, $4, 0)',
            [email, existing.user_id, otpHash, expiresAt]
        );

        await client.query('COMMIT');
    } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
    } finally {
        client.release();
    }

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
        // Query CockroachDB instead of running an RPC over Supabase DB [11.1]
        const profileResult = await pool.query('SELECT email FROM profiles WHERE username = $1', [targetEmail]);
        if (profileResult.rows.length === 0 || !profileResult.rows[0].email) {
            return res.status(400).json({ success: false, message: 'No registered user matches that username.' });
        }
        targetEmail = profileResult.rows[0].email;
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