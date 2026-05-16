# Owmeter

A web application for scanning websites against the OWASP Top 10 and generating a security score. Site owners must verify domain ownership before running any scan.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Auth.js v5** — Google & GitHub OAuth
- **Prisma 7** + PostgreSQL
- **BullMQ** + Redis — async scan jobs
- **OWASP ZAP** — active scanning via Docker
- **next-intl** — i18n (English & Spanish)

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Google and/or GitHub OAuth app credentials

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/tasiodev/owmeter.git
cd owmeter
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Random secret — generate with `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth app credentials |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth app credentials |
| `REDIS_URL` | Redis connection string |
| `ZAP_API_KEY` | API key for the ZAP container (set a strong value in prod) |
| `ZAP_URL` | ZAP daemon URL |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app |

### 3. Start services

```bash
docker compose up -d
```

This starts PostgreSQL (port 5432), Redis (port 6379), and the ZAP daemon (port 8080). Wait for all three to be healthy before continuing.

### 4. Run database migrations

```bash
npx prisma migrate dev
npx prisma generate
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful commands

```bash
# Tests
npm test                  # run all tests once
npm run test:watch        # watch mode
npm run test:coverage     # coverage report

# Database
npx prisma migrate dev --name <migration-name>
npx prisma generate       # regenerate client after schema changes
npx prisma studio         # open Prisma Studio GUI

# Production build
npm run build
npm start
```

## Project structure

```
src/
  domain/           # Pure TypeScript — no framework or Prisma imports
  application/      # Use cases — depends on domain interfaces only
  infrastructure/   # Prisma, ZAP client, BullMQ workers
  presentation/     # Next.js App Router, components, server actions
messages/           # i18n translation files (en.json, es.json)
prisma/             # Schema and migrations
```
