/**
 * AcolheBem — Notifications Module
 * Handles topic subscriptions, realtime notifications, bell badge, dropdown, and browser notifications.
 */

const Notifications = {
  _channel: null,
  _unreadCount: 0,
  _notifications: [],
  _dropdownOpen: false,
  _userId: null,

  // --- Lifecycle ---

  async init(userId) {
    // Close any open dropdown from previous session
    this.closeDropdown();
    this._userId = userId;
    try {
      await this._loadUnreadCount();
    } catch (e) {
      console.warn('Failed to load unread count:', e);
    }
    this._setupRealtime(userId);
    this._requestPermission();
    this._bindOutsideClick();
  },

  destroy() {
    if (this._channel) {
      const sb = window.supabaseClient;
      sb.removeChannel(this._channel);
      this._channel = null;
    }
    this._userId = null;
    this._unreadCount = 0;
    this._notifications = [];
    this._dropdownOpen = false;
    this._updateBadge();
    document.removeEventListener('click', this._outsideClickHandler);
  },

  // --- Realtime ---

  _setupRealtime(userId) {
    const sb = window.supabaseClient;
    if (this._channel) {
      sb.removeChannel(this._channel);
    }

    this._channel = sb
      .channel('notifications-' + userId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'user_id=eq.' + userId,
        },
        (payload) => {
          this._onNewNotification(payload.new);
        }
      )
      .subscribe();
  },

  _onNewNotification(notification) {
    this._unreadCount++;
    this._updateBadge();

    // Prepend to list if dropdown is open
    if (this._dropdownOpen) {
      this._notifications.unshift(notification);
      this._renderDropdown();
    }

    // Show browser notification
    this._showBrowserNotif(notification);
  },

  // --- Badge ---

  _updateBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (this._unreadCount > 0) {
      badge.textContent = this._unreadCount > 99 ? '99+' : this._unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  },

  // --- Dropdown ---

  toggleDropdown() {
    if (this._dropdownOpen) {
      this.closeDropdown();
    } else {
      this._openDropdown();
    }
  },

  async _openDropdown() {
    this._dropdownOpen = true;
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    panel.style.display = '';
    panel.classList.add('open');

    // Load notifications
    await this._loadNotifications();
    this._renderDropdown();
  },

  closeDropdown() {
    this._dropdownOpen = false;
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    panel.classList.remove('open');
    panel.style.display = 'none';
  },

  _renderDropdown() {
    const list = document.getElementById('notifList');
    const empty = document.getElementById('notifEmpty');
    if (!list || !empty) return;

    if (this._notifications.length === 0) {
      list.innerHTML = '';
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';
    list.innerHTML = this._notifications.map(n => {
      const time = this._timeAgo(n.created_at);
      const unreadClass = n.is_read ? '' : ' unread';
      const icons = {
        new_reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        new_follow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>',
      };
      const icon = icons[n.type] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

      return `
        <div class="notif-item${unreadClass}" data-topic-id="${n.topic_id || ''}" data-post-id="${n.post_id || ''}">
          <div class="notif-item-icon">${icon}</div>
          <div class="notif-item-content">
            <div class="notif-item-title">${this._escapeHTML(n.title)}</div>
            <div class="notif-item-body">${this._escapeHTML(n.body)}</div>
            <div class="notif-item-time">${time}</div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers to notification items
    list.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', () => {
        const topicId = item.dataset.topicId;
        if (topicId && window.acolheBemApp) {
          this.closeDropdown();
          // Navigate to the topic feed
          const app = window.acolheBemApp;
          if (app.currentTab !== 'community') {
            app.switchTab('community');
          }
          const topicData = app._dbTopicsMap
            ? Object.values(app._dbTopicsMap).find(t => t.id === topicId)
            : null;
          if (topicData) {
            app.currentTopicId = topicId;
            app.currentTopicData = topicData;
            app.showTopicFeed(topicId, topicData);
          }
        }
      });
    });
  },

  async markAllRead() {
    const sb = window.supabaseClient;
    if (!this._userId) return;

    await sb
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', this._userId)
      .eq('is_read', false);

    this._unreadCount = 0;
    this._updateBadge();
    this._notifications.forEach(n => n.is_read = true);
    this._renderDropdown();
  },

  // --- Browser Notifications ---

  _requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      // Don't request immediately — wait for user interaction
      // Permission will be requested when user subscribes to a topic
    }
  },

  async requestBrowserPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  },

  _showBrowserNotif(notification) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.hasFocus()) return; // Don't show if app is in focus

    try {
      new Notification(notification.title, {
        body: notification.body,
        icon: '/icons/icon-192.png',
        tag: 'acolhebem-' + notification.id,
      });
    } catch (e) {
      console.warn('Browser notification failed:', e);
    }
  },

  // --- Data ---

  async _loadUnreadCount() {
    const sb = window.supabaseClient;
    if (!this._userId) return;

    const { count, error } = await sb
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', this._userId)
      .eq('is_read', false);

    if (!error) {
      this._unreadCount = count || 0;
      this._updateBadge();
    }
  },

  async _loadNotifications(limit = 20) {
    const sb = window.supabaseClient;
    if (!this._userId) return;

    const { data, error } = await sb
      .from('notifications')
      .select('*')
      .eq('user_id', this._userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error) {
      this._notifications = data || [];
    }
  },

  // --- Notify Subscribers ---

  async notifySubscribers(topicId, postId, actorName, type) {
    if (!topicId || !this._userId) return;

    const sb = window.supabaseClient;

    // Get subscribers excluding the actor
    const subscribers = await Feed.getTopicSubscribers(topicId, this._userId);
    if (!subscribers || subscribers.length === 0) return;

    // Get topic name for notification text
    const { data: topic } = await sb
      .from('topics')
      .select('name, emoji')
      .eq('id', topicId)
      .single();

    const topicName = topic ? `${topic.emoji || ''} ${topic.name}` : 'um tema';

    const title = type === 'new_reply'
      ? `${actorName} respondeu`
      : `${actorName} publicou`;

    const body = type === 'new_reply'
      ? `Nova resposta em ${topicName}`
      : `Nova publicacao em ${topicName}`;

    // Insert notifications for all subscribers
    const notifications = subscribers.map(sub => ({
      user_id: sub.user_id,
      type,
      title,
      body,
      post_id: postId,
      topic_id: topicId,
      actor_name: actorName,
    }));

    const { error } = await sb
      .from('notifications')
      .insert(notifications);

    if (error) {
      ErrorHandler.handle('notifications.notifySubscribers', error, { silent: true });
    }
  },

  // --- Follow Notification ---

  async notifyFollow(targetUserId, actorName) {
    if (!this._userId || !targetUserId) return;
    if (targetUserId === this._userId) return; // don't notify self

    const sb = window.supabaseClient;
    const { error } = await sb
      .from('notifications')
      .insert({
        user_id: targetUserId,
        type: 'new_follow',
        title: `${actorName} comecou a te seguir`,
        body: 'Voce tem um novo seguidor!',
        actor_name: actorName,
      });

    if (error) {
      ErrorHandler.handle('notifications.notifyFollow', error, { silent: true });
    }
  },

  // --- Helpers ---

  _escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  _timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'agora';
    if (diff < 3600) return Math.floor(diff / 60) + ' min';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd';
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  },

  _outsideClickHandler: null,

  _bindOutsideClick() {
    // Remove previous handler to avoid accumulation on re-init
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
    }
    this._outsideClickHandler = (e) => {
      if (!this._dropdownOpen) return;
      const panel = document.getElementById('notifPanel');
      const btn = document.getElementById('notifBtn');
      if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
        this.closeDropdown();
      }
    };
    document.addEventListener('click', this._outsideClickHandler);
  },
};
