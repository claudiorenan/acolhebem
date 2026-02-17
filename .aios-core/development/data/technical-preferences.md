# AcolheBem Technical Preferences

## Stack
- **Frontend Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS 3.4
- **Icons**: Lucide React
- **Image Processing**: Sharp
- **Testing**: Playwright

## Development
- **Package Manager**: npm
- **Node Version**: 18+
- **Dev Server**: Next.js dev + Python proxy
- **Port**: 4500 (proxy), 3000 (Next.js)

## Deployment
- TBD (to be defined in architecture docs)

## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile-first responsive design

## Performance
- Server Components by default
- Image optimization via Sharp/next-image
- Lazy loading for off-screen content

## Security
- No sensitive data in client-side code
- API calls proxied through server
- Input sanitization on all forms
- CORS headers managed by proxy

## Accessibility
- Semantic HTML
- ARIA labels where needed
- Keyboard navigation support
- Color contrast compliance
