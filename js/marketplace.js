// ======================================
// ELEMENTS
// ======================================
const productsContainer = document.getElementById("productsContainer");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const categoryFilter = document.getElementById("categoryFilter");
const conditionFilter = document.getElementById("conditionFilter");
const applyFilters = document.getElementById("applyFilters");
const themeToggle = document.getElementById("themeToggle");
const profileBtn = document.getElementById("profileBtn");
const cartBtn = document.getElementById("cartBtn");
const sellBtn = document.getElementById("sellBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
const cartModal = document.getElementById("cartModal");
const cartItems = document.getElementById("cartItems");
const closeCart = document.getElementById("closeCart");
const cartBadge = document.getElementById("cartBadge");
const cartFooter = document.getElementById("cartFooter");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const toastContainer = document.getElementById("toastContainer");
const confirmModal = document.getElementById("confirmModal");
const confirmModalTitle = document.getElementById("confirmModalTitle");
const confirmModalMessage = document.getElementById("confirmModalMessage");
const confirmModalOk = document.getElementById("confirmModalOk");
const confirmModalCancel = document.getElementById("confirmModalCancel");

// ======================================
// GLOBAL DATA
// ======================================
let allProducts = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentUserId = null; 

// ======================================
// LOADING
// ======================================
function showLoading() { loadingOverlay.style.display = "flex"; }
function hideLoading() { loadingOverlay.style.display = "none"; }

// ======================================
// TOAST NOTIFICATIONS
// ======================================
function showToast(message, type = "info", duration = 3500) {
    if (!toastContainer) return;

    const icons = {
        success: "fa-check",
        error: "fa-xmark",
        warning: "fa-exclamation",
        info: "fa-info"
    };

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
        <span class="toast-icon"><i class="fas ${icons[type] || icons.info}"></i></span>
        <span class="toast-message"></span>
        <button class="toast-close" aria-label="Dismiss"><i class="fas fa-xmark"></i></button>
    `;
    toast.querySelector(".toast-message").textContent = message;

    const remove = () => {
        if (!toast.isConnected) return;
        toast.classList.add("toast--leaving");
        toast.addEventListener("animationend", () => toast.remove(), { once: true });
    };

    let timer = setTimeout(remove, duration);
    toast.addEventListener("mouseenter", () => clearTimeout(timer));
    toast.addEventListener("mouseleave", () => { timer = setTimeout(remove, 1200); });
    toast.querySelector(".toast-close").addEventListener("click", remove);

    toastContainer.appendChild(toast);
}

// ======================================
// CONFIRMATION MODAL
// ======================================
function showConfirm(message, title = "Are you sure?") {
    if (!confirmModal) return Promise.resolve(window.confirm(message));

    return new Promise(resolve => {
        confirmModalTitle.textContent = title;
        confirmModalMessage.textContent = message;
        confirmModal.classList.add("open");

        const cleanup = (result) => {
            confirmModal.classList.remove("open");
            confirmModalOk.removeEventListener("click", onOk);
            confirmModalCancel.removeEventListener("click", onCancel);
            confirmModal.removeEventListener("click", onOverlay);
            document.removeEventListener("keydown", onKeydown);
            resolve(result);
        };

        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onOverlay = (e) => { if (e.target === confirmModal) cleanup(false); };
        const onKeydown = (e) => { if (e.key === "Escape") cleanup(false); };

        confirmModalOk.addEventListener("click", onOk);
        confirmModalCancel.addEventListener("click", onCancel);
        confirmModal.addEventListener("click", onOverlay);
        document.addEventListener("keydown", onKeydown);
    });
}

// ======================================
// CART FUNCTIONS
// ======================================
function saveCart() { 
    localStorage.setItem("cart", JSON.stringify(cart)); 
    updateCartBadge();
}

function updateCartBadge() {
    if (!cartBadge) return;
    if (cart.length > 0) {
        cartBadge.textContent = cart.length;
        cartBadge.style.display = "flex";
    } else {
        cartBadge.style.display = "none";
    }
}

function closeCartModal() {
    cartModal.classList.remove("open");
}

function openCart() {
    cartItems.innerHTML = "";

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-cart-shopping"></i>
                <p>Your cart is empty</p>
            </div>
        `;
        cartFooter.style.display = "none";
    } else {
        cartFooter.style.display = "block";

        cart.forEach(item => {
            const div = document.createElement("div");
            div.classList.add("cart-item");
            div.innerHTML = `
                <img src="${item.image_url || 'https://via.placeholder.com/150'}" alt="${item.title}" class="cart-item-img">
                <div class="cart-item-details">
                    <div>
                        <h3>${item.title}</h3>
                        <p class="cart-item-desc">${item.description || 'No product description available for this item.'}</p>
                    </div>
                    <div class="cart-item-meta">
                        <span class="price" style="margin: 0; font-size: 1.1rem;">₹${item.price}</span>
                        <button class="remove-cart-btn" data-id="${item.id}">Remove</button>
                    </div>
                </div>
            `;
            cartItems.appendChild(div);
        });

        let subtotalItemsCost = 0;
        cart.forEach(item => {
            subtotalItemsCost += Number(item.price);
        });

        const shippingFee = subtotalItemsCost * 0.25;
        const ultimateTotal = subtotalItemsCost + shippingFee;

        let dynamicSummaryBox = document.getElementById("cartSummaryBreakdown");

        if (!dynamicSummaryBox) {
            dynamicSummaryBox = document.createElement("div");
            dynamicSummaryBox.id = "cartSummaryBreakdown";
            dynamicSummaryBox.style.cssText =
                "padding:12px 4px;font-size:0.9rem;border-bottom:1px solid var(--border);margin-bottom:14px;line-height:1.6;";

            if (cartFooter && placeOrderBtn) {
                cartFooter.insertBefore(dynamicSummaryBox, placeOrderBtn);
            }
        }

        dynamicSummaryBox.innerHTML = `
            <div style="display:flex;justify-content:space-between;">
                <span>Total Items:</span>
                <strong>${cart.length}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;">
                <span>Items Cost:</span>
                <strong>₹${subtotalItemsCost.toLocaleString('en-IN')}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;">
                <span>Shipping Cost (25%):</span>
                <strong>₹${shippingFee.toLocaleString('en-IN')}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:6px;border-top:1px dashed var(--border);font-size:1.1rem;color:var(--accent);font-weight:700;">
                <span>Order Total:</span>
                <span>₹${ultimateTotal.toLocaleString('en-IN')}</span>
            </div>
        `;

        if (placeOrderBtn) {
            placeOrderBtn.textContent = "Proceed to Payment";
        }

        attachRemoveButtons();
    }

    cartModal.classList.add("open");
}

