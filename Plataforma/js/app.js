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
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
        this.spawn(60);
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
//  MAIN APP
// ============================================================
class AcolheBemApp {
    constructor() {
        this.gender = 'women'; // default tab
        this.currentTab = 'women'; // tracks active view: women | men | community
        this.data = TOPICS_DATA[this.gender];
        this.currentUser = null;
        this.currentProfile = null;
        this.feedOffset = 0;
        this.feedLoading = false;
        this._pendingGateLink = null;
        this.currentTopicId = null;
        this.currentTopicData = null;
        this.communityFilters = { gender: '', ageRange: '' };
        this.init();
    }

    init() {
        this.$  = id => document.getElementById(id);
        this.$$ = sel => document.querySelectorAll(sel);

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
                if (this.data && this.currentTab !== 'community') this.renderHeroViz();
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

        // load default tab (women)
        this.applyTheme();
        this.buildContent();
        this.renderHeroViz();
        this.revealCards();
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
                this.$$('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const isLogin = tab.dataset.authTab === 'login';
                this.$('loginForm').style.display = isLogin ? 'flex' : 'none';
                this.$('signupForm').style.display = isLogin ? 'none' : 'flex';
            });
        });

        // Login form
        this.$('loginForm').addEventListener('submit', e => this.handleLogin(e));

        // Signup form
        this.$('signupForm').addEventListener('submit', e => this.handleSignup(e));

        // Listen for auth state changes
        Auth.onAuthChange(async (event, session) => {
            if (session?.user) {
                this.currentUser = session.user;
                const profile = await Profile.getProfile(session.user.id);
                // Profile may be null right after signup (before email confirmation triggers profile creation)
                this.currentProfile = profile;
                this.updateTopbarUser();
            } else {
                this.currentUser = null;
                this.currentProfile = null;
                this.updateTopbarUser();
            }
        });

        // Check initial auth state
        this.checkInitialAuth();
    }

    async checkInitialAuth() {
        const user = await Auth.getCurrentUser();
        if (user) {
            this.currentUser = user;
            this.currentProfile = await Profile.getProfile(user.id);
            this.updateTopbarUser();
        }
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
        btn.disabled = true;
        btn.textContent = 'Entrando...';

        const email = this.$('loginEmail').value;
        const password = this.$('loginPassword').value;

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

    async handleSignup(e) {
        e.preventDefault();
        const btn = this.$('signupSubmitBtn');
        const errEl = this.$('signupError');
        const successEl = this.$('signupSuccess');
        errEl.classList.remove('visible');
        if (successEl) successEl.classList.remove('visible');
        btn.disabled = true;
        btn.textContent = 'Criando conta...';

        const { error } = await Auth.signUp(
            this.$('signupEmail').value,
            this.$('signupPassword').value,
            {
                name: this.$('signupName').value,
                whatsapp: this.$('signupWhatsapp').value,
                city: this.$('signupCity').value,
                state: this.$('signupState').value,
                bio: this.$('signupBio').value,
                gender: this.$('signupGender').value || null,
                birth_year: this.$('signupBirthYear').value ? parseInt(this.$('signupBirthYear').value) : null,
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
            loginErr.textContent = 'Conta criada! Faça login com seu e-mail e senha.';
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
        this.openOverlay('profileModal');
    }

    async handleProfileSave(e) {
        e.preventDefault();
        const errEl = this.$('profileError');
        const successEl = this.$('profileSuccess');
        errEl.classList.remove('visible');
        successEl.classList.remove('visible');

        const updates = {
            name: this.$('profileName').value,
            whatsapp: this.$('profileWhatsapp').value,
            city: this.$('profileCity').value || null,
            state: this.$('profileState').value || null,
            bio: this.$('profileBio').value || null,
            gender: this.$('profileGender').value || null,
            birth_year: this.$('profileBirthYear').value ? parseInt(this.$('profileBirthYear').value) : null,
        };

        // Handle avatar upload
        const avatarFile = this.$('profileAvatarInput').files[0];
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

        // Feed login button
        this.$('feedLoginBtn').addEventListener('click', () => {
            this.openOverlay('authModal');
        });

        // Back to topics button
        this.$('backToTopicsBtn').addEventListener('click', () => this.handleBackToTopics());

        // Create topic button & modal
        this.$('createTopicBtn').addEventListener('click', () => this.showCreateTopicModal());
        this.$('createTopicCloseBtn').addEventListener('click', () => this.closeOverlay('createTopicModal'));
        this.$('createTopicForm').addEventListener('submit', e => this.handleCreateTopic(e));

        // Filters
        this.$('filterGender').addEventListener('change', () => this.handleFilterChange());
        this.$('filterAge').addEventListener('change', () => this.handleFilterChange());
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
        const posts = await Feed.loadPosts(this.currentTopicId, 20, 0);
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
        const posts = await Feed.loadPosts(this.currentTopicId, 20, this.feedOffset);
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

        const postBtn = this.$('postBtn');
        postBtn.disabled = true;

        const isAnonymous = this.$('anonCheckbox').checked;
        const { post, error } = await Feed.createPost(content, this.currentTopicId, isAnonymous);
        postBtn.disabled = false;

        if (error) {
            alert(error);
            return;
        }

        composerText.value = '';
        postBtn.disabled = true;
        this.$('anonCheckbox').checked = false;
        this.$('feedEmpty').style.display = 'none';

        const feedList = this.$('feedList');
        feedList.prepend(this.buildPostCard(post));
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
            authorName = post.author?.name || 'Voce';
            authorPhoto = post.author?.photo_url;
            initial = authorName[0].toUpperCase();
            avatarHTML = authorPhoto
                ? `<img src="${authorPhoto}" alt="${authorName}">`
                : `<span class="avatar-initial">${initial}</span>`;
            nameHTML = `<span class="feed-post-name">${this.escapeHTML(authorName)}</span> <span class="anon-label">(anonimo)</span>`;
        } else {
            authorName = post.author?.name || 'Usuario';
            authorPhoto = post.author?.photo_url;
            initial = authorName[0].toUpperCase();
            avatarHTML = authorPhoto
                ? `<img src="${authorPhoto}" alt="${authorName}">`
                : `<span class="avatar-initial">${initial}</span>`;
            nameHTML = `<span class="feed-post-name">${this.escapeHTML(authorName)}</span>`;
        }

        const date = new Date(post.created_at).toLocaleDateString('pt-BR', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const heartSVG = post.userReacted
            ? `<svg viewBox="0 0 24 24" fill="#e53935" stroke="#e53935" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

        card.innerHTML = `
            <div class="feed-post-header">
                <div class="feed-post-avatar${isAnon && !isOwn ? ' feed-post-avatar-anon' : ''}">${avatarHTML}</div>
                <div>
                    <div>${nameHTML}</div>
                    <div class="feed-post-date">${date}</div>
                </div>
                ${isOwn ? '<button class="feed-post-delete" title="Excluir">excluir</button>' : ''}
            </div>
            <div class="feed-post-content">${this.escapeHTML(post.content)}</div>
            <div class="feed-post-actions">
                <button class="feed-action-btn like-btn ${post.userReacted ? 'liked' : ''}" data-post-id="${post.id}">
                    ${heartSVG}
                    <span class="like-count">${post.reactionCount}</span>
                </button>
                <button class="feed-action-btn reply-toggle-btn" data-post-id="${post.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span class="reply-count">${post.replyCount}</span>
                </button>
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

        // Delete handler
        const deleteBtn = card.querySelector('.feed-post-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Excluir esta publicação?')) return;
                const { error } = await Feed.deletePost(post.id);
                if (!error) card.remove();
            });
        }

        // Like handler
        const likeBtn = card.querySelector('.like-btn');
        likeBtn.addEventListener('click', async () => {
            if (!this.currentUser) { this.openOverlay('authModal'); return; }
            const { liked, error } = await Feed.toggleReaction(post.id);
            if (error) return;
            const countEl = likeBtn.querySelector('.like-count');
            let count = parseInt(countEl.textContent) || 0;
            if (liked) {
                likeBtn.classList.add('liked');
                likeBtn.querySelector('svg').outerHTML = `<svg viewBox="0 0 24 24" fill="#e53935" stroke="#e53935" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
                countEl.textContent = count + 1;
            } else {
                likeBtn.classList.remove('liked');
                likeBtn.querySelector('svg').outerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
                countEl.textContent = Math.max(0, count - 1);
            }
        });

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
            name = reply.author?.name || 'Voce';
            photo = reply.author?.photo_url;
            initial = name[0].toUpperCase();
            avatarHTML = photo
                ? `<img src="${photo}" alt="${name}">`
                : `<span class="avatar-initial">${initial}</span>`;
            displayName = `${this.escapeHTML(name)} <span class="anon-label">(anonimo)</span>`;
        } else {
            name = reply.author?.name || 'Usuario';
            photo = reply.author?.photo_url;
            initial = name[0].toUpperCase();
            avatarHTML = photo
                ? `<img src="${photo}" alt="${name}">`
                : `<span class="avatar-initial">${initial}</span>`;
            displayName = this.escapeHTML(name);
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

        // update tab buttons
        this.$$('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        if (tab === 'community') {
            this.showCommunity();
        } else {
            this.hideCommunity();
            if (this.gender !== tab) {
                this.gender = tab;
                this.data = TOPICS_DATA[tab];
            }
            this.applyTheme();
            this.buildContent();
            this.renderHeroViz();
            this.revealCards();
        }
    }

    showCommunity() {
        this.$('mainBody').style.display = 'none';
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

    async showTopicsListing() {
        this.$('topicsView').style.display = '';
        this.$('topicFeedView').style.display = 'none';
        this.currentTopicId = null;
        this.currentTopicData = null;

        const topicsList = this.$('topicsList');
        topicsList.innerHTML = '<div style="text-align:center;padding:24px;color:var(--ink-20)">Carregando temas...</div>';

        const topics = await Feed.loadTopics();
        topicsList.innerHTML = '';

        if (topics.length === 0) {
            topicsList.innerHTML = '<div style="text-align:center;padding:24px;color:var(--ink-40)">Nenhum tema encontrado.</div>';
            return;
        }

        topics.forEach(topic => {
            topicsList.appendChild(this.buildTopicItem(topic));
        });
    }

    buildTopicItem(topic) {
        const item = document.createElement('div');
        item.className = 'topic-item';
        item.innerHTML = `
            <span class="topic-item-emoji">${topic.emoji}</span>
            <div class="topic-item-info">
                <div class="topic-item-name">${this.escapeHTML(topic.name)}</div>
                <div class="topic-item-desc">${topic.description ? this.escapeHTML(topic.description) : ''}</div>
            </div>
            <div class="topic-item-meta">
                <span class="topic-item-count">${topic.post_count || 0}</span>
                <svg class="topic-item-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        `;
        item.addEventListener('click', () => {
            this.currentTopicId = topic.id;
            this.currentTopicData = topic;
            this.showTopicFeed(topic.id, topic);
        });
        return item;
    }

    async showTopicFeed(topicId, topicData) {
        this.$('topicsView').style.display = 'none';
        this.$('topicFeedView').style.display = '';
        this.$('topicFeedTitle').innerHTML = `<span>${topicData.emoji}</span> ${this.escapeHTML(topicData.name)}`;
        this.updateFeedComposerVisibility();
        this.communityFilters = { gender: '', ageRange: '' };
        this.$('filterGender').value = '';
        this.$('filterAge').value = '';
        this.$('anonCheckbox').checked = false;
        await this.loadFeed();
    }

    handleBackToTopics() {
        this.currentTopicId = null;
        this.currentTopicData = null;
        this.showTopicsListing();
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
        this.$('createTopicForm').reset();
        this.$('createTopicError').classList.remove('visible');
        this.openOverlay('createTopicModal');
    }

    async handleCreateTopic(e) {
        e.preventDefault();
        const btn = this.$('createTopicSubmitBtn');
        const errEl = this.$('createTopicError');
        errEl.classList.remove('visible');
        btn.disabled = true;
        btn.textContent = 'Criando...';

        const name = this.$('topicName').value.trim();
        const emoji = this.$('topicEmoji').value.trim() || '💬';
        const description = this.$('topicDescription').value.trim();

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
        if (this.currentTab === 'community') {
            // neutral theme for community
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
                    <div class="fi-count">${c.subtopics.length} subtemas</div>
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

            // Build WhatsApp button: gated or direct
            const wppBtnHTML = `
                <button class="wpp-btn-big wpp-gate-btn" style="--btn-color:${c.color}" data-link="${c.link}">
                    ${wppIcon}
                    <span>Entrar no grupo</span>
                </button>`;

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
                        ${wppBtnHTML}
                    </div>
                </div>`;

            const hdr = card.querySelector('.tc-header');
            hdr.addEventListener('click', () => {
                const wasOpen = card.classList.contains('open');
                // close all others
                area.querySelectorAll('.topic-card.open').forEach(other => {
                    other.classList.remove('open');
                    other.querySelector('.tc-header').setAttribute('aria-expanded', false);
                });
                // toggle this one
                if (!wasOpen) {
                    card.classList.add('open');
                    hdr.setAttribute('aria-expanded', true);
                }
            });
            hdr.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hdr.click(); }
            });

            // Gate button handler
            const gateBtn = card.querySelector('.wpp-gate-btn');
            gateBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const link = gateBtn.dataset.link;
                if (link === '#') {
                    alert('Este grupo ainda não está disponível.');
                    return;
                }
                if (this.currentUser) {
                    window.open(link, '_blank');
                } else {
                    this.openGate(link);
                }
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
        const rx = Math.min(W * .40, 480);
        const ry = Math.min(H * .35, 280);
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
                .attr('stroke', `url(#lg-${i})`).attr('stroke-width', 2.5)
                .attr('stroke-dasharray','8 5').attr('stroke-linecap','round');

            line.transition().duration(900).delay(200 + i * 100)
                .attr('x2', n.x).attr('y2', n.y);

            // flowing dot
            const dot = lineG.append('circle')
                .attr('cx', cx).attr('cy', cy).attr('r', 4.5)
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
            hub.append('circle').attr('r', 50).attr('fill','none')
                .attr('stroke', accent).attr('stroke-width', 1.5).attr('opacity', 0)
                .each(function() {
                    const el = d3.select(this);
                    const pulse = () => {
                        el.attr('r', 50).attr('opacity', .4)
                            .transition().duration(2800).ease(d3.easeQuadOut)
                            .attr('r', 110).attr('opacity', 0)
                            .on('end', pulse);
                    };
                    setTimeout(pulse, i * 900);
                });
        }

        hub.append('circle').attr('r', 54).attr('fill','white')
            .attr('stroke', accent).attr('stroke-width', 2.5);
        hub.append('circle').attr('r', 48).attr('fill', isFem ? '#fff0f6' : '#e7f5ff');

        // SVG character illustration
        const person = hub.append('g').attr('transform','translate(0,-4)');
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

        hub.append('text').attr('text-anchor','middle').attr('y', 76)
            .attr('font-size', 14).attr('font-weight', 600).attr('fill', accent)
            .attr('font-family','DM Sans, sans-serif').text('AcolheBem');

        hub.transition().duration(500).style('opacity', 1);

        // topic nodes
        nodes.forEach((n, i) => {
            const g = svg.append('g').attr('class','topic-node')
                .attr('transform', `translate(${n.x},${n.y})`)
                .style('opacity', 0).style('cursor','pointer');

            g.append('circle').attr('r', 68).attr('fill', n.c.color).attr('opacity', .07)
                .attr('filter', `url(#glow-${n.c.id})`);
            g.append('circle').attr('r', 56).attr('fill','white')
                .attr('stroke', n.c.color).attr('stroke-width', 3)
                .attr('filter', `url(#glow-${n.c.id})`);
            g.append('circle').attr('r', 48).attr('fill', n.c.colorLight);

            g.append('text').attr('text-anchor','middle').attr('dominant-baseline','central')
                .attr('font-size', 34).attr('y', -2).text(n.c.icon);

            g.append('circle').attr('cx', 38).attr('cy', -38).attr('r', 18)
                .attr('fill', n.c.color).attr('stroke','white').attr('stroke-width', 2.5);
            g.append('text').attr('x', 38).attr('y', -38)
                .attr('text-anchor','middle').attr('dominant-baseline','central')
                .attr('font-size', 16).attr('font-weight', 800).attr('fill','white').text(n.c.id);

            const lbl = n.c.title.length > 28 ? n.c.title.slice(0,27)+'…' : n.c.title;
            const tw = lbl.length * 7.5 + 28;
            g.append('rect').attr('x', -tw/2).attr('y', 62).attr('width', tw).attr('height', 30)
                .attr('rx', 15).attr('fill','white').attr('stroke', n.c.color).attr('stroke-width', 1.5).attr('opacity', .95);
            g.append('text').attr('y', 77).attr('text-anchor','middle')
                .attr('dominant-baseline','central')
                .attr('font-size', 13).attr('font-weight', 600).attr('fill', '#333')
                .attr('font-family','DM Sans, sans-serif').text(lbl);

            g.append('text').attr('y', 102).attr('text-anchor','middle')
                .attr('font-size', 12).attr('fill','#888')
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

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// ============================================================
//  BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AcolheBemApp();
});
