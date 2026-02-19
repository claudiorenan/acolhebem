# Plano de Execucao: AcolheBem — P0 a P3

> **Objetivo:** Levar o AcolheBem de MVP funcional (~70%) a rede social 100% funcional
> **Criado por:** Orion (AIOS Master) | 2026-02-18
> **Status follow/unfollow:** Em andamento (usuario implementando)

---

## Visao Geral

```
P0 (Critico)       → Semanas 1-2    → Producao segura e estavel
P1 (Features core) → Semanas 3-6    → Rede social completa
P2 (Engajamento)   → Semanas 7-10   → Discovery e retencao
P3 (Qualidade)     → Continuo       → Monitoramento e docs
```

| Prioridade | Items | Estimativa |
|------------|-------|------------|
| P0 | 6 items | 2 semanas |
| P1 | 5 items (follow ja em andamento) | 4 semanas |
| P2 | 6 items | 4 semanas |
| P3 | 5 items | Continuo |

---

## P0 — Critico para Producao (Semanas 1-2)

> Sem isso, a plataforma nao esta pronta para usuarios reais em escala.

### P0.1 — Error Handling Global
**Prioridade:** URGENTE
**Esforco:** 1-2 dias

- [x] Criar error boundary global no app.js (try/catch no init + window.onerror)
- [x] Criar funcao utilitaria `handleError(context, error)` centralizada
- [x] Adicionar try/catch em todas as chamadas Supabase (feed.js, auth.js, profile.js, notifications.js)
- [x] Criar componente de UI para erro amigavel (em vez de falha silenciosa)
- [x] Tratar erros de rede/offline com mensagem "Sem conexao"

**Arquivos afetados:**
- `Plataforma/js/app.js`
- `Plataforma/js/auth.js`
- `Plataforma/js/feed.js`
- `Plataforma/js/profile.js`
- `Plataforma/js/notifications.js`

**Criterio de aceite:** Nenhum erro nao tratado no console. Usuario sempre ve mensagem util.

---

### P0.2 — Input Validation
**Prioridade:** URGENTE (seguranca)
**Esforco:** 1-2 dias

- [x] Criar modulo `validation.js` com funcoes reutilizaveis
- [x] Validar todos os inputs de texto (posts, replies, bio) — max length, min length, caracteres permitidos
- [x] Sanitizar HTML/scripts antes de renderizar (prevenir XSS alem do textContent)
- [x] Validar upload de avatar (tipo de arquivo, tamanho maximo 2MB, dimensoes)
- [x] Adicionar validacao no form de signup (email formato, senha min 8 chars)
- [x] Adicionar feedback visual nos campos invalidos (borda vermelha + mensagem)

**Arquivos a criar/modificar:**
- `Plataforma/js/validation.js` (novo)
- `Plataforma/js/auth.js` (signup/login forms)
- `Plataforma/js/feed.js` (post/reply forms)
- `Plataforma/js/profile.js` (bio/avatar forms)

**Criterio de aceite:** Nenhum input chega ao Supabase sem validacao client-side.

---

### P0.3 — Error Tracking (Sentry)
**Prioridade:** ALTA
**Esforco:** 0.5 dia

- [ ] Criar conta Sentry (free tier: 5K events/mes) ← ACAO MANUAL: criar conta e substituir DSN
- [x] Adicionar Sentry SDK via CDN no index.html
- [x] Configurar Sentry.init com DSN e environment (prod/dev)
- [x] Integrar com handleError() criado no P0.1
- [ ] Configurar source maps para debug em producao
- [ ] Testar captura de erros em staging

**Arquivos afetados:**
- `Plataforma/index.html` (script tag)
- `Plataforma/js/app.js` (Sentry.init + integracoes)

**Criterio de aceite:** Erros em producao aparecem no dashboard Sentry com stack trace.

---

### P0.4 — Testes Automatizados (Base)
**Prioridade:** ALTA
**Esforco:** 3-4 dias

- [x] Configurar Playwright para testes e2e
- [x] Criar testes criticos (smoke tests):
  - [x] Validacao de signup (senha curta, whatsapp invalido, nome vazio)
  - [x] Validacao de login (email invalido)
  - [x] Navegar entre tabs (women, men, community, psicologos)
  - [x] Content filter bloqueia telefone/email/URL/social
  - [x] Validacao de email, senha, whatsapp, avatar
  - [x] ErrorHandler e toast notifications
  - [x] Todos os modulos JS carregam sem erros
  - [x] Acessibilidade (lang, aria-label)
  - [ ] Criar post (anonimo e identificado) — requer auth fixture
  - [ ] Reagir a post (like/unlike) — requer auth fixture
  - [ ] Responder a post — requer auth fixture
  - [ ] Editar perfil + upload avatar — requer auth fixture
  - [ ] Verificar notificacoes — requer auth fixture
  - [ ] Admin modera post — requer admin fixture
