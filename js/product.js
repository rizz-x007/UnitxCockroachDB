// ======================================
// PRODUCT ID FROM URL
// ======================================
const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

// ======================================
// HTML ELEMENTS
// ======================================
const mainImage = document.getElementById("mainImage");
if (mainImage) mainImage.onerror = () => { mainImage.src = 'https://placehold.co/600x600?text=UniThrift'; };
const thumbnailContainer = document.getElementById("thumbnailContainer");
const productTitle = document.getElementById("productTitle");
const productPrice = document.getElementById("productPrice");
const productCondition = document.getElementById("productCondition");
const deliveryDate = document.getElementById("deliveryDate");
const paymentMethods = document.getElementById("paymentMethods");
const productDescription = document.getElementById("productDescription");
const sellerInfo = document.getElementById("sellerInfo");
const aiInsights = document.getElementById("aiInsights");
const reviewsContainer = document.getElementById("reviewsContainer");
const reviewForm = document.getElementById("reviewForm");

const actionButtonsWrapper = document.querySelector('.action-buttons');

const chatWithSellerBtn = document.getElementById("chatWithSellerBtn");
const chatPopup = document.getElementById("chatPopup");
const closeChatBtn = document.getElementById("closeChatBtn");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const chatSellerName = document.getElementById("chatSellerName");
const chatSellerAvatar = document.getElementById("chatSellerAvatar");
const chatOnlineIndicator = document.getElementById("chatOnlineIndicator");
const chatVerifiedBadge = document.getElementById("chatVerifiedBadge");
const chatProductCard = document.getElementById("chatProductCard");
const chatProductImage = document.getElementById("chatProductImage");
const chatProductTitle = document.getElementById("chatProductTitle");
const chatProductPrice = document.getElementById("chatProductPrice");

// ======================================
// UNIFIED NAVBAR CONTROLS
// ======================================
const themeToggle = document.getElementById("themeToggle");
const profileBtn = document.getElementById("profileBtn");
const cartBtn = document.getElementById("cartBtn");

// Modals
const cartModal = document.getElementById("cartModal");
const cartItems = document.getElementById("cartItems");
const closeCart = document.getElementById("closeCart");
const cartBadge = document.getElementById("cartBadge");
const cartFooter = document.getElementById("cartFooter");
const placeOrderBtn = document.getElementById("placeOrderBtn");

let currentProduct = null;
let currentSeller = null;
let currentUserId = null;
let currentUserName = null; 
let activeRoomId = null;

// ======================================
// GLOBAL CART MECHANICS
// ======================================
let cart = JSON.parse(localStorage.getItem("cart")) || [];

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
    if (cartModal) cartModal.classList.remove("open");
}

function openCart() {
    if (!cartItems) return;
    cartItems.innerHTML = "";

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-cart-shopping"></i>
                <p>Your cart is empty</p>
            </div>
        `;
        if (cartFooter) cartFooter.style.display = "none";
    } else {
        if (cartFooter) cartFooter.style.display = "block";

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
                "padding:12px 4px;font-size:0.9rem;border-bottom:1px solid var(--card-border);margin-bottom:14px;line-height:1.6;";

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
            <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:6px;border-top:1px dashed var(--card-border);font-size:1.1rem;color:var(--accent);font-weight:700;">
                <span>Order Total:</span>
                <span>₹${ultimateTotal.toLocaleString('en-IN')}</span>
            </div>
        `;

        if (placeOrderBtn) {
            placeOrderBtn.textContent = "Proceed to Payment";
        }

        attachRemoveButtons();
    }

    if (cartModal) cartModal.classList.add("open");
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

// ======================================
// TOAST NOTIFICATIONS
// ======================================
const toastContainer = document.getElementById("toastContainer");

