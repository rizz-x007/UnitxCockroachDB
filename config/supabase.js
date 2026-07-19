// config/supabase.js
const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// Rename from adminClient to supabaseAdmin
const supabaseAdmin = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

// Export supabaseAdmin
module.exports = {
    supabaseAdmin
};