function attachRemoveButtons() {
    document.querySelectorAll(".remove-cart-btn").forEach(btn => {
        btn.removeEventListener("click", handleRemoveItem); 
        btn.addEventListener("click", handleRemoveItem);
    });
}

function handleRemoveItem(e) {
    const id = e.target.closest(".remove-cart-btn")?.dataset.id;
    if (id == null) return;
    cart = cart.filter(item => item.id != id);
    saveCart();
    openCart();
    showToast("Removed from cart", "info");
}

placeOrderBtn.addEventListener("click", () => {
    const token = localStorage.getItem("unithrift_session_token");
    if (!token) {
        showToast("Please log in to proceed to checkout.", "warning");
        setTimeout(() => { window.location.href = "/"; }, 1500);
        return;
    }
    closeCartModal();
    window.location.href = "/checkout";
});

closeCart.addEventListener("click", closeCartModal);
cartBtn.addEventListener("click", openCart);

cartModal.addEventListener("click", (e) => {
    if (e.target === cartModal) closeCartModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && cartModal.classList.contains("open")) closeCartModal();
});

// ======================================
// LOAD PRODUCTS & USER SESSION
// ======================================
async function initSessionAndProducts() {
    try {
        showLoading();

        const token = localStorage.getItem("unithrift_session_token");
        if (token) {
            try {
                const r = await window.authFetch('/api/profile');
                const d = await r.json();
                if (d.success) currentUserId = d.profile?.id;
            } catch (_) {}
        }

        const response = await fetch('/api/products');
        const result = await response.json();

        if (!result.success) throw new Error(result.message);

        allProducts = result.products || [];
        renderProducts(allProducts);
    } catch (err) {
        console.error(err);
        productsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-triangle-exclamation"></i>
                <span>Failed to load products. Please try refreshing.</span>
            </div>
        `;
        showToast("Failed to load products", "error");
    } finally {
        hideLoading();
    }
}

// ======================================
// RENDER PRODUCTS
// ======================================
function renderProducts(products) {
    productsContainer.innerHTML = "";
    if (products.length === 0) {
        productsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <span>No products found</span>
            </div>
        `;
        return;
    }

    products.forEach((product, index) => {
        const isSold  = !!product.is_sold;
        const isOwner = currentUserId != null && String(product.user_id) === String(currentUserId);
        const card = document.createElement("div");
        card.classList.add("product-card");
        if (isSold) card.classList.add("product-card--sold");
        card.style.animationDelay = `${Math.min(index, 14) * 35}ms`;

        card.innerHTML = `
            <div class="product-image-wrap">
                <img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.title)}" class="product-image" onerror="this.src='https://placehold.co/600x400?text=UniThrift'">
                ${isSold ? '<div class="sold-badge">SOLD</div>' : ''}
            </div>
            <div class="product-content">
                <h3>${escapeHtml(product.title)}</h3>
                <div class="meta-wrapper">
                    <p class="category">${escapeHtml(product.category)}</p>
                    <p class="condition">${escapeHtml(product.condition)}</p>
                </div>
                <div class="price">₹${Number(product.price).toLocaleString('en-IN')}</div>
                <button class="view-btn" data-id="${product.id}">View Details</button>
                ${!isSold ? `<button class="add-cart-btn" data-id="${product.id}">Add To Cart</button>` : `<button class="add-cart-btn" disabled style="opacity:0.4;cursor:not-allowed;">Sold Out</button>`}
                ${isOwner && !isSold ? `<button class="mark-sold-btn" data-id="${product.id}">Mark as Sold</button>` : ''}
            </div>
        `;
        productsContainer.appendChild(card);
    });

    attachViewButtons();
    attachCartButtons();
    attachMarkSoldButtons();
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function attachViewButtons() {
    document.querySelectorAll(".view-btn").forEach(button => {
        button.onclick = () => { window.location.href = `/product?id=${button.dataset.id}`; };
    });
}

// Uses centralized window.authFetch for operations
function attachCartButtons() {
    document.querySelectorAll(".add-cart-btn").forEach(button => {
        if (button.disabled) return;
        button.onclick = () => {
            const product = allProducts.find(p => p.id == button.dataset.id);
            if (!product) return;
            if (cart.some(p => p.id == product.id)) {
                return showToast("This item is already in your cart", "warning");
            }
            cart.push(product);
            saveCart();
            showToast("Added to cart", "success");
        };
    });
}

function attachMarkSoldButtons() {
    document.querySelectorAll(".mark-sold-btn").forEach(button => {
        button.onclick = async () => {
            const confirmed = await showConfirm(
                "Mark this listing as sold? This cannot be undone.",
                "Mark as Sold?"
            );
            if (!confirmed) return;

            const token = localStorage.getItem("unithrift_session_token");
            button.textContent = "Marking...";
            button.disabled = true;
            try {
                const res = await window.authFetch(`/api/products/${button.dataset.id}/sold`, {
                    method: 'PATCH'
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.message);

                const idx = allProducts.findIndex(p => p.id == button.dataset.id);
                if (idx !== -1) allProducts[idx].is_sold = true;
                renderProducts(allProducts);
                showToast("Listing marked as sold", "success");
            } catch (err) {
                showToast("Failed: " + err.message, "error");
                button.textContent = "Mark as Sold";
                button.disabled = false;
            }
        };
    });
}

// ======================================
// SEARCH & FILTERS
// ======================================
const priceMinInput = document.getElementById("priceMin");
const priceMaxInput = document.getElementById("priceMax");

function matchesCampus(p) {
    const savedUni = localStorage.getItem("unithrift_selected_university");
    if (!savedUni) return true;
    if (!p.college_name) return true;
    return p.college_name.trim().toLowerCase() === savedUni.trim().toLowerCase();
}

function applyAllFilters() {
    const query = searchInput.value.toLowerCase().trim();
    const cat = categoryFilter.value;
    const con = conditionFilter.value;

    const rawMin = priceMinInput ? Number(priceMinInput.value) : 0;
    const rawMax = priceMaxInput ? Number(priceMaxInput.value) : Infinity;
    const lo = Math.min(rawMin, rawMax);
    const hi = Math.max(rawMin, rawMax);

    const filtered = allProducts.filter(p => {
        const matchesQuery = !query || p.title.toLowerCase().includes(query);
        const matchesCategory = !cat || p.category === cat;
        const matchesCondition = !con || p.condition === con;
        const price = Number(p.price);
        const matchesPrice = Number.isNaN(price) || (price >= lo && price <= hi);
        return matchesQuery && matchesCategory && matchesCondition && matchesPrice && matchesCampus(p);
    });

    renderProducts(filtered);
}

searchBtn.addEventListener("click", applyAllFilters);
searchInput.addEventListener("keyup", e => { if (e.key === "Enter") applyAllFilters(); });

applyFilters.addEventListener("click", applyAllFilters);

categoryFilter.addEventListener("change", applyAllFilters);
conditionFilter.addEventListener("change", applyAllFilters);

if (priceMinInput) priceMinInput.addEventListener("change", applyAllFilters);
if (priceMaxInput) priceMaxInput.addEventListener("change", applyAllFilters);

// ======================================
// THEME & ACTIONS
// ======================================
themeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.contains("dark-theme");
    document.body.classList.toggle("dark-theme", !isDark);
    document.body.classList.toggle("light-theme", isDark);
    localStorage.setItem("theme", isDark ? "light-theme" : "dark-theme");
});

