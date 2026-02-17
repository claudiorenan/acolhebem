# AcolheBem - Claude Code Project Instructions

## Project Overview
AcolheBem is a mental health platform (pt-BR) connecting patients with psychologists.
- **Static Site** (root): Psychologist directory with search/filters
- **Next.js App** (`cademeupsi/`): Interactive platform (triage, matching, booking)
- **API Backend**: External at `cademeupsi.com.br`

## AIOS Framework
This project uses Synkra AIOS. The framework is in `.aios-core/`.
- Activate agents with `@agent-name` (e.g., `@dev`, `@qa`, `@architect`)
- Use `*command` for agent commands (e.g., `*help`, `*task`, `*workflow`)
- Stories live in `docs/stories/`
- Follow story-driven development

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3.4
- **Static Site**: Vanilla HTML/CSS/JS
- **Dev Proxy**: Python HTTP server on port 4500
- **Testing**: Playwright, ESLint
- **Icons**: Lucide React
- **Images**: Sharp

## Key Conventions
- **Language**: Portuguese (pt-BR) for all UI text, English for code
- **Commits**: Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)
- **Branches**: `feature/{story-id}-{slug}`
- **Components**: PascalCase, functional only, Server Components by default
- **Styling**: Tailwind utility-first

## Design Tokens
- Primary: `#2f6f64` (teal)
- Accent: `#e9b384` (warm tan)
- Background: Soft cream gradients
- Text: `#2b2b2b`
- Fonts: Fraunces (headings), Assistant (body)

## Important Paths
- `.aios-core/` - AIOS framework core
- `docs/stories/` - User stories
- `docs/architecture/` - Architecture docs
- `cademeupsi/app/` - Next.js App Router pages
- `cademeupsi/public/` - Static assets

## Development Commands
```bash
# Static site
python server.py 4500

# Next.js app
cd cademeupsi && npm run dev     # Dev server
cd cademeupsi && npm run build   # Build
cd cademeupsi && npm run lint    # Lint
```

## API Endpoints
- `GET /api/v1/statistics` - Platform stats
- `GET /api/v1/users` - List psychologists
- `GET /api/v1/users/slug/{slug}` - Psychologist profile

## Rules
- Always read code before modifying
- Follow existing patterns in the codebase
- Run lint and typecheck before completing tasks
- Update story progress as you work
- Keep changes focused and atomic
- Test on both desktop and mobile viewports
