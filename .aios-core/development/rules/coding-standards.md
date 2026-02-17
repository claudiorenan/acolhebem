# AcolheBem Coding Standards

## Language & Naming
- **Language**: Portuguese (pt-BR) for UI text, English for code
- **Variables/Functions**: camelCase
- **Components**: PascalCase
- **Files**: kebab-case for pages, PascalCase for components
- **CSS Classes**: Tailwind utility-first

## TypeScript
- Strict mode enabled
- Explicit return types for public functions
- Interfaces over types when possible
- No `any` unless absolutely necessary

## React/Next.js
- Functional components only
- App Router conventions (Next.js 14)
- Server Components by default, `'use client'` only when needed
- Image optimization via `next/image`

## Styling
- Tailwind CSS as primary styling approach
- Design tokens from project palette:
  - Primary: `#2f6f64` (teal)
  - Accent: `#e9b384` (warm tan)
  - Background: soft cream gradients
  - Text: `#2b2b2b`
- Responsive-first design

## Testing
- Playwright for E2E tests
- Test critical user flows (triagem, agendamento, match)

## Git
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
- Reference story ID in commits
- Atomic, focused commits
