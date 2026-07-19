const crypto = require("crypto");

// HMAC key so a leaked email_verifications table alone isn't enough to
// brute-force the OTPs in it — a 6-digit code is only ~900k possibilities,
// which a bare SHA-256 hash brute-forces in well under a second offline.
// Falls back to JWT_SECRET (already required at boot) rather than hard-failing,
// but a dedicated OTP_HASH_SECRET is preferred.
const OTP_HASH_SECRET = (process.env.OTP_HASH_SECRET || process.env.SUPABASE_JWT_SECRET || "").trim();
if (!OTP_HASH_SECRET) {
    console.warn("⚠️  No OTP_HASH_SECRET (or SUPABASE_JWT_SECRET) set — OTP hashes are unpeppered.");
}

/**
 * Generate secure 6-digit OTP
 */
function generateOTP() {
    // randomInt's upper bound is EXCLUSIVE — use 1000000 so 999999 is reachable.
    return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash OTP before storing (HMAC, not a bare hash — see note above)
 */
function hashOTP(otp) {
    return crypto
        .createHmac("sha256", OTP_HASH_SECRET)
        .update(otp)
        .digest("hex");
}

/**
 * Compare entered OTP with stored hash, in constant time
 */
function verifyOTP(inputOTP, storedHash) {
    const inputHash = Buffer.from(hashOTP(inputOTP), "hex");
    const stored    = Buffer.from(storedHash, "hex");
    if (inputHash.length !== stored.length) return false;
    return crypto.timingSafeEqual(inputHash, stored);
}

/**
 * Create expiry timestamp
 */
function createExpiry(minutes = 10) {
    return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Check if OTP expired
 */
function isExpired(expiryDate) {
    return new Date() > new Date(expiryDate);
}

module.exports = {
    generateOTP,
    hashOTP,
    verifyOTP,
    createExpiry,
    isExpired
};