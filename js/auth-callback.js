// ======================================
// SUPABASE OAUTH CALLBACK HANDLER
// Run this on every page that could be
// the OAuth redirect target so the token
// is always captured and saved.
// ======================================
(function handleOAuthCallback() {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) return;

    // Parse the fragment — Supabase puts the session here after OAuth
    const params = new URLSearchParams(hash.substring(1));
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken) return;

    // Save the access token using the same key the rest of the app uses
    localStorage.setItem('unithrift_session_token', accessToken);

    // Also save refresh token so we can silently renew later
    if (refreshToken) localStorage.setItem('unithrift_refresh_token', refreshToken);

    // Clean the ugly hash out of the URL bar without triggering a reload
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    console.log('✅ Google OAuth session captured and saved.');
})();