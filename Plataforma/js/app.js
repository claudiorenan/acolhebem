/**
 * AcolheBem — App with Modal + Tabs + Auth + Gate + Feed
 * Particle system + D3.js hero + animated cards + community feed
 */

// ============================================================
//  PARTICLE SYSTEM (Canvas Background)
// ============================================================
class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: -1000, y: -1000 };
        this.running = true;
        this.colors = ['#2f6f64','#e9b384','#d6336c','#1971c2','#7c3aed'];
        this.resize();
        this._resizeDebounce = null;
        window.addEventListener('resize', () => {
            clearTimeout(this._resizeDebounce);
            this._resizeDebounce = setTimeout(() => this.resize(), 150);
        });
        window.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
        window.addEventListener('touchmove', e => {
            if (e.touches.length > 0) {
                this.mouse.x = e.touches[0].clientX;
                this.mouse.y = e.touches[0].clientY;
            }
        }, { passive: true });
        window.addEventListener('touchend', () => { this.mouse.x = -1000; this.mouse.y = -1000; }, { passive: true });

        // Pause when tab is hidden (saves battery on mobile)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.running = false;
            } else {
                this.running = true;
                this.loop();
            }
        });

        const isMobile = window.innerWidth < 768;
        this.spawn(isMobile ? 25 : 60);
        this.loop();
    }
    resize() {
        this.w = this.canvas.width = window.innerWidth;
        this.h = this.canvas.height = window.innerHeight;
    }
    spawn(n) {
        for (let i = 0; i < n; i++) {
            this.particles.push({
                x: Math.random() * this.w,
                y: Math.random() * this.h,
                r: 1.5 + Math.random() * 3,
                dx: (Math.random() - .5) * .4,
                dy: (Math.random() - .5) * .4,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                alpha: .08 + Math.random() * .12
            });
        }
    }
    loop() {
        if (!this.running) return;
        this.ctx.clearRect(0, 0, this.w, this.h);
        const mx = this.mouse.x, my = this.mouse.y;
        for (const p of this.particles) {
            const ddx = p.x - mx, ddy = p.y - my;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dist < 120) {
                const force = (120 - dist) / 120 * .8;
                p.x += (ddx / dist) * force;
                p.y += (ddy / dist) * force;
            }
            p.x += p.dx; p.y += p.dy;
            if (p.x < -10) p.x = this.w + 10;
            if (p.x > this.w + 10) p.x = -10;
            if (p.y < -10) p.y = this.h + 10;
            if (p.y > this.h + 10) p.y = -10;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fill();
        }
        this.ctx.globalAlpha = .04;
        this.ctx.strokeStyle = '#2f6f64';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const a = this.particles[i], b = this.particles[j];
                const dx = a.x - b.x, dy = a.y - b.y;
                if (dx*dx + dy*dy < 14000) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(a.x, a.y);
                    this.ctx.lineTo(b.x, b.y);
                    this.ctx.stroke();
                }
            }
        }
        this.ctx.globalAlpha = 1;
        requestAnimationFrame(() => this.loop());
    }
}

// ============================================================
//  CONTENT FILTER — blocks contact info in posts/replies
// ============================================================
const ContentFilter = {
    patterns: [
        { regex: /\d{2,3}[\s.\-]?\d{4,5}[\s.\-]?\d{4}/g, type: 'numero de telefone' },
        { regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, type: 'endereco de email' },
        { regex: /(https?:\/\/|www\.)\S+/gi, type: 'link' },
        { regex: /@[a-zA-Z0-9_]{3,}/g, type: 'perfil de rede social' },
        { regex: /(?:whatsapp|wpp|zap|zapzap|instagram|insta|tiktok|telegram)\s*[:.]?\s*\d[\d\s.\-]{6,}/gi, type: 'contato de rede social' },
    ],

    _disabledTypes: new Set(),

    /**
     * Load filter enabled/disabled state from Supabase.
     */
    async loadFromDB() {
        try {
            const sb = window.supabaseClient;
            if (!sb) return;
            const { data, error } = await sb.from('content_filters').select('id, filter_type, enabled');
            if (error || !data) return;
            this._disabledTypes.clear();
            for (const row of data) {
                if (!row.enabled) this._disabledTypes.add(row.filter_type);
            }
        } catch (e) {
            ErrorHandler.handle('ContentFilter.loadFromDB', e, { silent: true });
        }
    },

    /**
     * Check if content contains blocked patterns.
     * @param {string} content
     * @returns {{ blocked: boolean, type: string|null }}
     */
    check(content) {
        for (const p of this.patterns) {
            if (this._disabledTypes.has(p.type)) continue;
            p.regex.lastIndex = 0;
            if (p.regex.test(content)) {
                return { blocked: true, type: p.type };
            }
        }
        return { blocked: false, type: null };
    },

    /**
     * Get a user-friendly error message.
     * @param {string} type
     * @returns {string}
     */
    message(type) {
        return `Sua mensagem contem ${type}. Para sua seguranca, nao e permitido compartilhar dados de contato.`;
    }
};

// ============================================================
//  MAIN APP
// ============================================================
class AcolheBemApp {
    constructor() {
        this.gender = 'women'; // default tab
        this.currentTab = 'women'; // tracks active view: women | men | community | psicologos
        this.data = TOPICS_DATA[this.gender];
        this.currentUser = null;
        this.currentProfile = null;
        this.feedOffset = 0;
        this.feedLoading = false;
        this._pendingGateLink = null;
        this.currentTopicId = null;
        this.currentTopicData = null;
        this.communityFilters = { gender: '', ageRange: '' };
        this._dbTopicsMap = {};
        this._currentCategoryData = null;
        this._backToTab = null;
        this.psiAvailableFetched = false;
        this._membrosData = null;
        this._membrosPostCounts = {};
        this._membrosFilter = 'psi';
        this._membrosSearchTerm = '';
        this._membrosSearchTimer = null;
        this._followingSet = new Set();
        this._followingData = [];
        this._feedSource = 'all'; // 'all' or 'following'
        this._searchActiveTab = 'posts';
        this._searchCache = { posts: [], profiles: [], topics: [] };
        this._dmConversationId = null;
        this._dmOtherUser = null;
        this._dmEnabled = false;
        this.init();
    }

