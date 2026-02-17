/**
 * AcolheBem — Community Feed Module
 * Handles topics, posts, reactions, and replies via Supabase.
 */

const Feed = {
  /**
   * Load all topics ordered by post_count desc, then name.
   * @returns {Promise<object[]>}
   */
  async loadTopics() {
    const sb = window.supabaseClient;
    const { data, error } = await sb
      .from('topics')
      .select('*')
      .order('post_count', { ascending: false })
      .order('name', { ascending: true });

    if (error) { console.error('loadTopics error:', error); return []; }
    return data || [];
  },

  /**
   * Create a new topic.
   * @param {string} name
   * @param {string} emoji
   * @param {string} description
   * @returns {Promise<{topic: object|null, error: string|null}>}
   */
  async createTopic(name, emoji, description) {
    const sb = window.supabaseClient;
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return { topic: null, error: 'Faca login para criar um tema.' };

    const slug = name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { data, error } = await sb
      .from('topics')
      .insert({
        name,
        slug,
        emoji: emoji || '💬',
        description: description || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return { topic: null, error: error.message };
    return { topic: data, error: null };
  },

  /**
   * Auto-create a topic from data.js category (no auth required, uses service-level insert).
   * Falls back to upsert by slug.
   */
  async createTopicAuto(name, emoji, description, slug, color, gender) {
    const sb = window.supabaseClient;

    // Try to find existing first
    const { data: existing } = await sb
      .from('topics')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) return { topic: existing, error: null };

    // Insert new
    const { data, error } = await sb
      .from('topics')
      .insert({
        name,
        slug,
        emoji: emoji || '💬',
        description: description || null,
        color: color || '#2f6f64',
        is_default: true,
      })
      .select()
      .single();

    if (error) return { topic: null, error: error.message };
    return { topic: data, error: null };
  },

  /**
   * Load paginated posts with author profile, reaction count, and user reaction.
   * @param {string|null} topicId - filter by topic (null = all posts)
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<object[]>}
   */
  async loadPosts(topicId = null, limit = 20, offset = 0) {
    const sb = window.supabaseClient;
    const user = (await sb.auth.getUser()).data.user;

    let query = sb
      .from('posts')
      .select('*, profiles!posts_user_id_fkey(name, photo_url, gender, birth_year, is_psi), topics!posts_topic_id_fkey(name, emoji)')
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (topicId) {
      query = query.eq('topic_id', topicId);
    }

    const { data: posts, error } = await query;

    if (error) { console.error('loadPosts error:', error); return []; }

    // Fetch reaction counts and user reactions in bulk
    const postIds = posts.map(p => p.id);

    const { data: reactionCounts } = await sb
      .from('reactions')
      .select('post_id')
      .in('post_id', postIds);

    const countMap = {};
    if (reactionCounts) {
      reactionCounts.forEach(r => {
        countMap[r.post_id] = (countMap[r.post_id] || 0) + 1;
      });
    }

    let userReactions = {};
    if (user) {
      const { data: userReacts } = await sb
        .from('reactions')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds);
      if (userReacts) {
        userReacts.forEach(r => { userReactions[r.post_id] = true; });
      }
    }

    // Fetch reply counts
    const { data: replyCounts } = await sb
      .from('replies')
      .select('post_id')
      .in('post_id', postIds);

    const replyCountMap = {};
    if (replyCounts) {
      replyCounts.forEach(r => {
        replyCountMap[r.post_id] = (replyCountMap[r.post_id] || 0) + 1;
      });
    }

    return posts.map(p => ({
      ...p,
      author: p.profiles,
      reactionCount: countMap[p.id] || 0,
      replyCount: replyCountMap[p.id] || 0,
      userReacted: !!userReactions[p.id],
    }));
  },

  /**
   * Create a new post.
   * @param {string} content
   * @param {string|null} topicId
   * @param {boolean} isAnonymous
   * @returns {Promise<{post: object|null, error: string|null}>}
   */
  async createPost(content, topicId = null, isAnonymous = false) {
    const sb = window.supabaseClient;
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return { post: null, error: 'Faca login para publicar.' };

    const insertData = { user_id: user.id, content, is_anonymous: isAnonymous };
    if (topicId) insertData.topic_id = topicId;

    const { data, error } = await sb
      .from('posts')
      .insert(insertData)
      .select('*, profiles!posts_user_id_fkey(name, photo_url, gender, birth_year, is_psi)')
      .single();

    if (error) return { post: null, error: error.message };
    return { post: { ...data, author: data.profiles, reactionCount: 0, replyCount: 0, userReacted: false }, error: null };
  },

  /**
   * Delete own post.
   * @param {string} postId
   * @returns {Promise<{error: string|null}>}
   */
  async deletePost(postId) {
    const sb = window.supabaseClient;
    const { error } = await sb.from('posts').delete().eq('id', postId);
    if (error) return { error: error.message };
    return { error: null };
  },

  /**
   * Toggle like/unlike on a post.
   * @param {string} postId
   * @returns {Promise<{liked: boolean, error: string|null}>}
   */
  async toggleReaction(postId) {
    const sb = window.supabaseClient;
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return { liked: false, error: 'Faca login para reagir.' };

    // Check if already reacted
    const { data: existing } = await sb
      .from('reactions')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await sb.from('reactions').delete().eq('id', existing.id);
      return { liked: false, error: null };
    } else {
      const { error } = await sb
        .from('reactions')
        .insert({ post_id: postId, user_id: user.id, type: 'like' });
      if (error) return { liked: false, error: error.message };
      return { liked: true, error: null };
    }
  },

  /**
   * Load replies for a post.
   * @param {string} postId
   * @returns {Promise<object[]>}
   */
  async loadReplies(postId) {
    const sb = window.supabaseClient;
    const { data, error } = await sb
      .from('replies')
      .select('*, profiles!replies_user_id_fkey(name, photo_url, is_psi)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) { console.error('loadReplies error:', error); return []; }
    return data.map(r => ({ ...r, author: r.profiles }));
  },

  /**
   * Create a reply to a post.
   * @param {string} postId
   * @param {string} content
   * @param {boolean} isAnonymous
   * @returns {Promise<{reply: object|null, error: string|null}>}
   */
  async createReply(postId, content, isAnonymous = false) {
    const sb = window.supabaseClient;
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return { reply: null, error: 'Faca login para responder.' };

    const { data, error } = await sb
      .from('replies')
      .insert({ post_id: postId, user_id: user.id, content, is_anonymous: isAnonymous })
      .select('*, profiles!replies_user_id_fkey(name, photo_url, is_psi)')
      .single();

    if (error) return { reply: null, error: error.message };
    return { reply: { ...data, author: data.profiles }, error: null };
  },

  /**
   * Delete own reply.
   * @param {string} replyId
   * @returns {Promise<{error: string|null}>}
   */
  async deleteReply(replyId) {
    const sb = window.supabaseClient;
    const { error } = await sb.from('replies').delete().eq('id', replyId);
    if (error) return { error: error.message };
    return { error: null };
  },

  // ========================================
  //  ADMIN METHODS
  // ========================================

  /**
   * Load all members (profiles) with created_at, ordered by newest.
   */
  async loadMembers() {
    const sb = window.supabaseClient;
    const { data, error } = await sb
      .from('profiles')
      .select('id, name, email, whatsapp, city, state, gender, birth_year, photo_url, is_admin, created_at')
      .order('created_at', { ascending: false });
    if (error) { console.error('loadMembers error:', error); return []; }
    return data || [];
  },

  /**
   * Load all posts for admin moderation (including hidden).
   */
  async loadAllPostsAdmin(limit = 50, offset = 0) {
    const sb = window.supabaseClient;
    const { data, error } = await sb
      .from('posts')
      .select('*, profiles!posts_user_id_fkey(name, photo_url, email), topics!posts_topic_id_fkey(name, emoji)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) { console.error('loadAllPostsAdmin error:', error); return []; }
    return data || [];
  },

  /**
   * Update post status (visible, hidden, deleted).
   */
  async updatePostStatus(postId, status) {
    const sb = window.supabaseClient;
    const { error } = await sb
      .from('posts')
      .update({ status })
      .eq('id', postId);
    if (error) return { error: error.message };
    return { error: null };
  },

  /**
   * Admin hard-delete a post.
   */
  async adminDeletePost(postId) {
    const sb = window.supabaseClient;
    const { error } = await sb.from('posts').delete().eq('id', postId);
    if (error) return { error: error.message };
    return { error: null };
  },

  /**
   * Update topic name, link, etc.
   */
  async updateTopic(topicId, updates) {
    const sb = window.supabaseClient;
    const { data, error } = await sb
      .from('topics')
      .update(updates)
      .eq('id', topicId)
      .select()
      .single();
    if (error) return { topic: null, error: error.message };
    return { topic: data, error: null };
  },

  /**
   * Check if current user is admin.
   */
  async isAdmin() {
    const sb = window.supabaseClient;
    const user = (await sb.auth.getUser()).data.user;
    if (!user) return false;
    const { data } = await sb
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    return data?.is_admin === true;
  },

  /**
   * Load all psychologist profiles (is_psi = true).
   */
  async loadPsychologists() {
    const sb = window.supabaseClient;
    const { data, error } = await sb
      .from('profiles')
      .select('id, name, email, whatsapp, city, state, crp, photo_url, created_at')
      .eq('is_psi', true)
      .order('created_at', { ascending: false });
    if (error) { console.error('loadPsychologists error:', error); return []; }
    return data || [];
  }
};
