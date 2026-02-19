/**
 * AcolheBem — Error Handler Module
 * Centralized error handling with user-friendly messages and toast notifications.
 */

const ErrorHandler = {
  _toastContainer: null,
  _toastTimeout: null,
  _sentryReady: false,

  /**
   * Initialize global error handlers and Sentry.
   * Call once on app startup.
   */
  init() {
    this._createToastContainer();
    this._initSentry();

    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.handle('global', event.error || event.message);
      // Don't prevent default — let browser log it too
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handle('promise', event.reason);
      event.preventDefault();
    });

    // Detect offline/online transitions
    window.addEventListener('offline', () => {
      this.showToast('Sem conexao com a internet.', 'warning', 5000);
    });

    window.addEventListener('online', () => {
      this.showToast('Conexao restaurada!', 'success', 3000);
    });
  },

  /**
   * Handle an error with context.
   * Logs to console and optionally shows toast to user.
   * @param {string} context - Where the error happened (e.g., 'feed.createPost')
   * @param {Error|string|object} error - The error object or message
   * @param {object} [options]
   * @param {boolean} [options.silent=false] - If true, don't show toast
   * @param {string} [options.userMessage] - Custom user-facing message
   * @returns {string} The user-facing error message
   */
  handle(context, error, options = {}) {
    const errorMsg = this._extractMessage(error);
    const userMsg = options.userMessage || this._toUserMessage(errorMsg, context);

    // Always log for debugging
    console.error(`[AcolheBem:${context}]`, error);

    // Send to Sentry
    this._captureToSentry(context, error);

    // Show toast unless silent
    if (!options.silent) {
      this.showToast(userMsg, 'error');
    }

    return userMsg;
  },

  /**
   * Show a toast notification to the user.
   * @param {string} message
   * @param {'error'|'warning'|'success'|'info'} [type='info']
   * @param {number} [duration=4000] - Auto-dismiss in ms
   */
  showToast(message, type = 'info', duration = 4000) {
    if (!this._toastContainer) this._createToastContainer();

    // Remove existing toast
    const existing = this._toastContainer.querySelector('.ab-toast');
    if (existing) existing.remove();
    clearTimeout(this._toastTimeout);

    const icons = {
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    const toast = document.createElement('div');
    toast.className = `ab-toast ab-toast-${type}`;
    toast.innerHTML = `
      <span class="ab-toast-icon">${icons[type] || icons.info}</span>
      <span class="ab-toast-msg">${this._escapeHTML(message)}</span>
      <button class="ab-toast-close" aria-label="Fechar">&times;</button>
    `;

    toast.querySelector('.ab-toast-close').addEventListener('click', () => {
      toast.classList.add('ab-toast-exit');
      setTimeout(() => toast.remove(), 300);
    });

    this._toastContainer.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => toast.classList.add('ab-toast-enter'));

    // Auto-dismiss
    this._toastTimeout = setTimeout(() => {
      toast.classList.add('ab-toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * Wrap an async function with error handling.
   * @param {string} context
   * @param {Function} fn - async function to execute
   * @param {object} [options] - options for handle()
   * @returns {Promise<*>} Result of fn, or null on error
   */
  async wrap(context, fn, options = {}) {
    try {
      return await fn();
    } catch (error) {
      this.handle(context, error, options);
      return null;
    }
  },

  // --- Sentry ---

  _initSentry() {
    if (typeof Sentry === 'undefined') return;
    try {
      const isProduction = location.hostname === 'acolhebem.vercel.app'
        || location.hostname === 'acolhebem.com.br'
        || location.hostname === 'www.acolhebem.com.br';

      const dsn = window.SENTRY_DSN || '';
      if (!dsn || dsn.includes('YOUR_DSN_HERE')) {
        console.info('Sentry: No valid DSN configured, skipping initialization.');
        return;
      }
      Sentry.init({
        dsn,
        environment: isProduction ? 'production' : 'development',
        release: 'acolhebem@1.0.0',
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: isProduction ? 0.2 : 1.0,
        sampleRate: isProduction ? 1.0 : 1.0,
        beforeSend(event) {
          // Don't send events in development unless explicitly testing
          if (!isProduction && !localStorage.getItem('ab_sentry_debug')) {
            return null;
          }
          return event;
        },
      });

      this._sentryReady = true;
    } catch (e) {
      console.warn('Sentry init failed:', e);
    }
  },

  _captureToSentry(context, error) {
    if (!this._sentryReady || typeof Sentry === 'undefined') return;
    try {
      Sentry.withScope((scope) => {
        scope.setTag('context', context);
        scope.setExtra('context', context);

        // Attach user if available
        if (window.supabaseClient) {
          const session = window.supabaseClient.auth?.session?.();
          if (session?.user) {
            scope.setUser({ id: session.user.id, email: session.user.email });
          }
        }

        if (error instanceof Error) {
          Sentry.captureException(error);
        } else {
          Sentry.captureMessage(this._extractMessage(error), 'error');
        }
      });
    } catch (e) {
      // Silently fail — Sentry capture should never break the app
    }
  },

  /**
   * Set the current user in Sentry scope.
   * Call after login.
   */
  setSentryUser(userId, email) {
    if (!this._sentryReady || typeof Sentry === 'undefined') return;
    Sentry.setUser({ id: userId, email });
  },

  /**
   * Clear the Sentry user scope.
   * Call after logout.
   */
  clearSentryUser() {
    if (!this._sentryReady || typeof Sentry === 'undefined') return;
    Sentry.setUser(null);
  },

  // --- Internal ---

  _createToastContainer() {
    if (document.getElementById('ab-toast-container')) {
      this._toastContainer = document.getElementById('ab-toast-container');
      return;
    }
    const container = document.createElement('div');
    container.id = 'ab-toast-container';
    container.className = 'ab-toast-container';
    document.body.appendChild(container);
    this._toastContainer = container;
  },

  _extractMessage(error) {
    if (!error) return 'Erro desconhecido';
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.error_description) return error.error_description;
    if (error.msg) return error.msg;
    try { return JSON.stringify(error); } catch { return 'Erro desconhecido'; }
  },

  _toUserMessage(errorMsg, context) {
    const lower = errorMsg.toLowerCase();

    // Network errors
    if (lower.includes('fetch') || lower.includes('networkerror') || lower.includes('failed to fetch') || lower.includes('network')) {
      return 'Sem conexao com o servidor. Verifique sua internet e tente novamente.';
    }

    // Auth errors
    if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
      return 'E-mail ou senha incorretos.';
    }
    if (lower.includes('email not confirmed')) {
      return 'Confirme seu e-mail antes de fazer login.';
    }
    if (lower.includes('user already registered') || lower.includes('already been registered')) {
      return 'Este e-mail ja esta cadastrado. Tente fazer login.';
    }
    if (lower.includes('rate limit') || lower.includes('too many requests')) {
      return 'Muitas tentativas. Aguarde um momento e tente novamente.';
    }
    if (lower.includes('jwt') || lower.includes('token')) {
      return 'Sua sessão expirou. Faça login novamente.';
    }

    // Supabase RLS / permissions
    if (lower.includes('policy') || lower.includes('permission') || lower.includes('rls')) {
      return 'Você não tem permissão para esta ação.';
    }

    // Storage errors
    if (lower.includes('payload too large') || lower.includes('file size')) {
      return 'Arquivo muito grande. O limite e 2MB.';
    }
    if (lower.includes('mime') || lower.includes('file type')) {
      return 'Tipo de arquivo nao suportado. Use JPG, PNG ou WebP.';
    }

    // Database errors
    if (lower.includes('unique') || lower.includes('duplicate') || lower.includes('23505')) {
      return 'Este registro ja existe.';
    }
    if (lower.includes('not found') || lower.includes('no rows')) {
      return 'Registro nao encontrado.';
    }

    // Content filter
    if (lower.includes('contato') || lower.includes('telefone') || lower.includes('email')) {
      return errorMsg; // Already user-friendly from ContentFilter
    }

    // AbortError (Supabase race condition)
    if (lower.includes('aborterror') || lower.includes('aborted')) {
      return 'Operacao cancelada. Tente novamente.';
    }

    // Generic fallback based on context
    const contextMap = {
      'auth': 'Erro na autenticacao. Tente novamente.',
      'feed': 'Erro ao carregar publicacoes. Tente novamente.',
      'profile': 'Erro ao atualizar perfil. Tente novamente.',
      'notifications': 'Erro nas notificacoes.',
      'admin': 'Erro no painel administrativo.',
      'global': 'Ocorreu um erro inesperado.',
      'promise': 'Ocorreu um erro inesperado.',
    };

    // Match context prefix
    for (const [key, msg] of Object.entries(contextMap)) {
      if (context.startsWith(key)) return msg;
    }

    return 'Ocorreu um erro. Tente novamente.';
  },

  _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
