/**
 * AcolheBem — Profile Module
 * Handles profile CRUD and avatar management via Supabase.
 */

const Profile = {
  /**
   * Get a user's profile by ID.
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async getProfile(userId, retries = 2) {
    try {
      const sb = window.supabaseClient;
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        if (retries > 0 && error.message && error.message.includes('AbortError')) {
          await new Promise(r => setTimeout(r, 500));
          return this.getProfile(userId, retries - 1);
        }
        ErrorHandler.handle('profile.getProfile', error, { silent: true });
        return null;
      }
      return data;
    } catch (err) {
      ErrorHandler.handle('profile.getProfile', err, { silent: true });
      return null;
    }
  },

  /**
   * Update the current user's profile.
   * @param {object} updates - fields to update (name, whatsapp, city, state, bio, photo_url)
   * @returns {Promise<{data: object|null, error: string|null}>}
   */
  async updateProfile(updates) {
    try {
      const sb = window.supabaseClient;
      const user = (await sb.auth.getUser()).data.user;
      if (!user) return { data: null, error: 'Usuario nao autenticado.' };

      const { data, error } = await sb
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch (err) {
      ErrorHandler.handle('profile.updateProfile', err, { silent: true });
      return { data: null, error: 'Erro ao salvar perfil. Tente novamente.' };
    }
  },

  /**
   * Upload an avatar image to Supabase Storage.
   * @param {File} file
   * @param {string} [userId] - if not provided, uses current user
   * @returns {Promise<{url: string|null, error: string|null}>}
   */
  async uploadAvatar(file, userId) {
    try {
      const sb = window.supabaseClient;
      if (!userId) {
        const user = (await sb.auth.getUser()).data.user;
        if (!user) return { url: null, error: 'Usuario nao autenticado.' };
        userId = user.id;
      }

      const ext = file.name.split('.').pop();
      const path = `${userId}/avatar.${ext}`;

      const { error } = await sb.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (error) return { url: null, error: error.message };

      const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      await sb.from('profiles').update({ photo_url: publicUrl }).eq('id', userId);

      return { url: publicUrl, error: null };
    } catch (err) {
      ErrorHandler.handle('profile.uploadAvatar', err, { silent: true });
      return { url: null, error: 'Erro ao enviar foto. Tente novamente.' };
    }
  },

  /**
   * Delete the current user's avatar.
   * @returns {Promise<{error: string|null}>}
   */
  async deleteAvatar() {
    try {
      const sb = window.supabaseClient;
      const user = (await sb.auth.getUser()).data.user;
      if (!user) return { error: 'Usuario nao autenticado.' };

      const { data: files } = await sb.storage.from('avatars').list(user.id);
      if (files && files.length > 0) {
        const paths = files.map(f => `${user.id}/${f.name}`);
        await sb.storage.from('avatars').remove(paths);
      }

      await sb.from('profiles').update({ photo_url: null }).eq('id', user.id);
      return { error: null };
    } catch (err) {
      ErrorHandler.handle('profile.deleteAvatar', err, { silent: true });
      return { error: 'Erro ao remover foto. Tente novamente.' };
    }
  }
};
