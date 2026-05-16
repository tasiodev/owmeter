# Changelog

All notable changes to Owmeter are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — Semantic Versioning.

## [Unreleased]

### Added
- Initial project scaffolding with Next.js 16, TypeScript, TailwindCSS 4
- Docker Compose setup: PostgreSQL 17, Redis 7, OWASP ZAP
- Core dependencies: Auth.js v5, Prisma 7, BullMQ 5, Zod 4, pino
- Clean architecture folder structure (domain / application / infrastructure / presentation)
- AGENTS.md and CLAUDE.md with project conventions for AI agents

### Internationalization
- next-intl with path-based routing (`/en/`, `/es/`)
- EN and ES translations for all pages and components
- `LanguageSwitcher` component in all headers
- Locale detection via Accept-Language header in proxy.ts
- All pages moved under `src/app/[locale]/`

### Testing
- Vitest 4 + React Testing Library + happy-dom setup
- 12 test files, 68 tests covering all layers
- Unit tests: `OWASPCategory`, `Severity`, `Website` entity, `ScoringService`
- Application tests: `CreateScan` and `VerifyOwnership` use-cases with mocked repos
- Infrastructure tests: `PassiveAnalyzer` with stubbed `fetch`
- Component tests: `AddWebsiteForm`, `VerifyForm`, `StartScanButton`, `ScanResult`, `LanguageSwitcher`
