# AcolheBem Project Conventions

## Architecture
- **Root**: Static site (vanilla HTML/CSS/JS) - psychologist directory
- **cademeupsi/**: Next.js 14 app (App Router) - interactive platform
- **API Backend**: External at cademeupsi.com.br
- **Image CDN**: https://cademeupsi.com.br/storage/

## Directory Structure
```
AcolheBem/
├── .aios-core/          # AIOS framework
├── docs/                # Documentation
├── cademeupsi/          # Next.js app
│   ├── app/             # App Router pages
│   ├── public/          # Static assets
│   └── ...
├── index.html           # Static directory site
├── app.js               # Static site logic
├── styles.css           # Static site styles
├── server.py            # Python dev proxy
└── serve.ps1            # PowerShell launcher
```

## Key Routes (Next.js)
| Route | Purpose |
|-------|---------|
| `/` | Redirect to triagem |
| `/triagem-whatsapp` | WhatsApp-style triage assessment |
| `/match-perfeito` | Psychologist matching |
| `/agendamento` | Appointment booking |
| `/micro-aha` | Insights display |
| `/sales-page` | Marketing/conversion |

## API Integration
- Proxy via Python server (dev) on port 4500
- Endpoints: `/api/v1/statistics`, `/api/v1/users`, `/api/v1/users/slug/{slug}`

## Design System
- Fonts: Fraunces (headings), Assistant (body)
- Color palette: teal/cream/tan warm therapy theme
- WhatsApp-style chat UI for triagem
- iOS-style status bar elements
