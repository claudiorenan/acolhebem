/**
 * AcolheBem — Search Module
 * Full-text search across posts, profiles, and topics via Supabase RPCs.
 */

const Search = {
  _debounceTimer: null,
  _lastQuery: '',
  _cache: {},

  /**
   * Debounced search — waits 300ms after last keystroke.
   * @param {string} query
   * @param {function} callback - receives { posts, profiles, topics }
   */
  debounce(query, callback) {
    clearTimeout(this._debounceTimer);
    const q = query.trim();

    if (q.length < 2) {
      callback({ posts: [], profiles: [], topics: [] });
      return;
    }

    if (this._cache[q]) {
      callback(this._cache[q]);
      return;
    }

    this._debounceTimer = setTimeout(async () => {
      const results = await this.search(q);
      this._cache[q] = results;
      // Keep cache small
      const keys = Object.keys(this._cache);
      if (keys.length > 20) delete this._cache[keys[0]];
      callback(results);
    }, 300);
  },

  /**
   * Execute search across all types in parallel.
   * @param {string} query
   * @returns {Promise<{posts: object[], profiles: object[], topics: object[]}>}
   */
  async search(query) {
    const sb = window.supabaseClient;
    this._lastQuery = query;

    try {
      const [postsRes, profilesRes, topicsRes] = await Promise.all([
        sb.rpc('search_posts', { p_query: query, p_limit: 20, p_offset: 0 }),
        sb.rpc('search_profiles', { p_query: query, p_limit: 15 }),
        sb.rpc('search_topics', { p_query: query, p_limit: 10 }),
      ]);

      return {
        posts: postsRes.data || [],
        profiles: profilesRes.data || [],
        topics: topicsRes.data || [],
      };
    } catch (err) {
      ErrorHandler.handle('search.search', err, { silent: true });
      return { posts: [], profiles: [], topics: [] };
    }
  },

  /**
   * Highlight matched terms in text.
   * @param {string} text
   * @param {string} query
   * @returns {string} HTML with <mark> tags
   */
  highlight(text, query) {
    if (!text || !query) return text || '';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(regex, '<mark>$1</mark>');
  },

  /**
   * Truncate text around the matched term.
   * @param {string} text
   * @param {string} query
   * @param {number} maxLen
   * @returns {string}
   */
  excerpt(text, query, maxLen = 150) {
    if (!text) return '';
    const lower = text.toLowerCase();
    const qLower = query.toLowerCase();
    const idx = lower.indexOf(qLower);

    if (idx === -1 || text.length <= maxLen) {
      return text.substring(0, maxLen);
    }

    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, start + maxLen);
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    return snippet;
  },

  clearCache() {
    this._cache = {};
    this._lastQuery = '';
  },
};
