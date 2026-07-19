/* =========================================================================
   UniBot — AI Workspace
   Front-end only demo logic: theme toggle, side-nav pin, toasts, and a
   simulated "agent working" flow that fills in the compare cards/table
   and the cart rail. Swap the FAKE_RESULTS / simulateAgent() bits for real
   API calls to your backend when you wire this up.
========================================================================= */

/* ---------------- Theme toggle ---------------- */
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

function applyStoredTheme() {
    const saved = window.__unibotTheme || 'dark-theme';
    body.classList.remove('dark-theme', 'light-theme');
    body.classList.add(saved);
}
applyStoredTheme();

themeToggle?.addEventListener('click', () => {
    const isDark = body.classList.contains('dark-theme');
    body.classList.remove('dark-theme', 'light-theme');
    body.classList.add(isDark ? 'light-theme' : 'dark-theme');
    window.__unibotTheme = isDark ? 'light-theme' : 'dark-theme';
});

/* ---------------- Side-nav pin ---------------- */
const sideNav = document.getElementById('sideNav');
const sideNavPin = document.getElementById('sideNavPin');

sideNavPin?.addEventListener('click', () => {
    const pinned = sideNav.classList.toggle('side-nav--pinned');
    sideNavPin.setAttribute('aria-pressed', String(pinned));
});

/* ---------------- Toasts ---------------- */
const toastContainer = document.getElementById('toastContainer');
const TOAST_ICON = { success: 'fa-check', error: 'fa-xmark', warning: 'fa-triangle-exclamation', info: 'fa-info' };

function showToast(message, type = 'info', duration = 3200) {
    if (!toastContainer) return;
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `
        <span class="toast-icon"><i class="fas ${TOAST_ICON[type] || TOAST_ICON.info}"></i></span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Dismiss"><i class="fas fa-xmark"></i></button>
    `;
    toastContainer.appendChild(el);
    const remove = () => {
        el.classList.add('toast--leaving');
        setTimeout(() => el.remove(), 220);
    };
    el.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, duration);
}

/* ---------------- Campus select (demo list) ---------------- */
const CAMPUSES = [
    'IIT Kharagpur, Kolkata Campus',
    'IIT Bombay, Mumbai',
    'IIT Delhi, New Delhi',
    'IIT Madras, Chennai',
    'BITS Pilani, Pilani Campus',
    'Jadavpur University, Kolkata',
    'Delhi University, North Campus'
];

const universitySelect = document.getElementById('universitySelect');
const campusDropdown = document.getElementById('campusSelectDropdown');

function renderCampusOptions(filter = '') {
    if (!campusDropdown) return;
    const matches = CAMPUSES.filter(c => c.toLowerCase().includes(filter.toLowerCase()));
    campusDropdown.innerHTML = matches.length
        ? matches.map(c => `<div class="campus-suggestion"><i class="fas fa-location-dot"></i>${c}</div>`).join('')
        : `<div class="campus-suggestion-empty">No campuses found</div>`;

    campusDropdown.querySelectorAll('.campus-suggestion').forEach(node => {
        node.addEventListener('click', () => {
            universitySelect.value = node.textContent.trim();
            campusDropdown.classList.remove('open');
        });
    });
}

universitySelect?.addEventListener('focus', () => {
    renderCampusOptions(universitySelect.value);
    campusDropdown.classList.add('open');
});
universitySelect?.addEventListener('input', () => renderCampusOptions(universitySelect.value));
document.addEventListener('click', (e) => {
    if (!document.getElementById('campusSelectWrap')?.contains(e.target)) {
        campusDropdown?.classList.remove('open');
    }
});

/* ---------------- Cart state ---------------- */
const cart = [];
const cartBadge = document.getElementById('cartBadge');
const cartItemsWrap = document.getElementById('cartItemsWrap');
const cartTotals = document.getElementById('cartTotals');
const cartCheckoutBtn = document.getElementById('cartCheckoutBtn');