function showToast(message, type = "info", duration = 3500) {
    if (!toastContainer) return;
    const icons = { success: "fa-check", error: "fa-xmark", warning: "fa-exclamation", info: "fa-info" };

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
const confirmModal = document.getElementById("confirmModal");
const confirmModalTitle = document.getElementById("confirmModalTitle");
const confirmModalMessage = document.getElementById("confirmModalMessage");
const confirmModalOk = document.getElementById("confirmModalOk");
const confirmModalCancel = document.getElementById("confirmModalCancel");

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

if (chatWithSellerBtn) chatWithSellerBtn.style.display = 'none';

// ======================================
// SELLER EXCLUSIVE LAYOUT ROUTINE
// ======================================
function renderSellerLayout(token) {
  if (!actionButtonsWrapper) return;

  if (chatWithSellerBtn) {
    chatWithSellerBtn.style.display = 'inline-flex';
    chatWithSellerBtn.textContent = '💬 View Buyer Chats';
    chatWithSellerBtn.disabled = false;
  }
  const dashboardBadge = document.createElement('div');
  dashboardBadge.style.cssText = "width:100%; text-align:center; padding: 10px; background: rgba(139, 92, 246, 0.05); color: var(--accent); font-weight: 600; border-radius: 12px; margin-bottom: 8px; font-size: 0.9rem; border: 1px solid var(--card-border);";
  dashboardBadge.textContent = "🔒 You are managing this listing";
  actionButtonsWrapper.appendChild(dashboardBadge);

  if (!document.getElementById('markSoldBtnGenerated')) {
    const markSoldBtn = document.createElement('button');
    markSoldBtn.id = 'markSoldBtnGenerated';
    markSoldBtn.textContent = 'Mark as Sold';
    markSoldBtn.className = 'btn-primary';
    markSoldBtn.style.cssText = "width:100%; padding:13px; border:none; border-radius:12px; font-weight:700; font-size:1rem; cursor:pointer; transition:.2s;";
    
    markSoldBtn.addEventListener('click', async () => {
      const confirmed = await showConfirm("Mark this listing as sold? This cannot be undone.", "Mark as Sold?");
      if (!confirmed) return;
      markSoldBtn.textContent = "Marking...";
      markSoldBtn.disabled = true;
      try {
        const res = await window.authFetch(`/api/products/${productId}/sold`, {
          method: 'PATCH'
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        showToast("Listing marked as sold", "success");
        setTimeout(() => window.location.reload(), 600);
      } catch (err) {
        showToast("Failed: " + err.message, "error");
        markSoldBtn.textContent = "Mark as Sold";
        markSoldBtn.disabled = false;
      }
    });
    
    actionButtonsWrapper.appendChild(markSoldBtn);
  }

  if (!document.getElementById('deleteBtnGenerated')) {
    const deleteBtn = document.createElement('button');
    deleteBtn.id = 'deleteBtnGenerated';
    deleteBtn.textContent = 'Delete Item';
    deleteBtn.className = 'btn-secondary';
    deleteBtn.style.cssText = "width:100%; padding:13px; border-radius:12px; font-weight:700; font-size:1rem; cursor:pointer; transition:.2s; margin-top: 8px;";
    
    deleteBtn.addEventListener('click', async () => {
      const confirmed = await showConfirm("Are you sure you want to delete this listing? This action cannot be undone.", "Delete Listing?");
      if (!confirmed) return;
      deleteBtn.textContent = "Deleting...";
      deleteBtn.disabled = true;
      try {
        const res = await window.authFetch(`/api/products/${productId}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        showToast("Product deleted successfully!", "success");
        setTimeout(() => { window.location.href = "/marketplace"; }, 600);
      } catch (err) {
        showToast("Failed: " + err.message, "error");
        deleteBtn.textContent = "Delete Item";
        deleteBtn.disabled = false;
      }
    });
    
    actionButtonsWrapper.appendChild(deleteBtn);
  }
}

// ======================================
// BUYER/CLIENT EXCLUSIVE LAYOUT ROUTINE
// ======================================
async function renderBuyerLayout(token) {
  if (chatWithSellerBtn) {
    chatWithSellerBtn.style.display = 'inline-flex';
    chatWithSellerBtn.disabled = false;
  }

  if (token) {
    await syncChatRoomHistory();
  }
}

// ======================================
// LOAD PRODUCT & DATA
// ======================================
async function loadProduct() {
  try {
    const response = await fetch(`/api/products/${productId}`);
    const result = await response.json();
    if (!result.success) throw new Error("Product not found");

    currentProduct = result.product;
    productTitle.textContent = currentProduct.title;
    
    const catBreadcrumb = document.getElementById("breadcrumbCategory");
    if (catBreadcrumb) catBreadcrumb.textContent = currentProduct.category || "Books";

    const basePrice = Number(currentProduct.price) || 0;
    const computedOriginal = Math.round(basePrice * 1.45);
    const computedDiscount = 31; 
    
    if (productPrice) {
        productPrice.innerHTML = `
            <span class="price-actual">₹${basePrice.toLocaleString('en-IN')}</span>
            <span class="price-original">₹${computedOriginal.toLocaleString('en-IN')}</span>
            <span class="price-discount">${computedDiscount}% OFF</span>
        `;
    }

    productCondition.textContent = currentProduct.condition || "Like New";
    deliveryDate.textContent = currentProduct.delivery_date ? currentProduct.delivery_date.split('T')[0] : "Within Campus";
    
    const deliveryColl = document.getElementById("deliveryDistanceText");
    if (deliveryColl) deliveryColl.textContent = "Within " + (currentProduct.college_name || "Campus");

    paymentMethods.textContent = currentProduct.payment_methods || "UPI ID: 9X8X8X3";
    productDescription.textContent = currentProduct.description || "";

    const targetedSellerId = currentProduct.seller_id || currentProduct.user_id;

    if (currentProduct.is_sold) {
      const soldBanner = document.createElement('div');
      soldBanner.style.cssText = "background:#ef4444;color:white;text-align:center;padding:12px;font-weight:700;font-size:1.1rem;letter-spacing:2px;margin-bottom:16px;border-radius:10px;";
      soldBanner.textContent = "⚠️ THIS ITEM HAS BEEN SOLD";
      
      const detailsSection = document.querySelector('.details-section');
      if (detailsSection) detailsSection.prepend(soldBanner);
      
      const cartBtnEl = document.getElementById('addCartBtn');
      if (cartBtnEl) {
        cartBtnEl.disabled = true;
        cartBtnEl.style.opacity = '0.4';
        cartBtnEl.style.cursor = 'not-allowed';
      }
    }

    await Promise.all([
      loadSeller(targetedSellerId),
      loadImages(currentProduct.id),
      loadReviews(currentProduct.id),
      loadAIInsights(currentProduct.id)
    ]);

    const token = localStorage.getItem("unithrift_session_token");

    if (token) {
      try {
        const r = await window.authFetch('/api/profile');
        const d = await r.json();

        if (d.success) {
          currentUserId = d.profile?.id;
          currentUserName = d.profile?.full_name || d.profile?.username || "User";
        }
      } catch (err) {
        console.error("Profile initialization context failure:", err);
      }
    }

    if (currentUserId && String(currentUserId) === String(targetedSellerId)) {
      renderSellerLayout(token);
    } else {
      await renderBuyerLayout(token);
    }

    if (params.get("openChat") === "1" && chatWithSellerBtn && chatWithSellerBtn.style.display !== "none") {
      chatWithSellerBtn.click();
    }

  } catch (err) {
    console.error(err);
    if (productTitle) productTitle.textContent = "Product Not Found";
  }
}

// ======================================
// LOAD SELLER
// ======================================
async function loadSeller(sellerId) {
  if (!sellerId) return;
  try {
    const response = await fetch(`/api/user/${sellerId}`);
    const { success, seller } = await response.json();
    if (!success) return;

    currentSeller = seller;
    
    const miniBadge = document.getElementById("sellerHeaderBadge");
    if (miniBadge) {
        miniBadge.innerHTML = `
            <div class="seller-row-mini">
                <img src="${seller.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.username || 'U')}&background=7c3aed&color=fff`}" alt="Avatar">
                <span>By <strong>${seller.username || seller.full_name || "Registered Student"}</strong>${seller.college_name ? ` • ${seller.college_name}` : ''}</span>
            </div>
        `;
    }

    if (sellerInfo) {
      sellerInfo.innerHTML = `
        <div class="seller-profile-row">
            <img class="seller-avatar" src="${seller.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(seller.username || 'U')}&background=7c3aed&color=fff`}" alt="Avatar">
            <div class="seller-profile-details">
                <h4>${seller.username || seller.full_name || "Registered Student"}</h4>
                ${seller.student_verified ? '<span class="verified-seller-badge"><i class="fas fa-circle-check"></i> Verified Seller</span>' : ''}
                <p>${seller.college_name || "College not listed"}</p>
            </div>
        </div>

        <div class="seller-metrics-grid" id="sellerMetricsGrid">
            <div class="metric-row"><span>Rating</span><strong>Loading…</strong></div>
        </div>

        <button class="view-seller-profile-btn" onclick="window.location.href='/seller-profile?id=${seller.id}'">View Seller Profile</button>
      `;
    }

    try {
      const statsRes = await fetch(`/api/seller/${seller.id}/profile`);
      const statsData = await statsRes.json();
      const grid = document.getElementById("sellerMetricsGrid");
      if (grid && statsData.success) {
        const s = statsData.stats;
        const memberSince = s.member_since
          ? new Date(s.member_since).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
          : "—";
        grid.innerHTML = `
            <div class="metric-row">
                <span>Rating</span>
                <strong>${s.rating_avg ? `★ ${s.rating_avg} (${s.rating_count})` : "No ratings yet"}</strong>
            </div>
            <div class="metric-row">
                <span>Items Sold</span>
                <strong>${s.sold_listings}</strong>
            </div>
            <div class="metric-row">
                <span>Active Listings</span>
                <strong>${s.active_listings}</strong>
            </div>
            <div class="metric-row">
                <span>Member Since</span>
                <strong>${memberSince}</strong>
            </div>
        `;
      }
    } catch (err) {
      console.error("Failed to load seller stats:", err);
    }
  } catch (err) {
    console.error(err);
  }
}

// ======================================
// LOAD IMAGES
// ======================================
async function loadImages(id) {
  try {
    const response = await fetch(`/api/products/${id}/images`);
    const { images } = await response.json();

    if (images && images.length > 0) {
      if (mainImage) mainImage.src = images[0].image_url;
      if (thumbnailContainer) {
        thumbnailContainer.innerHTML = "";
        images.forEach((img, idx) => {
          const thumb = document.createElement("img");
          thumb.src = img.image_url;
          if (idx === 0) thumb.classList.add("active");
          thumb.addEventListener("click", () => { 
             if (mainImage) mainImage.src = img.image_url; 
             document.querySelectorAll(".thumbnail-container img").forEach(el => el.classList.remove("active"));
             thumb.classList.add("active");
          });
          thumbnailContainer.appendChild(thumb);
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// ======================================
// LOAD REVIEWS
// ======================================
async function loadReviews(id) {
  try {
    const response = await fetch(`/api/products/${id}/reviews`);
    const { reviews } = await response.json();
    if (!reviewsContainer) return;
    reviewsContainer.innerHTML = "";

    if (!reviews || reviews.length === 0) {
      reviewsContainer.innerHTML = `<div class="review-card">No reviews yet.</div>`;
      return;
    }

    reviews.forEach(review => {
      reviewsContainer.innerHTML += `
        <div class="review-card">
          <h4>${"★".repeat(review.rating)}</h4>
          <p>${review.review_text}</p>
        </div>
      `;
    });
  } catch (err) {
    console.error(err);
  }
}

// ======================================
// LOAD AI INSIGHTS
// ======================================
async function loadAIInsights(id) {
  if (!aiInsights) return;

  aiInsights.innerHTML = `
    <div class="ai-loading">
      <div class="spinner"></div>
      <h3>Generating AI Summary...</h3>
      <p>UniThrift AI is analysing this product and customer reviews.</p>
    </div>
  `;

  try {
    const response = await fetch(`/api/products/${id}/ai-insights`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message);

    renderAIInsights(result.insights);
  } catch (err) {
    console.error(err);
    aiInsights.innerHTML = `
      <div class="ai-error">
        <h3>⚠ AI Summary Unavailable</h3>
        <p>We couldn't generate an AI summary for this listing.</p>
      </div>
    `;
  }
}

// ======================================
// RENDER AI INSIGHTS
// ======================================
function renderAIInsights(data) {
  if (!aiInsights || !data) return;
  const recommendation = data.recommendation || "Neutral";
  let badgeColor = "#f59e0b";

  if (recommendation === "Positive") badgeColor = "#10b981";
  if (recommendation === "Caution") badgeColor = "#ef4444";

  aiInsights.innerHTML = `
    <div class="ai-summary-card">
      <div class="ai-recommendation" style="background:${badgeColor};">${recommendation}</div>
      <div class="ai-section">
        <h3>📦 Product Assessment</h3>
        <p>${data.product_summary || "No summary available."}</p>
      </div>
      <div class="ai-section">
        <h3>⭐ Review Analysis</h3>
        <p>${data.review_summary || "No review summary available."}</p>
      </div>
      <div class="ai-footer">Generated using UniThrift AI. AI may occasionally make mistakes.</div>
    </div>
  `;
}

// ======================================
// SUBMIT REVIEW
// ======================================
if (reviewForm) {
  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("unithrift_session_token");
    if (!token) return showToast("Please login first.", "warning");

    const rating = Number(document.getElementById("rating").value);
    const review_text = document.getElementById("reviewText").value.trim();

    if (!rating) return showToast("Please select a rating.", "warning");
    if (!review_text) return showToast("Please write a review.", "warning");

    const submitBtn = reviewForm.querySelector("button[type='submit']");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting...";
    }

    try {
      const response = await window.authFetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating, review_text })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to post");

      showToast("Review submitted successfully!", "success");
      reviewForm.reset();
      
      await loadReviews(productId);
      await loadAIInsights(productId);
    } catch (err) {
      console.error("Submission Error:", err);
      showToast(`Failed to submit review: ${err.message}`, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Review";
      }
    }
  });
}

// ======================================
// CHAT MECHANICS & MULTI-BUYER SELECTOR
// ======================================
let loadedMessageIds = new Set();
let chatPollInterval = null;

function formatMessageTime(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit"
  });
}

function appendMessageToUI(text, direction, timestamp) {
  if (!chatMessages) return;
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", direction);

  const textSpan = document.createElement("span");
  textSpan.className = "message-text";
  textSpan.textContent = text;
  msgDiv.appendChild(textSpan);

  if (direction !== "system-msg") {
    const timeSpan = document.createElement("span");
    timeSpan.className = "message-time";
    timeSpan.textContent = formatMessageTime(timestamp);
    msgDiv.appendChild(timeSpan);
  }

  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function populateChatHeader() {
  const sellerData = currentSeller?.seller || currentSeller;

  if (chatSellerAvatar) {
    const fallbackName = encodeURIComponent(sellerData?.full_name || sellerData?.username || "U");
    chatSellerAvatar.src =
      sellerData?.avatar_url ||
      sellerData?.profile_picture ||
      `https://ui-avatars.com/api/?name=${fallbackName}&background=1f2937&color=fff`;
  }

  if (chatVerifiedBadge) {
    const isVerified = !!(sellerData?.seller_verified || sellerData?.student_verified);
    chatVerifiedBadge.style.display = isVerified ? "inline" : "none";
  }

  if (chatOnlineIndicator) chatOnlineIndicator.style.background = "#10b981";

  if (currentProduct) {
    if (chatProductImage) chatProductImage.src = mainImage?.src || "";
    if (chatProductTitle) chatProductTitle.textContent = currentProduct.title || "Product";
    if (chatProductPrice) {
      chatProductPrice.textContent = `₹${Number(currentProduct.price).toLocaleString('en-IN')}`;
    }
    if (chatProductCard) chatProductCard.href = `/product.html?id=${productId}`;
  }
}

async function fetchMessages() {
  if (!activeRoomId) return;

  try {
    const response = await window.authFetch(`/api/chat/rooms/${activeRoomId}/messages`);
    const msgResult = await response.json();
    
    if (msgResult.success && msgResult.messages) {
      let addedNew = false;
      msgResult.messages.forEach(msg => {
        if (!loadedMessageIds.has(msg.id)) {
          loadedMessageIds.add(msg.id);
          const direction = (String(msg.sender_id) === String(currentUserId)) ? "sent" : "received";
          const timestamp = msg.created_at || msg.inserted_at || msg.timestamp;
          appendMessageToUI(msg.message_text, direction, timestamp);
          addedNew = true;
        }
      });
      if (addedNew && chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  } catch (err) {
    console.error("Error fetching messages during poll:", err);
  }
}

function startPolling() {
  stopPolling();
  fetchMessages();
  chatPollInterval = setInterval(fetchMessages, 2500);
}

function stopPolling() {
  if (chatPollInterval) {
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }
}

// Multi-buyer selector lists active conversations inside the popup itself.
async function syncChatRoomHistory(selectedBuyerId = null) {
  const sendChatBtn = document.getElementById("sendChatBtn");

  if (chatInput) chatInput.disabled = false;
  if (sendChatBtn) sendChatBtn.disabled = false;

  try {
    const requestBody = { product_id: productId };
    if (selectedBuyerId) {
        requestBody.buyer_id = selectedBuyerId;
    }

    const roomResponse = await window.authFetch('/api/chat/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const roomResult = await roomResponse.json();
    if (!roomResult.success) {
      const err = new Error(roomResult.message || "No active chats found.");
      err.code = roomResult.code;
      throw err;
    }

    activeRoomId = roomResult.room_id;
    loadedMessageIds.clear();

    if (chatMessages) {
      let backBtnHtml = "";
      if (selectedBuyerId) {
          backBtnHtml = `<button id="chatBackToBuyersBtn" style="background:none; border:none; color:var(--accent); font-size:0.8rem; cursor:pointer; padding:6px 0; margin-bottom:8px; display:inline-flex; align-items:center; gap:4px;"><i class="fas fa-arrow-left"></i> Back to Buyers</button>`;
      }
      chatMessages.innerHTML = backBtnHtml + '<div class="message system-msg">Welcome to campus chat! Protect your data.</div>';
      
      const backBtn = document.getElementById("chatBackToBuyersBtn");
      if (backBtn) {
          backBtn.onclick = () => {
              stopPolling();
              syncChatRoomHistory(null);
          };
      }
    }

    startPolling();
  } catch (err) {
    console.error("Failed to restore chat room history:", err);
    stopPolling();
    activeRoomId = null;

    if (err.code === "MULTIPLE_BUYERS") {
      if (chatInput) chatInput.disabled = true;
      if (sendChatBtn) sendChatBtn.disabled = true;

      if (chatMessages) {
        chatMessages.innerHTML = `
          <div style="padding: 16px; text-align: center;">
            <p style="font-weight:600; margin-bottom:12px; font-size:0.95rem; color:var(--text);">Manage Active Conversations:</p>
            <div id="buyersListContainer" style="display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto;">
              <p style="font-size:0.8rem; color:var(--muted);"><i class="fas fa-spinner fa-spin"></i> Retrieving active buyers...</p>
            </div>
          </div>`;
      }

      try {
          const roomsRes = await window.authFetch('/api/chat/rooms');
          const roomsData = await roomsRes.json();
          if (roomsData.success && roomsData.rooms) {
              const productRooms = roomsData.rooms.filter(r => String(r.product_id) === String(productId));
              const buyersListContainer = document.getElementById("buyersListContainer");
              if (buyersListContainer) {
                  if (productRooms.length === 0) {
                      buyersListContainer.innerHTML = `<p style="font-size:0.8rem; color:var(--muted);">No active buyer chats found.</p>`;
                      return;
                  }
                  buyersListContainer.innerHTML = "";
                  for (const r of productRooms) {
                      const buyerRes = await fetch(`/api/user/${r.buyer_id}`);
                      const buyerData = await buyerRes.json();
                      const buyerName = buyerData.success ? (buyerData.seller.username || buyerData.seller.full_name || "Buyer") : "Buyer";

                      const btn = document.createElement("button");
                      btn.style.cssText = "padding:10px; background:var(--card); border:1px solid var(--card-border); border-radius:8px; color:var(--text); text-align:left; cursor:pointer; font-size:0.85rem; font-weight:600; transition:background 0.2s; width:100%; display:flex; align-items:center; gap:8px;";
                      btn.innerHTML = `<i class="fas fa-user-circle" style="font-size:1.1rem; color:var(--accent);"></i> <span>${buyerName}</span>`;
                      btn.onclick = () => {
                          syncChatRoomHistory(r.buyer_id);
                      };
                      buyersListContainer.appendChild(btn);
                  }
              }
          }
      } catch (listErr) {
          console.error("Failed to load buyers list:", listErr);
      }
      return;
    }

    if (chatMessages) {
      chatMessages.innerHTML = `
        <div class="message system-msg" style="background:#e11d48;color:white;border-radius:8px;padding:10px;margin:10px;">
          ⚠️ Chat unavailable: ${err.message || "Please wait for a buyer to start a chat."}
        </div>`;
    }
  }
}

if (chatWithSellerBtn) {
  chatWithSellerBtn.addEventListener("click", async () => {
    if (!localStorage.getItem("unithrift_session_token")) {
      return showToast("Please login to chat with the seller.", "warning");
    }
    if (!currentProduct) {
      return showToast("Product data is loading. Please wait a moment.", "warning");
    }

    const sellerData = currentSeller?.seller || currentSeller;
    const sellerName = sellerData?.full_name || sellerData?.username || "Seller";

    if (chatSellerName) {
      chatSellerName.textContent = (currentUserId && String(currentUserId) === String(currentProduct.seller_id || currentProduct.user_id))
        ? "Buyer Chat"
        : sellerName;
    }

    populateChatHeader();

    if (chatPopup) chatPopup.classList.add("open");
    if (chatInput) chatInput.focus();

    await syncChatRoomHistory();
  });
}

if (closeChatBtn) {
  closeChatBtn.addEventListener("click", () => {
    if (chatPopup) chatPopup.classList.remove("open");
    stopPolling();
  });
}

if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = chatInput.value.trim();
    if (!text) return;

    if (!activeRoomId) {
      showToast("Chat room is not ready yet. Please wait.", "warning");
      return;
    }

    if (!localStorage.getItem("unithrift_session_token")) {
      return showToast("Session expired. Please log in again.", "error");
    }

    if (chatInput) chatInput.value = "";

    try {
      const response = await window.authFetch(`/api/chat/rooms/${activeRoomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_text: text })
      });

      const result = await response.json();
      if (result.success || response.ok) {
        await fetchMessages();
      } else {
        console.error("Failed to send message:", result.message);
      }
    } catch (err) {
      console.error("Transmission execution error:", err);
    }
  });
}

window.addEventListener("beforeunload", stopPolling);

// ======================================
// NAVBAR ACTIONS & INITIALIZATION
// ======================================
const addCartBtn = document.getElementById("addCartBtn");
if (addCartBtn) {
    addCartBtn.addEventListener("click", () => {
        if (!currentProduct) return;
        if (cart.some(p => p.id == currentProduct.id)) {
            return showToast("This item is already in your cart", "warning");
        }
        cart.push(currentProduct);
        saveCart();
        showToast("Added to cart", "success");
    });
}

if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        const isDark = document.body.classList.contains("dark-theme");
        document.body.classList.toggle("dark-theme", !isDark);
        document.body.classList.toggle("light-theme", isDark);
        localStorage.setItem("theme", isDark ? "light-theme" : "dark-theme");
    });
}

if (profileBtn) {
    profileBtn.addEventListener("click", () => { window.location.href = '/profile'; });
}

if (cartBtn) {
    cartBtn.addEventListener("click", openCart);
}

if (closeCart) {
    closeCart.addEventListener("click", closeCartModal);
}

if (cartModal) {
    cartModal.addEventListener("click", (e) => {
        if (e.target === cartModal) closeCartModal();
    });
}

if (placeOrderBtn) {
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
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeCartModal();
        if (chatPopup) chatPopup.classList.remove("open");
        stopPolling();
    }
});

// ======================================
// SEARCH IN NAVBAR REDIRECTS TO MARKETPLACE
// ======================================
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

if (searchBtn && searchInput) {
    const handleSearch = () => {
        const query = searchInput.value.trim();
        if (query) {
            window.location.href = `/marketplace?search=${encodeURIComponent(query)}`;
        }
    };
    searchBtn.addEventListener("click", handleSearch);
    searchInput.addEventListener("keyup", (e) => {
        if (e.key === "Enter") handleSearch();
    });
}

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
// RUN
// ======================================
const savedTheme = localStorage.getItem("theme") || "dark-theme";
document.body.classList.remove("dark-theme", "light-theme");
document.body.classList.add(savedTheme);

if (typeof productId !== 'undefined' && productId) {
  loadProduct();
} else if (productTitle) {
  productTitle.textContent = "Invalid Product ID";
}

updateCartBadge();