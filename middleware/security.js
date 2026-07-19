// middleware/security.js
const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Rate limiter for authentication sensitive routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,
    message: { success: false, message: 'Too many authentication attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter for file uploads
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    message: { success: false, message: 'Upload limits reached. Please wait a few minutes before trying again.' },
    standardHeaders: true,
    legacyHeaders: false
});

// ADD THIS: Rate limiter for UniBot conversations
const chatbotLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 40,
    message: { success: false, message: 'Too many messages to UniBot. Please wait a bit before continuing.' },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Cloudflare Turnstile token validation middleware.
 * Verifies the human challenge response sent inside req.body.
 */
async function verifyTurnstile(req, res, next) {
    const token = req.body['cf-turnstile-response'];

    if (!token) {
        return res.status(400).json({ success: false, message: 'Bot verification challenge token is missing.' });
    }

    try {
        const body = new URLSearchParams();
        body.append('secret', env.TURNSTILE_SECRET_KEY);
        body.append('response', token);
        body.append('remoteip', req.ip);

        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        });

        const result = await verifyRes.json();

        if (!result.success) {
            return res.status(400).json({ success: false, message: 'Security check failed. Please solve the captcha again.' });
        }

        next();
    } catch (err) {
        console.error('Turnstile verification error:', err.message);
        return res.status(500).json({ success: false, message: 'Verification engine offline. Please retry shortly.' });
    }
}

// UPDATE EXPORTS TO INCLUDE chatbotLimiter
module.exports = {
    authLimiter,
    uploadLimiter,
    chatbotLimiter,
    verifyTurnstile
};