function renderCart() {
    if (!cartItemsWrap) return;

    if (cart.length === 0) {
        cartItemsWrap.innerHTML = `<div class="cart-empty">Your cart is empty.<br>Add something UniBot finds for you.</div>`;
        cartTotals.style.display = 'none';
        cartCheckoutBtn.disabled = true;
        cartBadge.style.display = 'none';
        return;
    }

    cartItemsWrap.innerHTML = cart.map((item, i) => `
        <div class="cart-item">
            <div class="cart-item-img"><img src="${item.img}" alt="${item.title}"></div>
            <div class="cart-item-body">
                <div class="cart-item-title">${item.title}</div>
                <div class="cart-item-desc">${item.desc}</div>
                <div class="cart-item-row">
                    <span class="cart-item-price">₹${item.price}</span>
                    <button class="cart-item-remove" data-index="${i}">Remove</button>
                </div>
            </div>
        </div>
    `).join('');

    cartItemsWrap.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            cart.splice(Number(btn.dataset.index), 1);
            renderCart();
        });
    });

    const itemsCost = cart.reduce((sum, i) => sum + i.price, 0);
    const shipping = Math.round(itemsCost * 0.25);

    document.getElementById('cartTotalItems').textContent = cart.length;
    document.getElementById('cartItemsCost').textContent = `₹${itemsCost}`;
    document.getElementById('cartShipping').textContent = `₹${shipping}`;
    document.getElementById('cartOrderTotal').textContent = `₹${itemsCost + shipping}`;

    cartTotals.style.display = 'flex';
    cartCheckoutBtn.disabled = false;
    cartBadge.style.display = 'flex';
    cartBadge.textContent = cart.length;
}

function addToCart(item) {
    cart.push(item);
    renderCart();
    showToast(`${item.title} added to cart`, 'success');
}

document.getElementById('cartRailClose')?.addEventListener('click', () => {
    document.querySelector('.cart-card').style.display = 'none';
});

document.getElementById('cartCheckoutBtn')?.addEventListener('click', () => {
    showToast('Proceeding to payment…', 'info');
});

renderCart();

/* ---------------- Live process stepper ---------------- */
const STEP_LABELS = [
    'Understanding request',
    'Searching listings',
    'Comparing prices',
    'Checking seller ratings',
    'Final recommendation'
];

function resetSteps() {
    document.querySelectorAll('.process-step').forEach((step, i) => {
        step.classList.remove('process-step--done', 'process-step--active');
        const dot = step.querySelector('.process-step-dot');
        dot.innerHTML = '<i class="fas fa-circle-dot"></i>';
        step.querySelector('.process-step-meta').textContent = '—';
    });
}

