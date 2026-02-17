# AcolheBem - Architecture Overview

**Version:** 1.0
**Date:** 2026-02-16
**Status:** Current

## 1. System Overview

AcolheBem é uma plataforma de saúde mental que conecta pacientes a psicólogos. O sistema é composto por dois frontends e um backend externo.

```
┌─────────────────────────────────────────────────────┐
│                    AcolheBem                        │
│                                                     │
│  ┌──────────────────┐  ┌────────────────────────┐  │
│  │   Static Site     │  │   Next.js App           │  │
│  │   (Diretório)     │  │   (Plataforma)          │  │
│  │                   │  │                          │  │
│  │  - Busca          │  │  - Triagem WhatsApp      │  │
│  │  - Filtros        │  │  - Match Perfeito        │  │
│  │  - Perfis         │  │  - Agendamento           │  │
│  │  - Estatísticas   │  │  - Micro-Aha             │  │
│  │                   │  │  - Sales Page             │  │
│  └────────┬──────────┘  └───────────┬──────────────┘  │
│           │                         │                  │
│           └──────────┬──────────────┘                  │
│                      │                                 │
│              ┌───────▼───────┐                         │
│              │ Python Proxy  │                         │
│              │  (port 4500)  │                         │
│              └───────┬───────┘                         │
└──────────────────────┼─────────────────────────────────┘
                       │
               ┌───────▼───────────┐
               │  API Backend       │
               │  cademeupsi.com.br │
               │                    │
               │  /api/v1/users     │
               │  /api/v1/stats     │
               │  /storage/images   │
               └────────────────────┘
```

## 2. Components

### 2.1 Static Site (Root)
- **Tecnologia:** Vanilla HTML/CSS/JS
- **Função:** Diretório público de psicólogos
- **Arquivos:** `index.html`, `app.js`, `styles.css`
- **Funcionalidades:** Busca, filtros (cidade, abordagem, serviços), paginação, perfis individuais

### 2.2 Next.js App (`cademeupsi/`)
- **Tecnologia:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **Função:** Plataforma interativa de triagem e agendamento
- **Rotas:**
  - `/triagem-whatsapp` - Chat de triagem estilo WhatsApp
  - `/match-perfeito` - Matching com psicólogos
  - `/agendamento` - Agendamento de consultas
  - `/micro-aha` - Insights e momentos aha
  - `/sales-page` - Página de vendas

### 2.3 Python Proxy (`server.py`)
- **Tecnologia:** Python HTTP Server
- **Função:** Proxy de desenvolvimento com CORS
- **Porta:** 4500
- **Proxy:** `cademeupsi.com.br`

## 3. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/statistics` | GET | Estatísticas da plataforma |
| `/api/v1/users` | GET | Listar psicólogos |
| `/api/v1/users/slug/{slug}` | GET | Perfil do psicólogo |

## 4. Design System

### Cores
- **Primary:** `#2f6f64` (teal/verde terapêutico)
- **Accent:** `#e9b384` (tan acolhedor)
- **Background:** Gradientes cream suaves
- **Text:** `#2b2b2b`

### Tipografia
- **Headings:** Fraunces
- **Body:** Assistant

### UI Patterns
- Chat estilo WhatsApp (triagem)
- iOS-style status bar
- Cards com sombra suave
- Botões arredondados

## 5. Integrations
- **WhatsApp Business API** - Comunicação direta
- **CDN de Imagens** - `cademeupsi.com.br/storage/`
- **terapeutica.ia** - IA orientadora no chat de triagem