    init() {
        this.$  = id => document.getElementById(id);
        this.$$ = sel => document.querySelectorAll(sel);

        // Initialize global error handler
        ErrorHandler.init();

        // particles
        this.particles = new ParticleSystem(this.$('particleCanvas'));

        // modal gender buttons
        this.$$('.modal-gender-btn').forEach(btn => {
            btn.addEventListener('click', () => this.onModalGenderSelect(btn.dataset.gender));
        });
        this.$('modalSkipBtn').addEventListener('click', () => this.closeModal());

        // tabs
        this.$$('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // index
        this.$('indexBtn').addEventListener('click', () => this.toggleIndex(true));
        this.$('fiClose').addEventListener('click', () => this.toggleIndex(false));
        this.$('fiBackdrop').addEventListener('click', () => this.toggleIndex(false));
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                this.toggleIndex(false);
                this.closeOverlay('authModal');
                this.closeOverlay('profileModal');
                this.closeOverlay('gateModal');
                this.closeOverlay('createTopicModal');
            }
        });

        // scroll observer for mobile
        this.observer = new IntersectionObserver(entries => {
            entries.forEach(en => {
                if (en.isIntersecting) { en.target.classList.add('visible'); this.observer.unobserve(en.target); }
            });
        }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });

        // resize handler for viz
        this._resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                if (this.data && this.currentTab !== 'community' && this.currentTab !== 'psicologos') this.renderHeroViz();
            }, 200);
        });

        // ---- AUTH UI ----
        this.initAuth();

        // ---- PROFILE UI ----
        this.initProfile();

        // ---- PASSWORD GATE UI ----
        this.initGate();

        // ---- FEED UI ----
        this.initFeed();

        // ---- ADMIN UI ----
        this.initAdmin();

        // ---- PSICOLOGOS UI ----
        this.initPsicologos();

        // ---- DM UI ----
        this.initDM();
        this._loadDmFeatureFlag();

        // ---- ENGAGEMENT UI ----
        this._initEngagementUI();

        // load default tab (women)
        this.applyTheme();
        this.buildContent();
        this.renderHeroViz();
        this.revealCards();

        // Load public data (announcements, featured post)
        this._loadAnnouncements();
        this._loadFeaturedPost();
        this._loadFeatureFlags();
    }

    _initEngagementUI() {
        // Report modal
        this.$('reportCancelBtn').addEventListener('click', () => this.$('reportModal').style.display = 'none');
        this.$('reportSubmitBtn').addEventListener('click', () => this.submitReport());

        // Referral modal
        this.$('referralBtn').addEventListener('click', () => this.openReferralModal());
        this.$('referralCopyBtn').addEventListener('click', () => this._copyReferralLink());
        this.$('referralWhatsAppBtn').addEventListener('click', () => this._shareWhatsApp());
        this.$('referralCloseBtn').addEventListener('click', () => this.$('referralModal').style.display = 'none');

        // Announcement close
        this.$('announcementClose').addEventListener('click', () => this.$('announcementBanner').style.display = 'none');

        // Onboarding dismiss
        this.$('onboardingDismiss').addEventListener('click', () => this.$('onboardingOverlay').style.display = 'none');

        // Digest
        this.$('digestBtn').addEventListener('click', () => this._showDigest());
        this.$('digestCloseBtn').addEventListener('click', () => this.$('digestPanel').style.display = 'none');
    }

    async _loadFeatureFlags() {
        try {
            const sb = window.supabaseClient;
            if (!sb) return;
            const { data } = await sb.from('content_filters').select('id, enabled').eq('filter_type', 'feature_flag');
            if (!data) return;
            this._featureFlags = {};
            data.forEach(f => this._featureFlags[f.id] = f.enabled);
            // Apply feature flag UI effects
            const anonToggle = document.querySelector('.anon-toggle');
            if (anonToggle) anonToggle.style.display = this._featureFlags.anonymous_posts !== false ? '' : 'none';
        } catch { /* silent */ }
    }

    // ========================================
    //  AUTH INITIALIZATION
    // ========================================
    initAuth() {
        const loginBtn = this.$('loginBtn');
        const logoutBtn = this.$('logoutBtn');
        const authModal = this.$('authModal');
        const authCloseBtn = this.$('authCloseBtn');

        loginBtn.addEventListener('click', () => this.openOverlay('authModal'));
        authCloseBtn.addEventListener('click', () => this.closeOverlay('authModal'));
        logoutBtn.addEventListener('click', () => this.handleLogout());

        // Auth tab switching
        this.$$('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const isLogin = tab.dataset.authTab === 'login';
                // Block signup tab if registration is closed
                if (!isLogin && this._featureFlags?.open_registration === false) {
                    alert('Os cadastros estao fechados no momento.');
                    return;
                }
                this.$$('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.$('loginForm').style.display = isLogin ? 'flex' : 'none';
                this.$('signupForm').style.display = isLogin ? 'none' : 'flex';
                // Reset psi toggles
                this.$('loginPsiToggle').checked = false;
                this.$('loginPsiHint').style.display = 'none';
                this.$('signupPsiToggle').checked = false;
                this.$('signupPsiPanel').style.display = 'none';
                this.$('signupFieldsWrap').style.display = '';
            });
        });

        // Login form
        this.$('loginForm').addEventListener('submit', e => this.handleLogin(e));

        // Login Psi toggle
        this.$('loginPsiToggle').addEventListener('change', (e) => {
            this.$('loginPsiHint').style.display = e.target.checked ? '' : 'none';
        });

        // Signup Psi toggle
        this.$('signupPsiToggle').addEventListener('change', (e) => {
            const isPsi = e.target.checked;
            this.$('signupPsiPanel').style.display = isPsi ? '' : 'none';
            this.$('signupFieldsWrap').style.display = isPsi ? 'none' : '';
        });

        // Forgot password
        this.$('forgotPasswordBtn').addEventListener('click', () => this.showForgotPassword());
        this.$('backToLoginBtn').addEventListener('click', () => this.showLoginForm());
        this.$('forgotForm').addEventListener('submit', e => this.handleForgotPassword(e));

        // Signup form
        this.$('signupForm').addEventListener('submit', e => this.handleSignup(e));

        // Listen for auth state changes (handles login, logout, and initial session restore)
        this._authReady = false;
        Auth.onAuthChange(async (event, session) => {
            this._authReady = true;
            if (session?.user) {
                this.currentUser = session.user;
                const profile = await Profile.getProfile(session.user.id);
                this.currentProfile = profile;
                this.updateTopbarUser();
                // Init notifications
                Notifications.init(session.user.id);
                this.$('notifBtn').style.display = '';
                // Init DM (only if enabled by admin)
                if (this._dmEnabled) {
                    Messages.init(session.user.id);
                    this.$('dmBtn').style.display = '';
                }
                // Load following cache
                this._loadFollowingCache();
                this.$('followingBtn').style.display = '';
                // Set Sentry user context
                ErrorHandler.setSentryUser(session.user.id, session.user.email);
                // Show admin button
                this.$('adminBtn').style.display = this.currentProfile?.is_admin ? '' : 'none';
                // Check if banned
                if (this._checkBanned()) return;
                // Engagement features
                this.$('referralBtn').style.display = '';
                this._recordCheckIn();
                this._loadDigest();
                this._processReferralCode();
                this._checkOnboarding();
            } else {
                this.currentUser = null;
                this.currentProfile = null;
                this.updateTopbarUser();
                // Destroy notifications
                Notifications.destroy();
                this.$('notifBtn').style.display = 'none';
                // Destroy DM
                Messages.destroy();
                this.$('dmBtn').style.display = 'none';
                this._followingSet = new Set();
                this._followingData = [];
                this.$('followingBtn').style.display = 'none';
                this.$('referralBtn').style.display = 'none';
                this.$('digestBtn').style.display = 'none';
                this.$('streakBar').style.display = 'none';
                // Clear Sentry user context
                ErrorHandler.clearSentryUser();
            }
        });

        // Fallback: if onAuthStateChange doesn't fire within 2s, check manually
        setTimeout(async () => {
            if (!this._authReady) {
                const user = await Auth.getCurrentUser();
                if (user) {
                    this.currentUser = user;
                    this.currentProfile = await Profile.getProfile(user.id);
                    this.updateTopbarUser();
                    Notifications.init(user.id);
                    this.$('notifBtn').style.display = '';
                    if (this._dmEnabled) {
                        Messages.init(user.id);
                        this.$('dmBtn').style.display = '';
                    }
                    this._loadFollowingCache();
                    this.$('followingBtn').style.display = '';
                }
            }
        }, 2000);
    }

    updateTopbarUser() {
        const loginBtn = this.$('loginBtn');
        const userArea = this.$('topbarUser');
        const avatarImg = this.$('topbarAvatar');
        const avatarInitial = this.$('topbarInitial');

        if (this.currentUser && this.currentProfile) {
            loginBtn.style.display = 'none';
            userArea.style.display = 'flex';

            if (this.currentProfile.photo_url) {
                avatarImg.src = this.currentProfile.photo_url;
                avatarImg.style.display = 'block';
                avatarInitial.style.display = 'none';
            } else {
                avatarImg.style.display = 'none';
                avatarInitial.style.display = 'flex';
                avatarInitial.textContent = (this.currentProfile.name || 'U')[0];
            }

            // Update composer avatar
            this.updateComposerAvatar();

            // Show admin button if admin
            this.$('adminBtn').style.display = this.currentProfile.is_admin ? '' : 'none';
        } else if (this.currentUser && !this.currentProfile) {
            // User exists but no profile yet (e.g. email not confirmed, or trigger pending)
            loginBtn.style.display = 'none';
            userArea.style.display = 'flex';
            avatarImg.style.display = 'none';
            avatarInitial.style.display = 'flex';
            avatarInitial.textContent = (this.currentUser.user_metadata?.name || 'U')[0];
        } else {
            loginBtn.style.display = '';
            userArea.style.display = 'none';
            this.$('adminBtn').style.display = 'none';
        }

        // Update community section visibility
        this.updateFeedComposerVisibility();
    }

    async handleLogin(e) {
        e.preventDefault();
        const btn = this.$('loginSubmitBtn');
        const errEl = this.$('loginError');
        errEl.classList.remove('visible');
        errEl.style.color = '';

        // Client-side validation
        const form = this.$('loginForm');
        Validation.clearAll(form);

        const emailField = this.$('loginEmail');
        const passField = this.$('loginPassword');

        const emailResult = Validation.email(emailField.value);
        if (!emailResult.valid) {
            Validation.showFieldError(emailField, emailResult.error);
            errEl.textContent = emailResult.error;
            errEl.classList.add('visible');
            return;
        }
        if (!passField.value) {
            Validation.showFieldError(passField, 'Senha e obrigatoria.');
            errEl.textContent = 'Senha e obrigatoria.';
            errEl.classList.add('visible');
            return;
        }

        btn.disabled = true;

        const email = emailField.value;
        const password = passField.value;
        const isPsi = this.$('loginPsiToggle').checked;

        if (isPsi) {
            // Psi path: authenticate via Cadê Meu Psi
            btn.textContent = 'Verificando no Cade Meu Psi...';
            const { error } = await Auth.signInPsi(email, password);
            btn.disabled = false;
            btn.textContent = 'Entrar';

            if (error) {
                errEl.textContent = error;
                errEl.classList.add('visible');
            } else {
                this.closeOverlay('authModal');
                this.$('loginForm').reset();
                this.$('loginPsiToggle').checked = false;
                this.$('loginPsiHint').style.display = 'none';
            }
        } else {
            // Normal path: Supabase auth
            btn.textContent = 'Entrando...';
            const { error } = await Auth.signIn(email, password);
            btn.disabled = false;
            btn.textContent = 'Entrar';

            if (error) {
                errEl.textContent = error;
                errEl.classList.add('visible');
            } else {
                this.closeOverlay('authModal');
                this.$('loginForm').reset();
            }
        }
    }

    showForgotPassword() {
        this.$('loginForm').style.display = 'none';
        this.$('signupForm').style.display = 'none';
        this.$('forgotForm').style.display = 'flex';
        this.$$('.auth-tabs').forEach(el => el.style.display = 'none');
        this.$('forgotError').classList.remove('visible');
        this.$('forgotSuccess').classList.remove('visible');
        this.$('forgotEmail').value = this.$('loginEmail').value || '';
    }

    showLoginForm() {
        this.$('forgotForm').style.display = 'none';
        this.$('loginForm').style.display = 'flex';
        this.$$('.auth-tabs').forEach(el => el.style.display = '');
        this.$$('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.auth-tab[data-auth-tab="login"]').classList.add('active');
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        const btn = this.$('forgotSubmitBtn');
        const errEl = this.$('forgotError');
        const successEl = this.$('forgotSuccess');
        errEl.classList.remove('visible');
        successEl.classList.remove('visible');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        const email = this.$('forgotEmail').value.trim();
        const { error } = await Auth.resetPassword(email);

        btn.disabled = false;
        btn.textContent = 'Enviar link de recuperacao';

        if (error) {
            errEl.textContent = error;
            errEl.classList.add('visible');
        } else {
            successEl.textContent = 'Link enviado! Verifique sua caixa de entrada e spam.';
            successEl.classList.add('visible');
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        const btn = this.$('signupSubmitBtn');
        const errEl = this.$('signupError');
        const successEl = this.$('signupSuccess');
        errEl.classList.remove('visible');
        if (successEl) successEl.classList.remove('visible');

        // Check feature flag — block if registration is closed
        if (this._featureFlags?.open_registration === false) {
            errEl.textContent = 'Os cadastros estao fechados no momento. Tente novamente mais tarde.';
            errEl.classList.add('visible');
            return;
        }

        // Client-side validation
        const form = this.$('signupForm');
        Validation.clearAll(form);

        const fieldMap = {
            name: this.$('signupName'),
            email: this.$('signupEmail'),
            password: this.$('signupPassword'),
            whatsapp: this.$('signupWhatsapp'),
            bio: this.$('signupBio'),
            birthYear: this.$('signupBirthYear'),
            city: this.$('signupCity'),
        };

        const result = Validation.signup({
            name: fieldMap.name.value,
            email: fieldMap.email.value,
            password: fieldMap.password.value,
            whatsapp: fieldMap.whatsapp.value,
            bio: fieldMap.bio.value,
            birthYear: fieldMap.birthYear.value,
            city: fieldMap.city.value,
        });

        if (!result.valid) {
            const firstError = Validation.applyErrors(result.errors, fieldMap);
            errEl.textContent = firstError;
            errEl.classList.add('visible');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Criando conta...';

        const { error } = await Auth.signUp(
            fieldMap.email.value,
            fieldMap.password.value,
            {
                name: fieldMap.name.value,
                whatsapp: fieldMap.whatsapp.value,
                city: this.$('signupCity').value,
                state: this.$('signupState').value,
                bio: fieldMap.bio.value,
                gender: this.$('signupGender').value || null,
                birth_year: fieldMap.birthYear.value ? parseInt(fieldMap.birthYear.value) : null,
            }
        );

        btn.disabled = false;
        btn.textContent = 'Criar conta';

        if (error) {
            errEl.textContent = error;
            errEl.classList.add('visible');
        } else {
            // Capture email before resetting form
            const signupEmail = this.$('signupEmail').value;
            this.$('signupForm').reset();

            // Switch to login tab with email pre-filled
            this.$$('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.auth-tab[data-auth-tab="login"]').classList.add('active');
            this.$('signupForm').style.display = 'none';
            this.$('loginForm').style.display = 'flex';
            this.$('loginEmail').value = signupEmail;
            this.$('loginPassword').focus();

            // Show success message on login form
            const loginErr = this.$('loginError');
            loginErr.innerHTML = 'Conta criada! Enviamos um e-mail de confirmação para <strong>' + this.escapeHTML(signupEmail) + '</strong>. Verifique sua caixa de entrada e spam antes de fazer login.';
            loginErr.style.color = '#2f6f64';
            loginErr.classList.add('visible');
        }
    }

    async handleLogout() {
        await Auth.signOut();
        this.currentUser = null;
        this.currentProfile = null;
        this.updateTopbarUser();
    }

    // ========================================
    //  PROFILE INITIALIZATION
    // ========================================
    initProfile() {
        const avatarBtn = this.$('avatarBtn');
        const profileCloseBtn = this.$('profileCloseBtn');
        const profileCancelBtn = this.$('profileCancelBtn');
        const profileForm = this.$('profileForm');
        const profileAvatarInput = this.$('profileAvatarInput');
        const profileRemoveAvatar = this.$('profileRemoveAvatar');

        avatarBtn.addEventListener('click', () => this.openProfileModal());
        profileCloseBtn.addEventListener('click', () => this.closeOverlay('profileModal'));
        profileCancelBtn.addEventListener('click', () => this.closeOverlay('profileModal'));

        profileForm.addEventListener('submit', e => this.handleProfileSave(e));

        profileAvatarInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) {
                const check = Validation.avatarFile(file);
                if (!check.valid) {
                    ErrorHandler.showToast(check.error, 'warning');
                    profileAvatarInput.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = ev => {
                    this.$('profileAvatarPreview').innerHTML = `<img src="${ev.target.result}" alt="Preview">`;
                };
                reader.readAsDataURL(file);
            }
        });

        profileRemoveAvatar.addEventListener('click', async () => {
            await Profile.deleteAvatar();
            this.$('profileAvatarPreview').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
            profileRemoveAvatar.style.display = 'none';
            this.currentProfile.photo_url = null;
            this.updateTopbarUser();
        });
    }

    async openProfileModal() {
        if (!this.currentProfile) return;
        const p = this.currentProfile;

        this.$('profileName').value = p.name || '';
        this.$('profileWhatsapp').value = p.whatsapp || '';
        this.$('profileCity').value = p.city || '';
        this.$('profileState').value = p.state || '';
        this.$('profileBio').value = p.bio || '';
        this.$('profileGender').value = p.gender || '';
        this.$('profileBirthYear').value = p.birth_year || '';

        const preview = this.$('profileAvatarPreview');
        const removeBtn = this.$('profileRemoveAvatar');
        if (p.photo_url) {
            preview.innerHTML = `<img src="${p.photo_url}" alt="Avatar">`;
            removeBtn.style.display = '';
        } else {
            preview.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
            removeBtn.style.display = 'none';
        }

        this.$('profileError').classList.remove('visible');
        this.$('profileSuccess').classList.remove('visible');
        Validation.clearAll(this.$('profileForm'));
        this.$('profileAvatarInput').value = '';
        this.openOverlay('profileModal');
    }

    async handleProfileSave(e) {
        e.preventDefault();
        const errEl = this.$('profileError');
        const successEl = this.$('profileSuccess');
        errEl.classList.remove('visible');
        successEl.classList.remove('visible');

        // Client-side validation
        const form = this.$('profileForm');
        Validation.clearAll(form);

        const avatarFile = this.$('profileAvatarInput').files[0];

        const fieldMap = {
            name: this.$('profileName'),
            whatsapp: this.$('profileWhatsapp'),
            bio: this.$('profileBio'),
            birthYear: this.$('profileBirthYear'),
            city: this.$('profileCity'),
            avatar: this.$('profileAvatarInput'),
        };

        const result = Validation.profileEdit({
            name: fieldMap.name.value,
            whatsapp: fieldMap.whatsapp.value,
            bio: fieldMap.bio.value,
            birthYear: fieldMap.birthYear.value,
            city: fieldMap.city.value,
            avatarFile,
        });

        if (!result.valid) {
            const firstError = Validation.applyErrors(result.errors, fieldMap);
            errEl.textContent = firstError;
            errEl.classList.add('visible');
            return;
        }

        const updates = {
            name: fieldMap.name.value,
            whatsapp: fieldMap.whatsapp.value,
            city: this.$('profileCity').value || null,
            state: this.$('profileState').value || null,
            bio: fieldMap.bio.value || null,
            gender: this.$('profileGender').value || null,
            birth_year: fieldMap.birthYear.value ? parseInt(fieldMap.birthYear.value) : null,
        };

        // Handle avatar upload
        if (avatarFile) {
            const upload = await Profile.uploadAvatar(avatarFile);
            if (upload.url) updates.photo_url = upload.url;
        }

        const { data, error } = await Profile.updateProfile(updates);
        if (error) {
            errEl.textContent = error;
            errEl.classList.add('visible');
        } else {
            this.currentProfile = data;
            this.updateTopbarUser();
            successEl.textContent = 'Perfil atualizado com sucesso!';
            successEl.classList.add('visible');
            // Onboarding: set avatar
            if (avatarFile) {
                this._updateOnboarding('set_avatar');
                this._awardBadge('profile_complete');
            }
            setTimeout(() => this.closeOverlay('profileModal'), 1200);
        }
    }

    // ========================================
    //  PASSWORD GATE
    // ========================================
    initGate() {
        this.$('gateCloseBtn').addEventListener('click', () => this.closeOverlay('gateModal'));
        this.$('gateForm').addEventListener('submit', e => this.handleGateSubmit(e));
        this.$('gateSignupBtn').addEventListener('click', () => {
            this.closeOverlay('gateModal');
            this.openOverlay('authModal');
            // Switch to signup tab
            this.$$('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.auth-tab[data-auth-tab="signup"]').classList.add('active');
            this.$('loginForm').style.display = 'none';
            this.$('signupForm').style.display = 'flex';
        });
    }

    getDayPassword() {
        const day = new Date().getDate();
        return String(day + 20);
    }

    openGate(link) {
        this._pendingGateLink = link;
        this.$('gatePassword').value = '';
        this.$('gateError').classList.remove('visible');
        this.$('gateLink').style.display = 'none';
        this.$('gateLink').classList.remove('visible');
        this.openOverlay('gateModal');
    }

    handleGateSubmit(e) {
        e.preventDefault();
        const input = this.$('gatePassword').value.trim();
        const errEl = this.$('gateError');
        errEl.classList.remove('visible');

        if (input === this.getDayPassword()) {
            // Reveal link
            const linkEl = this.$('gateLink');
            linkEl.href = this._pendingGateLink;
            linkEl.classList.add('visible');
            linkEl.style.display = '';
        } else {
            errEl.textContent = 'Senha incorreta. Tente novamente.';
            errEl.classList.add('visible');
        }
    }

    // ========================================
    //  FEED INITIALIZATION
    // ========================================
    initFeed() {
        const composerText = this.$('composerText');
        const postBtn = this.$('postBtn');
        const loadMoreBtn = this.$('feedLoadMore');

        composerText.addEventListener('input', () => {
            postBtn.disabled = !composerText.value.trim();
        });

        postBtn.addEventListener('click', () => this.handleCreatePost());

        loadMoreBtn.addEventListener('click', () => this.loadMorePosts());

        // Notification bell
        this.$('notifBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            Notifications.toggleDropdown();
        });
        this.$('notifMarkAllRead').addEventListener('click', () => {
            Notifications.markAllRead();
        });

        // Feed login button
        this.$('feedLoginBtn').addEventListener('click', () => {
            this.openOverlay('authModal');
        });

        // Back to topics button
        this.$('backToTopicsBtn').addEventListener('click', () => this.handleBackToTopics());

        // Create topic button & modal (optional — button may not exist)
        const createTopicBtn = this.$('createTopicBtn');
        if (createTopicBtn) createTopicBtn.addEventListener('click', () => this.showCreateTopicModal());
        const createTopicCloseBtn = this.$('createTopicCloseBtn');
        if (createTopicCloseBtn) createTopicCloseBtn.addEventListener('click', () => this.closeOverlay('createTopicModal'));
        const createTopicForm = this.$('createTopicForm');
        if (createTopicForm) createTopicForm.addEventListener('submit', e => this.handleCreateTopic(e));

        // Filters
        this.$('filterGender').addEventListener('change', () => this.handleFilterChange());
        this.$('filterAge').addEventListener('change', () => this.handleFilterChange());

        // Feed source tabs (All / Following)
        this.$$('.feed-source-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.$$('.feed-source-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._feedSource = tab.dataset.feedSource;
                this.loadFeed();
            });
        });

        // Following view
        this.$('followingBtn').addEventListener('click', () => this.showFollowingView());
        this.$('backFromFollowingBtn').addEventListener('click', () => this.hideFollowingView());
        this.$$('.following-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.$$('.following-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderFollowingList(tab.dataset.followingTab);
            });
        });

        // User posts view
        this.$('backFromUserPostsBtn').addEventListener('click', () => this.hideUserPostsView());

        // Search
        this.$('searchToggleBtn').addEventListener('click', () => this.showSearch());
        this.$('searchCloseBtn').addEventListener('click', () => this.hideSearch());
        this.$('searchInput').addEventListener('input', (e) => {
            const q = e.target.value.trim();
            this.$('searchHint').style.display = q.length < 2 ? '' : 'none';
            Search.debounce(q, (results) => this.renderSearchResults(results, q));
        });
        this.$$('.search-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.$$('.search-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this._searchActiveTab = tab.dataset.searchTab;
                this.renderSearchResults(this._searchCache, Search._lastQuery);
            });
        });

    }

    updateFeedComposerVisibility() {
        const composer = this.$('feedComposer');
        const loginPrompt = this.$('composerLogin');
        if (this.currentUser) {
            composer.style.display = '';
            loginPrompt.style.display = 'none';
        } else {
            composer.style.display = 'none';
            loginPrompt.style.display = '';
        }
    }

    updateComposerAvatar() {
        const composerAvatar = this.$('composerAvatar');
        if (this.currentProfile && this.currentProfile.photo_url) {
            composerAvatar.innerHTML = `<img src="${this.currentProfile.photo_url}" alt="Avatar">`;
        } else if (this.currentProfile) {
            composerAvatar.innerHTML = `<span style="font-size:.9rem;font-weight:700;color:#2f6f64">${(this.currentProfile.name || 'U')[0].toUpperCase()}</span>`;
        }
    }

    filterPosts(posts) {
        return posts.filter(p => {
            // Anonymous posts don't expose author data for filtering; always show them
            if (p.is_anonymous) return true;
            const author = p.author;
            if (!author) return true;

            if (this.communityFilters.gender && author.gender !== this.communityFilters.gender) return false;

            if (this.communityFilters.ageRange && author.birth_year) {
                const currentYear = new Date().getFullYear();
                const age = currentYear - author.birth_year;
                const range = this.communityFilters.ageRange;
                if (range === '18-25' && (age < 18 || age > 25)) return false;
                if (range === '26-35' && (age < 26 || age > 35)) return false;
                if (range === '36-45' && (age < 36 || age > 45)) return false;
                if (range === '46-60' && (age < 46 || age > 60)) return false;
                if (range === '60+' && age < 60) return false;
            } else if (this.communityFilters.ageRange && !author.birth_year) {
                return false;
            }
            return true;
        });
    }

    async loadFeed() {
        this.feedOffset = 0;
        const feedList = this.$('feedList');
        feedList.innerHTML = '';

        const posts = this._feedSource === 'following'
            ? await Feed.loadFollowingFeed(this.currentTopicId, 20, 0, this._followingSet)
            : await Feed.loadPosts(this.currentTopicId, 20, 0);
        this.feedOffset = posts.length;

        const filtered = this.filterPosts(posts);

        if (filtered.length === 0) {
            this.$('feedEmpty').style.display = '';
            this.$('feedLoadMore').style.display = 'none';
        } else {
            this.$('feedEmpty').style.display = 'none';
            filtered.forEach(p => feedList.appendChild(this.buildPostCard(p)));
            this.$('feedLoadMore').style.display = posts.length >= 20 ? '' : 'none';
        }
    }

    async loadMorePosts() {
        if (this.feedLoading) return;
        this.feedLoading = true;
        const posts = this._feedSource === 'following'
            ? await Feed.loadFollowingFeed(this.currentTopicId, 20, this.feedOffset, this._followingSet)
            : await Feed.loadPosts(this.currentTopicId, 20, this.feedOffset);
        this.feedOffset += posts.length;
        const feedList = this.$('feedList');
        const filtered = this.filterPosts(posts);
        filtered.forEach(p => feedList.appendChild(this.buildPostCard(p)));
        if (posts.length < 20) this.$('feedLoadMore').style.display = 'none';
        this.feedLoading = false;
    }

    async handleCreatePost() {
        const composerText = this.$('composerText');
        const content = composerText.value.trim();
        if (!content) return;

        // Length validation
        const lenCheck = Validation.text(content, 'postContent');
        if (!lenCheck.valid) {
            ErrorHandler.showToast(lenCheck.error, 'warning');
            return;
        }

        // Content filter check
        const filterResult = ContentFilter.check(content);
        if (filterResult.blocked) {
            ErrorHandler.showToast(ContentFilter.message(filterResult.type), 'warning');
            return;
        }

        const postBtn = this.$('postBtn');
        postBtn.disabled = true;

        const anonAllowed = this._featureFlags?.anonymous_posts !== false;
        const isAnonymous = anonAllowed && this.$('anonCheckbox').checked;
        const { post, error } = await Feed.createPost(content, this.currentTopicId, isAnonymous);
        postBtn.disabled = false;

        if (error) {
            ErrorHandler.showToast(error, 'error');
            return;
        }

        composerText.value = '';
        postBtn.disabled = true;
        this.$('anonCheckbox').checked = false;
        this.$('feedEmpty').style.display = 'none';

        const feedList = this.$('feedList');
        feedList.prepend(this.buildPostCard(post));

        // Onboarding & badges: first post
        this._updateOnboarding('made_first_post');
        this._awardBadge('first_post');

        // Notify topic subscribers
        if (this.currentTopicId && post) {
            const actorName = isAnonymous ? 'Alguem' : (this.currentProfile?.name?.split(' ')[0] || 'Alguem');
            Notifications.notifySubscribers(this.currentTopicId, post.id, actorName, 'new_post');
        }
    }

    buildPostCard(post) {
        const card = document.createElement('div');
        card.className = 'feed-post';
        card.dataset.postId = post.id;

        const isAnon = post.is_anonymous;
        const isOwn = this.currentUser && post.user_id === this.currentUser.id;

        let authorName, authorPhoto, initial, avatarHTML, nameHTML;

        if (isAnon && !isOwn) {
            authorName = 'Anonimo';
            avatarHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
            nameHTML = `<span class="feed-post-name">${authorName}</span>`;
        } else if (isAnon && isOwn) {
            authorName = (post.author?.name || 'Voce').split(' ')[0];
            authorPhoto = post.author?.photo_url;
            initial = authorName[0].toUpperCase();
            avatarHTML = authorPhoto
                ? `<img src="${authorPhoto}" alt="${authorName}">`
                : `<span class="avatar-initial">${initial}</span>`;
            nameHTML = `<span class="feed-post-name">${this.escapeHTML(authorName)}</span> <span class="anon-label">(anonimo)</span>`;
        } else {
            authorName = (post.author?.name || 'Usuario').split(' ')[0];
            authorPhoto = post.author?.photo_url;
            initial = authorName[0].toUpperCase();
            avatarHTML = authorPhoto
                ? `<img src="${authorPhoto}" alt="${authorName}">`
                : `<span class="avatar-initial">${initial}</span>`;
            const psiBadge = post.author?.is_psi ? ' <span class="psi-badge">Psi.</span>' : '';
            nameHTML = `<span class="feed-post-name">${this.escapeHTML(authorName)}</span>${psiBadge}`;
        }

        const date = new Date(post.created_at).toLocaleDateString('pt-BR', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        // Reaction icon — show user's reaction type or default heart
        const userReactionType = post.userReactionType || 'like';
        const reactionIcon = post.userReacted
            ? (this._reactionTypes.find(r => r.type === userReactionType)?.icon || '❤️')
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

        const topicTag = post.topics
            ? `<div class="feed-post-topic">${post.topics.emoji || ''} ${this.escapeHTML(post.topics.name || '')}</div>`
            : '';

        // Follow button: show for non-anon, non-own posts when logged in
        const showFollowBtn = this.currentUser && !isAnon && !isOwn;
        const isFollowing = showFollowBtn && this._followingSet.has(post.user_id);
        const followBtnHTML = showFollowBtn
            ? `<button class="follow-btn${isFollowing ? ' following' : ''}" data-user-id="${post.user_id}" title="${isFollowing ? 'Deixar de seguir' : 'Seguir'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16">
                    ${isFollowing
                        ? '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>'
                        : '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>'}
                </svg>
              </button>`
            : '';

        // DM button: show for non-anon, non-own posts when logged in AND DM enabled
        const dmBtnHTML = (showFollowBtn && this._dmEnabled)
            ? `<button class="dm-post-btn" data-user-id="${post.user_id}" data-user-name="${this.escapeHTML(authorName)}" title="Enviar mensagem">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
              </button>`
            : '';

        card.innerHTML = `
            <div class="feed-post-header">
                <div class="feed-post-avatar${isAnon && !isOwn ? ' feed-post-avatar-anon' : ''}">${avatarHTML}</div>
                <div>
                    ${topicTag}
                    <div>${nameHTML}${followBtnHTML}${dmBtnHTML}</div>
                    <div class="feed-post-date">${date}</div>
                </div>
                ${isOwn ? '<button class="feed-post-delete" title="Excluir">excluir</button>' : (this.currentProfile?.is_admin ? '<button class="feed-post-delete admin-delete" title="Excluir (admin)">excluir</button>' : '')}
                ${!isOwn && this.currentUser ? `<button class="feed-post-report" data-post-id="${post.id}" data-preview="${this.escapeHTML(post.content?.substring(0, 60) || '')}" title="Denunciar">denunciar</button>` : ''}
            </div>
            <div class="feed-post-content">${this.escapeHTML(post.content)}</div>
            <div class="feed-post-actions">
                <div class="reaction-wrap">
                    <button class="feed-action-btn like-btn ${post.userReacted ? 'liked' : ''}" data-post-id="${post.id}">
                        <span class="reaction-icon">${reactionIcon}</span>
                        <span class="like-count">${post.reactionCount}</span>
                    </button>
                    ${this._buildReactionPicker(post.id)}
                </div>
                <button class="feed-action-btn reply-toggle-btn" data-post-id="${post.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span class="reply-count">${post.replyCount}</span>
                </button>
                <span class="feed-post-brand">AcolheBem.com.br <span>Plataforma de Acolhimento</span></span>
            </div>
            <div class="feed-replies" style="display:none">
                <div class="replies-list"></div>
                ${this.currentUser ? `
                <div class="feed-reply-form">
                    <input type="text" placeholder="Escreva uma resposta..." maxlength="500">
                    <button>Enviar</button>
                </div>` : ''}
            </div>
        `;

        // Follow button handler
        const followBtn = card.querySelector('.follow-btn');
        if (followBtn) {
            followBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                followBtn.disabled = true;
                const targetUserId = followBtn.dataset.userId;
                const isCurrentlyFollowing = followBtn.classList.contains('following');

                if (isCurrentlyFollowing) {
                    const { error } = await Feed.unfollowUser(targetUserId);
                    if (!error) {
                        this._followingSet.delete(targetUserId);
                        followBtn.classList.remove('following');
                        followBtn.title = 'Seguir';
                        followBtn.querySelector('svg').innerHTML = '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>';
                    }
                } else {
                    const { error } = await Feed.followUser(targetUserId);
                    if (!error) {
                        this._followingSet.add(targetUserId);
                        followBtn.classList.add('following');
                        followBtn.title = 'Deixar de seguir';
                        followBtn.querySelector('svg').innerHTML = '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>';
                        // Notify the followed user
                        const actorName = this.currentProfile?.name || 'Alguem';
                        Notifications.notifyFollow(targetUserId, actorName);
                        // Onboarding: followed someone
                        this._updateOnboarding('followed_someone');
                        this._awardBadge('first_follow');
                    }
                }
                followBtn.disabled = false;
            });
        }

        // DM button handler
        const dmPostBtn = card.querySelector('.dm-post-btn');
        if (dmPostBtn) {
            dmPostBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = dmPostBtn.dataset.userId;
                const userName = dmPostBtn.dataset.userName;
                this.openDMWith(userId, userName);
            });
        }

        // Delete handler
        const deleteBtn = card.querySelector('.feed-post-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Excluir esta publicação?')) return;
                const { error } = await Feed.deletePost(post.id);
                if (!error) card.remove();
            });
        }

        // Report handler
        const reportBtn = card.querySelector('.feed-post-report');
        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                this.openReportModal('post', post.id, post.content);
            });
        }

        // Like handler — quick click toggles default 'like'
        const likeBtn = card.querySelector('.like-btn');
        likeBtn.addEventListener('click', async () => {
            if (!this.currentUser) { this.openOverlay('authModal'); return; }
            const { liked, error } = await Feed.toggleReaction(post.id, 'like');
            if (error) return;
            const countEl = likeBtn.querySelector('.like-count');
            const iconEl = likeBtn.querySelector('.reaction-icon');
            let count = parseInt(countEl.textContent) || 0;
            if (liked) {
                likeBtn.classList.add('liked');
                iconEl.textContent = '❤️';
                countEl.textContent = count + 1;
            } else {
                likeBtn.classList.remove('liked');
                iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
                countEl.textContent = Math.max(0, count - 1);
            }
        });

        // Reaction picker handler — diverse reactions
        const reactionPicker = card.querySelector('.reaction-picker');
        if (reactionPicker) {
            reactionPicker.querySelectorAll('.reaction-pick-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!this.currentUser) { this.openOverlay('authModal'); return; }
                    const rType = btn.dataset.type;
                    const { liked, error } = await Feed.toggleReaction(post.id, rType);
                    if (error) return;
                    const countEl = likeBtn.querySelector('.like-count');
                    const iconEl = likeBtn.querySelector('.reaction-icon');
                    let count = parseInt(countEl.textContent) || 0;
                    if (liked) {
                        likeBtn.classList.add('liked');
                        iconEl.textContent = btn.textContent;
                        countEl.textContent = count + 1;
                    } else {
                        likeBtn.classList.remove('liked');
                        iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
                        countEl.textContent = Math.max(0, count - 1);
                    }
                    reactionPicker.classList.remove('show');
                });
            });
        }

        // Reply toggle handler
        const replyToggleBtn = card.querySelector('.reply-toggle-btn');
        const repliesSection = card.querySelector('.feed-replies');
        let repliesLoaded = false;

        replyToggleBtn.addEventListener('click', async () => {
            const isVisible = repliesSection.style.display !== 'none';
            if (isVisible) {
                repliesSection.style.display = 'none';
                return;
            }
            repliesSection.style.display = '';
            if (!repliesLoaded) {
                const replies = await Feed.loadReplies(post.id);
                const list = repliesSection.querySelector('.replies-list');
                replies.forEach(r => list.appendChild(this.buildReplyEl(r, post.id)));
                repliesLoaded = true;
            }
        });

        // Reply form handler
        const replyForm = card.querySelector('.feed-reply-form');
        if (replyForm) {
            const replyInput = replyForm.querySelector('input');
            const replyBtn = replyForm.querySelector('button');
            replyBtn.addEventListener('click', async () => {
                const content = replyInput.value.trim();
                if (!content) return;

                // Length validation
                const lenCheck = Validation.text(content, 'replyContent');
                if (!lenCheck.valid) {
                    ErrorHandler.showToast(lenCheck.error, 'warning');
                    return;
                }

                // Content filter check
                const filterResult = ContentFilter.check(content);
                if (filterResult.blocked) {
                    ErrorHandler.showToast(ContentFilter.message(filterResult.type), 'warning');
                    return;
                }

                replyBtn.disabled = true;
                const { reply, error } = await Feed.createReply(post.id, content);
                replyBtn.disabled = false;
                if (error) return;
                replyInput.value = '';
                const list = repliesSection.querySelector('.replies-list');
                list.appendChild(this.buildReplyEl(reply, post.id));
                // Update reply count
                const countEl = replyToggleBtn.querySelector('.reply-count');
                countEl.textContent = parseInt(countEl.textContent || '0') + 1;

                // Notify topic subscribers about the reply
                if (this.currentTopicId && reply) {
                    const actorName = this.currentProfile?.name?.split(' ')[0] || 'Alguem';
                    Notifications.notifySubscribers(this.currentTopicId, post.id, actorName, 'new_reply');
                }
            });
        }

        return card;
    }

    buildReplyEl(reply, postId) {
        const div = document.createElement('div');
        div.className = 'feed-reply';
        const isOwn = this.currentUser && reply.user_id === this.currentUser.id;
        const isAnon = reply.is_anonymous;

        let name, photo, initial, avatarHTML, displayName;

        if (isAnon && !isOwn) {
            name = 'Anonimo';
            avatarHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:16px;height:16px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
            displayName = name;
        } else if (isAnon && isOwn) {
            name = (reply.author?.name || 'Voce').split(' ')[0];
            photo = reply.author?.photo_url;
            initial = name[0].toUpperCase();
            avatarHTML = photo
                ? `<img src="${photo}" alt="${name}">`
                : `<span class="avatar-initial">${initial}</span>`;
            displayName = `${this.escapeHTML(name)} <span class="anon-label">(anonimo)</span>`;
        } else {
            name = (reply.author?.name || 'Usuario').split(' ')[0];
            photo = reply.author?.photo_url;
            initial = name[0].toUpperCase();
            avatarHTML = photo
                ? `<img src="${photo}" alt="${name}">`
                : `<span class="avatar-initial">${initial}</span>`;
            const psiBadge = reply.author?.is_psi ? ' <span class="psi-badge">Psi.</span>' : '';
            displayName = this.escapeHTML(name) + psiBadge;
        }

        const date = new Date(reply.created_at).toLocaleDateString('pt-BR', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });

        div.innerHTML = `
            <div class="feed-reply-avatar">${avatarHTML}</div>
            <div class="feed-reply-body">
                <div class="feed-reply-meta">
                    <span class="feed-reply-name">${displayName}</span>
                    <span class="feed-reply-date">${date}</span>
                    ${isOwn ? '<button class="feed-reply-delete" title="Excluir">excluir</button>' : ''}
                </div>
                <div class="feed-reply-text">${this.escapeHTML(reply.content)}</div>
            </div>
        `;

        const deleteBtn = div.querySelector('.feed-reply-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const { error } = await Feed.deleteReply(reply.id);
                if (!error) div.remove();
            });
        }

        return div;
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ========================================
    //  OVERLAY HELPERS
    // ========================================
    openOverlay(id) {
        this.$(id).classList.add('active');
    }
    closeOverlay(id) {
        this.$(id).classList.remove('active');
    }

    // ========================================
    //  MODAL
    // ========================================
    onModalGenderSelect(gender) {
        // highlight selected button
        this.$$('.modal-gender-btn').forEach(b => b.classList.remove('selected'));
        const btn = document.querySelector(`.modal-gender-btn[data-gender="${gender}"]`);
        if (btn) btn.classList.add('selected');

        // switch to chosen tab
        this.switchTab(gender);

        // close modal after brief visual feedback
        setTimeout(() => this.closeModal(), 300);
    }

    closeModal() {
        const modal = this.$('welcomeModal');
        modal.classList.add('closing');
        setTimeout(() => {
            modal.classList.remove('active', 'closing');
            modal.style.display = 'none';
        }, 400);
    }

    // ========================================
    //  TAB SWITCHING
    // ========================================
    switchTab(tab) {
        if (this.currentTab === tab) return;
        this.currentTab = tab;

        // hide admin panel if open
        this.$('adminSection').style.display = 'none';

        // hide DM views if open
        this.$('dmListView').style.display = 'none';
        this.$('dmChatView').style.display = 'none';
        this._dmConversationId = null;

        // update tab buttons
        this.$$('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        if (tab === 'community') {
            this.hidePsicologos();
            this.hideMembros();
            this.showCommunity();
        } else if (tab === 'psicologos') {
            this.hideCommunity();
            this.hideMembros();
            this.showPsicologos();
        } else if (tab === 'membros') {
            this.hideCommunity();
            this.hidePsicologos();
            this.showMembros();
        } else {
            this.hideCommunity();
            this.hidePsicologos();
            this.hideMembros();
            if (this.gender !== tab) {
                this.gender = tab;
                this.data = TOPICS_DATA[tab];
            }
            this.applyTheme();
            this.buildContent();
            this.renderHeroViz();
            this.revealCards();
            this._loadMonthlyPostCounts();
        }
    }

    showCommunity() {
        this.$('mainBody').style.display = 'none';
        this.$('membrosSection').style.display = 'none';
        this.$('communitySection').style.display = '';
        this.applyTheme();

        if (this.currentTopicId) {
            this.showTopicFeed(this.currentTopicId, this.currentTopicData);
        } else {
            this.showTopicsListing();
        }
    }

    hideCommunity() {
        this.$('mainBody').style.display = '';
        this.$('communitySection').style.display = 'none';
    }

    // ========================================
    //  PSICOLOGOS TAB
    // ========================================
    showPsicologos() {
        this.$('mainBody').style.display = 'none';
        this.$('communitySection').style.display = 'none';
        this.$('membrosSection').style.display = 'none';
        this.$('psicologosSection').style.display = '';
        this.applyTheme();

        if (!this.psiAvailableFetched) {
            this.loadPsiAvailable();
        }
    }

    hidePsicologos() {
        this.$('psicologosSection').style.display = 'none';
    }

    // ========================================
    //  MEMBROS TAB
    // ========================================
    showMembros() {
        this.$('mainBody').style.display = 'none';
        this.$('communitySection').style.display = 'none';
        this.$('psicologosSection').style.display = 'none';
        this.$('membrosSection').style.display = '';
        this.applyTheme();

        if (!this._membrosData) {
            this.loadMembrosData();
        }

        // Setup event listeners once
        if (!this._membrosListenersSet) {
            this._membrosListenersSet = true;

            // Sub-tab switching
            this.$$('.membros-tab').forEach(btn => {
                btn.addEventListener('click', () => {
                    this._membrosFilter = btn.dataset.membrosTab;
                    this.$$('.membros-tab').forEach(b => b.classList.toggle('active', b.dataset.membrosTab === this._membrosFilter));
                    this.renderMembros();
                });
            });

            // Search with debounce
            this.$('membrosSearch').addEventListener('input', (e) => {
                clearTimeout(this._membrosSearchTimer);
                this._membrosSearchTimer = setTimeout(() => {
                    this._membrosSearchTerm = e.target.value.trim().toLowerCase();
                    this.renderMembros();
                }, 300);
            });
        }
    }

    hideMembros() {
        this.$('membrosSection').style.display = 'none';
    }

    async loadMembrosData() {
        const loadingEl = this.$('membrosLoading');
        const listEl = this.$('membrosList');
        loadingEl.style.display = '';
        listEl.innerHTML = '';

        try {
            const sb = window.supabaseClient;
            const SUPABASE_URL = sb?.supabaseUrl || 'https://ynsxfifbbqhstlhuilzg.supabase.co';

            // Load psychologists from the API (same as Psicologos tab)
            const psiRes = await fetch(`${SUPABASE_URL}/functions/v1/psi-available?_t=${Date.now()}`, { cache: 'no-store' });
            if (psiRes.ok) {
                const psiData = await psiRes.json();
                this._membrosPsiData = psiData.psychologists || [];
            } else {
                this._membrosPsiData = [];
            }

            // Load psi profiles from DB to map CRP -> user_id for follow
            const { data: psiProfiles, error: psiProfilesErr } = await sb
                .from('profiles')
                .select('id, crp')
                .eq('is_psi', true);

            if (!psiProfilesErr && psiProfiles) {
                this._membrosPsiCrpMap = {};
                psiProfiles.forEach(p => {
                    if (p.crp) {
                        const normalizedCrp = p.crp.replace(/\D/g, '');
                        this._membrosPsiCrpMap[normalizedCrp] = p.id;
                    }
                });
            }

            // Load member profiles (non-psi) from Supabase
            const { data: profiles, error: profilesErr } = await sb
                .from('profiles')
                .select('id, name, photo_url, is_psi, city, state')
                .eq('is_psi', false);

            if (profilesErr) throw profilesErr;

            // Load post counts per user (visible posts only) for follow button logic
            const { data: posts, error: postsErr } = await sb
                .from('posts')
                .select('user_id')
                .eq('status', 'visible');

            if (postsErr) throw postsErr;

            const countMap = {};
            if (posts) {
                posts.forEach(p => {
                    countMap[p.user_id] = (countMap[p.user_id] || 0) + 1;
                });
            }

            this._membrosData = profiles || [];
            this._membrosPostCounts = countMap;

            loadingEl.style.display = 'none';
            this.renderMembros();
        } catch (err) {
            console.error('Error loading membros:', err);
            loadingEl.style.display = 'none';
            listEl.innerHTML = '<div class="psi-state"><span class="psi-state-icon">⚠️</span><p>Nao foi possivel carregar os membros.</p></div>';
        }
    }

    renderMembros() {
        const listEl = this.$('membrosList');
        const filter = this._membrosFilter;
        const search = this._membrosSearchTerm;

        if (filter === 'psi') {
            this._renderMembrosPsi(listEl, search);
        } else {
            this._renderMembrosUsers(listEl, search);
        }
    }

    _renderMembrosPsi(listEl, search) {
        let psiList = this._membrosPsiData || [];
        const currentUserId = this.currentUser?.id;
        const crpMap = this._membrosPsiCrpMap || {};

        if (search) {
            psiList = psiList.filter(p => p.name && p.name.toLowerCase().includes(search));
        }

        if (psiList.length === 0) {
            listEl.innerHTML = '<div class="psi-state"><p>Nenhum psicologo encontrado.</p></div>';
            return;
        }

        listEl.innerHTML = psiList.map(psi => {
            const nameEsc = this.escapeHTML(psi.name);

            // Avatar
            let avatarHTML;
            if (psi.photo) {
                avatarHTML = `<div class="membro-avatar"><img src="${this.escapeHTML(psi.photo)}" alt="${nameEsc}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'membro-avatar-initial\\'>${nameEsc.charAt(0)}</div>'"></div>`;
            } else {
                const initial = (psi.name || '?').charAt(0).toUpperCase();
                avatarHTML = `<div class="membro-avatar-initial">${initial}</div>`;
            }

            // Info
            const crpHTML = psi.crp ? `<span class="membro-meta">CRP ${this.escapeHTML(psi.crp)}</span>` : '';
            const abordHTML = psi.abordagem ? `<span class="membro-meta">${this.escapeHTML(psi.abordagem)}</span>` : '';
            const statusDot = psi.available
                ? '<span style="color:#25d366;font-size:.7rem">● Disponivel</span>'
                : '<span style="color:var(--ink-40);font-size:.7rem">● Ativo</span>';

            // Match API psi to DB profile via CRP for follow button
            let actionHTML = '';
            if (this.currentUser && psi.crp) {
                const normalizedCrp = psi.crp.replace(/\D/g, '');
                const userId = crpMap[normalizedCrp];
                if (userId && userId !== currentUserId) {
                    const isFollowing = this._followingSet.has(userId);
                    actionHTML = `<button class="membro-follow-btn${isFollowing ? ' following' : ''}" data-user-id="${userId}">${isFollowing ? 'Seguindo' : 'Seguir'}</button>`;
                }
            }

            return `<div class="membro-card">
                ${avatarHTML}
                <div class="membro-info">
                    <span class="membro-name">Psi. ${nameEsc}<span class="psi-badge">Psi.</span></span>
                    ${crpHTML}
                    ${abordHTML}
                    ${statusDot}
                </div>
                ${actionHTML}
            </div>`;
        }).join('');

        // Attach follow/unfollow handlers for psi cards
        listEl.querySelectorAll('.membro-follow-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                btn.disabled = true;
                const targetUserId = btn.dataset.userId;
                const isCurrentlyFollowing = btn.classList.contains('following');

                if (isCurrentlyFollowing) {
                    const { error } = await Feed.unfollowUser(targetUserId);
                    if (!error) {
                        this._followingSet.delete(targetUserId);
                        btn.classList.remove('following');
                        btn.textContent = 'Seguir';
                    }
                } else {
                    const { error } = await Feed.followUser(targetUserId);
                    if (!error) {
                        this._followingSet.add(targetUserId);
                        btn.classList.add('following');
                        btn.textContent = 'Seguindo';
                        const actorName = this.currentProfile?.name || 'Alguem';
                        Notifications.notifyFollow(targetUserId, actorName);
                        this._updateOnboarding('followed_someone');
                        this._awardBadge('first_follow');
                    }
                }
                btn.disabled = false;
            });
        });
    }

    _renderMembrosUsers(listEl, search) {
        const currentUserId = this.currentUser?.id;

        let filtered = (this._membrosData || []).filter(m => {
            if (currentUserId && m.id === currentUserId) return false;
            if (search && m.name && !m.name.toLowerCase().includes(search)) return false;
            if (search && !m.name) return false;
            return true;
        });

        // Sort: members with posts first, then alphabetically
        filtered.sort((a, b) => {
            const aCount = this._membrosPostCounts[a.id] || 0;
            const bCount = this._membrosPostCounts[b.id] || 0;
            if (bCount !== aCount) return bCount - aCount;
            return (a.name || '').localeCompare(b.name || '');
        });

        if (filtered.length === 0) {
            listEl.innerHTML = '<div class="psi-state"><p>Nenhum membro encontrado.</p></div>';
            return;
        }

        listEl.innerHTML = filtered.map(m => {
            const postCount = this._membrosPostCounts[m.id] || 0;
            const hasPosts = postCount > 0;
            const isFollowing = this._followingSet.has(m.id);
            const location = [m.city, m.state].filter(Boolean).join(', ');

            let avatarHTML;
            if (m.photo_url) {
                avatarHTML = `<div class="membro-avatar"><img src="${m.photo_url}" alt="${this.escapeHTML(m.name || '')}" loading="lazy"></div>`;
            } else {
                const initial = (m.name || '?').charAt(0).toUpperCase();
                avatarHTML = `<div class="membro-avatar-initial">${initial}</div>`;
            }

            const nameHTML = `<span class="membro-name">${this.escapeHTML(m.name || 'Anonimo')}</span>`;
            const metaHTML = location ? `<span class="membro-meta">${this.escapeHTML(location)}</span>` : '';

            let actionHTML;
            if (!this.currentUser) {
                actionHTML = '';
            } else if (hasPosts) {
                actionHTML = `<button class="membro-follow-btn${isFollowing ? ' following' : ''}" data-user-id="${m.id}">${isFollowing ? 'Seguindo' : 'Seguir'}</button>`;
            } else {
                actionHTML = '<span class="membro-no-follow">Sem publicacoes</span>';
            }

            return `<div class="membro-card">${avatarHTML}<div class="membro-info">${nameHTML}${metaHTML}</div>${actionHTML}</div>`;
        }).join('');

        // Attach follow/unfollow handlers
        listEl.querySelectorAll('.membro-follow-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                btn.disabled = true;
                const targetUserId = btn.dataset.userId;
                const isCurrentlyFollowing = btn.classList.contains('following');

                if (isCurrentlyFollowing) {
                    const { error } = await Feed.unfollowUser(targetUserId);
                    if (!error) {
                        this._followingSet.delete(targetUserId);
                        btn.classList.remove('following');
                        btn.textContent = 'Seguir';
                    }
                } else {
                    const { error } = await Feed.followUser(targetUserId);
                    if (!error) {
                        this._followingSet.add(targetUserId);
                        btn.classList.add('following');
                        btn.textContent = 'Seguindo';
                        const actorName = this.currentProfile?.name || 'Alguem';
                        Notifications.notifyFollow(targetUserId, actorName);
                        this._updateOnboarding('followed_someone');
                        this._awardBadge('first_follow');
                    }
                }
                btn.disabled = false;
            });
        });
    }

    async loadPsiAvailable() {
        const loadingEl = this.$('psiAvailableLoading');
        const errorEl = this.$('psiAvailableError');
        const emptyEl = this.$('psiAvailableEmpty');

        // Show loading, hide others
        loadingEl.style.display = '';
        errorEl.style.display = 'none';
        emptyEl.style.display = 'none';
        this.$('psiAvailSection').style.display = 'none';
        this.$('psiAllSection').style.display = 'none';

        try {
            const SUPABASE_URL = window.supabaseClient?.supabaseUrl || 'https://ynsxfifbbqhstlhuilzg.supabase.co';
            const res = await fetch(`${SUPABASE_URL}/functions/v1/psi-available?_t=${Date.now()}`, {
                cache: 'no-store'
            });

            if (!res.ok) throw new Error('Fetch failed');

            const data = await res.json();
            loadingEl.style.display = 'none';

            if (!data.psychologists || data.psychologists.length === 0) {
                emptyEl.style.display = '';
            } else {
                const available = [];
                const active = [];

                data.psychologists.forEach(p => {
                    if (p.available === true) {
                        available.push(p);
                    } else {
                        active.push(p);
                    }
                });

                if (available.length > 0) {
                    this.renderPsiFeaturedCards(available, this.$('psiAvailGrid'));
                    this.$('psiAvailSection').style.display = '';
                }

                if (active.length > 0) {
                    this.renderPsiCards(active, this.$('psiAllGrid'), false);
                    this.$('psiAllSection').style.display = '';
                }
            }

            this.psiAvailableFetched = true;
        } catch (err) {
            ErrorHandler.handle('app.psiAvailableFetch', err, { silent: true });
            loadingEl.style.display = 'none';
            errorEl.style.display = '';
        }
    }

    renderPsiFeaturedCards(psychologists, grid) {
        grid.innerHTML = '';

        psychologists.forEach((psi, i) => {
            const card = document.createElement('div');
            card.className = 'psi-featured';
            card.style.animationDelay = `${i * 0.08}s`;

            const nameEsc = this.escapeHTML(psi.name);
            const profileUrl = this.escapeHTML(psi.profileUrl);
            const wppMsg = encodeURIComponent(`Oi Psi. ${psi.name}, encontrei o seu perfil na plataforma AcolheBem do Cadê Meu Psi. Gostaria de saber mais sobre o atendimento.`);
            const wppUrl = psi.whatsappNumber
                ? `https://wa.me/${psi.whatsappNumber}?text=${wppMsg}`
                : (psi.whatsappUrl || profileUrl);

            const photoHtml = psi.photo
                ? `<img src="${this.escapeHTML(psi.photo)}" alt="${nameEsc}" class="psi-featured-photo" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';
            const fallbackHtml = `<div class="psi-featured-photo-fallback" ${psi.photo ? 'style="display:none"' : ''}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>`;

            const abordagem = psi.abordagem ? `<span class="psi-featured-tag">${this.escapeHTML(psi.abordagem)}</span>` : '';
            const atendimento = psi.atendimento ? `<span class="psi-featured-tag psi-featured-tag-outline">${this.escapeHTML(psi.atendimento)}</span>` : '';
            const especialidade = psi.especialidade ? `<p class="psi-featured-esp">${this.escapeHTML(psi.especialidade)}</p>` : '';
            const desc = psi.description ? `<p class="psi-featured-desc">${this.escapeHTML(psi.description)}</p>` : '';

            card.innerHTML = `
                <div class="psi-featured-top">
                    ${photoHtml}
                    ${fallbackHtml}
                    <div class="psi-featured-info">
                        <div class="psi-featured-name">Psi. ${nameEsc}</div>
                        ${psi.crp ? `<div class="psi-featured-crp">CRP ${this.escapeHTML(psi.crp)}</div>` : ''}
                        <div class="psi-featured-status">
                            <span class="psi-featured-status-dot"></span>
                            Disponivel hoje
                        </div>
                    </div>
                </div>
                <div class="psi-featured-tags">
                    ${abordagem}${atendimento}
                </div>
                ${especialidade}
                ${desc}
                <a href="${wppUrl}" target="_blank" rel="noopener noreferrer" class="psi-featured-btn psi-featured-btn-wpp">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Chamar psicólogo no WhatsApp
                </a>
                <div class="psi-featured-actions">
                    <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="psi-featured-btn psi-featured-btn-acessivel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                        Terapia Acessível
                    </a>
                    <button class="psi-featured-btn psi-featured-btn-site" disabled>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Ver Site (Psicólogo sem site)
                    </button>
                </div>
            `;

            grid.appendChild(card);
        });
    }

    renderPsiCards(psychologists, grid, isAvailable) {
        grid.innerHTML = '';

        psychologists.forEach((psi, i) => {
            const card = document.createElement('div');
            card.className = 'psi-card';
            card.style.animationDelay = `${i * 0.06}s`;

            const profileUrl = this.escapeHTML(psi.profileUrl);
            const nameEsc = this.escapeHTML(psi.name);
            const wppMsg = encodeURIComponent(`Oi Psi. ${psi.name}, encontrei o seu perfil na plataforma AcolheBem do Cadê Meu Psi. Gostaria de saber mais sobre o atendimento.`);
            const wppUrl = psi.whatsappNumber
                ? `https://wa.me/${psi.whatsappNumber}?text=${wppMsg}`
                : (psi.whatsappUrl || profileUrl);

            const photoHtml = psi.photo
                ? `<img src="${this.escapeHTML(psi.photo)}" alt="${nameEsc}" class="psi-card-avatar" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';

            const fallbackHtml = `<div class="psi-card-avatar-fallback" ${psi.photo ? 'style="display:none"' : ''}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>`;

            const crpHtml = psi.crp ? `<span class="psi-card-crp">CRP ${this.escapeHTML(psi.crp)}</span>` : '';

            const abordagemHtml = psi.abordagem
                ? `<div class="psi-card-detail"><span class="psi-card-detail-label">Abordagem:</span> <span class="psi-card-detail-value">${this.escapeHTML(psi.abordagem)}</span></div>`
                : '';

            const atendimentoHtml = psi.atendimento
                ? `<div class="psi-card-detail"><span class="psi-card-detail-label">Atendimento:</span> <span class="psi-card-detail-text">${this.escapeHTML(psi.atendimento)}</span></div>`
                : '';

            const especialidadeHtml = psi.especialidade
                ? `<div class="psi-card-detail"><span class="psi-card-detail-label">Especialidade:</span> <span class="psi-card-detail-text">${this.escapeHTML(psi.especialidade)}</span></div>`
                : '';

            const descHtml = psi.description
                ? `<p class="psi-card-detail-desc">${this.escapeHTML(psi.description)}</p>`
                : '';

            card.innerHTML = `
                <div class="psi-card-header" role="button" tabindex="0" aria-expanded="false">
                    <div class="psi-card-top">
                        ${photoHtml}
                        ${fallbackHtml}
                        <div class="psi-card-body">
                            <div class="psi-card-name">Psi. ${nameEsc}</div>
                            ${crpHtml}
                            <div class="psi-card-status${isAvailable ? '' : ' psi-card-status-active'}">
                                <span class="psi-card-status-dot"></span>
                                ${isAvailable ? 'Disponível hoje' : 'Ativo'}
                            </div>
                        </div>
                    </div>
                    <div class="psi-card-chevron">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                </div>
                <div class="psi-card-expand">
                    <div class="psi-card-expand-inner">
                        ${abordagemHtml}
                        ${atendimentoHtml}
                        ${especialidadeHtml}
                        ${descHtml}
                        <a href="${wppUrl}" target="_blank" rel="noopener noreferrer" class="psi-card-btn psi-card-btn-wpp" onclick="event.stopPropagation()">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            Chamar psicólogo no WhatsApp
                        </a>
                        <div class="psi-card-actions">
                            <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="psi-card-btn psi-card-btn-acessivel" onclick="event.stopPropagation()">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                                Terapia Acessível
                            </a>
                            <button class="psi-card-btn psi-card-btn-site" disabled onclick="event.stopPropagation()">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                Ver Site (Psicólogo sem site)
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Accordion toggle
            const header = card.querySelector('.psi-card-header');
            const toggleCard = () => {
                const isOpen = card.classList.contains('open');
                // Close all other cards
                grid.querySelectorAll('.psi-card.open').forEach(c => {
                    if (c !== card) {
                        c.classList.remove('open');
                        c.querySelector('.psi-card-header')?.setAttribute('aria-expanded', 'false');
                    }
                });
                card.classList.toggle('open', !isOpen);
                header.setAttribute('aria-expanded', String(!isOpen));
            };
            header.addEventListener('click', toggleCard);
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCard();
                }
            });

            grid.appendChild(card);
        });
    }

    initPsicologos() {
        this.$('psiRetryBtn').addEventListener('click', () => {
            this.psiAvailableFetched = false;
            this.loadPsiAvailable();
        });

    }

    showTopicsListing() {
        this.$('topicsView').style.display = '';
        this.$('topicFeedView').style.display = 'none';
        this.$('followingView').style.display = 'none';
        this.$('userPostsView').style.display = 'none';
        this.$('dmListView').style.display = 'none';
        this.$('dmChatView').style.display = 'none';
        this.currentTopicId = null;
        this.currentTopicData = null;

        const topicsList = this.$('topicsList');
        topicsList.innerHTML = '';

        // Load DB topics in background (non-blocking)
        Feed.loadTopics().then(dbTopics => {
            this._dbTopicsMap = {};
            dbTopics.forEach(t => { this._dbTopicsMap[t.slug] = t; });
            this._loadMonthlyPostCounts();
        });

        // Render Feminino section
        const femLabel = document.createElement('div');
        femLabel.className = 'topics-section-label topics-section-fem';
        femLabel.innerHTML = `<svg class="topics-section-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="24" cy="16" r="10"/><line x1="24" y1="26" x2="24" y2="40"/><line x1="18" y1="34" x2="30" y2="34"/></svg> Feminino`;
        topicsList.appendChild(femLabel);

        TOPICS_DATA.women.categories.forEach(cat => {
            topicsList.appendChild(this.buildTopicPage(cat, 'women'));
        });

        // Render Masculino section
        const mascLabel = document.createElement('div');
        mascLabel.className = 'topics-section-label topics-section-masc';
        mascLabel.innerHTML = `<svg class="topics-section-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="19" cy="28" r="10"/><line x1="26" y1="21" x2="38" y2="9"/><polyline points="30,9 38,9 38,17"/></svg> Masculino`;
        topicsList.appendChild(mascLabel);

        TOPICS_DATA.men.categories.forEach(cat => {
            topicsList.appendChild(this.buildTopicPage(cat, 'men'));
        });
    }

    _slugify(str) {
        return str.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    async _loadMonthlyPostCounts() {
        try {
            const sb = window.supabaseClient;
            if (!sb || !this._dbTopicsMap || Object.keys(this._dbTopicsMap).length === 0) return;

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const { data, error } = await sb
                .from('posts')
                .select('topic_id')
                .eq('status', 'visible')
                .gte('created_at', startOfMonth);

            if (error || !data) return;

            const countsByTopicId = {};
            data.forEach(p => {
                if (p.topic_id) countsByTopicId[p.topic_id] = (countsByTopicId[p.topic_id] || 0) + 1;
            });

            const cats = this.data.categories;
            const gender = this.gender;
            cats.forEach(c => {
                const slug = this._slugify(c.title) + '-' + gender;
                const dbTopic = this._dbTopicsMap[slug];
                const count = dbTopic ? (countsByTopicId[dbTopic.id] || 0) : 0;

                const label = count > 0 ? count + ' posts no mês' : c.subtopics.length + ' subtemas';

                const fiEl = document.getElementById('fi-count-' + c.id);
                if (fiEl) fiEl.textContent = label;

                const heroEl = document.getElementById('hero-count-' + c.id);
                if (heroEl) heroEl.textContent = label;
            });
        } catch (err) {
            console.warn('_loadMonthlyPostCounts error:', err);
        }
    }

    buildTopicPage(cat, gender) {
        const slug = this._slugify(cat.title) + '-' + gender;
        const dbTopic = this._dbTopicsMap[slug];

        const page = document.createElement('div');
        page.className = 'topic-page';
        if (!this.currentUser) page.classList.add('tp-locked');

        const lockIcon = !this.currentUser ? '<span class="tp-lock">🔒</span>' : '';
        const ctaText = 'Clique para entrar';

        page.innerHTML = `
            <div class="tp-header" style="background:${cat.colorLight}">
                <span class="tp-emoji">${cat.icon}</span>
                <h3 class="tp-title">${this.escapeHTML(cat.title)}</h3>
                ${lockIcon}
            </div>
            <div class="tp-cta">${ctaText}</div>
        `;

        // Add subscribe bell on the topic card (only for logged-in users)
        if (this.currentUser) {
            this._addTopicCardBell(page, slug, cat, gender);
        }

        page.addEventListener('click', async (e) => {
            // Don't navigate if clicking the bell
            if (e.target.closest('.tp-bell')) return;
            if (!this.currentUser) {
                this.openOverlay('authModal');
                return;
            }
            let topicData;
            if (dbTopic) {
                topicData = dbTopic;
            } else {
                const { topic } = await Feed.createTopicAuto(cat.title, cat.icon, cat.description, slug, cat.color, gender);
                if (topic) {
                    topicData = topic;
                    this._dbTopicsMap[slug] = topic;
                } else {
                    topicData = { id: null, name: cat.title, emoji: cat.icon, slug, description: cat.description, color: cat.color, post_count: 0 };
                }
            }
            this.currentTopicId = topicData.id;
            this.currentTopicData = { ...topicData, emoji: cat.icon, name: cat.title };
            this._currentCategoryData = cat;
            this.showTopicFeed(topicData.id, { emoji: cat.icon, name: cat.title });
        });

        return page;
    }

    async _addTopicCardBell(page, slug, cat, gender) {
        const bell = document.createElement('button');
        bell.className = 'tp-bell';
        bell.setAttribute('aria-label', 'Ativar notificacoes');
        bell.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
        `;
        page.style.position = 'relative';
        page.appendChild(bell);

        // Resolve topic ID (may need to wait for DB topics to load)
        const resolveTopicId = async () => {
            let dbTopic = this._dbTopicsMap[slug];
            if (dbTopic) return dbTopic.id;
            // If not loaded yet, create/find it
            const { topic } = await Feed.createTopicAuto(cat.title, cat.icon, cat.description, slug, cat.color, gender);
            if (topic) {
                this._dbTopicsMap[slug] = topic;
                return topic.id;
            }
            return null;
        };

        // Check subscription state once DB topics are loaded
        const checkState = async () => {
            const topicId = this._dbTopicsMap[slug]?.id;
            if (!topicId) return;
            const subscribed = await Feed.isSubscribed(topicId);
            if (subscribed) {
                bell.classList.add('active');
                bell.querySelector('svg').setAttribute('fill', 'currentColor');
            }
        };
        // Delay check slightly to let DB topics load
        setTimeout(() => checkState(), 800);

        bell.addEventListener('click', async (e) => {
            e.stopPropagation();
            bell.disabled = true;

            const topicId = await resolveTopicId();
            if (!topicId) { bell.disabled = false; return; }

            const isActive = bell.classList.contains('active');

            if (isActive) {
                const { error } = await Feed.unsubscribeTopic(topicId);
                if (!error) {
                    bell.classList.remove('active');
                    bell.querySelector('svg').setAttribute('fill', 'none');
                }
            } else {
                await Notifications.requestBrowserPermission();
                const { error } = await Feed.subscribeTopic(topicId);
                if (!error) {
                    bell.classList.add('active');
                    bell.querySelector('svg').setAttribute('fill', 'currentColor');
                }
            }
            bell.disabled = false;
        });
    }

    async showTopicFeed(topicId, topicData) {
        this.$('topicsView').style.display = 'none';
        this.$('topicFeedView').style.display = '';
        this.$('followingView').style.display = 'none';
        this.$('userPostsView').style.display = 'none';
        this.$('dmListView').style.display = 'none';
        this.$('dmChatView').style.display = 'none';
        this.$('topicFeedTitle').innerHTML = `<span>${topicData.emoji}</span> ${this.escapeHTML(topicData.name)}`;
        this._renderSubscribeBtn(topicId);
        this.updateFeedComposerVisibility();
        this.communityFilters = { gender: '', ageRange: '' };
        this.$('filterGender').value = '';
        this.$('filterAge').value = '';
        this.$('anonCheckbox').checked = false;
        this._feedSource = 'all';
        this.$$('.feed-source-tab').forEach(t => t.classList.toggle('active', t.dataset.feedSource === 'all'));
        // Show feed source tabs only when logged in and following someone
        this.$('feedSourceTabs').style.display = (this.currentUser && this._followingSet.size > 0) ? '' : 'none';

        // Onboarding: chose a topic
        this._updateOnboarding('chose_topic');

        // Populate topic summary if category data is available
        const summary = this.$('topicSummary');
        const catData = this._currentCategoryData;
        if (catData) {
            summary.style.display = '';
            this.$('topicSummaryDesc').textContent = catData.description || '';

            const tagsEl = this.$('topicSummaryTags');
            tagsEl.innerHTML = '';
            if (catData.subtopics && catData.subtopics.length > 0) {
                catData.subtopics.forEach(s => {
                    const tag = document.createElement('span');
                    tag.className = 'sub-tag';
                    tag.innerHTML = `<span class="sub-tag-emoji">${s.emoji}</span>${this.escapeHTML(s.name)}`;
                    tagsEl.appendChild(tag);
                });
            }

            const wppBtn = this.$('topicSummaryWpp');
            if (this.currentUser && catData.link && catData.link !== '#') {
                wppBtn.href = catData.link;
                wppBtn.style.display = '';
                wppBtn.onclick = null;
            } else {
                wppBtn.style.display = 'none';
            }

            // Apply color accent
            if (catData.color) {
                summary.style.borderLeftColor = catData.color;
            }
        } else {
            summary.style.display = 'none';
        }

        await this.loadFeed();
    }

    async _renderSubscribeBtn(topicId) {
        // Remove existing subscribe button if any
        const existing = document.querySelector('.topic-subscribe-btn');
        if (existing) existing.remove();

        if (!this.currentUser || !topicId) return;

        const header = this.$('topicFeedTitle');
        if (!header) return;

        const btn = document.createElement('button');
        btn.className = 'topic-subscribe-btn';
        btn.disabled = true;
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span>Notificar</span>
        `;

        header.parentElement.appendChild(btn);

        // Check current subscription state
        const subscribed = await Feed.isSubscribed(topicId);
        btn.disabled = false;
        this._updateSubscribeBtn(btn, subscribed);

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const isCurrentlySubscribed = btn.classList.contains('subscribed');

            if (isCurrentlySubscribed) {
                const { error } = await Feed.unsubscribeTopic(topicId);
                if (!error) this._updateSubscribeBtn(btn, false);
            } else {
                // Request browser notification permission on first subscribe
                await Notifications.requestBrowserPermission();
                const { error } = await Feed.subscribeTopic(topicId);
                if (!error) this._updateSubscribeBtn(btn, true);
            }
            btn.disabled = false;
        });
    }

    _updateSubscribeBtn(btn, subscribed) {
        if (subscribed) {
            btn.classList.add('subscribed');
            btn.querySelector('span').textContent = 'Notificando';
            btn.querySelector('svg').setAttribute('fill', 'currentColor');
        } else {
            btn.classList.remove('subscribed');
            btn.querySelector('span').textContent = 'Notificar';
            btn.querySelector('svg').setAttribute('fill', 'none');
        }
    }

    // ========================================
    //  FOLLOW / FOLLOWING
    // ========================================

    async _loadFollowingCache() {
        try {
            const follows = await Feed.getFollowing();
            this._followingData = follows;
            this._followingSet = new Set(follows.map(f => f.following_id));
        } catch (e) {
            ErrorHandler.handle('app._loadFollowingCache', e, { silent: true });
        }
    }

    showFollowingView() {
        this.$('topicsView').style.display = 'none';
        this.$('topicFeedView').style.display = 'none';
        this.$('userPostsView').style.display = 'none';
        this.$('dmListView').style.display = 'none';
        this.$('dmChatView').style.display = 'none';
        this.$('followingView').style.display = '';

        // Reset to "users" tab
        this.$$('.following-tab').forEach(t => t.classList.toggle('active', t.dataset.followingTab === 'users'));

        // Reload cache then render
        this._loadFollowingCache().then(() => this.renderFollowingList('users'));

        // Load follow counts
        this._updateFollowCounts();
    }

    async _updateFollowCounts() {
        if (!this.currentUser) return;
        const counts = await Feed.getFollowCounts(this.currentUser.id);
        const followingEl = this.$('followingCount');
        const followersEl = this.$('followersCount');
        if (followingEl) followingEl.textContent = counts.following;
        if (followersEl) followersEl.textContent = counts.followers;
    }

    // ===== SEARCH =====

    showSearch() {
        this.$('searchView').style.display = '';
        this.$('mainBody').style.display = 'none';
        this.$('communitySection')  && (this.$('communitySection').style.display = 'none');
        this.$('psicologosSection') && (this.$('psicologosSection').style.display = 'none');
        this.$('searchInput').value = '';
        this.$('searchResults').innerHTML = '';
        this.$('searchEmpty').style.display = 'none';
        this.$('searchHint').style.display = '';
        this._searchActiveTab = 'posts';
        this.$$('.search-tab').forEach(t => t.classList.toggle('active', t.dataset.searchTab === 'posts'));
        setTimeout(() => this.$('searchInput').focus(), 100);
    }

    hideSearch() {
        this.$('searchView').style.display = 'none';
        Search.clearCache();
        // Restore the current tab view
        this.switchTab(this.currentTab);
    }

    renderSearchResults(results, query) {
        this._searchCache = results;
        const container = this.$('searchResults');
        const empty = this.$('searchEmpty');
        container.innerHTML = '';

        const tab = this._searchActiveTab;
        const items = results[tab] || [];

        if (!query || query.length < 2) {
            empty.style.display = 'none';
            return;
        }

        if (items.length === 0) {
            empty.style.display = '';
            return;
        }
        empty.style.display = 'none';

        if (tab === 'posts') {
            items.forEach(p => {
                const div = document.createElement('div');
                div.className = 'search-result-post';
                const excerpt = Search.excerpt(p.content, query, 200);
                div.innerHTML = `
                    <div class="search-result-post-header">
                        <span class="search-result-post-author">${this.escapeHTML(p.author_name)}</span>
                        ${p.topic_name ? `<span class="search-result-post-topic">${p.topic_emoji || ''} ${this.escapeHTML(p.topic_name)}</span>` : ''}
                    </div>
                    <div class="search-result-post-content">${Search.highlight(excerpt, query)}</div>
                `;
                div.addEventListener('click', () => {
                    this.hideSearch();
                    if (p.topic_id) {
                        const topicData = this._dbTopicsMap?.[p.topic_id] || { name: p.topic_name, emoji: p.topic_emoji };
                        this.switchTab('community');
                        this.showTopicFeed(p.topic_id, topicData);
                    }
                });
                container.appendChild(div);
            });
        } else if (tab === 'profiles') {
            items.forEach(p => {
                const div = document.createElement('div');
                div.className = 'search-result-profile';
                const initial = (p.name || 'U')[0].toUpperCase();
                const avatarHTML = p.photo_url
                    ? `<img src="${p.photo_url}" alt="${this.escapeHTML(p.name)}">`
                    : initial;
                const psiBadge = p.is_psi ? ' <span class="psi-badge">Psi.</span>' : '';
                const bioHTML = p.bio ? `<div class="search-result-profile-bio">${Search.highlight(Search.excerpt(p.bio, query, 80), query)}</div>` : '';
                div.innerHTML = `
                    <div class="search-result-profile-avatar">${avatarHTML}</div>
                    <div class="search-result-profile-info">
                        <div class="search-result-profile-name">${Search.highlight(p.name, query)}${psiBadge}</div>
                        ${bioHTML}
                    </div>
                `;
                div.addEventListener('click', () => {
                    this.hideSearch();
                    this.switchTab('community');
                    this.showUserPosts(p.id, p.name);
                });
                container.appendChild(div);
            });
        } else if (tab === 'topics') {
            items.forEach(t => {
                const div = document.createElement('div');
                div.className = 'search-result-topic';
                div.innerHTML = `
                    <span class="search-result-topic-emoji">${t.emoji || '💬'}</span>
                    <div class="search-result-topic-info">
                        <div class="search-result-topic-name">${Search.highlight(t.name, query)}</div>
                        ${t.description ? `<div class="search-result-topic-desc">${this.escapeHTML(t.description)}</div>` : ''}
                    </div>
                    <span class="search-result-topic-count">${t.post_count || 0} posts</span>
                `;
                div.addEventListener('click', () => {
                    this.hideSearch();
                    this.switchTab('community');
                    this.showTopicFeed(t.id, { name: t.name, emoji: t.emoji });
                });
                container.appendChild(div);
            });
        }
    }

    hideFollowingView() {
        this.$('followingView').style.display = 'none';
        this.$('topicsView').style.display = '';
    }

    renderFollowingList(filter) {
        const list = this.$('followingList');
        const empty = this.$('followingEmpty');
        list.innerHTML = '';

        const filtered = filter === 'psi'
            ? this._followingData.filter(f => f.is_psi)
            : this._followingData.filter(f => !f.is_psi);

        if (filtered.length === 0) {
            empty.style.display = '';
            return;
        }
        empty.style.display = 'none';

        filtered.forEach(f => {
            const card = document.createElement('div');
            card.className = 'following-user-card';

            const initial = (f.name || 'U')[0].toUpperCase();
            const avatarHTML = f.photo_url
                ? `<img src="${f.photo_url}" alt="${this.escapeHTML(f.name)}" class="following-user-avatar">`
                : `<div class="following-user-avatar following-user-avatar-initial">${initial}</div>`;

            const psiBadge = f.is_psi ? '<span class="psi-badge">Psi.</span>' : '';

            card.innerHTML = `
                ${avatarHTML}
                <div class="following-user-info">
                    <span class="following-user-name">${this.escapeHTML(f.name)}${psiBadge}</span>
                </div>
                <button class="follow-btn following" data-user-id="${f.following_id}" title="Deixar de seguir">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>
                    </svg>
                </button>
            `;

            // Click card to see user's posts
            card.addEventListener('click', (e) => {
                if (e.target.closest('.follow-btn')) return;
                this.showUserPosts(f.following_id, f.name);
            });

            // Unfollow button
            const unfollowBtn = card.querySelector('.follow-btn');
            unfollowBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                unfollowBtn.disabled = true;
                const { error } = await Feed.unfollowUser(f.following_id);
                if (!error) {
                    this._followingSet.delete(f.following_id);
                    this._followingData = this._followingData.filter(x => x.following_id !== f.following_id);
                    card.remove();
                    // Re-check empty state
                    const currentFilter = document.querySelector('.following-tab.active')?.dataset.followingTab || 'users';
                    const remaining = currentFilter === 'psi'
                        ? this._followingData.filter(x => x.is_psi)
                        : this._followingData.filter(x => !x.is_psi);
                    if (remaining.length === 0) this.$('followingEmpty').style.display = '';
                }
                unfollowBtn.disabled = false;
            });

            list.appendChild(card);
        });
    }

    async showUserPosts(userId, userName) {
        this.$('followingView').style.display = 'none';
        this.$('topicsView').style.display = 'none';
        this.$('topicFeedView').style.display = 'none';
        this.$('dmListView').style.display = 'none';
        this.$('dmChatView').style.display = 'none';
        this.$('userPostsView').style.display = '';

        this.$('userPostsTitle').textContent = `Posts de ${userName}`;
        const postsList = this.$('userPostsList');
        const empty = this.$('userPostsEmpty');
        postsList.innerHTML = '<div class="feed-loading">Carregando...</div>';
        empty.style.display = 'none';

        const posts = await Feed.loadUserPosts(userId);
        postsList.innerHTML = '';

        if (posts.length === 0) {
            empty.style.display = '';
            return;
        }

        posts.forEach(p => postsList.appendChild(this.buildPostCard(p)));
    }

    hideUserPostsView() {
        this.$('userPostsView').style.display = 'none';
        // Go back to following view
        this.$('followingView').style.display = '';
    }

    handleBackToTopics() {
        this.currentTopicId = null;
        this.currentTopicData = null;
        this._currentCategoryData = null;
        if (this._backToTab) {
            this.switchTab(this._backToTab);
            this._backToTab = null;
        } else {
            this.showTopicsListing();
        }
    }

    handleFilterChange() {
        this.communityFilters.gender = this.$('filterGender').value;
        this.communityFilters.ageRange = this.$('filterAge').value;
        this.loadFeed();
    }

    showCreateTopicModal() {
        if (!this.currentUser) {
            this.openOverlay('authModal');
            return;
        }
        // Check feature flag — admins can always create
        if (this._featureFlags?.member_topic_creation === false && !this.currentProfile?.is_admin) {
            alert('A criacao de novos temas esta desabilitada no momento.');
            return;
        }
        this.$('createTopicForm').reset();
        this.$('createTopicError').classList.remove('visible');
        this.openOverlay('createTopicModal');
    }

    async handleCreateTopic(e) {
        e.preventDefault();
        const btn = this.$('createTopicSubmitBtn');
        const errEl = this.$('createTopicError');
        errEl.classList.remove('visible');

        // Client-side validation
        const form = this.$('createTopicForm');
        Validation.clearAll(form);

        const nameField = this.$('topicName');
        const emojiField = this.$('topicEmoji');
        const descField = this.$('topicDescription');

        const fieldMap = { name: nameField, emoji: emojiField, description: descField };
        const result = Validation.topicCreate({
            name: nameField.value.trim(),
            emoji: emojiField.value.trim(),
            description: descField.value.trim(),
        });

        if (!result.valid) {
            const firstError = Validation.applyErrors(result.errors, fieldMap);
            errEl.textContent = firstError;
            errEl.classList.add('visible');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Criando...';

        const name = nameField.value.trim();
        const emoji = emojiField.value.trim() || '💬';
        const description = descField.value.trim();

        const { topic, error } = await Feed.createTopic(name, emoji, description);
        btn.disabled = false;
        btn.textContent = 'Criar tema';

        if (error) {
            errEl.textContent = error;
            errEl.classList.add('visible');
            return;
        }

        this.closeOverlay('createTopicModal');
        // Navigate into the new topic
        this.currentTopicId = topic.id;
        this.currentTopicData = topic;
        this.showTopicFeed(topic.id, topic);
    }

    applyTheme() {
        const screen = this.$('mainScreen');
        screen.classList.remove('theme-women', 'theme-men');
        if (this.currentTab === 'community' || this.currentTab === 'psicologos') {
            // neutral theme for community and psicologos
        } else {
            screen.classList.add(this.gender === 'women' ? 'theme-women' : 'theme-men');
        }
    }

    // ========================================
    //  BUILD CONTENT
    // ========================================
    buildContent() {
        this.buildIndex(this.data.categories);
        this.buildCards(this.data.categories);
    }

    buildIndex(cats) {
        const ul = this.$('fiList');
        ul.innerHTML = '';

        cats.forEach(c => {
            const li = document.createElement('li');
            li.className = 'fi-item';
            li.innerHTML = `
                <span class="fi-num" style="background:${c.color}">${c.id}</span>
                <div class="fi-label">
                    <div class="fi-title">${c.icon} ${c.title}</div>
                    <div class="fi-count" id="fi-count-${c.id}">${c.subtopics.length} subtemas</div>
                </div>`;
            li.onclick = () => {
                this.toggleIndex(false);
                const el = this.$('topic-' + c.id);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('visible');
                    el.style.borderColor = c.color;
                    setTimeout(() => el.style.borderColor = '', 2000);
                }
            };
            ul.appendChild(li);
        });

        // Separator
        const sep = document.createElement('li');
        sep.className = 'fi-separator';
        sep.innerHTML = '<hr>';
        ul.appendChild(sep);

        // General group
        const generalLi = document.createElement('li');
        generalLi.className = 'fi-item';
        generalLi.innerHTML = `
            <span class="fi-num" style="background:var(--emerald)">💚</span>
            <div class="fi-label">
                <div class="fi-title">Quem Cuida de Quem Cuida</div>
                <div class="fi-count">Grupo geral de acolhimento</div>
            </div>`;
        generalLi.onclick = () => {
            this.toggleIndex(false);
            const el = document.querySelector('.general-card');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.boxShadow = '0 0 0 3px var(--emerald)';
                setTimeout(() => el.style.boxShadow = '', 2000);
            }
        };
        ul.appendChild(generalLi);

        // MeMovimentar
        const movLi = document.createElement('li');
        movLi.className = 'fi-item';
        movLi.innerHTML = `
            <span class="fi-num" style="background:#1565c0">🏃</span>
            <div class="fi-label">
                <div class="fi-title">Projeto MeMovimentar</div>
                <div class="fi-count">Exercícios contra o sedentarismo</div>
            </div>`;
        movLi.onclick = () => {
            this.toggleIndex(false);
            const el = document.querySelector('.movimentar-card');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.boxShadow = '0 0 0 3px #1565c0';
                setTimeout(() => el.style.boxShadow = '', 2000);
            }
        };
        ul.appendChild(movLi);

        // Partner link
        const partnerLi = document.createElement('li');
        partnerLi.className = 'fi-item';
        partnerLi.innerHTML = `
            <span class="fi-num" style="background:var(--emerald)">🧑‍⚕️</span>
            <div class="fi-label">
                <div class="fi-title">Encontre um psicólogo</div>
                <div class="fi-count">quemcuidadequemcuida.com.br</div>
            </div>`;
        partnerLi.onclick = () => {
            this.toggleIndex(false);
            const el = document.querySelector('.partner-card');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.borderColor = 'var(--emerald)';
                el.style.boxShadow = '0 0 0 2px rgba(47,111,100,.3)';
                setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 2000);
            }
        };
        ul.appendChild(partnerLi);
    }

    buildCards(cats) {
        const area = this.$('cardsArea');
        area.innerHTML = '';
        const wppIcon = `<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

        // Partner link (above topics)
        const partner = document.createElement('a');
        partner.className = 'partner-card visible';
        partner.href = PARTNER_LINK.url;
        partner.target = '_blank';
        partner.rel = 'noopener noreferrer';
        partner.innerHTML = `
            <span class="pc-icon">${PARTNER_LINK.icon}</span>
            <div class="pc-info">
                <span class="pc-title">${PARTNER_LINK.title}</span>
                <span class="pc-url">quemcuidadequemcuida.com.br</span>
            </div>
            <div class="pc-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
            </div>
        `;
        area.appendChild(partner);

        // MeMovimentar (compact link card — also gated)
        const movimentar = document.createElement('div');
        movimentar.className = 'partner-card movimentar-link visible';
        movimentar.style.cursor = 'pointer';
        movimentar.innerHTML = `
            <span class="pc-icon">${MOVIMENTAR_GROUP.icon}</span>
            <div class="pc-info">
                <span class="pc-title">${MOVIMENTAR_GROUP.title}</span>
                <span class="pc-url">${MOVIMENTAR_GROUP.description}</span>
            </div>
            <div class="pc-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
            </div>
        `;
        movimentar.addEventListener('click', () => {
            if (this.currentUser) {
                window.open(MOVIMENTAR_GROUP.link, '_blank');
            } else {
                this.openGate(MOVIMENTAR_GROUP.link);
            }
        });
        area.appendChild(movimentar);

        // "Temas" section label
        const themesLabel = document.createElement('h3');
        themesLabel.className = 'section-label';
        themesLabel.textContent = 'Temas';
        area.appendChild(themesLabel);

        cats.forEach(c => {
            const card = document.createElement('div');
            card.className = 'topic-card';
            card.id = 'topic-' + c.id;

            const tags = c.subtopics.map(s =>
                `<span class="sub-tag"><span class="sub-tag-emoji">${s.emoji}</span>${s.name}</span>`
            ).join('');

            card.innerHTML = `
                <div class="tc-header" role="button" tabindex="0" aria-expanded="false">
                    <div class="tc-num" style="background:${c.color}">${c.id}</div>
                    <span class="tc-emoji">${c.icon}</span>
                    <div class="tc-info">
                        <div class="tc-title">${c.title}</div>
                        <div class="tc-desc">${c.description}</div>
                    </div>
                    <div class="tc-chevron">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                </div>
                <div class="tc-body">
                    <div class="tc-body-inner">
                        <p class="tc-themes-label">Temas abordados neste grupo:</p>
                        <div class="sub-tags">${tags}</div>
                        <button class="community-enter-btn" style="--btn-color:${c.color}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            <span>Entrar na comunidade</span>
                        </button>
                    </div>
                </div>`;

            // Accordion toggle
            const hdr = card.querySelector('.tc-header');
            hdr.addEventListener('click', () => {
                const wasOpen = card.classList.contains('open');
                area.querySelectorAll('.topic-card.open').forEach(other => {
                    other.classList.remove('open');
                    other.querySelector('.tc-header').setAttribute('aria-expanded', false);
                });
                if (!wasOpen) {
                    card.classList.add('open');
                    hdr.setAttribute('aria-expanded', true);
                }
            });
            hdr.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hdr.click(); }
            });

            // "Entrar na comunidade" button — navigates to community feed
            const enterBtn = card.querySelector('.community-enter-btn');
            enterBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const gender = this.gender;
                const slug = this._slugify(c.title) + '-' + gender;

                // Ensure DB topics map is loaded
                if (!this._dbTopicsMap || Object.keys(this._dbTopicsMap).length === 0) {
                    const dbTopics = await Feed.loadTopics();
                    this._dbTopicsMap = {};
                    dbTopics.forEach(t => { this._dbTopicsMap[t.slug] = t; });
                }

                // Resolve or auto-create DB topic
                let topicData;
                const dbTopic = this._dbTopicsMap[slug];
                if (dbTopic) {
                    topicData = dbTopic;
                } else {
                    const { topic } = await Feed.createTopicAuto(c.title, c.icon, c.description, slug, c.color, gender);
                    if (topic) {
                        topicData = topic;
                        this._dbTopicsMap[slug] = topic;
                    } else {
                        topicData = { id: null, name: c.title, emoji: c.icon, slug, description: c.description, color: c.color, post_count: 0 };
                    }
                }

                this.currentTopicId = topicData.id;
                this.currentTopicData = { ...topicData, emoji: c.icon, name: c.title };
                this._currentCategoryData = c;
                this._backToTab = this.currentTab;

                // Switch to community tab and show the topic feed
                this.currentTab = 'community';
                this.$$('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === 'community'));
                this.showCommunity();
            });

            area.appendChild(card);
        });

        // General group (also gated)
        const general = document.createElement('div');
        general.className = 'general-card visible';
        general.innerHTML = `
            <div class="gc-badge">${GENERAL_GROUP.icon}</div>
            <h3 class="gc-card-title">${GENERAL_GROUP.title}</h3>
            <p class="gc-card-desc">${GENERAL_GROUP.description}</p>
            <button class="wpp-btn-big wpp-btn-general wpp-gate-btn" data-link="${GENERAL_GROUP.link}">
                ${wppIcon}
                <span>Entrar no grupo geral</span>
            </button>
        `;
        const generalGateBtn = general.querySelector('.wpp-gate-btn');
        generalGateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.currentUser) {
                window.open(GENERAL_GROUP.link, '_blank');
            } else {
                this.openGate(GENERAL_GROUP.link);
            }
        });
        area.appendChild(general);

        // Mini footer
        const miniFooter = document.createElement('div');
        miniFooter.className = 'panel-footer';
        miniFooter.innerHTML = `<span>💚</span> AcolheBem — Você não está sozinho(a)`;
        area.appendChild(miniFooter);
    }

    revealCards() {
        setTimeout(() => {
            const isDesktop = window.innerWidth >= 1024;
            this.$$('.topic-card').forEach((c, i) => {
                if (isDesktop) {
                    setTimeout(() => c.classList.add('visible'), 80 * i);
                } else {
                    this.observer.observe(c);
                }
            });
        }, 150);
    }

    // ========================================
    //  D3 HERO VISUALIZATION
    // ========================================
    renderHeroViz() {
        const svgEl = this.$('heroSVG');
        const wrap = this.$('vizWrap');
        d3.select(svgEl).selectAll('*').remove();

        const W = wrap.clientWidth - 40;
        const H = wrap.clientHeight - 40 || 600;
        const cx = W / 2, cy = H / 2;
        const cats = this.data.categories;
        const accent = this.data.accentColor;
        const isFem = this.gender === 'women';
        const mob = W < 480;

        // Mobile-scaled dimensions
        const hubR1 = mob ? 38 : 54, hubR2 = mob ? 33 : 48;
        const pulseR0 = mob ? 35 : 50, pulseR1 = mob ? 75 : 110;
        const hubTxtY = mob ? 52 : 76, hubTxtSz = mob ? 10 : 14;
        const nR1 = mob ? 46 : 68, nR2 = mob ? 38 : 56, nR3 = mob ? 32 : 48;
        const emoSz = mob ? 22 : 34;
        const bdgCx = mob ? 26 : 38, bdgCy = mob ? -26 : -38, bdgR = mob ? 13 : 18, bdgSz = mob ? 11 : 16;
        const lblY = mob ? 42 : 62, lblH = mob ? 22 : 30, lblRx = mob ? 11 : 15;
        const lblSz = mob ? 10 : 13, lblTxtY = mob ? 53 : 77;
        const subY = mob ? 68 : 102, subSz = mob ? 9 : 12;
        const dotR = mob ? 3 : 4.5, sW = mob ? 2 : 2.5;
        const charW = mob ? 5.5 : 7.5, charPad = mob ? 18 : 28;

        const svg = d3.select(svgEl).attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);

        // defs
        const defs = svg.append('defs');

        // radial bg
        const rg = defs.append('radialGradient').attr('id','vizBg').attr('cx','50%').attr('cy','50%').attr('r','65%');
        rg.append('stop').attr('offset','0%').attr('stop-color', isFem ? '#fff0f6' : '#e7f5ff');
        rg.append('stop').attr('offset','100%').attr('stop-color','#f8f8fc');

        // glow filters
        cats.forEach(c => {
            const f = defs.append('filter').attr('id', 'glow-'+c.id).attr('x','-50%').attr('y','-50%').attr('width','200%').attr('height','200%');
            f.append('feGaussianBlur').attr('stdDeviation','6').attr('result','blur');
            f.append('feFlood').attr('flood-color', c.color).attr('flood-opacity','.2').attr('result','color');
            f.append('feComposite').attr('in','color').attr('in2','blur').attr('operator','in').attr('result','shadow');
            const mg = f.append('feMerge');
            mg.append('feMergeNode').attr('in','shadow');
            mg.append('feMergeNode').attr('in','SourceGraphic');
        });

        // bg rect
        svg.append('rect').attr('width',W).attr('height',H).attr('rx',24).attr('fill','url(#vizBg)');

        // subtle grid
        const grid = svg.append('g').attr('opacity',.04);
        for (let x = 0; x < W; x += 40) grid.append('line').attr('x1',x).attr('y1',0).attr('x2',x).attr('y2',H).attr('stroke','#666');
        for (let y = 0; y < H; y += 40) grid.append('line').attr('x1',0).attr('y1',y).attr('x2',W).attr('y2',y).attr('stroke','#666');

        // node positions
        const rx = Math.min(W * (mob ? .36 : .40), 480);
        const ry = Math.min(H * (mob ? .30 : .35), 280);
        const nodes = cats.map((c, i) => {
            const a = -Math.PI / 2 + (i / cats.length) * Math.PI * 2;
            return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), c };
        });

        // connection lines with flowing particles
        const lineG = svg.append('g');
        nodes.forEach((n, i) => {
            const lg = defs.append('linearGradient').attr('id', 'lg-'+i)
                .attr('x1', cx).attr('y1', cy).attr('x2', n.x).attr('y2', n.y).attr('gradientUnits','userSpaceOnUse');
            lg.append('stop').attr('offset','0%').attr('stop-color', accent).attr('stop-opacity','.15');
            lg.append('stop').attr('offset','100%').attr('stop-color', n.c.color).attr('stop-opacity','.5');

            const line = lineG.append('line')
                .attr('x1', cx).attr('y1', cy).attr('x2', cx).attr('y2', cy)
                .attr('stroke', `url(#lg-${i})`).attr('stroke-width', sW)
                .attr('stroke-dasharray','8 5').attr('stroke-linecap','round');

            line.transition().duration(900).delay(200 + i * 100)
                .attr('x2', n.x).attr('y2', n.y);

            // flowing dot
            const dot = lineG.append('circle')
                .attr('cx', cx).attr('cy', cy).attr('r', dotR)
                .attr('fill', n.c.color).attr('opacity', 0);

            const animateDot = () => {
                dot.attr('cx', cx).attr('cy', cy).attr('opacity', .6)
                    .transition().duration(2000 + i * 300).ease(d3.easeLinear)
                    .attr('cx', n.x).attr('cy', n.y).attr('opacity', 0)
                    .on('end', () => setTimeout(animateDot, 500 + Math.random() * 2000));
            };
            setTimeout(animateDot, 1200 + i * 300);
        });

        // center hub
        const hub = svg.append('g').attr('transform', `translate(${cx},${cy})`).style('opacity', 0);

        // pulse rings
        for (let i = 0; i < 3; i++) {
            hub.append('circle').attr('r', pulseR0).attr('fill','none')
                .attr('stroke', accent).attr('stroke-width', 1.5).attr('opacity', 0)
                .each(function() {
                    const el = d3.select(this);
                    const pulse = () => {
                        el.attr('r', pulseR0).attr('opacity', .4)
                            .transition().duration(2800).ease(d3.easeQuadOut)
                            .attr('r', pulseR1).attr('opacity', 0)
                            .on('end', pulse);
                    };
                    setTimeout(pulse, i * 900);
                });
        }

        hub.append('circle').attr('r', hubR1).attr('fill','white')
            .attr('stroke', accent).attr('stroke-width', sW);
        hub.append('circle').attr('r', hubR2).attr('fill', isFem ? '#fff0f6' : '#e7f5ff');

        // SVG character illustration
        const person = hub.append('g').attr('transform', mob ? 'translate(0,-3) scale(0.7)' : 'translate(0,-4)');
        if (isFem) {
            person.append('ellipse').attr('cx',0).attr('cy',-8).attr('rx',14).attr('ry',16).attr('fill','#5c3d2e');
            person.append('path').attr('d','M-14,-8 Q-16,10 -12,18 Q-10,22 -8,18 Q-8,2 -10,-4Z').attr('fill','#5c3d2e');
            person.append('path').attr('d','M14,-8 Q16,10 12,18 Q10,22 8,18 Q8,2 10,-4Z').attr('fill','#5c3d2e');
            person.append('circle').attr('cx',0).attr('cy',-6).attr('r',12).attr('fill','#fcd5b4').attr('stroke','#d4a574').attr('stroke-width',.8);
            person.append('path').attr('d','M-10,-14 Q-6,-20 0,-18 Q6,-20 10,-14 Q8,-16 4,-17 Q0,-15 -4,-17 Q-8,-16 -10,-14Z').attr('fill','#5c3d2e');
            person.append('ellipse').attr('cx',-4).attr('cy',-8).attr('rx',1.8).attr('ry',2.2).attr('fill','#333');
            person.append('ellipse').attr('cx',4).attr('cy',-8).attr('rx',1.8).attr('ry',2.2).attr('fill','#333');
            person.append('circle').attr('cx',-3.4).attr('cy',-8.5).attr('r',.6).attr('fill','#fff');
            person.append('circle').attr('cx',4.6).attr('cy',-8.5).attr('r',.6).attr('fill','#fff');
            person.append('ellipse').attr('cx',-8).attr('cy',-4).attr('rx',2.5).attr('ry',1.5).attr('fill','#f4b8a0').attr('opacity',.5);
            person.append('ellipse').attr('cx',8).attr('cy',-4).attr('rx',2.5).attr('ry',1.5).attr('fill','#f4b8a0').attr('opacity',.5);
            person.append('path').attr('d','M-3,-2 Q0,2 3,-2').attr('fill','none').attr('stroke','#c47a5a').attr('stroke-width',1).attr('stroke-linecap','round');
            person.append('path').attr('d','M-12,8 Q-14,6 -12,4 Q-6,2 0,4 Q6,2 12,4 Q14,6 12,8 L14,24 Q8,28 0,28 Q-8,28 -14,24Z').attr('fill', accent);
            person.append('path').attr('d','M-4,6 L0,12 L4,6').attr('fill','none').attr('stroke','#fff').attr('stroke-width',1.2).attr('stroke-linecap','round');
            person.append('path').attr('d','M-12,8 Q-18,14 -16,20').attr('fill','none').attr('stroke','#fcd5b4').attr('stroke-width',4).attr('stroke-linecap','round');
            person.append('path').attr('d','M12,8 Q18,14 16,20').attr('fill','none').attr('stroke','#fcd5b4').attr('stroke-width',4).attr('stroke-linecap','round');
            person.append('circle').attr('cx',-16).attr('cy',20).attr('r',2.5).attr('fill','#fcd5b4');
            person.append('circle').attr('cx',16).attr('cy',20).attr('r',2.5).attr('fill','#fcd5b4');
        } else {
            person.append('ellipse').attr('cx',0).attr('cy',-12).attr('rx',13).attr('ry',10).attr('fill','#3e2723');
            person.append('circle').attr('cx',0).attr('cy',-6).attr('r',12).attr('fill','#fcd5b4').attr('stroke','#d4a574').attr('stroke-width',.8);
            person.append('path').attr('d','M-11,-12 Q-10,-20 0,-19 Q10,-20 11,-12 Q10,-14 6,-16 Q0,-18 -6,-16 Q-10,-14 -11,-12Z').attr('fill','#3e2723');
            person.append('path').attr('d','M-7,-11 Q-4,-13 -2,-11').attr('fill','none').attr('stroke','#3e2723').attr('stroke-width',1).attr('stroke-linecap','round');
            person.append('path').attr('d','M2,-11 Q4,-13 7,-11').attr('fill','none').attr('stroke','#3e2723').attr('stroke-width',1).attr('stroke-linecap','round');
            person.append('ellipse').attr('cx',-4).attr('cy',-8).attr('rx',1.8).attr('ry',2.2).attr('fill','#333');
            person.append('ellipse').attr('cx',4).attr('cy',-8).attr('rx',1.8).attr('ry',2.2).attr('fill','#333');
            person.append('circle').attr('cx',-3.4).attr('cy',-8.5).attr('r',.6).attr('fill','#fff');
            person.append('circle').attr('cx',4.6).attr('cy',-8.5).attr('r',.6).attr('fill','#fff');
            person.append('path').attr('d','M-3,-2 Q0,1.5 3,-2').attr('fill','none').attr('stroke','#c47a5a').attr('stroke-width',1).attr('stroke-linecap','round');
            person.append('path').attr('d','M-14,8 Q-16,6 -14,4 Q-8,0 0,2 Q8,0 14,4 Q16,6 14,8 L16,26 Q8,30 0,30 Q-8,30 -16,26Z').attr('fill', accent);
            person.append('path').attr('d','M-5,5 L0,11 L5,5').attr('fill','none').attr('stroke','#fff').attr('stroke-width',1.2).attr('stroke-linecap','round');
            person.append('path').attr('d','M-14,8 Q-20,14 -18,22').attr('fill','none').attr('stroke','#fcd5b4').attr('stroke-width',5).attr('stroke-linecap','round');
            person.append('path').attr('d','M14,8 Q20,14 18,22').attr('fill','none').attr('stroke','#fcd5b4').attr('stroke-width',5).attr('stroke-linecap','round');
            person.append('circle').attr('cx',-18).attr('cy',22).attr('r',3).attr('fill','#fcd5b4');
            person.append('circle').attr('cx',18).attr('cy',22).attr('r',3).attr('fill','#fcd5b4');
        }

        hub.append('text').attr('text-anchor','middle').attr('y', hubTxtY)
            .attr('font-size', hubTxtSz).attr('font-weight', 600).attr('fill', accent)
            .attr('font-family','DM Sans, sans-serif').text('AcolheBem');

        hub.transition().duration(500).style('opacity', 1);

        // topic nodes
        nodes.forEach((n, i) => {
            const g = svg.append('g').attr('class','topic-node')
                .attr('transform', `translate(${n.x},${n.y})`)
                .style('opacity', 0).style('cursor','pointer');

            g.append('circle').attr('r', nR1).attr('fill', n.c.color).attr('opacity', .07)
                .attr('filter', `url(#glow-${n.c.id})`);
            g.append('circle').attr('r', nR2).attr('fill','white')
                .attr('stroke', n.c.color).attr('stroke-width', mob ? 2 : 3)
                .attr('filter', `url(#glow-${n.c.id})`);
            g.append('circle').attr('r', nR3).attr('fill', n.c.colorLight);

            g.append('text').attr('text-anchor','middle').attr('dominant-baseline','central')
                .attr('font-size', emoSz).attr('y', mob ? -1 : -2).text(n.c.icon);

            g.append('circle').attr('cx', bdgCx).attr('cy', bdgCy).attr('r', bdgR)
                .attr('fill', n.c.color).attr('stroke','white').attr('stroke-width', sW);
            g.append('text').attr('x', bdgCx).attr('y', bdgCy)
                .attr('text-anchor','middle').attr('dominant-baseline','central')
                .attr('font-size', bdgSz).attr('font-weight', 800).attr('fill','white').text(n.c.id);

            const maxLbl = mob ? 18 : 28;
            const lbl = n.c.title.length > maxLbl ? n.c.title.slice(0, maxLbl - 1)+'…' : n.c.title;
            const tw = lbl.length * charW + charPad;
            g.append('rect').attr('x', -tw/2).attr('y', lblY).attr('width', tw).attr('height', lblH)
                .attr('rx', lblRx).attr('fill','white').attr('stroke', n.c.color).attr('stroke-width', 1.5).attr('opacity', .95);
            g.append('text').attr('y', lblTxtY).attr('text-anchor','middle')
                .attr('dominant-baseline','central')
                .attr('font-size', lblSz).attr('font-weight', 600).attr('fill', '#333')
                .attr('font-family','DM Sans, sans-serif').text(lbl);

            g.append('text').attr('id', 'hero-count-' + n.c.id)
                .attr('y', subY).attr('text-anchor','middle')
                .attr('font-size', subSz).attr('fill','#888')
                .attr('font-family','DM Sans, sans-serif')
                .text(n.c.subtopics.length + ' subtemas');

            g.transition().duration(700).delay(500 + i * 120)
                .ease(d3.easeBackOut.overshoot(1.2))
                .style('opacity', 1);

            g.on('mouseenter', function() {
                d3.select(this).transition().duration(250).ease(d3.easeBackOut)
                    .attr('transform', `translate(${n.x},${n.y}) scale(1.12)`);
            }).on('mouseleave', function() {
                d3.select(this).transition().duration(300)
                    .attr('transform', `translate(${n.x},${n.y}) scale(1)`);
            });

            g.on('click', () => {
                const el = document.getElementById('topic-' + n.c.id);
                if (!el) return;
                el.classList.add('visible');
                if (!el.classList.contains('open')) el.querySelector('.tc-header').click();
                const panel = document.getElementById('cardsArea');
                const isDesktop = window.innerWidth >= 1024;
                if (isDesktop) {
                    panel.scrollTo({ top: el.offsetTop - panel.offsetTop - 12, behavior: 'smooth' });
                } else {
                    el.scrollIntoView({ behavior:'smooth', block:'center' });
                }
                el.style.borderColor = n.c.color;
                el.style.boxShadow = `0 0 0 2px ${n.c.color}30`;
                setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 2500);
            });
        });
    }

    // ========================================
    //  NAVIGATION
    // ========================================
    toggleIndex(open) {
        const fi = this.$('floatingIndex');
        const bd = this.$('fiBackdrop');
        if (open) { fi.classList.add('open'); bd.classList.add('active'); }
        else { fi.classList.remove('open'); bd.classList.remove('active'); }
    }

    // ========================================
    //  ADMIN PANEL
    // ========================================
    initAdmin() {
        this._adminPostsOffset = 0;
        this._adminCurrentTab = 'dashboard';

        this.$('adminBtn').addEventListener('click', () => this.showAdminPanel());
        this.$('adminBackBtn').addEventListener('click', () => this.hideAdminPanel());

        const adminPanels = ['dashboard','posts','reports','members','announcements','topics','featured','psi','filters','config'];
        this.$$('.admin-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.adminTab;
                this._adminCurrentTab = tab;
                this.$$('.admin-tab').forEach(b => b.classList.toggle('active', b === btn));
                adminPanels.forEach(p => {
                    const el = this.$('admin' + p.charAt(0).toUpperCase() + p.slice(1) + 'Panel');
                    if (el) el.style.display = p === tab ? '' : 'none';
                });
                const loaders = { dashboard:'loadAdminDashboard', members:'loadAdminMembers', topics:'loadAdminTopics', psi:'loadAdminPsi', filters:'loadAdminFilters', config:'loadAdminConfig', reports:'loadAdminReports', announcements:'loadAdminAnnouncements', featured:'loadAdminFeatured' };
                if (loaders[tab] && this[loaders[tab]]) this[loaders[tab]]();
            });
        });

        this.$('adminPostsLoadMore').addEventListener('click', () => this.loadAdminPosts(true));
    }

    showAdminPanel() {
        this._previousView = this.currentTab;
        this.$('mainBody').style.display = 'none';
        this.$('communitySection').style.display = 'none';
        this.$('psicologosSection').style.display = 'none';
        this.$('adminSection').style.display = '';
        this._adminPostsOffset = 0;
        this.loadAdminDashboard();
    }

    hideAdminPanel() {
        this.$('adminSection').style.display = 'none';
        if (this._previousView === 'community') {
            this.showCommunity();
        } else if (this._previousView === 'psicologos') {
            this.showPsicologos();
        } else if (this._previousView === 'membros') {
            this.showMembros();
        } else {
            this.$('mainBody').style.display = '';
        }
    }

    async loadAdminPosts(append = false) {
        if (!append) {
            this._adminPostsOffset = 0;
            this.$('adminPostsList').innerHTML = '';
        }
        const posts = await Feed.loadAllPostsAdmin(30, this._adminPostsOffset);
        this._adminPostsOffset += posts.length;

        const list = this.$('adminPostsList');
        posts.forEach(p => list.appendChild(this.buildAdminPostItem(p)));

        this.$('adminPostsLoadMore').style.display = posts.length >= 30 ? '' : 'none';
    }

    buildAdminPostItem(post) {
        const item = document.createElement('div');
        item.className = 'admin-post-item';
        if (post.status === 'hidden') item.classList.add('admin-post-hidden');
        if (post.status === 'deleted') item.classList.add('admin-post-deleted');

        const authorName = post.profiles?.name || 'Desconhecido';
        const authorEmail = post.profiles?.email || '';
        const topicName = post.topics ? `${post.topics.emoji} ${post.topics.name}` : 'Sem tema';
        const date = new Date(post.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        const statusLabel = post.status === 'visible' ? 'Visivel' : post.status === 'hidden' ? 'Oculto' : 'Excluido';
        const statusClass = `admin-status-${post.status}`;
        const isAnon = post.is_anonymous ? ' (anonimo)' : '';

        item.innerHTML = `
            <div class="admin-post-meta">
                <strong>${this.escapeHTML(authorName)}</strong>${isAnon}
                <span class="admin-post-email">${this.escapeHTML(authorEmail)}</span>
                <span class="admin-post-date">${date}</span>
                <span class="admin-post-topic">${this.escapeHTML(topicName)}</span>
                <span class="${statusClass}">${statusLabel}</span>
            </div>
            <div class="admin-post-content">${this.escapeHTML(post.content).substring(0, 200)}</div>
            <div class="admin-post-actions">
                ${post.status !== 'visible' ? `<button class="admin-action-btn admin-btn-show" data-id="${post.id}" data-action="visible">Visivel</button>` : ''}
                ${post.status !== 'hidden' ? `<button class="admin-action-btn admin-btn-hide" data-id="${post.id}" data-action="hidden">Ocultar</button>` : ''}
                <button class="admin-action-btn admin-btn-delete" data-id="${post.id}" data-action="delete">Excluir</button>
            </div>
        `;

        item.querySelectorAll('.admin-action-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                const postId = btn.dataset.id;
                if (action === 'delete') {
                    if (!confirm('Excluir permanentemente este post?')) return;
                    await Feed.adminDeletePost(postId);
                    item.remove();
                } else {
                    await Feed.updatePostStatus(postId, action);
                    // Refresh this item
                    const newPosts = await Feed.loadAllPostsAdmin(1, 0);
                    const updatedPost = newPosts.find(p => p.id === postId);
                    if (updatedPost) {
                        const newItem = this.buildAdminPostItem(updatedPost);
                        item.replaceWith(newItem);
                    } else {
                        this.loadAdminPosts();
                    }
                }
            });
        });

        return item;
    }

    async loadAdminMembers() {
        const list = this.$('adminMembersList');
        list.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Carregando...</div>';
        const members = await Feed.loadMembers();

        this.$('adminMembersCount').textContent = `${members.length} membros cadastrados`;
        list.innerHTML = '';

        members.forEach(m => {
            const item = document.createElement('div');
            item.className = 'admin-member-item';
            const date = new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const avatar = m.photo_url
                ? `<img src="${m.photo_url}" class="admin-member-avatar">`
                : `<div class="admin-member-avatar admin-member-initial">${(m.name || 'U')[0].toUpperCase()}</div>`;
            const genderLabel = m.gender === 'female' ? 'F' : m.gender === 'male' ? 'M' : m.gender === 'other' ? 'O' : '';
            const location = [m.city, m.state].filter(Boolean).join(', ');
            const adminBadge = m.is_admin ? '<span class="admin-badge">Admin</span>' : '';
            const bannedTag = m.banned_at ? '<span class="admin-member-banned-tag">BANIDO</span>' : '';
            const banBtn = !m.is_admin ? (m.banned_at
                ? `<button class="admin-member-ban-btn unban" onclick="app.unbanMember('${m.id}')">Desbanir</button>`
                : `<button class="admin-member-ban-btn ban" onclick="app.banMember('${m.id}')">Banir</button>`) : '';

            // Format WhatsApp number for link
            const wppNumber = (m.whatsapp || '').replace(/\D/g, '');
            const wppLink = wppNumber ? `https://wa.me/55${wppNumber}` : '';

            item.innerHTML = `
                ${avatar}
                <div class="admin-member-info">
                    <div class="admin-member-name">${this.escapeHTML(m.name || 'Sem nome')} ${adminBadge}${bannedTag}</div>
                    <div class="admin-member-detail">${this.escapeHTML(m.email)}</div>
                    <div class="admin-member-detail">${date}${genderLabel ? ' · ' + genderLabel : ''}${location ? ' · ' + this.escapeHTML(location) : ''}</div>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                    ${banBtn}
                    ${wppLink ? `<a href="${wppLink}" target="_blank" rel="noopener noreferrer" class="admin-wpp-btn" title="Chamar no WhatsApp">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </a>` : ''}
                </div>
            `;
            list.appendChild(item);
        });
    }

    async loadAdminTopics() {
        const list = this.$('adminTopicsList');
        list.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Carregando...</div>';
        const topics = await Feed.loadTopics();
        list.innerHTML = '';

        topics.forEach(t => {
            const item = document.createElement('div');
            item.className = 'admin-topic-item';
            item.innerHTML = `
                <div class="admin-topic-header">
                    <span class="admin-topic-emoji">${t.emoji}</span>
                    <span class="admin-topic-name">${this.escapeHTML(t.name)}</span>
                    <span class="admin-topic-posts">${t.post_count} posts</span>
                </div>
                <div class="admin-topic-fields">
                    <div class="auth-field">
                        <label>Nome</label>
                        <input type="text" class="admin-topic-input" data-field="name" value="${this.escapeHTML(t.name)}" maxlength="60">
                    </div>
                    <div class="auth-field">
                        <label>Link WhatsApp</label>
                        <input type="url" class="admin-topic-input" data-field="whatsapp_link" value="${this.escapeHTML(t.whatsapp_link || '')}" placeholder="https://chat.whatsapp.com/...">
                    </div>
                    <div class="auth-field">
                        <label>Descricao</label>
                        <input type="text" class="admin-topic-input" data-field="description" value="${this.escapeHTML(t.description || '')}" maxlength="200">
                    </div>
                    <button class="admin-action-btn admin-btn-save" data-topic-id="${t.id}">Salvar</button>
                    <span class="admin-topic-saved" style="display:none">Salvo!</span>
                </div>
            `;

            const saveBtn = item.querySelector('.admin-btn-save');
            const savedMsg = item.querySelector('.admin-topic-saved');
            saveBtn.addEventListener('click', async () => {
                const inputs = item.querySelectorAll('.admin-topic-input');
                const updates = {};
                inputs.forEach(inp => { updates[inp.dataset.field] = inp.value || null; });
                saveBtn.disabled = true;
                const { error } = await Feed.updateTopic(t.id, updates);
                saveBtn.disabled = false;
                if (error) {
                    ErrorHandler.showToast('Erro ao salvar: ' + error, 'error');
                } else {
                    savedMsg.style.display = '';
                    setTimeout(() => { savedMsg.style.display = 'none'; }, 2000);
                }
            });

            list.appendChild(item);
        });
    }

    async loadAdminPsi() {
        const list = this.$('adminPsiList');
        list.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Carregando...</div>';
        const psychologists = await Feed.loadPsychologists();

        this.$('adminPsiCount').textContent = `${psychologists.length} psicologos cadastrados`;
        list.innerHTML = '';

        psychologists.forEach(p => {
            const item = document.createElement('div');
            item.className = 'admin-member-item';
            const date = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const avatar = p.photo_url
                ? `<img src="${p.photo_url}" class="admin-member-avatar">`
                : `<div class="admin-member-avatar admin-member-initial">${(p.name || 'P')[0].toUpperCase()}</div>`;
            const crpLabel = p.crp ? `CRP: ${this.escapeHTML(p.crp)}` : '';
            const location = [p.city, p.state].filter(Boolean).join(', ');

            // Format WhatsApp number for link
            const wppNumber = (p.whatsapp || '').replace(/\D/g, '');
            const wppLink = wppNumber ? `https://wa.me/55${wppNumber}` : '';

            item.innerHTML = `
                ${avatar}
                <div class="admin-member-info">
                    <div class="admin-member-name">${this.escapeHTML(p.name || 'Sem nome')} <span class="psi-badge">Psi.</span></div>
                    <div class="admin-member-detail">${this.escapeHTML(p.email || '')}</div>
                    <div class="admin-member-detail">${date}${crpLabel ? ' · ' + crpLabel : ''}${location ? ' · ' + this.escapeHTML(location) : ''}</div>
                </div>
                ${wppLink ? `<a href="${wppLink}" target="_blank" rel="noopener noreferrer" class="admin-wpp-btn" title="Chamar no WhatsApp">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>` : ''}
            `;
            list.appendChild(item);
        });
    }

    async loadAdminFilters() {
        const list = this.$('adminFiltersList');
        list.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Carregando...</div>';

        try {
            const sb = window.supabaseClient;
            const { data, error } = await sb.from('content_filters').select('*').order('id');
            if (error) throw error;

            list.innerHTML = '';
            (data || []).forEach(f => {
                const item = document.createElement('div');
                item.className = 'admin-filter-item';
                item.id = `adminFilter_${f.id}`;
                item.innerHTML = `
                    <div class="admin-filter-info">
                        <span class="admin-filter-label">${this.escapeHTML(f.label)}</span>
                        <span class="admin-filter-type">${this.escapeHTML(f.filter_type)}</span>
                    </div>
                    <label class="admin-filter-toggle">
                        <input type="checkbox" ${f.enabled ? 'checked' : ''} onchange="app.toggleAdminFilter('${f.id}', this.checked)">
                        <span class="admin-filter-track"><span class="admin-filter-thumb"></span></span>
                        <span class="admin-filter-status">${f.enabled ? 'Ativo' : 'Inativo'}</span>
                    </label>
                `;
                list.appendChild(item);
            });
        } catch (e) {
            ErrorHandler.handle('app.loadAdminFilters', e, { silent: true });
            list.innerHTML = '<div style="text-align:center;padding:20px;color:#e53935">Erro ao carregar filtros.</div>';
        }
    }

    async toggleAdminFilter(filterId, enabled) {
        const item = this.$(`adminFilter_${filterId}`);
        const statusEl = item?.querySelector('.admin-filter-status');
        const checkbox = item?.querySelector('input[type="checkbox"]');

        try {
            const sb = window.supabaseClient;
            const { error } = await sb.from('content_filters').update({ enabled, updated_at: new Date().toISOString() }).eq('id', filterId);
            if (error) throw error;

            if (statusEl) statusEl.textContent = enabled ? 'Ativo' : 'Inativo';

            // Update ContentFilter in real time
            const { data } = await sb.from('content_filters').select('id, filter_type, enabled').eq('id', filterId).single();
            if (data) {
                if (data.enabled) {
                    ContentFilter._disabledTypes.delete(data.filter_type);
                } else {
                    ContentFilter._disabledTypes.add(data.filter_type);
                }
            }
        } catch (e) {
            ErrorHandler.handle('app.toggleAdminFilter', e);
            // Revert checkbox on error
            if (checkbox) checkbox.checked = !enabled;
            if (statusEl) statusEl.textContent = !enabled ? 'Ativo' : 'Inativo';
        }
    }

    // ========================================
    //  ADMIN DASHBOARD
    // ========================================

    async loadAdminDashboard() {
        const panel = this.$('adminDashboardPanel');
        panel.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Carregando dashboard...</div>';
        try {
            const sb = window.supabaseClient;
            const { data: stats, error } = await sb.rpc('admin_get_dashboard_stats');
            if (error) throw error;

            const { data: topTopics } = await sb.rpc('admin_get_top_topics', { p_days: 7 });
            const { data: topReferrers } = await sb.rpc('admin_get_top_referrers', { p_limit: 5 });

            const s = stats || {};
            panel.innerHTML = `
                <div class="admin-dashboard">
                    <div class="admin-stats-grid">
                        <div class="admin-stat-card"><div class="admin-stat-value">${s.total_members || 0}</div><div class="admin-stat-label">Membros totais</div></div>
                        <div class="admin-stat-card highlight"><div class="admin-stat-value">${s.members_7d || 0}</div><div class="admin-stat-label">Ativos (7d)</div></div>
                        <div class="admin-stat-card"><div class="admin-stat-value">${s.members_30d || 0}</div><div class="admin-stat-label">Ativos (30d)</div></div>
                        <div class="admin-stat-card"><div class="admin-stat-value">${s.new_members_7d || 0}</div><div class="admin-stat-label">Novos (7d)</div></div>
                        <div class="admin-stat-card highlight"><div class="admin-stat-value">${s.posts_today || 0}</div><div class="admin-stat-label">Posts hoje</div></div>
                        <div class="admin-stat-card"><div class="admin-stat-value">${s.posts_7d || 0}</div><div class="admin-stat-label">Posts (7d)</div></div>
                        <div class="admin-stat-card"><div class="admin-stat-value">${s.replies_7d || 0}</div><div class="admin-stat-label">Respostas (7d)</div></div>
                        <div class="admin-stat-card"><div class="admin-stat-value">${s.reactions_7d || 0}</div><div class="admin-stat-label">Reacoes (7d)</div></div>
                        <div class="admin-stat-card ${s.pending_reports > 0 ? 'warning' : ''}"><div class="admin-stat-value">${s.pending_reports || 0}</div><div class="admin-stat-label">Denuncias pendentes</div></div>
                        <div class="admin-stat-card"><div class="admin-stat-value">${s.total_referrals || 0}</div><div class="admin-stat-label">Indicacoes</div></div>
                        <div class="admin-stat-card"><div class="admin-stat-value">${s.banned_members || 0}</div><div class="admin-stat-label">Banidos</div></div>
                    </div>
                    <div class="admin-section-title">Temas mais ativos (7d)</div>
                    <div class="admin-top-topics" id="adminTopTopics">
                        ${(topTopics || []).map((t, i) => {
                            const maxCount = topTopics[0]?.post_count || 1;
                            const pct = Math.round((t.post_count / maxCount) * 100);
                            return `<div class="admin-top-topic">
                                <span>${t.topic_emoji || ''} ${this.escapeHTML(t.topic_name)}</span>
                                <span style="margin-left:auto;font-weight:700">${t.post_count}</span>
                            </div>
                            <div class="admin-top-topic-bar" style="width:${pct}%"></div>`;
                        }).join('') || '<div style="color:#888;font-size:.82rem">Nenhum post esta semana</div>'}
                    </div>
                    ${(topReferrers || []).length > 0 ? `
                    <div class="admin-section-title">Top indicadores</div>
                    <div class="admin-top-referrers">
                        ${topReferrers.map(r => `<div class="admin-referrer-item"><span>${this.escapeHTML(r.user_name)}</span><span style="font-weight:700">${r.referral_count} indicacoes</span></div>`).join('')}
                    </div>` : ''}
                </div>`;
        } catch (e) {
            ErrorHandler.handle('app.loadAdminDashboard', e, { silent: true });
            panel.innerHTML = '<div style="text-align:center;padding:20px;color:#e53935">Erro ao carregar dashboard.</div>';
        }
    }

    // ========================================
    //  ADMIN REPORTS (Denúncias)
    // ========================================

    async loadAdminReports() {
        const panel = this.$('adminReportsPanel');
        panel.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Carregando denuncias...</div>';
        try {
            const sb = window.supabaseClient;
            const { data, error } = await sb.from('reports').select('*').order('created_at', { ascending: false }).limit(50);
            if (error) throw error;

            const pendingCount = (data || []).filter(r => r.status === 'pending').length;
            panel.innerHTML = `
                <div class="admin-reports-count">${pendingCount} pendente(s) de ${(data || []).length} total</div>
                <div id="adminReportsList">${(data || []).map(r => this._buildReportItem(r)).join('')}</div>
            `;
        } catch (e) {
            ErrorHandler.handle('app.loadAdminReports', e, { silent: true });
            panel.innerHTML = '<div style="text-align:center;padding:20px;color:#e53935">Erro ao carregar denuncias.</div>';
        }
    }

    _buildReportItem(r) {
        const date = new Date(r.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
        const actions = r.status === 'pending' ? `
            <div class="admin-report-actions">
                <button class="btn-hide" onclick="app.reviewReport('${r.id}','reviewed','hide_content')">Ocultar conteudo</button>
                <button class="btn-ban" onclick="app.reviewReport('${r.id}','reviewed','ban_user')">Banir autor</button>
                <button class="btn-dismiss" onclick="app.reviewReport('${r.id}','dismissed')">Ignorar</button>
            </div>` : `<div style="font-size:.72rem;color:#888">Status: ${r.status} ${r.admin_action ? '(' + r.admin_action + ')' : ''}</div>`;
        return `<div class="admin-report-item ${r.status}">
            <div class="admin-report-header">
                <span class="admin-report-type">${this.escapeHTML(r.target_type)}</span>
                <span class="admin-report-date">${date}</span>
            </div>
            <div class="admin-report-reason">${this.escapeHTML(r.reason)}</div>
            ${actions}
        </div>`;
    }

    async reviewReport(reportId, status, action = null) {
        try {
            const sb = window.supabaseClient;
            const updateData = { status, reviewed_at: new Date().toISOString(), reviewed_by: this.currentUser.id };
            if (action) updateData.admin_action = action;
            await sb.from('reports').update(updateData).eq('id', reportId);

            if (action === 'hide_content') {
                const { data: report } = await sb.from('reports').select('target_type, target_id').eq('id', reportId).single();
                if (report?.target_type === 'post') {
                    await sb.from('posts').update({ status: 'hidden' }).eq('id', report.target_id);
                } else if (report?.target_type === 'reply') {
                    await sb.from('replies').update({ status: 'hidden' }).eq('id', report.target_id);
                }
            } else if (action === 'ban_user') {
                const { data: report } = await sb.from('reports').select('target_type, target_id').eq('id', reportId).single();
                if (report) {
                    let userId = report.target_id;
                    if (report.target_type === 'post') {
                        const { data: post } = await sb.from('posts').select('user_id').eq('id', report.target_id).single();
                        userId = post?.user_id;
                    } else if (report.target_type === 'reply') {
                        const { data: reply } = await sb.from('replies').select('user_id').eq('id', report.target_id).single();
                        userId = reply?.user_id;
                    }
                    if (userId) {
                        await sb.from('profiles').update({ banned_at: new Date().toISOString(), ban_reason: 'Banido via denuncia' }).eq('id', userId);
                    }
                }
            }
            this.loadAdminReports();
        } catch (e) {
            ErrorHandler.handle('app.reviewReport', e);
        }
    }

    // ========================================
    //  ADMIN ANNOUNCEMENTS
    // ========================================

    async loadAdminAnnouncements() {
        const panel = this.$('adminAnnouncementsPanel');
        panel.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Carregando...</div>';
        try {
            const sb = window.supabaseClient;
            const { data, error } = await sb.from('announcements').select('*').order('created_at', { ascending: false }).limit(20);
            if (error) throw error;

            panel.innerHTML = `
                <div class="admin-announcement-form">
                    <input type="text" id="annTitle" placeholder="Titulo do aviso" maxlength="200">
                    <textarea id="annBody" placeholder="Corpo do aviso (opcional)" maxlength="1000"></textarea>
                    <input type="url" id="annLink" placeholder="Link (opcional) — ex: https://exemplo.com" maxlength="500">
                    <div class="form-row">
                        <select id="annType"><option value="info">Info</option><option value="warning">Alerta</option><option value="event">Evento</option><option value="celebration">Celebracao</option></select>
                        <button class="btn-primary" onclick="app.createAnnouncement()" style="padding:8px 16px;font-size:.85rem">Publicar aviso</button>
                    </div>
                </div>
                <div id="adminAnnList">
                    ${(data || []).map(a => `
                        <div class="admin-announcement-item ${a.active ? '' : 'inactive'}">
                            <div>
                                <strong>${this.escapeHTML(a.title)}</strong>
                                ${a.link_url ? `<a href="${this.escapeHTML(a.link_url)}" target="_blank" rel="noopener" style="font-size:.7rem;margin-left:6px;color:#1971c2">🔗 link</a>` : ''}
                                <span style="font-size:.7rem;color:#888;margin-left:8px">${a.type} | ${a.active ? 'Ativo' : 'Inativo'}</span>
                            </div>
                            <div style="display:flex;gap:6px">
                                <button class="admin-member-ban-btn ${a.active ? 'ban' : 'unban'}" onclick="app.toggleAnnouncement('${a.id}',${!a.active})">${a.active ? 'Desativar' : 'Ativar'}</button>
                                <button class="admin-member-ban-btn ban" onclick="app.deleteAnnouncement('${a.id}')">Excluir</button>
                            </div>
                        </div>
                    `).join('') || '<div style="color:#888;text-align:center;padding:12px">Nenhum aviso.</div>'}
                </div>`;
        } catch (e) {
            ErrorHandler.handle('app.loadAdminAnnouncements', e, { silent: true });
            panel.innerHTML = '<div style="text-align:center;padding:20px;color:#e53935">Erro ao carregar avisos.</div>';
        }
    }

    async createAnnouncement() {
        const title = this.$('annTitle')?.value?.trim();
        const body = this.$('annBody')?.value?.trim();
        const linkUrl = this.$('annLink')?.value?.trim();
        const type = this.$('annType')?.value || 'info';
        if (!title) return;
        try {
            const sb = window.supabaseClient;
            await sb.from('announcements').insert({ title, body: body || null, type, link_url: linkUrl || null, created_by: this.currentUser.id });
            this.loadAdminAnnouncements();
            this._loadAnnouncements();
        } catch (e) { ErrorHandler.handle('app.createAnnouncement', e); }
    }

    async toggleAnnouncement(id, active) {
        try {
            await window.supabaseClient.from('announcements').update({ active }).eq('id', id);
            this.loadAdminAnnouncements();
            this._loadAnnouncements();
        } catch (e) { ErrorHandler.handle('app.toggleAnnouncement', e); }
    }

    async deleteAnnouncement(id) {
        try {
            await window.supabaseClient.from('announcements').delete().eq('id', id);
            this.loadAdminAnnouncements();
            this._loadAnnouncements();
        } catch (e) { ErrorHandler.handle('app.deleteAnnouncement', e); }
    }

    // ========================================
    //  ADMIN FEATURED POST
    // ========================================

    async loadAdminFeatured() {
        const panel = this.$('adminFeaturedPanel');
        panel.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Carregando...</div>';
        try {
            const sb = window.supabaseClient;
            const { data: current } = await sb.from('featured_posts').select('*, posts(content, user_id, profiles:posts_user_id_fkey(name))').eq('active', true).order('created_at', { ascending: false }).limit(1).single();

            const { data: topPosts } = await sb.from('posts').select('id, content, user_id, profiles:posts_user_id_fkey(name)').eq('status', 'visible').order('created_at', { ascending: false }).limit(10);

            let currentHTML = '<div class="admin-featured-none">Nenhum post em destaque.</div>';
            if (current?.posts) {
                currentHTML = `<div class="admin-featured-current">
                    <div class="featured-post-label">⭐ ${this.escapeHTML(current.label)}</div>
                    <div style="font-size:.85rem;color:#333;margin-bottom:6px">${this.escapeHTML(current.posts.content?.substring(0, 150))}...</div>
                    <div style="font-size:.75rem;color:#888">por ${this.escapeHTML(current.posts.profiles?.name || 'Anonimo')}</div>
                    <button class="admin-member-ban-btn ban" style="margin-top:8px" onclick="app.removeFeaturedPost('${current.id}')">Remover destaque</button>
                </div>`;
            }

            panel.innerHTML = `
                ${currentHTML}
                <div class="admin-section-title">Posts recentes (selecione para destacar)</div>
                <div>${(topPosts || []).map(p => `
                    <div class="admin-announcement-item">
                        <div style="flex:1">
                            <div style="font-size:.82rem;color:#333">${this.escapeHTML(p.content?.substring(0, 100))}...</div>
                            <div style="font-size:.72rem;color:#888">${this.escapeHTML(p.profiles?.name || 'Anonimo')}</div>
                        </div>
                        <button class="admin-member-ban-btn unban" onclick="app.featurePost('${p.id}')">Destacar</button>
                    </div>
                `).join('')}</div>`;
        } catch (e) {
            ErrorHandler.handle('app.loadAdminFeatured', e, { silent: true });
            panel.innerHTML = '<div style="text-align:center;padding:20px;color:#e53935">Erro ao carregar destaque.</div>';
        }
    }

    async featurePost(postId) {
        try {
            const sb = window.supabaseClient;
            await sb.from('featured_posts').update({ active: false }).eq('active', true);
            await sb.from('featured_posts').insert({ post_id: postId, featured_by: this.currentUser.id, label: 'Post da Semana' });
            this.loadAdminFeatured();
            this._loadFeaturedPost();
        } catch (e) { ErrorHandler.handle('app.featurePost', e); }
    }

    async removeFeaturedPost(id) {
        try {
            await window.supabaseClient.from('featured_posts').update({ active: false }).eq('id', id);
            this.loadAdminFeatured();
            this.$('featuredPostWrap').style.display = 'none';
        } catch (e) { ErrorHandler.handle('app.removeFeaturedPost', e); }
    }

    // ========================================
    //  USER: REPORTS (Denunciar)
    // ========================================

    _reportTarget = null;

    openReportModal(targetType, targetId, preview = '') {
        this._reportTarget = { type: targetType, id: targetId };
        this.$('reportTargetInfo').textContent = `Denunciando: ${targetType === 'post' ? 'publicacao' : targetType === 'reply' ? 'resposta' : 'perfil'} ${preview ? '— "' + preview.substring(0, 60) + '..."' : ''}`;
        this.$('reportModal').style.display = '';
        this.$('reportError').style.display = 'none';
        this.$$('input[name="reportReason"]').forEach(r => r.checked = false);
        this.$('reportDetails').value = '';
    }

    async submitReport() {
        if (!this._reportTarget || !this.currentUser) return;
        const reasonEl = document.querySelector('input[name="reportReason"]:checked');
        if (!reasonEl) {
            this.$('reportError').textContent = 'Selecione um motivo.';
            this.$('reportError').style.display = '';
            return;
        }
        const reason = reasonEl.value + (this.$('reportDetails').value ? ' — ' + this.$('reportDetails').value : '');
        try {
            const sb = window.supabaseClient;
            const { error } = await sb.from('reports').insert({
                reporter_id: this.currentUser.id,
                target_type: this._reportTarget.type,
                target_id: this._reportTarget.id,
                reason
            });
            if (error) throw error;
            this.$('reportModal').style.display = 'none';
            this._reportTarget = null;
        } catch (e) {
            this.$('reportError').textContent = 'Erro ao enviar denuncia. Tente novamente.';
            this.$('reportError').style.display = '';
            ErrorHandler.handle('app.submitReport', e, { silent: true });
        }
    }

    // ========================================
    //  USER: ANNOUNCEMENTS
    // ========================================

    async _loadAnnouncements() {
        try {
            const sb = window.supabaseClient;
            if (!sb) return;
            const banner = this.$('announcementBanner');
            // Avisos sao exibidos apenas para psicologos
            if (!this.currentProfile?.is_psi) { banner.style.display = 'none'; return; }
            const { data } = await sb.from('announcements').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1);
            const ann = data?.[0];
            if (!ann) { banner.style.display = 'none'; return; }

            const icons = { info: '📢', warning: '⚠️', event: '📅', celebration: '🎉' };
            banner.dataset.type = ann.type;
            this.$('announcementIcon').textContent = icons[ann.type] || '📢';
            this.$('announcementTitle').textContent = ann.title;
            this.$('announcementBody').textContent = ann.body || '';
            const linkEl = this.$('announcementLink');
            if (ann.link_url) {
                linkEl.href = ann.link_url;
                linkEl.style.display = '';
            } else {
                linkEl.style.display = 'none';
            }
            banner.style.display = '';
        } catch { /* silent */ }
    }

    // ========================================
    //  USER: REFERRAL
    // ========================================

    async _ensureReferralCode() {
        if (!this.currentProfile?.referral_code) {
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            try {
                const sb = window.supabaseClient;
                await sb.from('profiles').update({ referral_code: code }).eq('id', this.currentUser.id);
                this.currentProfile.referral_code = code;
            } catch { /* silent */ }
        }
        return this.currentProfile?.referral_code || '';
    }

    async openReferralModal() {
        const code = await this._ensureReferralCode();
        const link = `${window.location.origin}?ref=${code}`;
        this.$('referralLinkInput').value = link;
        this.$('referralModal').style.display = '';
    }

    _copyReferralLink() {
        const input = this.$('referralLinkInput');
        navigator.clipboard.writeText(input.value).then(() => {
            this.$('referralCopyBtn').textContent = 'Copiado!';
            setTimeout(() => this.$('referralCopyBtn').textContent = 'Copiar', 2000);
        });
    }

    _shareWhatsApp() {
        const link = this.$('referralLinkInput').value;
        const text = `Conhece o AcolheBem? Uma comunidade de acolhimento para saude mental. Entra la: ${link}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }

    async _processReferralCode() {
        const params = new URLSearchParams(window.location.search);
        const refCode = params.get('ref');
        if (!refCode || !this.currentUser) return;
        try {
            const sb = window.supabaseClient;
            const { data: profile } = await sb.from('profiles').select('referred_by').eq('id', this.currentUser.id).single();
            if (profile?.referred_by) return;
            const { data: referrer } = await sb.from('profiles').select('id').eq('referral_code', refCode).single();
            if (referrer && referrer.id !== this.currentUser.id) {
                await sb.from('profiles').update({ referred_by: referrer.id }).eq('id', this.currentUser.id);
            }
            window.history.replaceState({}, '', window.location.pathname);
        } catch { /* silent */ }
    }

    // ========================================
    //  USER: STREAKS
    // ========================================

    async _recordCheckIn() {
        try {
            const sb = window.supabaseClient;
            if (!sb || !this.currentUser) return;
            const { data } = await sb.rpc('record_check_in');
            if (!data) return;
            this._streakData = data;
            const bar = this.$('streakBar');
            if (data.current_streak > 0) {
                this.$('streakText').innerHTML = `<b>${data.current_streak} dia${data.current_streak > 1 ? 's' : ''} seguido${data.current_streak > 1 ? 's' : ''}</b> na comunidade`;
                bar.style.display = '';
            }
            this._checkStreakBadges(data);
        } catch { /* silent */ }
    }

    _checkStreakBadges(data) {
        if (data.current_streak >= 7) this._awardBadge('7_day_streak');
        if (data.current_streak >= 30) this._awardBadge('30_day_streak');
    }

    // ========================================
    //  USER: BADGES
    // ========================================

    async _awardBadge(badgeId) {
        try {
            const sb = window.supabaseClient;
            if (!sb || !this.currentUser) return;
            await sb.from('user_badges').insert({ user_id: this.currentUser.id, badge_id: badgeId }).select();
        } catch { /* badge likely already earned — ignore duplicate */ }
    }

    async _loadUserBadges(userId) {
        try {
            const sb = window.supabaseClient;
            const { data } = await sb.from('user_badges').select('badge_id, earned_at, badge_definitions(name, icon, category)').eq('user_id', userId);
            return data || [];
        } catch { return []; }
    }

    _renderBadges(badges) {
        if (!badges || badges.length === 0) return '';
        return `<div class="profile-badges">${badges.map(b => {
            const def = b.badge_definitions;
            return `<span class="badge-chip" data-cat="${def?.category || ''}" title="${def?.name || ''}">${def?.icon || ''} ${def?.name || ''}</span>`;
        }).join('')}</div>`;
    }

    // ========================================
    //  USER: ONBOARDING
    // ========================================

    async _checkOnboarding() {
        if (!this.currentUser) return;
        try {
            const sb = window.supabaseClient;
            const { data } = await sb.from('onboarding_progress').select('*').eq('user_id', this.currentUser.id).single();
            if (!data) {
                await sb.from('onboarding_progress').insert({ user_id: this.currentUser.id });
                this._showOnboarding({ chose_topic: false, made_first_post: false, followed_someone: false, set_avatar: false });
                return;
            }
            if (data.completed_at) return;
            const allDone = data.chose_topic && data.made_first_post && data.followed_someone && data.set_avatar;
            if (allDone) {
                await sb.from('onboarding_progress').update({ completed_at: new Date().toISOString() }).eq('user_id', this.currentUser.id);
                await sb.from('profiles').update({ onboarding_completed: true }).eq('id', this.currentUser.id);
                this._awardBadge('onboarding_done');
                return;
            }
            this._showOnboarding(data);
        } catch { /* silent */ }
    }

    _showOnboarding(data) {
        const overlay = this.$('onboardingOverlay');
        overlay.style.display = '';
        const steps = [
            { id: 'onbStepTopic', done: data.chose_topic },
            { id: 'onbStepPost', done: data.made_first_post },
            { id: 'onbStepFollow', done: data.followed_someone },
            { id: 'onbStepAvatar', done: data.set_avatar },
        ];
        steps.forEach(s => {
            const el = this.$(s.id);
            if (el) {
                el.classList.toggle('done', s.done);
                el.querySelector('.onboarding-check').textContent = s.done ? '✅' : '☐';
            }
        });
    }

    async _updateOnboarding(field) {
        try {
            const sb = window.supabaseClient;
            if (!sb || !this.currentUser) return;
            const update = {};
            update[field] = true;
            await sb.from('onboarding_progress').update(update).eq('user_id', this.currentUser.id);
            this._checkOnboarding();
        } catch { /* silent */ }
    }

    // ========================================
    //  USER: FEATURED POST
    // ========================================

    async _loadFeaturedPost() {
        try {
            const sb = window.supabaseClient;
            if (!sb) return;
            const { data } = await sb.from('featured_posts').select('*, posts(content, user_id, profiles:posts_user_id_fkey(name))').eq('active', true).order('created_at', { ascending: false }).limit(1).single();
            const wrap = this.$('featuredPostWrap');
            if (!data?.posts) { wrap.style.display = 'none'; return; }
            wrap.style.display = '';
            wrap.innerHTML = `<div class="featured-post-card">
                <div class="featured-post-label">⭐ ${this.escapeHTML(data.label)}</div>
                <div class="featured-post-content">${this.escapeHTML(data.posts.content?.substring(0, 300))}</div>
                <div class="featured-post-author">— ${this.escapeHTML(data.posts.profiles?.name || 'Anonimo')}</div>
            </div>`;
        } catch { this.$('featuredPostWrap').style.display = 'none'; }
    }

    // ========================================
    //  USER: WEEKLY DIGEST
    // ========================================

    async _loadDigest() {
        try {
            const sb = window.supabaseClient;
            if (!sb || !this.currentUser) return;
            const { data } = await sb.rpc('get_weekly_digest');
            if (!data) return;
            this._digestData = data;
            this.$('digestBtn').style.display = '';
            const lastSeen = localStorage.getItem('ab_digest_seen');
            const weekEnd = data.week_end;
            if (!lastSeen || lastSeen < weekEnd) {
                this.$('digestBadge').style.display = '';
            }
        } catch { /* silent */ }
    }

    _showDigest() {
        if (!this._digestData) return;
        const d = this._digestData;
        const topTopic = d.top_topic ? `${d.top_topic.emoji || ''} ${d.top_topic.name} (${d.top_topic.count} posts)` : 'Nenhum';
        this.$('digestContent').innerHTML = `
            <div class="digest-stat"><span class="digest-stat-icon">📝</span><div class="digest-stat-info"><div class="digest-stat-value">${d.new_posts || 0}</div><div class="digest-stat-label">Novos posts</div></div></div>
            <div class="digest-stat"><span class="digest-stat-icon">👋</span><div class="digest-stat-info"><div class="digest-stat-value">${d.new_members || 0}</div><div class="digest-stat-label">Novos membros</div></div></div>
            <div class="digest-stat"><span class="digest-stat-icon">💬</span><div class="digest-stat-info"><div class="digest-stat-value">${d.new_replies || 0}</div><div class="digest-stat-label">Respostas</div></div></div>
            <div class="digest-stat"><span class="digest-stat-icon">🏆</span><div class="digest-stat-info"><div class="digest-stat-value">${topTopic}</div><div class="digest-stat-label">Tema mais ativo</div></div></div>
            ${d.your_streak ? `<div class="digest-stat"><span class="digest-stat-icon">🔥</span><div class="digest-stat-info"><div class="digest-stat-value">${d.your_streak} dias</div><div class="digest-stat-label">Seu streak atual</div></div></div>` : ''}
        `;
        this.$('digestPanel').style.display = '';
        this.$('digestBadge').style.display = 'none';
        localStorage.setItem('ab_digest_seen', this._digestData.week_end);
    }

    // ========================================
    //  USER: BAN CHECK
    // ========================================

    _checkBanned() {
        if (this.currentProfile?.banned_at) {
            document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:40px;text-align:center">
                <div><h2>Conta suspensa</h2><p style="color:#666;max-width:400px">Sua conta foi suspensa por violacao das regras da comunidade.${this.currentProfile.ban_reason ? '<br><br>Motivo: ' + this.escapeHTML(this.currentProfile.ban_reason) : ''}</p></div>
            </div>`;
            return true;
        }
        return false;
    }

    // ========================================
    //  ADMIN: BAN/UNBAN MEMBERS
    // ========================================

    async banMember(userId, reason = '') {
        try {
            const sb = window.supabaseClient;
            await sb.from('profiles').update({ banned_at: new Date().toISOString(), ban_reason: reason || 'Banido pelo admin' }).eq('id', userId);
            this.loadAdminMembers();
        } catch (e) { ErrorHandler.handle('app.banMember', e); }
    }

    async unbanMember(userId) {
        try {
            const sb = window.supabaseClient;
            await sb.from('profiles').update({ banned_at: null, ban_reason: null }).eq('id', userId);
            this.loadAdminMembers();
        } catch (e) { ErrorHandler.handle('app.unbanMember', e); }
    }

    // ========================================
    //  DIVERSE REACTIONS
    // ========================================

    _reactionTypes = [
        { type: 'like', icon: '❤️', label: 'Curtir' },
        { type: 'hug', icon: '🫂', label: 'Abraco' },
        { type: 'strength', icon: '💪', label: 'Forca' },
        { type: 'welcome', icon: '🤗', label: 'Acolhimento' },
        { type: 'thanks', icon: '🙏', label: 'Obrigado' },
    ];

    _buildReactionPicker(postId) {
        return `<div class="reaction-picker" id="reactionPicker_${postId}">
            ${this._reactionTypes.map(r => `<button class="reaction-pick-btn" data-post-id="${postId}" data-type="${r.type}" title="${r.label}">${r.icon}</button>`).join('')}
        </div>`;
    }

    // ========================================
    //  ADMIN CONFIG (Feature Flags)
    // ========================================

    async _loadDmFeatureFlag() {
        try {
            const sb = window.supabaseClient;
            if (!sb) return;
            const { data } = await sb
                .from('content_filters')
                .select('enabled')
                .eq('id', 'dm_feature')
                .single();
            if (data) {
                this._dmEnabled = data.enabled;
                // If DM just got enabled and user is logged in, activate it
                if (this._dmEnabled && this.currentUser) {
                    Messages.init(this.currentUser.id);
                    this.$('dmBtn').style.display = '';
                }
            }
        } catch {
            // dm_feature row doesn't exist yet — keep disabled
        }
    }

    async loadAdminConfig() {
        const panel = this.$('adminConfigPanel');
        panel.innerHTML = '<div style="text-align:center;padding:20px;color:#888">Carregando...</div>';

        const flagDescriptions = {
            dm_feature: 'Permite membros trocarem mensagens privadas',
            anonymous_posts: 'Permite que membros publiquem de forma anonima',
            member_topic_creation: 'Permite que membros criem novos temas',
            open_registration: 'Permite que novas pessoas se cadastrem na plataforma',
        };

        try {
            const sb = window.supabaseClient;
            const { data, error } = await sb
                .from('content_filters')
                .select('id, label, enabled')
                .eq('filter_type', 'feature_flag')
                .order('id');
            if (error) throw error;

            panel.innerHTML = `
                <p class="admin-filters-desc">Ative ou desative funcionalidades da plataforma.</p>
                <div class="admin-filters-list">
                    ${(data || []).map(f => `
                        <div class="admin-filter-item" id="adminConfig_${f.id}">
                            <div class="admin-filter-info">
                                <span class="admin-filter-label">${this.escapeHTML(f.label)}</span>
                                <span class="admin-filter-type">${flagDescriptions[f.id] || ''}</span>
                            </div>
                            <label class="admin-filter-toggle">
                                <input type="checkbox" ${f.enabled ? 'checked' : ''} onchange="app.toggleFeatureFlag('${f.id}', this.checked)">
                                <span class="admin-filter-track"><span class="admin-filter-thumb"></span></span>
                                <span class="admin-filter-status">${f.enabled ? 'Ativo' : 'Inativo'}</span>
                            </label>
                        </div>
                    `).join('')}
                </div>`;
        } catch {
            panel.innerHTML = '<div style="text-align:center;padding:20px;color:#e53935">Erro ao carregar config.</div>';
        }
    }

    async toggleFeatureFlag(flagId, enabled) {
        const item = this.$('adminConfig_' + flagId);
        const statusEl = item?.querySelector('.admin-filter-status');
        const checkbox = item?.querySelector('input[type="checkbox"]');
        try {
            const sb = window.supabaseClient;
            await sb.from('content_filters').update({ enabled, updated_at: new Date().toISOString() }).eq('id', flagId);
            if (statusEl) statusEl.textContent = enabled ? 'Ativo' : 'Inativo';
            this._featureFlags[flagId] = enabled;
            // Special handling for DM
            if (flagId === 'dm_feature') {
                this._dmEnabled = enabled;
                if (enabled && this.currentUser) { Messages.init(this.currentUser.id); this.$('dmBtn').style.display = ''; }
                else { Messages.destroy(); this.$('dmBtn').style.display = 'none'; }
            }
        } catch (e) {
            ErrorHandler.handle('app.toggleFeatureFlag', e);
            if (checkbox) checkbox.checked = !enabled;
            if (statusEl) statusEl.textContent = !enabled ? 'Ativo' : 'Inativo';
        }
    }

    // ========================================
    //  DIRECT MESSAGES (DM)
    // ========================================

    initDM() {
        // DM topbar button
        this.$('dmBtn').addEventListener('click', () => this.showDMList());

        // Back from DM list
        this.$('backFromDMListBtn').addEventListener('click', () => this.hideDMList());

        // Back from DM chat
        this.$('backFromDMChatBtn').addEventListener('click', () => this.hideDMChat());

        // DM send button
        this.$('dmSendBtn').addEventListener('click', () => this.handleSendDM());

        // DM composer: enable/disable send button, Enter to send
        const dmText = this.$('dmComposerText');
        dmText.addEventListener('input', () => {
            this.$('dmSendBtn').disabled = !dmText.value.trim();
            // Auto-resize textarea
            dmText.style.height = 'auto';
            dmText.style.height = Math.min(dmText.scrollHeight, 120) + 'px';
        });
        dmText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (dmText.value.trim()) this.handleSendDM();
            }
        });
    }

    async showDMList() {
        // Hide other views, show DM list
        this.$('topicsView').style.display = 'none';
        this.$('topicFeedView').style.display = 'none';
        this.$('followingView').style.display = 'none';
        this.$('userPostsView').style.display = 'none';
        this.$('dmChatView').style.display = 'none';
        this.$('dmListView').style.display = '';

        // Ensure community section is visible
        if (this.currentTab !== 'community') {
            this.switchTab('community');
        }
        this.$('mainBody').style.display = 'none';
        this.$('communitySection').style.display = '';

        // Load conversations
        const conversations = await Messages.getConversations();
        this.renderConversationList(conversations);
    }

    hideDMList() {
        this.$('dmListView').style.display = 'none';
        // Return to current community view
        if (this.currentTopicId) {
            this.showTopicFeed(this.currentTopicId, this.currentTopicData);
        } else {
            this.showTopicsListing();
        }
    }

    async showDMChat(convId, otherUser) {
        this._dmConversationId = convId;
        this._dmOtherUser = otherUser;

        // Hide DM list, show chat
        this.$('dmListView').style.display = 'none';
        this.$('topicsView').style.display = 'none';
        this.$('topicFeedView').style.display = 'none';
        this.$('followingView').style.display = 'none';
        this.$('userPostsView').style.display = 'none';
        this.$('dmChatView').style.display = 'flex';

        // Ensure community section is visible
        this.$('mainBody').style.display = 'none';
        this.$('communitySection').style.display = '';

        // Set header
        const avatarEl = this.$('dmChatAvatar');
        if (otherUser.photo) {
            avatarEl.innerHTML = `<img src="${otherUser.photo}" alt="${this.escapeHTML(otherUser.name)}">`;
        } else {
            const initial = (otherUser.name || 'U')[0].toUpperCase();
            avatarEl.innerHTML = `<span class="avatar-initial">${initial}</span>`;
        }
        this.$('dmChatName').textContent = otherUser.name || 'Usuario';

        // Clear composer
        this.$('dmComposerText').value = '';
        this.$('dmSendBtn').disabled = true;

        // Load messages
        const messages = await Messages.loadMessages(convId);
        this.renderMessages(messages);

        // Mark as read
        await Messages.markAsRead(convId);
    }

    hideDMChat() {
        this.$('dmChatView').style.display = 'none';
        this._dmConversationId = null;
        this._dmOtherUser = null;
        // Return to DM list
        this.showDMList();
    }

    async handleSendDM() {
        const textarea = this.$('dmComposerText');
        const content = textarea.value.trim();
        if (!content || !this._dmConversationId) return;

        // Validate
        const lenCheck = Validation.text(content, 'messageContent');
        if (!lenCheck.valid) {
            ErrorHandler.showToast(lenCheck.error, 'warning');
            return;
        }

        // Content filter
        const filterResult = ContentFilter.check(content);
        if (filterResult.blocked) {
            ErrorHandler.showToast(ContentFilter.message(filterResult.type), 'warning');
            return;
        }

        // Send
        this.$('dmSendBtn').disabled = true;
        const { message, error } = await Messages.sendMessage(this._dmConversationId, content);
        if (error) {
            this.$('dmSendBtn').disabled = false;
            return;
        }

        // Append sent message to chat
        this.appendMessage(message);
        textarea.value = '';
        textarea.style.height = 'auto';
        this.$('dmSendBtn').disabled = true;
    }

    async openDMWith(userId, userName) {
        if (!this.currentUser) {
            this.openOverlay('authModal');
            return;
        }

        const convId = await Messages.getOrCreateConversation(userId);
        if (!convId) return;

        this.showDMChat(convId, { id: userId, name: userName, photo: null });
    }

    renderConversationList(conversations) {
        const list = this.$('dmConvList');
        const empty = this.$('dmListEmpty');

        if (!conversations || conversations.length === 0) {
            list.innerHTML = '';
            empty.style.display = '';
            return;
        }

        empty.style.display = 'none';
        list.innerHTML = conversations.map(c => {
            const unread = c.unread_count > 0;
            const initial = (c.other_user_name || 'U')[0].toUpperCase();
            const avatarHTML = c.other_user_photo
                ? `<img src="${c.other_user_photo}" alt="${this.escapeHTML(c.other_user_name)}">`
                : `<span class="avatar-initial">${initial}</span>`;
            const time = c.last_message_at ? this._dmTimeAgo(c.last_message_at) : '';
            const preview = c.last_message
                ? this.escapeHTML(c.last_message.substring(0, 60))
                : '<em>Nova conversa</em>';

            return `
                <div class="dm-conv-card${unread ? ' unread' : ''}"
                     data-conv-id="${c.conversation_id}"
                     data-other-id="${c.other_user_id}"
                     data-other-name="${this.escapeHTML(c.other_user_name || '')}"
                     data-other-photo="${c.other_user_photo || ''}">
                    <div class="dm-conv-avatar">${avatarHTML}</div>
                    <div class="dm-conv-info">
                        <div class="dm-conv-name">${this.escapeHTML(c.other_user_name || 'Usuario')}</div>
                        <div class="dm-conv-preview">${preview}</div>
                    </div>
                    <div class="dm-conv-meta">
                        <span class="dm-conv-time">${time}</span>
                        ${unread ? '<div class="dm-conv-unread-dot"></div>' : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Click handlers for conversation cards
        list.querySelectorAll('.dm-conv-card').forEach(card => {
            card.addEventListener('click', () => {
                const convId = card.dataset.convId;
                const otherUser = {
                    id: card.dataset.otherId,
                    name: card.dataset.otherName,
                    photo: card.dataset.otherPhoto || null,
                };
                this.showDMChat(convId, otherUser);
            });
        });
    }

    renderMessages(messages) {
        const list = this.$('dmMessagesList');
        list.innerHTML = '';

        if (!messages || messages.length === 0) return;

        let lastDate = '';
        messages.forEach(msg => {
            // Date separator
            const msgDate = new Date(msg.created_at).toLocaleDateString('pt-BR');
            if (msgDate !== lastDate) {
                lastDate = msgDate;
                const sep = document.createElement('div');
                sep.className = 'dm-date-sep';
                sep.textContent = msgDate;
                list.appendChild(sep);
            }

            list.appendChild(this._buildMessageEl(msg));
        });

        // Scroll to bottom
        list.scrollTop = list.scrollHeight;
    }

    appendMessage(msg) {
        const list = this.$('dmMessagesList');
        list.appendChild(this._buildMessageEl(msg));
        list.scrollTop = list.scrollHeight;
    }

    _buildMessageEl(msg) {
        const isSent = msg.sender_id === this.currentUser?.id;
        const el = document.createElement('div');
        el.className = `dm-message ${isSent ? 'dm-message-sent' : 'dm-message-received'}`;
        el.dataset.messageId = msg.id;

        const time = new Date(msg.created_at).toLocaleTimeString('pt-BR', {
            hour: '2-digit', minute: '2-digit'
        });

        const readIndicator = isSent
            ? `<span class="dm-read-indicator${msg.read_at ? ' read' : ''}">✓✓</span>`
            : '';

        el.innerHTML = `
            <div>${this.escapeHTML(msg.content)}</div>
            <div class="dm-message-time">${time}${readIndicator}</div>
        `;
        return el;
    }

    _onRealtimeDM(msg) {
        // If the chat for this conversation is currently open, append the message
        if (this._dmConversationId && msg.conversation_id === this._dmConversationId) {
            this.appendMessage(msg);
            // Mark as read since user is viewing
            Messages.markAsRead(this._dmConversationId);
        }
    }

    _dmTimeAgo(dateStr) {
        const now = new Date();
        const date = new Date(dateStr);
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'agora';
        if (diff < 3600) return Math.floor(diff / 60) + ' min';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd';
        return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// ============================================================
//  BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await ContentFilter.loadFromDB();
    window.app = new AcolheBemApp();
    window.acolheBemApp = window.app;
});
