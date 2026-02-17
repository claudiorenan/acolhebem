/**
 * AcolheBem — Premium App
 * Particle system + D3.js hero + animated cards
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
            // mouse repel
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
        // draw lines between close particles
        this.ctx.globalAlpha = .04;
        this.ctx.strokeStyle = '#2f6f64';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const a = this.particles[i], b = this.particles[j];
                const dx = a.x - b.x, dy = a.y - b.y;
                const d = dx*dx + dy*dy;
                if (d < 14000) {
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
        this.gender = null;
        this.data = null;
        this.init();
    }

    init() {
        this.$  = id => document.getElementById(id);
        this.$$ = sel => document.querySelectorAll(sel);

        // particles
        this.particles = new ParticleSystem(this.$('particleCanvas'));

        // gender buttons
        this.$$('.gender-card').forEach(btn => {
            btn.addEventListener('click', () => this.onGenderSelect(btn.dataset.gender));
        });

        // topbar buttons
        this.$('backBtn').addEventListener('click', () => this.goBack());
        this.$('indexBtn').addEventListener('click', () => this.toggleIndex(true));
        this.$('fiClose').addEventListener('click', () => this.toggleIndex(false));
        this.$('fiBackdrop').addEventListener('click', () => this.toggleIndex(false));

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') this.toggleIndex(false);
        });

        // scroll observer
        this.observer = new IntersectionObserver(entries => {
            entries.forEach(en => {
                if (en.isIntersecting) { en.target.classList.add('visible'); this.observer.unobserve(en.target); }
            });
        }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
    }

    // ========================================
    //  GENDER SELECT → TRANSITION → GROUPS
    // ========================================
    async onGenderSelect(g) {
        this.gender = g;
        this.data = TOPICS_DATA[g];
        const accent = this.data.accentColor;

        // transition overlay
        const ov = this.$('transition-overlay');
        const fill = this.$('tlFill');
        const txt = this.$('transText');
        const icon = this.$('transIcon');

        icon.textContent = g === 'women' ? '👩' : '👨';
        fill.style.background = `linear-gradient(90deg, ${accent}, var(--gold))`;
        fill.style.width = '0%';
        ov.classList.add('active');

        const msgs = LOADING_MESSAGES;
        for (let i = 0; i < msgs.length; i++) {
            txt.style.opacity = 0;
            await this.sleep(180);
            txt.textContent = msgs[i].text;
            txt.style.opacity = 1;
            fill.style.width = msgs[i].progress + '%';
            await this.sleep(600);
        }
        await this.sleep(350);

        // build & show
        this.buildGroupsScreen();
        this.$('welcome-screen').classList.remove('active');
        const gs = this.$('groups-screen');
        gs.classList.add('active', g === 'women' ? 'theme-women' : 'theme-men');
        ov.classList.remove('active');

        // animate viz
        await this.sleep(80);
        this.renderHeroViz();

        // reveal cards — desktop: all visible immediately; mobile: scroll-triggered
        await this.sleep(200);
        const isDesktop = window.innerWidth >= 1024;
        this.$$('.topic-card').forEach((c, i) => {
            if (isDesktop) {
                setTimeout(() => c.classList.add('visible'), 80 * i);
            } else {
                this.observer.observe(c);
            }
        });
    }

    // ========================================
    //  BUILD GROUPS SCREEN
    // ========================================
    buildGroupsScreen() {
        const d = this.data;
        this.$('topbarTitle').textContent = d.title;
        this.$('topbarSub').textContent = d.subtitle;
        this.buildIndex(d.categories);
        this.buildCards(d.categories);
    }

    buildIndex(cats) {
        const ul = this.$('fiList');
        ul.innerHTML = '';

        // Tópicos
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

        // Separador
        const sep = document.createElement('li');
        sep.className = 'fi-separator';
        sep.innerHTML = '<hr>';
        ul.appendChild(sep);

        // Grupo geral
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

        // Link parceiro
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

        cats.forEach(c => {
            const card = document.createElement('div');
            card.className = 'topic-card';
            card.id = 'topic-' + c.id;

            // subtópicos como tags (temas do grupo)
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
                        <a href="${c.link}" target="_blank" rel="noopener noreferrer" class="wpp-btn-big" style="--btn-color:${c.color}">
                            ${wppIcon}
                            <span>Entrar no grupo</span>
                        </a>
                    </div>
                </div>`;

            const hdr = card.querySelector('.tc-header');
            hdr.addEventListener('click', () => {
                const open = card.classList.toggle('open');
                hdr.setAttribute('aria-expanded', open);
            });
            hdr.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hdr.click(); }
            });

            area.appendChild(card);
        });

        // Grupo geral "Quem Cuida de Quem Cuida"
        const general = document.createElement('div');
        general.className = 'general-card visible';
        general.innerHTML = `
            <div class="gc-badge">${GENERAL_GROUP.icon}</div>
            <h3 class="gc-card-title">${GENERAL_GROUP.title}</h3>
            <p class="gc-card-desc">${GENERAL_GROUP.description}</p>
            <a href="${GENERAL_GROUP.link}" target="_blank" rel="noopener noreferrer" class="wpp-btn-big wpp-btn-general">
                ${wppIcon}
                <span>Entrar no grupo geral</span>
            </a>
        `;
        area.appendChild(general);

        // Link parceiro
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

        // Mini footer inside panel (visible on desktop where main footer is hidden)
        const miniFooter = document.createElement('div');
        miniFooter.className = 'panel-footer';
        miniFooter.innerHTML = `<span>💚</span> AcolheBem — Você não está sozinho(a)`;
        area.appendChild(miniFooter);
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

        // subtle grid pattern
        const grid = svg.append('g').attr('opacity',.04);
        for (let x = 0; x < W; x += 40) grid.append('line').attr('x1',x).attr('y1',0).attr('x2',x).attr('y2',H).attr('stroke','#666');
        for (let y = 0; y < H; y += 40) grid.append('line').attr('x1',0).attr('y1',y).attr('x2',W).attr('y2',y).attr('stroke','#666');

        // node positions — escala com o espaço disponível
        const rx = Math.min(W * .40, 480);
        const ry = Math.min(H * .35, 280);
        const nodes = cats.map((c, i) => {
            const a = -Math.PI / 2 + (i / cats.length) * Math.PI * 2;
            return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), c };
        });

        // animated connection lines with flowing particles
        const lineG = svg.append('g');
        nodes.forEach((n, i) => {
            // gradient for line
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

            // flowing dot along line
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

        // center hub — grande e visível
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

        // Ilustração SVG — Mulher ou Homem
        const person = hub.append('g').attr('transform','translate(0,-4)');
        if (isFem) {
            // Cabelo longo
            person.append('ellipse').attr('cx',0).attr('cy',-8).attr('rx',14).attr('ry',16).attr('fill','#5c3d2e');
            person.append('path').attr('d','M-14,-8 Q-16,10 -12,18 Q-10,22 -8,18 Q-8,2 -10,-4Z').attr('fill','#5c3d2e');
            person.append('path').attr('d','M14,-8 Q16,10 12,18 Q10,22 8,18 Q8,2 10,-4Z').attr('fill','#5c3d2e');
            // Rosto
            person.append('circle').attr('cx',0).attr('cy',-6).attr('r',12).attr('fill','#fcd5b4').attr('stroke','#d4a574').attr('stroke-width',.8);
            // Franja
            person.append('path').attr('d','M-10,-14 Q-6,-20 0,-18 Q6,-20 10,-14 Q8,-16 4,-17 Q0,-15 -4,-17 Q-8,-16 -10,-14Z').attr('fill','#5c3d2e');
            // Olhos
            person.append('ellipse').attr('cx',-4).attr('cy',-8).attr('rx',1.8).attr('ry',2.2).attr('fill','#333');
            person.append('ellipse').attr('cx',4).attr('cy',-8).attr('rx',1.8).attr('ry',2.2).attr('fill','#333');
            person.append('circle').attr('cx',-3.4).attr('cy',-8.5).attr('r',.6).attr('fill','#fff');
            person.append('circle').attr('cx',4.6).attr('cy',-8.5).attr('r',.6).attr('fill','#fff');
            // Bochechas
            person.append('ellipse').attr('cx',-8).attr('cy',-4).attr('rx',2.5).attr('ry',1.5).attr('fill','#f4b8a0').attr('opacity',.5);
            person.append('ellipse').attr('cx',8).attr('cy',-4).attr('rx',2.5).attr('ry',1.5).attr('fill','#f4b8a0').attr('opacity',.5);
            // Sorriso
            person.append('path').attr('d','M-3,-2 Q0,2 3,-2').attr('fill','none').attr('stroke','#c47a5a').attr('stroke-width',1).attr('stroke-linecap','round');
            // Corpo (blusa/vestido)
            person.append('path').attr('d','M-12,8 Q-14,6 -12,4 Q-6,2 0,4 Q6,2 12,4 Q14,6 12,8 L14,24 Q8,28 0,28 Q-8,28 -14,24Z').attr('fill', accent);
            // Gola V
            person.append('path').attr('d','M-4,6 L0,12 L4,6').attr('fill','none').attr('stroke','#fff').attr('stroke-width',1.2).attr('stroke-linecap','round');
            // Braços
            person.append('path').attr('d','M-12,8 Q-18,14 -16,20').attr('fill','none').attr('stroke','#fcd5b4').attr('stroke-width',4).attr('stroke-linecap','round');
            person.append('path').attr('d','M12,8 Q18,14 16,20').attr('fill','none').attr('stroke','#fcd5b4').attr('stroke-width',4).attr('stroke-linecap','round');
            // Mãos
            person.append('circle').attr('cx',-16).attr('cy',20).attr('r',2.5).attr('fill','#fcd5b4');
            person.append('circle').attr('cx',16).attr('cy',20).attr('r',2.5).attr('fill','#fcd5b4');
        } else {
            // Cabelo curto
            person.append('ellipse').attr('cx',0).attr('cy',-12).attr('rx',13).attr('ry',10).attr('fill','#3e2723');
            // Rosto
            person.append('circle').attr('cx',0).attr('cy',-6).attr('r',12).attr('fill','#fcd5b4').attr('stroke','#d4a574').attr('stroke-width',.8);
            // Cabelo topo
            person.append('path').attr('d','M-11,-12 Q-10,-20 0,-19 Q10,-20 11,-12 Q10,-14 6,-16 Q0,-18 -6,-16 Q-10,-14 -11,-12Z').attr('fill','#3e2723');
            // Sobrancelhas
            person.append('path').attr('d','M-7,-11 Q-4,-13 -2,-11').attr('fill','none').attr('stroke','#3e2723').attr('stroke-width',1).attr('stroke-linecap','round');
            person.append('path').attr('d','M2,-11 Q4,-13 7,-11').attr('fill','none').attr('stroke','#3e2723').attr('stroke-width',1).attr('stroke-linecap','round');
            // Olhos
            person.append('ellipse').attr('cx',-4).attr('cy',-8).attr('rx',1.8).attr('ry',2.2).attr('fill','#333');
            person.append('ellipse').attr('cx',4).attr('cy',-8).attr('rx',1.8).attr('ry',2.2).attr('fill','#333');
            person.append('circle').attr('cx',-3.4).attr('cy',-8.5).attr('r',.6).attr('fill','#fff');
            person.append('circle').attr('cx',4.6).attr('cy',-8.5).attr('r',.6).attr('fill','#fff');
            // Sorriso
            person.append('path').attr('d','M-3,-2 Q0,1.5 3,-2').attr('fill','none').attr('stroke','#c47a5a').attr('stroke-width',1).attr('stroke-linecap','round');
            // Corpo (camisa)
            person.append('path').attr('d','M-14,8 Q-16,6 -14,4 Q-8,0 0,2 Q8,0 14,4 Q16,6 14,8 L16,26 Q8,30 0,30 Q-8,30 -16,26Z').attr('fill', accent);
            // Gola
            person.append('path').attr('d','M-5,5 L0,11 L5,5').attr('fill','none').attr('stroke','#fff').attr('stroke-width',1.2).attr('stroke-linecap','round');
            // Ombros/braços
            person.append('path').attr('d','M-14,8 Q-20,14 -18,22').attr('fill','none').attr('stroke','#fcd5b4').attr('stroke-width',5).attr('stroke-linecap','round');
            person.append('path').attr('d','M14,8 Q20,14 18,22').attr('fill','none').attr('stroke','#fcd5b4').attr('stroke-width',5).attr('stroke-linecap','round');
            // Mãos
            person.append('circle').attr('cx',-18).attr('cy',22).attr('r',3).attr('fill','#fcd5b4');
            person.append('circle').attr('cx',18).attr('cy',22).attr('r',3).attr('fill','#fcd5b4');
        }

        hub.append('text').attr('text-anchor','middle').attr('y', 76)
            .attr('font-size', 14).attr('font-weight', 600).attr('fill', accent)
            .attr('font-family','DM Sans, sans-serif').text('AcolheBem');

        hub.transition().duration(500).style('opacity', 1);

        // topic nodes — grandes e legíveis
        nodes.forEach((n, i) => {
            const g = svg.append('g').attr('class','topic-node')
                .attr('transform', `translate(${n.x},${n.y})`)
                .style('opacity', 0).style('cursor','pointer');

            // outer glow
            g.append('circle').attr('r', 68).attr('fill', n.c.color).attr('opacity', .07)
                .attr('filter', `url(#glow-${n.c.id})`);

            // white ring
            g.append('circle').attr('r', 56).attr('fill','white')
                .attr('stroke', n.c.color).attr('stroke-width', 3)
                .attr('filter', `url(#glow-${n.c.id})`);

            // colored inner
            g.append('circle').attr('r', 48).attr('fill', n.c.colorLight);

            // icon
            g.append('text').attr('text-anchor','middle').attr('dominant-baseline','central')
                .attr('font-size', 34).attr('y', -2).text(n.c.icon);

            // number badge
            g.append('circle').attr('cx', 38).attr('cy', -38).attr('r', 18)
                .attr('fill', n.c.color).attr('stroke','white').attr('stroke-width', 2.5);
            g.append('text').attr('x', 38).attr('y', -38)
                .attr('text-anchor','middle').attr('dominant-baseline','central')
                .attr('font-size', 16).attr('font-weight', 800).attr('fill','white').text(n.c.id);

            // label bg pill
            const lbl = n.c.title.length > 28 ? n.c.title.slice(0,27)+'…' : n.c.title;
            const tw = lbl.length * 7.5 + 28;
            g.append('rect').attr('x', -tw/2).attr('y', 62).attr('width', tw).attr('height', 30)
                .attr('rx', 15).attr('fill','white').attr('stroke', n.c.color).attr('stroke-width', 1.5).attr('opacity', .95);
            g.append('text').attr('y', 77).attr('text-anchor','middle')
                .attr('dominant-baseline','central')
                .attr('font-size', 13).attr('font-weight', 600).attr('fill', '#333')
                .attr('font-family','DM Sans, sans-serif').text(lbl);

            // subtopic count
            g.append('text').attr('y', 102).attr('text-anchor','middle')
                .attr('font-size', 12).attr('fill','#888')
                .attr('font-family','DM Sans, sans-serif')
                .text(n.c.subtopics.length + ' subtemas');

            // entrance animation
            g.transition().duration(700).delay(500 + i * 120)
                .ease(d3.easeBackOut.overshoot(1.2))
                .style('opacity', 1);

            // hover
            g.on('mouseenter', function() {
                d3.select(this).transition().duration(250).ease(d3.easeBackOut)
                    .attr('transform', `translate(${n.x},${n.y}) scale(1.12)`);
            }).on('mouseleave', function() {
                d3.select(this).transition().duration(300)
                    .attr('transform', `translate(${n.x},${n.y}) scale(1)`);
            });

            // click → scroll to card in panel + expand
            g.on('click', () => {
                const el = document.getElementById('topic-' + n.c.id);
                if (!el) return;
                el.classList.add('visible');
                if (!el.classList.contains('open')) el.querySelector('.tc-header').click();
                // on desktop scroll inside panel; on mobile scroll page
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
    goBack() {
        const gs = this.$('groups-screen');
        gs.classList.remove('active','theme-women','theme-men');
        this.$('welcome-screen').classList.add('active');
        this.$('cardsArea').innerHTML = '';
        d3.select(this.$('heroSVG')).selectAll('*').remove();
        this.gender = null; this.data = null;
    }

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
