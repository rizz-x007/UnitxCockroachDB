// config/env.js
require('dotenv').config();

// List of environment keys that must be defined for the app to function
const REQUIRED_ENV_KEYS = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_JWT_SECRET',
    'GEMINI_API_KEY',
    'GEOAPIFY_API_KEY',
    'TURNSTILE_SECRET_KEY'
];

const missingKeys = REQUIRED_ENV_KEYS.filter(key => !process.env[key]);

if (missingKeys.length > 0) {
    console.error('❌ CRITICAL: Missing required environment configurations:');
    console.error(`👉 Missing keys: ${missingKeys.join(', ')}`);
    console.error('The server cannot start safely without these values. Exiting...');
    process.exit(1);
}

module.exports = {
    PORT: process.env.PORT || 3000,
    SUPABASE_URL: process.env.SUPABASE_URL.trim(),
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY.trim(),
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY.trim(),
    JWT_SECRET: process.env.SUPABASE_JWT_SECRET.trim(),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY.trim(),
    GEOAPIFY_API_KEY: process.env.GEOAPIFY_API_KEY.trim(),
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY.trim(),
    APP_URL: process.env.APP_URL?.trim() || 'http://localhost:3000'
};