// middleware/auth.js
const { supabaseAdmin } = require('../config/supabase');

async function authenticateUser(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return res.status(401).json({ success: false, message: 'Authentication required. No session token found.' });
    }

    const token = parts[1].trim();

    try {
        // Query the authentication session state using the admin client
        const { data, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !data?.user) {
            return res.status(401).json({ success: false, message: 'Session expired or invalid. Please log in again.' });
        }

        // Standardize the auth payload attached to the request object
        req.user = {
            id: data.user.id,
            email: data.user.email,
            created_at: data.user.created_at,
            user_metadata: data.user.user_metadata || {}
        };

        next();
    } catch (err) {
        next(err);
    }
}

module.exports = { authenticateUser };