- [x] Criar helpers.ts com dismissOverlays() para modal/toast
- [x] Criar script `npm test` no package.json

**Arquivos a criar:**
- `Plataforma/tests/` (diretorio)
- `Plataforma/tests/smoke.spec.ts`
- `Plataforma/tests/auth.spec.ts`
- `Plataforma/tests/feed.spec.ts`
- `Plataforma/tests/admin.spec.ts`
- `Plataforma/playwright.config.ts`

**Criterio de aceite:** `npm test` roda 10+ testes e todos passam.

---

### P0.5 — CI/CD Pipeline
**Prioridade:** ALTA
**Esforco:** 1 dia

- [x] Criar `.github/workflows/ci.yml`:
  - [x] Trigger: push to main + PRs
  - [x] Step 1: Rodar Playwright tests (com upload de report)
  - [x] Step 2: Deploy to Vercel (se tests passam, apenas main)
- [x] Deploy via Vercel CLI no CI (requer VERCEL_TOKEN secret)
- [ ] Adicionar badge de status no README (quando README existir)
- [ ] Proteger branch main (require PR + CI pass) — configurar no GitHub Settings

**Arquivos a criar:**
- `.github/workflows/ci.yml`

**Criterio de aceite:** Push para main so funciona se CI passar. PRs mostram status dos testes.

---

### P0.6 — Rate Limiting por Usuario
**Prioridade:** MEDIA-ALTA
**Esforco:** 1 dia

- [x] Criar tabela `rate_limits` no Supabase (user_id, action, created_at)
- [x] Criar funcao RPC `check_rate_limit(p_action, p_max_count, p_window_seconds)`
- [x] Aplicar rate limits:
  - [x] Criar post: max 10/hora
  - [x] Criar reply: max 30/hora
  - [x] Reactions: max 60/hora (apenas like, unlike livre)
  - [ ] Signup: max 3/hora por IP (via Edge Function) — futuro
- [x] Retornar mensagem amigavel quando limite atingido
- [x] Criar migration SQL (`20260218200000_rate_limits.sql`)
- [x] Graceful degradation: se RPC nao existe, permite acao normalmente

**Arquivos a criar/modificar:**
- `supabase/migrations/XXX_rate_limits.sql` (novo)
- `Plataforma/js/feed.js` (verificar antes de post/reply/react)

**Criterio de aceite:** Spam de posts/reactions e bloqueado com mensagem clara.

---

## P1 — Features Sociais Core (Semanas 3-6)

> Features que usuarios esperam de qualquer rede social.

### P1.1 — Follow/Unfollow ✅ COMPLETO
**Status:** Implementado

- [x] Tabela `user_follows` (follower_id, following_id, created_at) + indices
- [x] RLS policies para follows (SELECT publico, INSERT/DELETE por owner)
- [x] Botao follow/unfollow nos posts do feed
- [x] Contador de followers/following na tela "Seguindo"
- [x] Lista de seguidores/seguindo com tabs (Usuarios / Psicologos)
- [x] Notificacao ao ser seguido (tipo `new_follow` com icone dedicado)
- [x] Feed filtrado por "quem eu sigo" (tabs "Todos" / "Seguindo" no feed)

---

### P1.2 — Busca Full-Text ✅ COMPLETO
**Prioridade:** ALTA

- [x] Habilitar `pg_trgm` e `unaccent` no Supabase
- [x] Criar indices GIN em `posts.content`, `profiles.name`, `topics.name`
- [x] Criar funcao RPC `search_posts(query, limit, offset)` com `similarity()`
- [x] Criar funcao RPC `search_profiles(query, limit)` (nome + bio)
- [x] Criar funcao RPC `search_topics(query, limit)` (nome + descricao)
- [x] Criar UI de busca:
  - [x] Botao busca no topbar + view overlay
  - [x] Resultados em tabs (Posts | Pessoas | Topicos)
  - [x] Highlight do termo buscado nos resultados (`<mark>`)
  - [x] Busca com debounce (300ms) e cache