profileBtn.addEventListener("click", () => { window.location.href = '/profile'; });

sellBtn.addEventListener("click", async () => {
    const token = localStorage.getItem("unithrift_session_token");
    if (!token) return window.location.href = '/';

    try {
        const response = await window.authFetch('/api/profile');
        const { success, profile } = await response.json();

        if (!success || !profile.seller_verified) {
            showToast("Complete your seller verification first.", "warning");
            window.location.href = '/profile';
        } else {
            window.location.href = '/sell';
        }
    } catch (err) {
        console.error("Failed to check seller verification:", err);
        showToast("Something went wrong. Please try again.", "error");
    }
});

// ======================================
// UNIVERSITY SEARCH (Geoapify autocomplete)
// ======================================
(function setupUniversitySearch() {
    const input = document.getElementById("universitySelect");
    const dropdown = document.getElementById("campusSelectDropdown");
    if (!input || !dropdown) return;

    let debounceTimer = null;
    let currentResults = [];
    let activeIndex = -1;

    const saved = localStorage.getItem("unithrift_selected_university");
    if (saved) input.value = saved;

    function closeDropdown() {
        dropdown.classList.remove("open");
        dropdown.innerHTML = "";
        currentResults = [];
        activeIndex = -1;
    }

    function renderResults(results) {
        currentResults = results;
        activeIndex = -1;

        if (results.length === 0) {
            dropdown.innerHTML = `<div class="campus-suggestion-empty">No universities found</div>`;
            dropdown.classList.add("open");
            return;
        }

        dropdown.innerHTML = results.map((r, i) => `
            <div class="campus-suggestion" data-index="${i}">
                <i class="fas fa-graduation-cap"></i><span></span>
            </div>
        `).join("");

        dropdown.querySelectorAll(".campus-suggestion").forEach((el, i) => {
            el.querySelector("span").textContent = results[i].formatted;
            el.addEventListener("click", () => selectResult(results[i]));
        });

        dropdown.classList.add("open");
    }

    function highlight(index) {
        dropdown.querySelectorAll(".campus-suggestion").forEach(el => {
            el.classList.toggle("active", Number(el.dataset.index) === index);
        });
    }

    function selectResult(result) {
        if (!result) return;
        input.value = result.formatted;
        localStorage.setItem("unithrift_selected_university", result.formatted);
        closeDropdown();
        if (typeof applyAllFilters === "function") applyAllFilters();
    }

    input.addEventListener("input", () => {
        const query = input.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < 3) {
            closeDropdown();
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const resp = await fetch(`/api/geoapify/autocomplete?text=${encodeURIComponent(query)}&type=amenity`);
                const data = await resp.json();
                if (!data.success) return closeDropdown();
                renderResults(data.results || []);
            } catch (err) {
                console.error("University autocomplete failed:", err);
                closeDropdown();
            }
        }, 300);
    });

    input.addEventListener("keydown", (e) => {
        if (!dropdown.classList.contains("open") || currentResults.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
            highlight(activeIndex);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            highlight(activeIndex);
        } else if (e.key === "Enter") {
            e.preventDefault();
            selectResult(currentResults[activeIndex >= 0 ? activeIndex : 0]);
        } else if (e.key === "Escape") {
            closeDropdown();
        }
    });

    document.addEventListener("click", (e) => {
        if (e.target !== input && !dropdown.contains(e.target)) closeDropdown();
    });
})();

