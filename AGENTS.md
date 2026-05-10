<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# OwaspChecker — Agent Instructions

## What this project is

A web application where website owners can scan their sites against the OWASP Top 10 and receive a security score. Key invariants:

- **Only verified owners can scan** — before scanning, the user must prove domain ownership via DNS TXT record, meta tag, or a `.well-known` file.
- **ZIP files are never persisted** — if code analysis is added (V2), ZIPs are processed in memory and immediately discarded.
- **The app itself must comply with OWASP Top 10** — any change to auth, session handling, data access, or HTTP headers must maintain compliance.

## Architecture

Clean architecture with strict layer boundaries. Never import upward (infra → domain is forbidden):

```
src/
  domain/           ← Pure TypeScript. No framework imports. No Prisma.
  application/      ← Use cases. Depends on domain interfaces only.
  infrastructure/   ← Prisma, ZAP, BullMQ, Redis. Implements domain interfaces.
  presentation/     ← Next.js App Router (app/), components/, server actions.
```

## Key decisions

- **Auth**: Auth.js v5 (next-auth@beta) with Google + GitHub providers. JWT sessions (edge-compatible). Prisma adapter for OAuth account linking.
- **i18n**: next-intl, path-based routing (`/en/...`, `/es/...`). All pages live under `src/app/[locale]/`. Translations in `messages/en.json` and `messages/es.json`. Use `getTranslations` (server) or `useTranslations` (client). Never hardcode UI strings.
- **Queue**: BullMQ + Redis for async scan jobs (ZAP scans take minutes).
- **Scanning**: Passive (headers, SSL, path probes) + Active (OWASP ZAP REST API via Docker).
- **Scoring**: Max 65/100 without code access; 100/100 with code (V2).
- **DB**: Prisma 7 + PostgreSQL. Requires `@prisma/adapter-pg` — never instantiate `PrismaClient` without the adapter. Always use parameterized queries (Prisma handles this).
- **Validation**: Zod at all system boundaries (API routes, server actions, env vars).
- **Logging**: pino. Never log sensitive data (tokens, passwords, PII).
- **Proxy**: `src/proxy.ts` (not `middleware.ts` — renamed in Next.js 16). Handles locale detection + auth guard for `/dashboard/**`.

## Commands

```bash
# Start services
docker compose up -d

# Dev server (kills port 3000 first to avoid ghost processes)
npm run dev

# If port 3000 is stuck after Ctrl+C
npm run dev:kill

# Tests
npm test                 # run all tests once
npm run test:watch       # watch mode
npm run test:coverage    # coverage report

# Prisma
npx prisma migrate dev --name <migration-name>
npx prisma studio

# Build
npm run build
```

## Testing rules

- Framework: **Vitest** + **React Testing Library** + **happy-dom**
- Test files live co-located: `src/**/__tests__/*.test.{ts,tsx}`
- Global mocks for `next-intl`, `@/i18n/navigation`, and `next/navigation` are in `src/tests/setup.ts` — do not re-mock these in individual tests unless overriding.
- **Domain tests**: pure unit tests, no mocks needed.
- **Use-case tests**: mock the repository interfaces with `vi.fn()`. Never import Prisma or infrastructure in use-case tests.
- **Infrastructure tests** (PassiveAnalyzer, ZapClient): mock `fetch` with `vi.stubGlobal('fetch', vi.fn(...))` and always call `vi.unstubAllGlobals()` in `afterEach`.
- **Component tests**: use `render` + `userEvent` + `screen` queries. Mock `fetch` for components that call APIs. Assert on visible text, roles, and ARIA attributes.
- When adding a new feature, add tests for: the domain logic, the use-case, and the component (if UI exists). Do not skip tests for new code.

## OWASP compliance checklist (do not break)

| Check | How maintained |
|---|---|
| A01 Access Control | Middleware guards /dashboard/**; ownership verified before scan |
| A02 Crypto | HTTPS, HttpOnly+Secure+SameSite=Strict cookies, HSTS header |
| A03 Injection | Prisma parameterized queries; Zod input validation |
| A05 Misconfig | CSP, X-Frame-Options, X-Content-Type headers in middleware |
| A07 Auth Failures | Auth.js handles session rotation; no custom session logic |
| A10 SSRF | Scans restricted to user-verified domains only |

## Next.js 16 docs

Always read from `node_modules/next/dist/docs/` — not training data. Key guides:
- Authentication: `01-app/02-guides/authentication.md`
- Data fetching / mutations: `01-app/01-getting-started/`
- API reference: `01-app/03-api-reference/`
