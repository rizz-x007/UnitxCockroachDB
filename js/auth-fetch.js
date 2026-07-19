// =========================================================================
// GLOBAL AUTHENTICATED FETCH WRAPPER WITH SILENT REFRESH & DEDUPLICATION
// =========================================================================
(function () {
    let refreshPromise = null;
    let isLoggingOut = false;

    async function tryTokenRefresh() {
        if (refreshPromise) return refreshPromise;

        refreshPromise = (async () => {
            const refreshToken = localStorage.getItem("unithrift_refresh_token");
            if (!refreshToken) return null;

            try {
                const response = await fetch("/api/auth/refresh", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refresh_token: refreshToken })
                });
                if (!response.ok) throw new Error("Token refresh execution failure");
                const data = await response.json().catch(() => ({ success: false }));
                if (data.success && data.access_token) {
                    localStorage.setItem("unithrift_session_token", data.access_token);
                    if (data.refresh_token) {
                        localStorage.setItem("unithrift_refresh_token", data.refresh_token);
                    }
                    window.dispatchEvent(new CustomEvent("unithrift:tokens-updated"));
                    return data.access_token;
                }
            } catch (err) {
                console.warn("Silent token refresh request failed:", err.message);
            }
            return null;
        })();

        try {
            return await refreshPromise;
        } finally {
            refreshPromise = null;
        }
    }

    window.authFetch = async function authFetch(url, options = {}) {
        const buildHeaders = () => {
            const h = new Headers(options.headers || {});
            h.set("Authorization", `Bearer ${localStorage.getItem("unithrift_session_token") || ""}`);
            const rt = localStorage.getItem("unithrift_refresh_token");
            if (rt) h.set("X-Refresh-Token", rt);
            return h;
        };

        const persistHeaders = (res) => {
            const a = res.headers.get("X-New-Access-Token");
            const r = res.headers.get("X-New-Refresh-Token");
            if (a) localStorage.setItem("unithrift_session_token", a);
            if (r) localStorage.setItem("unithrift_refresh_token", r);
            if (a || r) window.dispatchEvent(new CustomEvent("unithrift:tokens-updated"));
        };

        const forceLogout = () => {
            if (isLoggingOut) return;
            isLoggingOut = true;
            localStorage.removeItem("unithrift_session_token");
            localStorage.removeItem("unithrift_refresh_token");
            setTimeout(() => { window.location.href = "/"; }, 100);
        };

        let response = await fetch(url, { ...options, headers: buildHeaders() });
        persistHeaders(response);

        if (response.status === 401) {
            const newToken = await tryTokenRefresh();
            if (newToken) {
                response = await fetch(url, { ...options, headers: buildHeaders() });
                persistHeaders(response);

                if (response.status === 401) forceLogout();
            } else {
                forceLogout();
            }
        }

        return response;
    };
})();