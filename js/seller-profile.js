document.addEventListener("DOMContentLoaded", () => {
    // Standardized theme alignment across the platform
    const savedTheme = localStorage.getItem("theme") || "dark-theme";
    document.body.classList.remove("dark-theme", "light-theme");
    document.body.classList.add(savedTheme);

    const params = new URLSearchParams(window.location.search);
    const sellerId = params.get("id");

    const loadingEl = document.getElementById("sellerLoading");
    const errorEl = document.getElementById("sellerError");
    const errorMsgEl = document.getElementById("sellerErrorMsg");
    const contentEl = document.getElementById("sellerContent");

    function escapeHtml(str) {
        return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function showError(msg) {
        if (loadingEl) loadingEl.style.display = "none";
        if (contentEl) contentEl.style.display = "none";
        if (errorEl) {
            errorEl.style.display = "block";
            errorMsgEl.textContent = msg;
        }
    }

    if (!sellerId) {
        showError("No seller specified.");
        return;
    }

    let allListings = [];
    let currentTab = "active";

    function renderListings() {
        const grid = document.getElementById("sellerListingsGrid");
        if (!grid) return;

        const filtered = allListings.filter(p => {
            if (currentTab === "active") return !p.is_sold;
            if (currentTab === "sold") return !!p.is_sold;
            return true;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="empty-listings">No ${currentTab === "all" ? "" : currentTab + " "}listings to show.</div>`;
            return;
        }

        grid.innerHTML = filtered.map(p => `
            <div class="listing-card" data-id="${p.id}">
                <div class="listing-img-wrap">
                    <img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.title)}" onerror="this.src='https://placehold.co/600x400?text=UniThrift'">
                    ${p.is_sold ? '<span class="listing-sold-badge">SOLD</span>' : ''}
                </div>
                <div class="listing-body">
                    <h4>${escapeHtml(p.title)}</h4>
                    <span class="listing-price">₹${Number(p.price).toLocaleString('en-IN')}</span>
                </div>
            </div>
        `).join("");

        grid.querySelectorAll(".listing-card").forEach(card => {
            card.addEventListener("click", () => {
                window.location.href = `/product?id=${card.dataset.id}`;
            });
        });
    }

    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentTab = btn.dataset.tab;
            renderListings();
        });
    });

    (async function loadSellerProfile() {
        try {
            const res = await fetch(`/api/seller/${sellerId}/profile`);
            const data = await res.json();
            if (!data.success) return showError(data.message || "Seller not found.");

            const { seller, stats, listings } = data;
            allListings = listings || [];

            const avatarEl = document.getElementById("sellerAvatar");
            if (avatarEl) {
                avatarEl.src = seller.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.username || 'U')}&background=7c3aed&color=fff`;
            }

            const nameEl = document.getElementById("sellerName");
            if (nameEl) {
                nameEl.textContent = seller.username || seller.full_name || "Registered Student";
            }

            const collegeEl = document.getElementById("sellerCollege");
            if (collegeEl) {
                collegeEl.textContent = seller.college_name || "College not listed";
            }

            const badges = document.getElementById("sellerBadges");
            if (badges) {
                badges.innerHTML = "";
                if (seller.student_verified) {
                    badges.innerHTML += `<span class="seller-badge"><i class="fas fa-graduation-cap"></i> Verified Student</span>`;
                }
                if (seller.seller_verified) {
                    badges.innerHTML += `<span class="seller-badge"><i class="fas fa-circle-check"></i> Verified Seller</span>`;
                }
            }

            const ratingEl = document.getElementById("statRating");
            if (ratingEl) {
                ratingEl.textContent = stats.rating_avg ? `★ ${stats.rating_avg} (${stats.rating_count})` : "No ratings yet";
            }

            const soldEl = document.getElementById("statSold");
            if (soldEl) soldEl.textContent = stats.sold_listings;

            const activeEl = document.getElementById("statActive");
            if (activeEl) activeEl.textContent = stats.active_listings;

            const sinceEl = document.getElementById("statSince");
            if (sinceEl) {
                let sinceStr = "—";
                if (stats.member_since) {
                    const parsedSince = new Date(stats.member_since);
                    if (!isNaN(parsedSince.getTime())) {
                        sinceStr = parsedSince.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                    }
                }
                sinceEl.textContent = sinceStr;
            }

            renderListings();

            if (loadingEl) loadingEl.style.display = "none";
            if (contentEl) contentEl.style.display = "block";
        } catch (err) {
            console.error("Failed to load seller profile:", err);
            showError("Something went wrong loading this seller's profile.");
        }
    })();
});