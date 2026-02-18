/**
 * AcolheBem — Messages (DM) Module
 * Handles direct messaging: conversations list, sending/receiving messages,
 * realtime updates, and unread badge.
 */

const Messages = {
  _channel: null,
  _unreadCount: 0,
  _userId: null,

  // --- Lifecycle ---

  async init(userId) {
    this._userId = userId;
    try {
      await this._loadUnreadCount();
    } catch (e) {
      console.warn('Failed to load DM unread count:', e);
    }
    this._setupRealtime(userId);
  },

  destroy() {
    if (this._channel) {
      const sb = window.supabaseClient;
      sb.removeChannel(this._channel);
      this._channel = null;
    }
    this._userId = null;
    this._unreadCount = 0;
    this._updateBadge();
  },

  // --- Realtime ---

  _setupRealtime(userId) {
    const sb = window.supabaseClient;
    if (this._channel) {
      sb.removeChannel(this._channel);
    }

    this._channel = sb
      .channel('dm_' + userId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          this._onNewMessage(payload.new);
        }
      )
      .subscribe();
  },

  _onNewMessage(msg) {
    // Only count messages from others
    if (msg.sender_id === this._userId) return;

    this._unreadCount++;
    this._updateBadge();

    // Notify app if it has a handler
    if (window.acolheBemApp && typeof window.acolheBemApp._onRealtimeDM === 'function') {
      window.acolheBemApp._onRealtimeDM(msg);
    }
  },

  // --- Badge ---

  _updateBadge() {
    const badge = document.getElementById('dmBadge');
    if (!badge) return;
    if (this._unreadCount > 0) {
      badge.textContent = this._unreadCount > 99 ? '99+' : this._unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  },

  // --- Data ---

  async _loadUnreadCount() {
    const sb = window.supabaseClient;
    if (!this._userId) return;

    const { data, error } = await sb.rpc('get_unread_dm_count');
    if (!error && data !== null) {
      this._unreadCount = data;
      this._updateBadge();
    }
  },

  async getConversations() {
    const sb = window.supabaseClient;
    const { data, error } = await sb.rpc('get_conversations_list');
    if (error) {
      ErrorHandler.handle('Messages.getConversations', error, { silent: true });
      return [];
    }
    return data || [];
  },

  async getOrCreateConversation(otherUserId) {
    const sb = window.supabaseClient;
    const { data, error } = await sb.rpc('get_or_create_conversation', {
      p_other_user_id: otherUserId,
    });
    if (error) {
      ErrorHandler.handle('Messages.getOrCreateConversation', error);
      return null;
    }
    return data;
  },

  async loadMessages(conversationId, limit = 50, offset = 0) {
    const sb = window.supabaseClient;
    const { data, error } = await sb
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at, read_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      ErrorHandler.handle('Messages.loadMessages', error, { silent: true });
      return [];
    }
    return data || [];
  },

  async sendMessage(conversationId, content) {
    const sb = window.supabaseClient;
    const { data, error } = await sb
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: this._userId,
        content: content.trim(),
      })
      .select()
      .single();

    if (error) {
      ErrorHandler.handle('Messages.sendMessage', error);
      return { error: error.message };
    }
    return { message: data, error: null };
  },

  async markAsRead(conversationId) {
    const sb = window.supabaseClient;
    if (!this._userId) return;

    const { error } = await sb
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', this._userId)
      .is('read_at', null);

    if (!error) {
      // Reload unread count
      await this._loadUnreadCount();
    }
  },
};
