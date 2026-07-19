// =========================================================================
// UPDATES.JS — Notifications page: list rendering, tabs, mark-read,
// and realtime delivery (persisted DB inserts + instant broadcasts).
// =========================================================================
(async function () {
    const token = localStorage.getItem('unithrift_session_token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const savedTheme = localStorage.getItem('theme') || 'dark-theme';
    document.body.className = savedTheme;
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
        const targetTheme = document.body.className === 'dark-theme' ? 'light-theme' : 'dark-theme';
        document.body.className = targetTheme;
        localStorage.setItem('theme', targetTheme);
    });

    let allNotifications = [];
    let currentFilter = 'all';
    const list = document.getElementById('notifList');
    const unreadBadge = document.getElementById('unreadCount');

    const ICONS = {
        sale: 'fas fa-tag',
        message: 'fas fa-comment',
        offer: 'fas fa-hand-holding-dollar',
        system: 'fas fa-gear',
        info: 'fas fa-circle-info'
    };

    function timeAgo(dateStr) {
        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) return '—';
        const diff = Math.max(0, (Date.now() - parsedDate.getTime()) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = String(str ?? '');
        return div.innerHTML;
    }

    function renderCard(n) {
        const type = n.type || 'info';
        const icon = ICONS[type] || ICONS.info;
        return `
        <div class="notif-card ${n.read ? 'read' : 'unread'}" data-id="${n.id}" data-type="${type}" data-ref="${n.reference_id || ''}">
            <div class="notif-icon ${type}"><i class="${icon}"></i></div>
            <div class="notif-body">
                <p>${escapeHtml(n.message)}</p>
                <span class="notif-time">${timeAgo(n.created_at)}</span>
            </div>
            ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
        </div>`;
    }

    function renderList() {
        const filtered = currentFilter === 'all'
            ? allNotifications
            : allNotifications.filter(n => n.type === currentFilter);

        if (!filtered.length) {
            list.innerHTML = `<div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>No ${currentFilter === 'all' ? '' : currentFilter + ' '}notifications yet.</p>
            </div>`;
            return;
        }
        list.innerHTML = filtered.map(renderCard).join('');

        list.querySelectorAll('.notif-card').forEach(card => {
            card.addEventListener('click', async () => {
                const id = card.getAttribute('data-id');
                const ref = card.getAttribute('data-ref');
                const type = card.getAttribute('data-type');

                if (card.classList.contains('unread')) {
                    if (id !== 'live-broadcast') {
                        await window.authFetch(`/api/notifications/${id}/read`, { method: 'POST' });
                    }
                    card.classList.remove('unread');
                    card.classList.add('read');
                    card.querySelector('.notif-unread-dot')?.remove();
                    const n = allNotifications.find(x => x.id === id);
                    if (n) n.read = true;
                    updateBadge();
                }

                if (type === 'message' && ref) window.location.href = `/chat?room=${ref}`;
                else if ((type === 'sale' || type === 'offer') && ref) window.location.href = `/product?id=${ref}`;
            });
        });
    }

    function updateBadge() {
        const count = allNotifications.filter(n => !n.read).length;
        if (count > 0) {
            unreadBadge.textContent = count > 99 ? '99+' : count;
            unreadBadge.style.display = 'inline-block';
        } else {
            unreadBadge.style.display = 'none';
        }
    }

    async function loadNotifications() {
        try {
            const res = await window.authFetch('/api/notifications');
            if (res.status === 401) {
                return { ok: false, loggedOut: true };
            }
            const result = await res.json();
            if (!result.success) throw new Error(result.message);
            allNotifications = result.notifications || [];
            renderList();
            updateBadge();
            return { ok: true };
        } catch (err) {
            list.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>${escapeHtml(err.message)}</p></div>`;
            return { ok: false, loggedOut: false };
        }
    }

    document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
        await window.authFetch('/api/notifications/read-all', { method: 'POST' });
        allNotifications.forEach(n => { n.read = true; });
        renderList();
        updateBadge();
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add("active");
            currentFilter = btn.getAttribute('data-filter');
            renderList();
        });
    });

    const initialLoad = await loadNotifications();
    if (!initialLoad.ok) return;

    if (typeof supabase === 'undefined') return;

    const SUPABASE_URL = window.__SUPABASE_URL__ || '';
    const SUPABASE_KEY = window.__SUPABASE_ANON__ || '';
    if (!SUPABASE_URL || !SUPABASE_KEY) return;

    const { createClient } = supabase;
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
    sb.realtime.setAuth(localStorage.getItem('unithrift_session_token') || token);

    let userId = null;
    try {
        const profileRes = await window.authFetch('/api/profile');
        if (profileRes.status === 401) return; 
        const profileData = await profileRes.json();
        if (profileData.success) userId = profileData.profile?.id;
    } catch (err) {
        console.error('Failed to fetch session identity for realtime wiring:', err);
    }
    if (!userId) return;

    const currentToken = localStorage.getItem('unithrift_session_token');
    if (currentToken) sb.realtime.setAuth(currentToken);

    // Listens for centralized updates and refreshes the subscription authentication JWT
    window.addEventListener("unithrift:tokens-updated", () => {
        const newToken = localStorage.getItem("unithrift_session_token");
        if (newToken) sb.realtime.setAuth(newToken);
    });

    sb.channel('notifications')
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'notifications',
            filter: `user_id=eq.${userId}`
        }, payload => {
            if (allNotifications.some(n => n.id === payload.new.id)) return;
            allNotifications.unshift(payload.new);
            renderList();
            updateBadge();
        })
        .subscribe();

    sb.channel(`notifications:${userId}`)
        .on('broadcast', { event: 'new_msg_alert' }, (payload) => {
            const { msg, senderName, roomId } = payload.payload || {};
            allNotifications.unshift({
                id: `live-${Date.now()}`,
                type: 'message',
                message: `New message from ${senderName || 'a student'}: "${msg || ''}"`,
                read: false,
                reference_id: roomId || '',
                created_at: new Date().toISOString()
            });
            renderList();
            updateBadge();
        })
        .subscribe();
})();