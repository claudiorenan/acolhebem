/**
 * AcolheBem — Authentication Module
 * Handles sign up, sign in, sign out, and auth state changes via Supabase.
 */

const Auth = {
  /**
   * Sign up a new user and create their profile.
   * @param {string} email
   * @param {string} password
   * @param {object} profileData - { name, whatsapp, city, state, bio }
   * @param {File|null} avatarFile - optional avatar image
   * @returns {Promise<{user: object|null, error: string|null}>}
   */
  async signUp(email, password, profileData) {
    try {
      const sb = window.supabaseClient;

      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: profileData.name,
            whatsapp: profileData.whatsapp,
            city: profileData.city || null,
            state: profileData.state || null,
            bio: profileData.bio || null,
            gender: profileData.gender || null,
            birth_year: profileData.birth_year || null,
          }
        }
      });
      if (error) return { user: null, error: error.message };

      const user = data.user;
      if (!user) return { user: null, error: 'Erro ao criar conta. Tente novamente.' };

      return { user, error: null };
    } catch (err) {
      ErrorHandler.handle('auth.signUp', err, { silent: true });
      return { user: null, error: 'Erro de conexao. Verifique sua internet e tente novamente.' };
    }
  },

  /**
   * Sign in with email and password.
   * @returns {Promise<{user: object|null, error: string|null}>}
   */
  async signIn(email, password) {
    try {
      const sb = window.supabaseClient;
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return { user: null, error: error.message };
      return { user: data.user, error: null };
    } catch (err) {
      ErrorHandler.handle('auth.signIn', err, { silent: true });
      return { user: null, error: 'Erro de conexao. Verifique sua internet e tente novamente.' };
    }
  },

  /**
   * Sign out the current user.
   */
  async signOut() {
    try {
      const sb = window.supabaseClient;
      await sb.auth.signOut();
    } catch (err) {
      ErrorHandler.handle('auth.signOut', err);
    }
  },

  /**
   * Get the currently logged-in user (or null).
   * @returns {Promise<object|null>}
   */
  async getCurrentUser() {
    try {
      const sb = window.supabaseClient;
      const { data: { user } } = await sb.auth.getUser();
      return user;
    } catch (err) {
      ErrorHandler.handle('auth.getCurrentUser', err, { silent: true });
      return null;
    }
  },

  /**
   * Send a password reset email.
   * @param {string} email
   * @returns {Promise<{error: string|null}>}
   */
  async resetPassword(email) {
    try {
      const sb = window.supabaseClient;
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err) {
      ErrorHandler.handle('auth.resetPassword', err, { silent: true });
      return { error: 'Erro de conexao. Tente novamente.' };
    }
  },

  /**
   * Sign in as a psychologist via Cadê Meu Psi credentials.
   * Calls the psi-auth Edge Function, then signs in locally.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{user: object|null, error: string|null}>}
   */
  async signInPsi(email, password) {
    const sb = window.supabaseClient;
    const SUPABASE_URL = sb.supabaseUrl || 'https://ynsxfifbbqhstlhuilzg.supabase.co';

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/psi-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return { user: null, error: data.error || 'Erro ao autenticar no Cade Meu Psi.' };
      }

      // Sign in with the deterministic password created by the Edge Function
      const { data: signInData, error: signInError } = await sb.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (signInError) return { user: null, error: signInError.message };
      return { user: signInData.user, error: null };
    } catch (err) {
      ErrorHandler.handle('auth.signInPsi', err, { silent: true });
      return { user: null, error: 'Erro de conexao. Tente novamente.' };
    }
  },

  /**
   * Listen for auth state changes.
   * @param {function} callback - receives (event, session)
   */
  onAuthChange(callback) {
    const sb = window.supabaseClient;
    sb.auth.onAuthStateChange(callback);
  }
};