- [x] Suporte a acentos via `immutable_unaccent()`
- [x] Modulo `search.js` com excerpt + highlight + debounce

**Arquivos a criar/modificar:**
- `supabase/migrations/XXX_search.sql`
- `Plataforma/js/search.js` (novo)
- `Plataforma/js/app.js` (UI da barra de busca)
- `Plataforma/styles.css` (estilos dos resultados)

**Criterio de aceite:** Buscar "ansiedade" retorna posts e topicos relevantes em < 500ms.

---

### P1.3 — Mensagens Diretas (DM)
**Prioridade:** ALTA
**Esforco:** 4-5 dias

- [ ] Criar tabelas:
  - [ ] `conversations` (id, created_at, updated_at)
  - [ ] `conversation_participants` (conversation_id, user_id)
  - [ ] `messages` (id, conversation_id, sender_id, content, created_at, read_at)
- [ ] RLS: usuario so ve suas conversas e mensagens
- [ ] Aplicar content filter nas DMs (mesmo filtro dos posts)
- [ ] Criar UI:
  - [ ] Icone de mensagens no header (com badge de nao lidas)
  - [ ] Lista de conversas (ultimo message preview + timestamp)
  - [ ] Tela de conversa (chat-style, scroll infinito)
  - [ ] Botao "Enviar mensagem" no perfil do usuario
  - [ ] Indicador de "lida" (check duplo)
- [ ] Realtime via Supabase channels (postgres_changes em messages)
- [ ] Notificacao push para nova DM

**Arquivos a criar:**
- `supabase/migrations/XXX_messages.sql`
- `Plataforma/js/messages.js` (novo)
- `Plataforma/styles.css` (chat UI)

**Criterio de aceite:** Dois usuarios conseguem trocar mensagens em tempo real com notificacao.

---

### P1.4 — Denuncia/Report de Conteudo
**Prioridade:** ALTA
**Esforco:** 2 dias

- [ ] Criar tabela `reports` (id, reporter_id, target_type, target_id, reason, status, created_at, resolved_at, resolved_by)
- [ ] Criar opcoes de denuncia:
  - [ ] "Conteudo ofensivo"
  - [ ] "Spam"
  - [ ] "Assedio"
  - [ ] "Informacao falsa"
  - [ ] "Outro" (campo livre)
- [ ] UI: Botao "..." no post/reply → "Denunciar"
- [ ] Modal de denuncia com opcoes + campo opcional de descricao
- [ ] Confirmacao: "Denuncia enviada. Nossa equipe vai analisar."
- [ ] Admin panel: Aba "Denuncias" com lista, detalhes, acoes (ignorar/remover/banir)
- [ ] Auto-hide: Post com 3+ denuncias fica oculto ate moderacao
- [ ] Notificacao para admins quando nova denuncia chega

**Arquivos a criar/modificar:**
- `supabase/migrations/XXX_reports.sql`
- `Plataforma/js/feed.js` (botao denuncia)
- `Plataforma/js/app.js` (admin panel aba denuncias)

**Criterio de aceite:** Usuario denuncia post → admin ve na fila → pode agir.

---

### P1.5 — Bloqueio de Usuarios
**Prioridade:** MEDIA
**Esforco:** 2 dias

- [ ] Criar tabela `blocks` (blocker_id, blocked_id, created_at)
- [ ] RLS: Posts de usuarios bloqueados nao aparecem no feed
- [ ] Criar funcao RPC `block_user(target_id)` e `unblock_user(target_id)`
- [ ] UI: Menu "..." no perfil → "Bloquear usuario"
- [ ] Confirmacao: "Voce nao vera mais posts de {nome}. Voce pode desbloquear a qualquer momento."
- [ ] Tela de "Usuarios bloqueados" nas configuracoes do perfil
- [ ] Bloquear impede DMs entre os usuarios
- [ ] Bloquear remove follow mutuo automaticamente

**Arquivos a criar/modificar:**
- `supabase/migrations/XXX_blocks.sql`
- `Plataforma/js/profile.js` (botao bloquear)
- `Plataforma/js/feed.js` (filtrar posts de bloqueados)
- `Plataforma/js/messages.js` (impedir DM)

**Criterio de aceite:** Usuario bloqueado e invisivel para quem bloqueou.

---

## P2 — Engajamento e Discovery (Semanas 7-10)

> Features que aumentam retencao e tempo na plataforma.

### P2.1 — Bookmarks/Salvos
**Prioridade:** MEDIA
**Esforco:** 1-2 dias

