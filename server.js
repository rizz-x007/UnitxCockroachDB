// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');

// Load validated environment variables first
const env = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Trust proxy header to support rate limiters behind Cloudflare or reverse proxies
app.set('trust proxy', 1);

// Convert the HTTP/HTTPS Supabase URL to WS/WSS protocols to allow WebSocket secure connections
const supabaseWss = env.SUPABASE_URL.replace(/^http/, 'ws');

// Configure robust security headers using Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", `${env.SUPABASE_URL}`, "https://placehold.co", "https://images.unsplash.com"],
            connectSrc: ["'self'", `${env.SUPABASE_URL}`, supabaseWss, "https://challenges.cloudflare.com", "https://api.geoapify.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            frameSrc: ["'self'", "https://challenges.cloudflare.com"],
        }
    }
}));

app.use(cors({
    exposedHeaders: ['X-New-Access-Token', 'X-New-Refresh-Token']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve frontend static folders
app.use('/css',    express.static(path.join(__dirname, 'css')));
app.use('/js',     express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));

/**
 * Dynamic HTML Injector.
 * Reads frontend HTML pages and injects public Supabase URL/Anon key configs
 * directly into the head before rendering to enable client-side subscriptions.
 */
function sendWithSupabaseConfig(res, fileName) {
    fs.readFile(path.join(__dirname, fileName), 'utf8', (err, html) => {
        if (err) {
            console.error(`Failed to read HTML file ${fileName}:`, err.message);
            return res.status(500).send('Internal Server Error - Failed to load page');
        }
        const injected = html.replace(
            '</head>',
            `<script>
                window.__SUPABASE_URL__ = ${JSON.stringify(env.SUPABASE_URL)};
                window.__SUPABASE_ANON__ = ${JSON.stringify(env.SUPABASE_ANON_KEY)};
            </script></head>`
        );
        res.send(injected);
    });
}

// ==========================================
// MOUNT API SUB-ROUTERS
// ==========================================

// Auth router handles signup, verify, resend, and login endpoints
app.use('/api', require('./routes/authRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));

// Profile router handles update profile and uploads
app.use('/api/profile', require('./routes/profileRoutes'));

// Listing router handles creation, viewing, and physical image uploads
app.use('/api/products', require('./routes/listingRoutes'));
app.use('/api/listings', require('./routes/listingRoutes')); 

// Seller router handles public storefront metrics
app.use('/api', require('./routes/sellerRoutes'));

// Chat router handles active rooms and messages
app.use('/api/chat', require('./routes/chatRoutes'));

// Notification router handles counters and clearing lists
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Geoapify router proxy handles location queries
app.use('/api/geoapify', require('./routes/geoapifyRoutes'));

// AI router handles chatbot turns and recommendations
app.use('/api', require('./routes/aiRoutes'));

// Admin router handles verification queues
app.use('/api/admin', require('./routes/adminRoutes'));

// ==========================================
// FRONTEND PAGE ROUTING
// ==========================================

// Auth Pages (No client-side Supabase required, uses backend API fetch)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));

// Standalone Static App Pages
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/sell', (req, res) => res.sendFile(path.join(__dirname, 'sell.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/help', (req, res) => res.sendFile(path.join(__dirname, 'help.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'checkout.html')));

// Client-Side Supabase Connected Pages (Requires dynamically injected credentials)
app.get('/marketplace', (req, res) => sendWithSupabaseConfig(res, 'marketplace.html'));
app.get('/product', (req, res) => sendWithSupabaseConfig(res, 'product.html'));
app.get('/product.html', (req, res) => sendWithSupabaseConfig(res, 'product.html'));
app.get('/seller-profile', (req, res) => sendWithSupabaseConfig(res, 'seller-profile.html')); // Fixed missing app. prefix
app.get('/chatbot', (req, res) => sendWithSupabaseConfig(res, 'unibot.html'));
app.get('/updates', (req, res) => sendWithSupabaseConfig(res, 'updates.html'));

// ==========================================
// CENTRAL ERROR INTERCEPTOR
// ==========================================
app.use(errorHandler);

// Start Server Listen Execution
const PORT = env.PORT;
app.listen(PORT, () => {
    console.log(`🚀 UniThrift running at: http://localhost:${PORT}`);
});