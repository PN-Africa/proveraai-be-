# Provera AI — Backend

API for **Provera AI**, an AI-supported fraud detection MVP built by PN Africa team PNA 6.

Transaction data is uploaded, validated and scored against admin-defined detection rules. Every transaction gets a **Low / Medium / High** risk level with plain-language reasons. Flagged transactions go to a fraud analyst for review.

> A flag means **"this transaction requires review"**. It never means "this transaction is fraudulent". The system supports the analyst's decision and never makes it.

The architecture, data model, detection engine and security controls are described in [architect.md](architect.md).



## Stack

NestJS (ESM) · TypeScript · PostgreSQL (TypeORM) · Redis (ioredis) · class-validator · Swagger · Throttler · Vitest · oxlint

## Getting started

Requirements: Node.js 24, PostgreSQL, Redis.

```bash
cp .env.example .env               # then fill in the values
docker run -d -p 6379:6379 redis   # local Redis, or point REDIS_URL elsewhere
npm install
npm run start:dev
```

Pending database migrations run automatically on startup.

- API: `https://`
- API docs (Swagger): `https://.../api/docs`
- Health check: `GET /health`

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | yes | HTTP port |
| `ALLOWED_ORIGINS` | no | Comma-separated CORS allowlist (the frontend URL) |
| `DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB` | yes | PostgreSQL connection |
| `REDIS_URL` | yes | Redis connection (rate limits, login lockout, token revocation) |
| `OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET` | no | NestJS Observe telemetry. Observe is an external service, so it stays off unless both are set. Leave empty unless the security analyst has approved it |

Variables are validated at startup, and the app refuses to boot when one is missing. Never commit `.env` or real credentials.


## Project structure

```
src/
├── main.ts            # bootstrap: cookies, security headers, CORS, validation, Swagger, DB + migrations
├── app.module.ts      # root module: rate limiting, config, database, feature modules
├── common/            # app-wide infrastructure (config, decorators, error filter, Redis)
├── database/          # data source, base model, migrations
├── util/              # generic data-access base class
└── modules/           # one folder per feature (auth, users, audit, transactions, rules, detection, ...)
```

Each feature module follows the same layering:

```
controller → service → sub-services → model-actions → database
```

Controllers only route, the main service only orchestrates, sub-services hold the logic, and model actions are the only layer that touches the database. Modules talk to each other only through exported services. [architect.md](architect.md) has the full explanation.

## Conventions

- ESM: relative imports end in `.js`.
- Schema changes go through migrations only. `synchronize` stays off.
- Every route requires authentication by default. Only login and health are marked `@Public()`.
- Every request body is a DTO validated by the global `ValidationPipe`, which rejects unknown fields. Id params use `ParseUUIDPipe`.
- A new env var goes in `src/common/config/config.ts`, `src/common/config/validate-env.ts` and `.env.example`.
- Language in API responses and docs: say "flagged" or "requires review", never "fraud" or "fraudulent".


## Team

PNA 6, PN Africa (14 September – 14 November 2026).