- [ ] Criar tabela `bookmarks` (user_id, post_id, created_at)
- [ ] RLS: usuario so ve seus bookmarks
- [ ] Icone de bookmark no post (toggle save/unsave)
- [ ] Tela "Salvos" acessivel pelo perfil
- [ ] Ordenar por data de salvamento (mais recente primeiro)

**Arquivos a criar/modificar:**
- `supabase/migrations/XXX_bookmarks.sql`
- `Plataforma/js/feed.js` (botao bookmark)
- `Plataforma/js/app.js` (tela salvos)

---

### P2.2 — Feed Inteligente ("Quem eu sigo")
**Prioridade:** MEDIA
**Esforco:** 2-3 dias
**Depende de:** P1.1 (Follow - em andamento)

- [ ] Criar aba "Seguindo" no feed (alem de "Todos")
- [ ] Query: posts de usuarios que eu sigo, ordenado por recente
- [ ] Fallback: se follow feed vazio, sugerir "Siga pessoas para ver posts aqui"
- [ ] Mostrar posts com mais reacoes com leve boost no ranking
- [ ] Cache do feed com invalidacao via realtime

**Arquivos a modificar:**
- `Plataforma/js/feed.js` (nova query + tab)
- `Plataforma/js/app.js` (UI da tab)

---

### P2.3 — Trending Topics
**Prioridade:** MEDIA
**Esforco:** 1-2 dias

- [ ] Criar funcao RPC `get_trending_topics(period, limit)`:
  - [ ] Contar posts por topico nos ultimos 7 dias
  - [ ] Ranking por volume + crescimento
- [ ] Criar secao "Em Alta" no sidebar ou topo do feed
- [ ] Mostrar nome do topico + contagem de posts recentes
- [ ] Clicar leva para o topico filtrado

**Arquivos a criar/modificar:**
- `supabase/migrations/XXX_trending.sql` (funcao RPC)
- `Plataforma/js/app.js` (UI trending)

---

### P2.4 — Mencoes @username
**Prioridade:** MEDIA
**Esforco:** 2-3 dias

- [ ] Ajustar content filter para permitir @mentions internos (diferenciar de @instagram)
- [ ] Criar autocomplete de usuarios ao digitar "@" em posts/replies
- [ ] Criar regex para detectar @mentions no conteudo
- [ ] Renderizar @mentions como links clicaveis para o perfil
- [ ] Gerar notificacao quando mencionado
- [ ] Limitar a usuarios existentes na plataforma

**Arquivos a modificar:**
- `Plataforma/js/feed.js` (autocomplete + render)
- `Plataforma/js/notifications.js` (notificacao de mencao)
- `supabase/migrations/XXX_mentions.sql` (trigger de notificacao)

---

### P2.5 — Pagina Explorar
**Prioridade:** MEDIA-BAIXA
**Esforco:** 2-3 dias

- [ ] Criar pagina/aba "Explorar" com:
  - [ ] Posts populares (mais reacoes nos ultimos 7 dias)
  - [ ] Topicos ativos (trending do P2.3)
  - [ ] Perfis sugeridos ("Psicologos para seguir" + "Membros ativos")
  - [ ] Posts recentes de topicos que voce nao segue
- [ ] Algoritmo simples: popularidade + recencia + diversidade de topico
- [ ] Paginacao com scroll infinito

**Arquivos a criar:**
- `Plataforma/js/explore.js` (novo)
- `Plataforma/js/app.js` (tab Explorar)

---

### P2.6 — Badges e Conquistas
**Prioridade:** BAIXA
**Esforco:** 2-3 dias

- [ ] Criar tabela `badges` (id, name, icon, description, criteria)
- [ ] Criar tabela `user_badges` (user_id, badge_id, earned_at)
- [ ] Badges iniciais:
  - [ ] "Primeiro Post" — criou 1 post
  - [ ] "Acolhedor(a)" — 10 respostas em posts de outros
  - [ ] "Voz Ativa" — 50 posts criados
  - [ ] "Popular" — post com 20+ reacoes
  - [ ] "Veterano(a)" — 6 meses na plataforma
  - [ ] "Psico Verificado" — perfil PSI validado
- [ ] Trigger SQL que verifica e concede badges automaticamente
- [ ] Mostrar badges no perfil do usuario
- [ ] Notificacao ao conquistar badge
- [ ] Icone do badge ao lado do nome nos posts