// ======================================
// INIT
// ======================================
const savedTheme = localStorage.getItem("theme") || "dark-theme";
document.body.classList.remove("dark-theme", "light-theme");
document.body.classList.add(savedTheme);

initSessionAndProducts();
updateCartBadge();

// ======================================
// REALTIME AUTO-REFRESH
// ======================================
(function setupMarketplaceRealtime() {
    if (typeof supabase === "undefined") return;

    const SUPABASE_URL = window.__SUPABASE_URL__ || "";
    const SUPABASE_KEY = window.__SUPABASE_ANON__ || "";
    if (!SUPABASE_URL || !SUPABASE_KEY) return;

    const { createClient } = supabase;
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const token = localStorage.getItem("unithrift_session_token");
    if (token) sb.realtime.setAuth(token);

    // Listens for centralized updates and refreshes the socket token seamlessly
    window.addEventListener("unithrift:tokens-updated", () => {
        const newToken = localStorage.getItem("unithrift_session_token");
        if (newToken) sb.realtime.setAuth(newToken);
    });

    sb.channel("marketplace-products")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "products" }, (payload) => {
            if (allProducts.some(p => p.id === payload.new.id)) return;
            const incoming = { ...payload.new, image_url: 'https://placehold.co/600x400?text=UniThrift' };
            allProducts.unshift(incoming);
            applyAllFilters();
            showToast("A new listing just went up", "info");
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "products" }, (payload) => {
            const idx = allProducts.findIndex(p => p.id === payload.new.id);
            if (idx === -1) return;
            allProducts[idx] = { ...allProducts[idx], ...payload.new };
            applyAllFilters();
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "products" }, (payload) => {
            allProducts = allProducts.filter(p => p.id !== payload.old.id);
            applyAllFilters();
        })
        .subscribe();
})();