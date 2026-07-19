const { Resend } = require("resend");

if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY in .env");
}

const resend = new Resend(process.env.RESEND_API_KEY);

// =========================================================================
// RETRY HELPER
// =========================================================================
function isRetryableEmailError(err) {
    const status = err.statusCode || err.status;
    if (status) return [429, 500, 502, 503, 504].includes(status);
    return true;
}

async function withRetry(fn, { retries = 3, baseDelayMs = 300, isRetryable = () => true } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (attempt === retries || !isRetryable(err)) throw err;
            console.warn(`Email send attempt ${attempt + 1} failed (${err.message}), retrying...`);
        }
        const delay = baseDelayMs * 2 ** attempt + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw lastErr;
}

/**
 * Base email sender
 */
async function sendEmail({ to, subject, html }) {
    try {
        return await withRetry(async () => {
            const { data, error } = await resend.emails.send({
                from: process.env.EMAIL_FROM,
                to,
                subject,
                html
            });

            if (error) {
                console.error("Resend Error:", error);
                const err = new Error(error.message);
                err.statusCode = error.statusCode;
                err.name = error.name;
                throw err;
            }

            return data;
        }, { retries: 3, baseDelayMs: 300, isRetryable: isRetryableEmailError });
    } catch (err) {
        console.error("Email Service Error:", err);
        throw err;
    }
}

/**
 * Email Verification OTP
 */
async function sendVerificationOTP(email, otp) {
    const html = `
    <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:40px;">

        <h1 style="text-align:center;color:#7C3AED;margin-bottom:5px;">
            UniThrift
        </h1>

        <p style="text-align:center;color:#666;margin-top:0;">
            Student Marketplace Verification
        </p>

        <hr style="margin:30px 0;">

        <h2 style="color:#333;text-align:center;">
            Verify your email
        </h2>

        <p style="font-size:16px;color:#555;text-align:center;">
            Enter the following verification code to complete your signup.
        </p>

        <div style="
            margin:35px auto;
            width:fit-content;
            background:#F5F3FF;
            border:2px dashed #7C3AED;
            border-radius:10px;
            padding:18px 30px;
            font-size:38px;
            font-weight:bold;
            letter-spacing:10px;
            color:#7C3AED;
        ">
            ${otp}
        </div>

        <p style="text-align:center;color:#555;">
            This code expires in <strong>10 minutes</strong>.
        </p>

        <p style="margin-top:35px;color:#777;font-size:14px;text-align:center;">
            If you didn't create a UniThrift account, you can safely ignore this email.
        </p>

        <hr style="margin:35px 0;">

        <p style="font-size:12px;color:#999;text-align:center;">
            Never share this code with anyone.
        </p>

    </div>
    `;

    return sendEmail({
        to: email,
        subject: "Verify your UniThrift account",
        html
    });
}

/**
 * Password Reset OTP
 * (We'll use this later)
 */
async function sendPasswordResetOTP(email, otp) {
    const html = `
        <h2>Password Reset</h2>
        <p>Your password reset code is:</p>
        <h1>${otp}</h1>
        <p>This code expires in 10 minutes.</p>
    `;

    return sendEmail({
        to: email,
        subject: "Reset your UniThrift password",
        html
    });
}

module.exports = {
    sendEmail,
    sendVerificationOTP,
    sendPasswordResetOTP
};