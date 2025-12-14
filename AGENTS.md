# Repository Guidelines

## Project Structure & Module Organization
- Next.js App Router powers the UI. Admin dashboards live under src/app/admin/**; end-user workflows remain in src/app/(public).
- Shared UI is stored in src/components. Business logic and Supabase utilities stay in src/lib (namespaced with supabase*).
- Static assets and diagnostics are split between public/ (icons, manifest, test fixtures) and data/logs/ (runtime traces). Keep new client components lean and move heavy transforms or data access into helper modules.

## Build, Test, and Development Commands
- `npm install` – install dependencies.
- `npm run dev` – start the Turbopack dev server.
- `npm run lint` – run ESLint plus TypeScript validation.
- `npm run build` – production build with type-checking.
- `npm run gen:types` – regenerate Supabase typings (requires CLI auth).
- `npm run start` – preview the optimized bundle after a build.

## Coding Style & Naming Conventions
- Use TypeScript everywhere. Components should be arrow functions with explicit prop types and "use client" where required.
- File names: React components in PascalCase (UserPinsClient.tsx); shared utilities in camelCase (salesComparisonQuery.ts).
- TailwindCSS drives styling. Group utilities in the order layout -> spacing -> color -> effects for readability. Avoid deep wrapper stacks and comment only when behaviour is not obvious.
- Reuse context hooks (useAuth, useModal), React Query loaders, and Supabase helpers instead of creating duplicate fetch logic.

## Testing Guidelines
- `npm run lint` blocks builds when JSX or TypeScript rules fail (for example react/no-unescaped-entities).
- `npm run build` is the type-check gate; run it before shipping changes.
- Smoke-test /, /admin, and /admin/user-pins on desktop, tablet, and the PWA shell. Use public/test-scroll.html when debugging touch behaviour and capture console/network logs when Supabase calls misfire.

## Commit & Pull Request Guidelines
- History uses short imperative subjects (e.g. Update, Add branding_settings). Continue that tone: verb first, <=60 characters, optionally scoped (update admin/UserPins responsive layout).
- PRs should document affected routes, include before/after screenshots or recordings (desktop + mobile), list Supabase migrations/scripts touched, and record manual checks (lint, build, device tests). Link issues or ticket IDs in the footer and call out any env vars or config toggles reviewers need.

## Performance & PWA QA
- Monitor Speed Index and scroll smoothness. Run Lighthouse on desktop and mobile after large UI updates and double-check the service worker with DevTools (chrome://inspect).
- Avoid reintroducing fixed overlays that capture touch input. Test with CPU throttling or low-end emulation to catch jank before release.