function timeNow() {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function runProcessSteps(onDone) {
    resetSteps();
    const steps = document.querySelectorAll('.process-step');
    let i = 0;

    function next() {
        if (i > 0) {
            const prev = steps[i - 1];
            prev.classList.remove('process-step--active');
            prev.classList.add('process-step--done');
            prev.querySelector('.process-step-dot').innerHTML = '<i class="fas fa-check"></i>';
        }
        if (i >= steps.length) {
            onDone?.();
            return;
        }
        const step = steps[i];
        step.classList.add('process-step--active');
        step.querySelector('.process-step-meta').textContent = timeNow();
        i++;
        setTimeout(next, 500 + Math.random() * 500);
    }
    next();
}

/* ---------------- Fake result data (swap for a real API call) ---------------- */
function buildResults(query) {
    const label = query?.trim() || 'Logitech G304 Wireless Mouse';
    return [
        {
            store: 'Amazon', logoClass: 'amazon', logoText: 'a',
            img: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=300&q=60',
            price: 1899, title: `${label} Lightspeed`, seller: 'Appario Retail',
            tags: [{ text: 'New' }, { text: 'FREE delivery' }],
            rating: 4.3, reviews: '12,842 ratings', best: false
        },
        {
            store: 'Flipkart', logoClass: 'flipkart', logoText: 'f',
            img: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=300&q=60',
            price: 1799, title: `${label}`, seller: 'RetailNet',
            tags: [{ text: 'New' }, { text: 'Delivery in 2 days' }],
            rating: 4.2, reviews: '9,201 ratings', best: false
        },
        {
            store: 'UniThrift', logoClass: 'unithrift', logoText: 'u',
            img: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=300&q=60',
            price: 1200, title: `${label}`, seller: 'arjun_cse',
            tags: [{ text: 'Used', variant: 'accent' }, { text: 'Pickup available', variant: 'pos' }],
            rating: 4.8, reviews: '23 reviews', best: true
        }
    ];
}

/* ---------------- Render compare cards ---------------- */
const compareSection = document.getElementById('compareSection');
const compareGrid = document.getElementById('compareGrid');
const tableSection = document.getElementById('tableSection');
const compareTable = document.getElementById('compareTable');
const workspaceAnswer = document.getElementById('workspaceAnswer');

function renderSkeletons() {
    compareSection.style.display = 'block';
    compareGrid.innerHTML = Array.from({ length: 3 }).map(() => `
        <div class="compare-card compare-card--skeleton">
            <div class="compare-card-img"></div>
            <div class="skeleton-line w-40"></div>
            <div class="skeleton-line w-60"></div>
            <div class="skeleton-line w-40"></div>
        </div>
    `).join('');
}

function renderCompare(results) {
    compareGrid.innerHTML = results.map(r => `
        <div class="compare-card ${r.best ? 'compare-card--best' : ''}">
            ${r.best ? '<span class="compare-card-badge">BEST VALUE</span>' : ''}
            <div class="compare-card-store">
                <span class="compare-card-logo compare-card-logo--${r.logoClass}">${r.logoText}</span>
                ${r.store}
            </div>
            <div class="compare-card-img"><img src="${r.img}" alt="${r.title}"></div>
            <div class="compare-card-price">₹${r.price.toLocaleString('en-IN')}</div>
            <div class="compare-card-title">${r.title}<br><span style="color:var(--secondary);font-size:0.78rem;">Seller: ${r.seller}</span></div>
            <div class="compare-card-tags">
                ${r.tags.map(t => `<span class="compare-tag ${t.variant ? 'compare-tag--' + t.variant : ''}">${t.text}</span>`).join('')}
            </div>
            <div class="compare-card-foot">
                <div class="compare-card-rating"><i class="fas fa-star"></i>${r.rating} · ${r.reviews}</div>
                ${r.store === 'UniThrift' ? `<button class="compare-card-add" data-price="${r.price}" data-title="${r.title}" data-img="${r.img}" aria-label="Add to cart"><i class="fas fa-plus"></i></button>` : ''}
            </div>
        </div>
    `).join('');

    compareGrid.querySelectorAll('.compare-card-add').forEach(btn => {
        btn.addEventListener('click', () => {
            addToCart({
                title: btn.dataset.title,
                desc: 'Added from UniBot AI Workspace comparison.',
                price: Number(btn.dataset.price),
                img: btn.dataset.img
            });
        });
    });
}

function renderTable(results) {
    tableSection.style.display = 'block';
    const rows = [
        ['Price', r => `₹${r.price.toLocaleString('en-IN')}`],
        ['Condition', r => r.store === 'UniThrift' ? 'Used – Excellent' : 'New'],
        ['Seller', r => r.seller],
        ['Rating', r => `${r.rating} ★ (${r.reviews.split(' ')[0]})`]
    ];

    compareTable.innerHTML = `
        <thead>
            <tr>
                <th>Feature</th>
                ${results.map(r => `<th><span class="th-store"><span class="compare-card-logo compare-card-logo--${r.logoClass}" style="width:20px;height:20px;font-size:0.6rem;">${r.logoText}</span>${r.store}</span></th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${rows.map(([label, fn]) => `
                <tr>
                    <td>${label}</td>
                    ${results.map(r => `<td class="${r.best ? 'col-win' : ''}">${fn(r)}</td>`).join('')}
                </tr>
            `).join('')}
        </tbody>
    `;
}

/* ---------------- Search / agent flow ---------------- */
const workspaceSearchForm = document.getElementById('workspaceSearchForm');
const workspaceSearchInput = document.getElementById('workspaceSearchInput');

function runSearch(query) {
    workspaceAnswer.classList.remove('visible');
    renderSkeletons();
    tableSection.style.display = 'none';

    runProcessSteps(() => {
        const results = buildResults(query);
        renderCompare(results);
        renderTable(results);
        const best = results.find(r => r.best);
        workspaceAnswer.textContent = `UniThrift has the best match: a ${best.title} from ${best.seller} at ₹${best.price.toLocaleString('en-IN')} — ${((1 - best.price / results[0].price) * 100).toFixed(0)}% cheaper than the next best price. Rated ${best.rating}★ across ${best.reviews}.`;
        workspaceAnswer.classList.add('visible');
    });
}

workspaceSearchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = workspaceSearchInput.value.trim();
    if (!q) return;
    runSearch(q);
});

/* ---------------- Follow-up chat bar ---------------- */
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = chatInput.value.trim();
    if (!q) return;
    chatInput.value = '';
    runSearch(q);
});

chatInput?.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
});

/* ---------------- Kick things off with the reference example ---------------- */
window.addEventListener('DOMContentLoaded', () => {
    workspaceSearchInput.value = 'Find me a used Logitech G304 under ₹1500';
    runSearch(workspaceSearchInput.value);
});