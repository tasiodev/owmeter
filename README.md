<p align="center">
  <img src="public/logo.svg" alt="OWMeter" width="220" />
</p>

<p align="center">
  <a href="https://owmeter.dev"><strong>owmeter.dev</strong></a>
</p>

[![OWASP Score](https://owmeter.dev/api/badge/cmpa3jtit000001o6sgmzl39o?lang=en)](https://owmeter.dev)

Owmeter is an open-source web application that lets site owners scan their websites against the [OWASP Top 10](https://owasp.org/www-project-top-ten/) and receive a security score. Before any scan runs, the user must prove they own the domain — so results can never be abused to probe third-party sites.

---

## Features

- **Domain ownership verification** before scanning (DNS TXT record, HTML meta tag, or `.well-known` file)
- **Passive scan** — checks HTTP headers, TLS configuration, cookie flags, and common misconfigurations without sending traffic through ZAP
- **Active scan** — full OWASP ZAP spider + active attack mode for deeper findings
- **Code repository scanning** — static source-code analysis for JavaScript and TypeScript projects (package.json, dependency CVEs, insecure patterns)
- **Private GitHub repositories** — connect via GitHub App and grant access to selected private repos; no `.owmeter` verification file required
- **OWASP Top 10 coverage** — findings mapped to all ten categories (A01–A10)
- **Per-category score breakdown** — see exactly where points are lost
- **False positive reporting** — flag inaccurate findings from the results page; reports are reviewed by admins and suppressed on approval
- **PDF certificate** — download a shareable security report after each scan
- **Async job queue** — long-running ZAP scans are processed in the background via BullMQ + Redis
- **i18n** — English and Spanish UI out of the box
- **OAuth login** — Google and GitHub providers via Auth.js v5

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Auth | Auth.js v5 (next-auth@beta) — JWT sessions |
| Database | PostgreSQL 17 via Prisma 7 + `@prisma/adapter-pg` |
| Queue | BullMQ + Redis 7 |
| Active scanner | OWASP ZAP (Docker, REST API) |
| i18n | next-intl — path-based (`/en/`, `/es/`) |
| Styling | Tailwind CSS v4 |
| PDF | @react-pdf/renderer |
| Logging | pino |
| Validation | Zod v4 |
| Testing | Vitest + React Testing Library + happy-dom |

## How scoring works

Each OWASP category carries a maximum point value. A passive scan evaluates the categories that are observable without code access (headers, TLS, cookies, path probes). An active ZAP scan covers additional categories. Findings deduct points based on severity:

| Severity | Points lost |
|---|---|
| Info | 0 |
| Low | 2 |
| Medium | 5 |
| High | 10 |
| Critical | 20 |

The final score is capped at 100. Categories not evaluated in a given scan mode count as full marks.

---

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- A Google OAuth app and/or a GitHub OAuth app

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/tasiodev/owmeter.git
cd owmeter
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string — matches the Docker Compose defaults |
| `AUTH_SECRET` | Random secret. Generate with `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_GITHUB_ID` | GitHub OAuth App client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App client secret |
| `REDIS_URL` | Redis connection string — `redis://localhost:6380` by default |
| `ZAP_API_KEY` | API key for the ZAP container — set a strong value in production |
| `ZAP_URL` | ZAP daemon URL — `http://localhost:8050` by default |
| `NEXT_PUBLIC_APP_URL` | Public base URL of the app (used in verification tokens and OAuth callbacks) |
| `GITHUB_TOKEN` | *(Optional)* GitHub Personal Access Token for the Advisory API. Without it the API still works but is rate-limited to 60 requests/hour — enough for occasional use but easily exhausted during development. With a token the limit rises to 5 000 req/hour. No scopes are needed; create one at [github.com/settings/tokens](https://github.com/settings/tokens). |
| `ADMIN_EMAILS` | *(Optional)* Comma-separated list of email addresses that have admin access (e.g. `alice@example.com,bob@example.com`). Admins can review false positive reports at `/dashboard/admin/false-positives`. If omitted, the admin panel is inaccessible to everyone. |
| `RESEND_API_KEY` | *(Optional)* API key for [Resend](https://resend.com) (free tier: 3 000 emails/month). When set, users receive an email when their false positive report is approved or rejected, and admins receive an email when a new report is submitted. If omitted, the app works normally — emails are simply not sent. |
| `EMAIL_FROM` | *(Optional)* Sender address used in outgoing emails, e.g. `OWMeter <no-reply@yourdomain.com>`. Defaults to `OWMeter <onboarding@resend.dev>`, which works on Resend's free tier but only delivers to the address registered on your Resend account. Set a verified domain address for production. |
| `LOG_LEVEL` | *(Optional)* Pino log level: `trace`, `debug`, `info`, `warn`, `error`, or `fatal`. Defaults to `info` in development and `warn` in production. Set to `warn` locally to silence verbose scan-progress logs. |
| `GITHUB_APP_ID` | *(Optional)* Numeric App ID shown on the GitHub App settings page. Required to enable private repository support. |
| `GITHUB_APP_SLUG` | *(Optional)* URL slug of your GitHub App (appears in `github.com/apps/{slug}`). Used to build the installation redirect URL. |
| `GITHUB_APP_PRIVATE_KEY` | *(Optional)* Base64-encoded RSA private key (`.pem` file) used to sign JWT tokens for the GitHub App API. Encode with `base64 -w 0 your-app.private-key.pem`. |
| `GITHUB_WEBHOOK_SECRET` | *(Optional)* A random string used to verify the HMAC-SHA256 signature of incoming webhook events from GitHub. Set the same value in the GitHub App's webhook configuration. |

> **Private repo support is entirely optional.** If the four `GITHUB_APP_*` variables are not set, the GitHub App integration is hidden everywhere in the UI and no GitHub API calls are made.

**Creating OAuth apps**

- Google: [console.cloud.google.com](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client ID. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
- GitHub: Settings → Developer settings → OAuth Apps → New OAuth App. Set the callback URL to `http://localhost:3000/api/auth/callback/github`.

### 3. Start services

```bash
docker compose up zap redis db -d
```

This starts PostgreSQL (port 5433), Redis (port 6380), and OWASP ZAP (port 8050). ZAP takes ~30 seconds to initialize — wait until `docker compose ps` shows all containers as healthy before continuing.

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

---

## Project structure

```
src/
  domain/           # Pure TypeScript — entities, value objects, domain services
  application/      # Use cases — depends on domain interfaces only, no Prisma
  infrastructure/   # Prisma repositories, ZAP client, BullMQ workers
  presentation/     # Next.js App Router pages, components, server actions
messages/           # i18n translation files (en.json, es.json)
prisma/             # Prisma schema and migrations
```

The architecture follows strict layer boundaries: infrastructure and presentation layers depend on domain interfaces — never the other way around.

## Useful commands

```bash
# Dev server
npm run dev

# Tests
npm test                  # run all tests once
npm run test:watch        # watch mode
npm run test:coverage     # coverage report

# Linting
npm run lint
npm run lint:fix

# Database
npx prisma migrate dev --name <migration-name>
npx prisma generate       # regenerate client after schema changes
npx prisma studio         # open Prisma Studio GUI

# Production build
npm run build
npm start
```

## Deployment

The app is a standard Next.js application. It requires:

1. A running PostgreSQL instance
2. A running Redis instance
3. A running OWASP ZAP daemon (`ghcr.io/zaproxy/zaproxy:stable`)
4. All environment variables from `.env.example` set in the production environment

Set `NEXT_PUBLIC_APP_URL` and the OAuth callback URLs to your production domain before deploying.

## False positive management

Static analysis produces occasional false positives — findings that match a dangerous pattern but are safe in context (e.g. `password: 'Contraseña'` is a UI translation label, not a hardcoded credential).

Users can report a finding as a false positive directly from the scan results page. Each report includes a free-text explanation and is routed to an admin for review.

**User flow**

1. Open a scan result and click **"False positive?"** on any finding.
2. Fill in the reason (minimum 10 characters) and submit.
3. The report appears in the **False Positives** section of the project page with its current status (`Pending`, `Approved`, or `Rejected`).

**Admin flow**

1. Set `ADMIN_EMAILS` in the environment to grant admin access to one or more accounts.
2. Navigate to `/dashboard/admin/false-positives` to see all pending reports across all projects.
3. Review the evidence snippet and the user's reason, add an optional note, then approve or reject.

**Effect of approval**

Once a report is approved, that specific finding is suppressed in all future scan results for the project — it is hidden from the findings list and a banner shows how many findings are suppressed. The stored score is not retroactively adjusted; only the display changes. The suppression key is `category + title + file path`, so it survives new scans as long as the finding recurs in the same file with the same title.

---

## GitHub App integration (private repositories)

Private repository scanning is an optional feature. When enabled, users can connect their GitHub account via a GitHub App installation and select which repositories to grant access to. OWMeter then downloads the repository ZIP using a short-lived installation token — **no tokens are ever stored in the database**.

### 1. Create a GitHub App

Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App** and fill in:

| Field | Value |
|---|---|
| App name | `Owmeter` (or `Owmeter Dev` for local development) |
| Homepage URL | Your app's public URL |
| Callback URL | `https://your-domain.com/api/github/app/callback` |
| Setup URL | `https://your-domain.com/api/github/app/callback` |
| Redirect on update | ✅ Enabled |
| Webhook URL | `https://your-domain.com/api/github/webhooks` |
| Webhook secret | A random string (save it as `GITHUB_WEBHOOK_SECRET`) |
| Repository permissions | **Contents → Read-only** |
| Subscribe to events | `Installation`, `Installation repositories` |
| Where can this app be installed | Any account |

After saving:
1. Note the **App ID** (number) and the **slug** from the URL (`github.com/apps/{slug}`).
2. Generate and download a **Private Key** (`.pem` file).
3. Base64-encode it: `base64 -w 0 your-app.private-key.pem`

### 2. Set environment variables

```env
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=owmeter-dev
GITHUB_APP_PRIVATE_KEY=<base64-encoded .pem>
GITHUB_WEBHOOK_SECRET=<random string>
```

### 3. Run the migration

The feature requires a `GitHubInstallation` table and two optional columns on `Project`:

```bash
npx prisma migrate dev
```

### How it works

1. The user goes to **Dashboard → Settings** and clicks **Connect GitHub App**.
2. GitHub redirects them to the app installation page where they choose which repositories to share.
3. After installation, GitHub redirects back to `/api/github/app/callback`. A CSRF-protected cookie (HMAC-SHA256 signed, `httpOnly; Secure; SameSite=lax`) prevents state forgery. The installation ID is saved — nothing else.
4. When configuring a project's repository, a **Private Repo** tab appears. The user picks a repo from the dropdown; OWMeter verifies access and marks the project as verified — no `.owmeter` file needed.
5. During a scan, a fresh installation token is generated on demand via the GitHub API and discarded immediately after use.
6. If the user uninstalls the app from GitHub, a webhook event fires and OWMeter removes the installation record and unlinks all affected projects automatically.

---

## Roadmap

- **Multi-language source code analysis** — extend SAST and dependency vulnerability checks to .NET (`.csproj`, NuGet), Java (`pom.xml`, Gradle), Python (`requirements.txt`, `pyproject.toml`), and Go (`go.mod`)

## Contributing

Contributions are welcome. Please open an issue first to discuss significant changes.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit your changes following the existing conventions
4. Add or update tests for any new behavior
5. Open a pull request

When adding new features, make sure the OWASP compliance checklist in [AGENTS.md](AGENTS.md) is not broken.

## License

MIT