**Arquivos a criar:**
- `supabase/migrations/XXX_badges.sql`
- `Plataforma/js/badges.js` (novo)
- `Plataforma/js/profile.js` (exibir badges)

---

## P3 — Qualidade e Infraestrutura (Continuo)

> Melhoria continua que roda em paralelo com features.

### P3.1 — Monitoramento de Performance
**Esforco:** 1 dia

- [ ] Adicionar Web Vitals tracking (LCP, FID, CLS)
- [ ] Enviar metricas para Sentry Performance ou analytics
- [ ] Monitorar tempo de carregamento do feed (target: < 1s)
- [ ] Monitorar tempo de resposta das queries Supabase
- [ ] Configurar alerta se tempo de resposta > 3s

---

### P3.2 — Analytics de Uso
**Esforco:** 1 dia

- [ ] Integrar analytics simples (Plausible ou Umami — privacy-friendly)
- [ ] Rastrear eventos chave:
  - [ ] Signup, login, logout
  - [ ] Post criado, reply criado, reacao
  - [ ] Topico visitado
  - [ ] Busca realizada
  - [ ] DM enviada
  - [ ] Follow/unfollow
- [ ] Dashboard de metricas: DAU, WAU, MAU, posts/dia, retencao

---

### P3.3 — Image Optimization
**Esforco:** 1 dia

- [ ] Configurar Supabase Storage transforms para avatares (resize 200x200, webp)
- [ ] Lazy loading de imagens no feed
- [ ] Placeholder blur enquanto carrega
- [ ] Limitar upload a 2MB + validar tipo (jpg, png, webp)

---

### P3.4 — Documentacao
**Esforco:** 2-3 dias (pode ser incremental)

- [ ] Documentar API (todas as RPCs do Supabase)
- [ ] Documentar schema do banco (tabelas, relacoes, RLS policies)
- [ ] Documentar arquitetura dos modulos JS (app, auth, feed, profile, notifications)
- [ ] Atualizar README com setup local completo
- [ ] Criar CONTRIBUTING.md para novos desenvolvedores

---

### P3.5 — Testes Avancados
**Esforco:** Continuo

- [ ] Expandir testes e2e para cobrir P1 e P2 features
- [ ] Adicionar testes de acessibilidade (axe-playwright)
- [ ] Adicionar testes de performance (Lighthouse CI)
- [ ] Criar testes de seguranca (XSS injection, SQL injection via inputs)
- [ ] Meta: 80%+ de cobertura nos fluxos criticos

---

## Timeline Visual

```
Semana 1  │ P0.1 Error Handling + P0.2 Input Validation
Semana 2  │ P0.3 Sentry + P0.4 Testes + P0.5 CI/CD + P0.6 Rate Limit
          │
Semana 3  │ P1.1 Follow (em andamento) + P1.2 Busca Full-Text
Semana 4  │ P1.3 Mensagens Diretas (inicio)
Semana 5  │ P1.3 Mensagens Diretas (conclusao) + P1.4 Denuncia
Semana 6  │ P1.5 Bloqueio de Usuarios
          │
Semana 7  │ P2.1 Bookmarks + P2.2 Feed Inteligente
Semana 8  │ P2.3 Trending + P2.4 Mencoes
Semana 9  │ P2.5 Pagina Explorar
Semana 10 │ P2.6 Badges
          │
Continuo  │ P3.1-P3.5 rodando em paralelo desde a semana 1
```

---

## Dependencias entre Items

```
P1.1 Follow ──→ P2.2 Feed Inteligente
P1.1 Follow ──→ P1.5 Bloqueio (remove follow mutuo)
P1.3 DMs ──────→ P1.5 Bloqueio (impede DM)
P0.1 Error ────→ P0.3 Sentry (integrar)
P0.4 Testes ──→ P0.5 CI/CD (rodar no pipeline)
P2.3 Trending ─→ P2.5 Explorar (usa ranking)
```

---

## Metricas de Sucesso

| Metrica | Target |
|---------|--------|
| Testes passando | 100% no CI |
| Erros nao tratados | 0 em producao |
| Tempo de carregamento feed | < 1s |
| Cobertura testes e2e | 80%+ fluxos criticos |
| Features sociais core | 100% P1 implementado |
| Retencao D7 | Mensuravel via analytics |

---

> *"Primeiro estabiliza (P0), depois completa (P1), depois engaja (P2), depois otimiza (P3)."*
> — Orion, AIOS Master 🎯
