# Podcast Summary

A multi-user, anonymous podcast-note app. Every visitor gets a UUID stored in
their browser's `localStorage`; the backend uses that UUID (`x-user-id`
header) to scope every record, so multiple users on the same server only see
their own summaries.

## Table of contents

- [Stack](#stack)
- [Project layout](#project-layout)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Daily development workflow](#daily-development-workflow)
- [Feature workflow](#feature-workflow)
- [Database & migrations](#database--migrations)
- [Auth model](#auth-model)
- [API reference](#api-reference)
- [Frontend ↔ backend wiring](#frontend--backend-wiring)
- [Scripts reference](#scripts-reference)
- [Troubleshooting](#troubleshooting)

---

## Stack

| Layer    | Tech                                                              |
| -------- | ----------------------------------------------------------------- |
| Backend  | Node 24, Express 4, TypeScript (run via `tsx`), Drizzle ORM, `pg` |
| Database | Postgres (local via [DBngin](https://dbngin.com))                 |
| Frontend | Vite 6, Vue 3 (`<script setup>`), TypeScript, plain CSS           |

Both sides are type-checked on every build. No bundler magic on the backend
— `tsx` runs `.ts` directly with ESM `*.ts` import paths.

## Project layout

```
podcast-summary/
├── backend/
│   ├── drizzle/                  # generated SQL migrations (commit these)
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts         # pgTable definitions
│   │   │   ├── client.ts         # pg.Pool + drizzle() instance
│   │   │   ├── migrate.ts        # CLI runner
│   │   │   └── summaries.ts      # data-access functions (DB ↔ API types)
│   │   ├── middleware/
│   │   │   └── user.ts           # requireUser: validates x-user-id header
│   │   ├── routes/
│   │   │   └── summaries.ts      # generic CRUD router
│   │   └── server.ts             # express app, cors, json, morgan
│   ├── drizzle.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/
    │   │   ├── client.ts         # typed fetch wrapper, auto-injects x-user-id
    │   │   └── user.ts           # getOrCreateUserId() — localStorage UUID
    │   ├── components/
    │   │   ├── SummaryList.vue
    │   │   ├── SummaryForm.vue
    │   │   └── SummaryView.vue
    │   ├── App.vue               # mode: list / view / create / edit
    │   ├── main.ts
    │   ├── styles.css
    │   └── env.d.ts
    ├── vite.config.ts            # /api → :4000 proxy
    ├── tsconfig.json
    ├── index.html
    └── package.json
```

## Prerequisites

- **Node 24+** (`node -v`)
- **DBngin** running with a default Postgres engine (any version ≥ 13 works;
  17 has `gen_random_uuid()` built-in, which is what we rely on)
- **psql** CLI (ships with Postgres.app, or `brew install libpq`)

Verify Postgres is up:

```bash
pg_isready -h localhost -p 5432        # → "accepting connections"
# or
nc -zv localhost 5432
```

If it fails, launch DBngin: `open -a DBngin` and wait a few seconds.

## Quick start

```bash
# from the repo root

# --- 1) Backend ---------------------------------------------------------------
cd backend
cp .env.example .env                    # DATABASE_URL=postgres://postgres@localhost:5432/podcast_summary
npm install
psql -h localhost -U postgres -c 'CREATE DATABASE podcast_summary;'   # one-time
npm run db:generate                     # generate SQL from src/db/schema.ts
npm run db:migrate                      # apply migrations
npm run dev                             # http://localhost:4000

# --- 2) Frontend (in a new terminal) -----------------------------------------
cd ../frontend
npm install
npm run dev                             # http://localhost:5173
```

Open <http://localhost:5173>. The Vite dev server proxies `/api/*` to the
backend on `:4000`, so the frontend never needs to know the backend URL.

## Daily development workflow

Two terminals side by side.

| Terminal | Command                      | Watches              |
| -------- | ---------------------------- | -------------------- |
| 1        | `cd backend && npm run dev`  | `src/**` (tsx watch) |
| 2        | `cd frontend && npm run dev` | `src/**` (Vite HMR)  |

- Edit any `.ts` / `.vue` → both servers reload automatically.
- Edit a Drizzle schema → run `npm run db:generate && npm run db:migrate` in
  the backend terminal.
- Inspect data → `npm run db:studio` (UI at `https://local.drizzle.studio`).
- Type-check without running anything: `npx tsc --noEmit` (backend) /
  `npx vue-tsc --noEmit` (frontend).

## Feature workflow

A repeatable loop for adding anything — a new field, a new endpoint, a new
page.

### 1. Plan the data shape

- What fields? Required vs optional? Server- vs client-generated?
- Will it be a new column, a new table, or a join?
- Does the API contract need a new type?

### 2. Update the schema (if data changed)

Edit [backend/src/db/schema.ts](backend/src/db/schema.ts), then:

```bash
cd backend
npm run db:generate     # produces drizzle/0001_*.sql — review it
npm run db:migrate      # applies it
```

Commit the generated file in `drizzle/`. Never hand-edit it after it has
been applied.

### 3. Update the data-access layer

Edit the typed functions in [backend/src/db/summaries.ts](backend/src/db/summaries.ts):

- Add the new field to the `Summary` interface (the public API shape).
- Map it in `toSummary()` (timestamps → ISO strings stay as strings).
- Add a new function for any non-CRUD operation; reuse the same `userId`
  scoping pattern.

### 4. Update the route

Edit [backend/src/routes/summaries.ts](backend/src/routes/summaries.ts):

- New endpoint? Add a handler; everything under the router already passes
  through `requireUser`, so `req.userId` is guaranteed.
- New field in input? Validate it (presence + shape) in the handler before
  passing to the data-access function.

### 5. Update the frontend API client

Edit [frontend/src/api/client.ts](frontend/src/api/client.ts):

- Add the field to `Summary` and (if applicable) `SummaryInput`.
- If you added a new endpoint, add a method on the `api` object — the
  `x-user-id` header is wired in once, in `request()`.

### 6. Update the UI

Edit the relevant component in [frontend/src/components/](frontend/src/components/)
and the mode-switching logic in [App.vue](frontend/src/App.vue).

### 7. Verify

- `npx tsc --noEmit` in `backend/` — clean
- `npx vue-tsc --noEmit` in `frontend/` — clean
- Run the app and exercise the new path in the browser
- (Optional) `curl` the new endpoint directly with two different
  `x-user-id` values to confirm multi-user isolation

## Database & migrations

- The app **does not** auto-migrate on boot. Always run `npm run db:migrate`
  after pulling.
- Do not auto-seed on boot; use an explicit `db:seed` script if you add one.
- `gen_random_uuid()` is built in on Postgres 13+ — no `pgcrypto` extension
  needed. `defaultRandom()` on a `uuid` column maps to it.
- Migrations live in `backend/drizzle/`. Generate with `npm run db:generate`,
  apply with `npm run db:migrate`.

Manual queries:

```bash
psql -h localhost -U postgres -d podcast_summary
> \d summaries
> SELECT id, podcast_name, session_title FROM summaries;
```

## Auth model

Anonymous, per-browser.

1. On first load, [frontend/src/api/user.ts](frontend/src/api/user.ts) calls
   `crypto.randomUUID()`, stores it in `localStorage` under
   `podcast-summary:user-id`, and returns it.
2. The frontend API client sends it on every request as `x-user-id: <uuid>`.
3. The backend [requireUser](backend/src/middleware/user.ts) middleware
   validates the header is a UUID and attaches it to `req.userId`.
4. Every data-access function takes `userId` as its first argument and
   filters by it in `WHERE`. Cross-user reads return `404` (not `403`) on
   purpose — we don't leak existence.

To "log out" or test as a fresh user, open DevTools and run
`localStorage.removeItem('podcast-summary:user-id')`, then refresh.

## API reference

Base URL: `http://localhost:4000` (dev) — all routes under `/api/summaries`.
**Every request must include** `x-user-id: <uuid>`.

| Method | Path                 | Body                                            | Returns         | Status          |
| ------ | -------------------- | ----------------------------------------------- | --------------- | --------------- |
| GET    | `/api/summaries`     | —                                               | `{ items }`     | 200             |
| GET    | `/api/summaries/:id` | —                                               | summary         | 200 / 404       |
| POST   | `/api/summaries`     | `{ podcastName, sessionTitle, url?, content? }` | created summary | 201 / 400       |
| PUT    | `/api/summaries/:id` | same shape as POST                              | updated         | 200 / 400 / 404 |
| PATCH  | `/api/summaries/:id` | any subset of fields                            | updated         | 200 / 404       |
| DELETE | `/api/summaries/:id` | —                                               | —               | 204 / 404       |
| GET    | `/health`            | —                                               | `{ ok: true }`  | 200             |

Summary shape:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "podcastName": "string",
  "sessionTitle": "string",
  "url": "string | null",
  "content": "string",
  "createdAt": "ISO-8601 string",
  "updatedAt": "ISO-8601 string"
}
```

Quick curl:

```bash
UID=11111111-1111-4111-8111-111111111111
curl -H "x-user-id: $UID" http://localhost:4000/api/summaries
curl -H "x-user-id: $UID" -H 'content-type: application/json' \
     -d '{"podcastName":"Huberman Lab","sessionTitle":"Ep 1"}' \
     http://localhost:4000/api/summaries
```

## Frontend ↔ backend wiring

- Vite proxy: any request from the SPA to `/api/*` is forwarded to
  `http://localhost:4000` (see [vite.config.ts](frontend/vite.config.ts)).
- CORS: the backend uses `cors({ origin: true })` so it accepts any
  origin in dev. In production, lock `origin` down to the deployed host.
- `x-user-id` is set in exactly one place:
  [frontend/src/api/client.ts](frontend/src/api/client.ts) → `request()`.
- `req.userId` is set in exactly one place:
  [backend/src/middleware/user.ts](backend/src/middleware/user.ts) → `requireUser`.

## Scripts reference

### Backend

| Script                | What it does                                              |
| --------------------- | --------------------------------------------------------- |
| `npm run dev`         | `tsx watch src/server.ts` — hot-reload on file changes    |
| `npm start`           | `tsx src/server.ts` — single run                          |
| `npm run build`       | `tsc -p tsconfig.json` — type-check (no emit, see config) |
| `npm run db:generate` | `drizzle-kit generate` — schema → SQL migration           |
| `npm run db:migrate`  | `tsx src/db/migrate.ts` — apply pending migrations        |
| `npm run db:studio`   | `drizzle-kit studio` — browse the DB in a web UI          |

### Frontend

| Script            | What it does                                     |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Vite dev server on :5173 with HMR + `/api` proxy |
| `npm run build`   | `vue-tsc` type-check + `vite build` → `dist/`    |
| `npm run preview` | Serve the built `dist/` locally                  |

## Troubleshooting

**`pg_isready` says "no response"**
DBngin isn't running. `open -a DBngin` and wait a few seconds.

**`psql: error: connection to server … FATAL: database "podcast_summary" does not exist`**
Run `psql -h localhost -U postgres -c 'CREATE DATABASE podcast_summary;'` once.

**Drizzle Studio UI is blank / blocked in Chrome**
Chrome blocks cross-origin requests from `local.drizzle.studio` to
`localhost:4983` by default. Click the site-info icon in the URL bar →
enable "Local network access" → reload. The CLI is up regardless — verify
with `curl -sk https://localhost:4983/init`.

**Frontend can't reach backend**
Check the Vite dev server is running on :5173 (not the Vite preview port).
The proxy only exists in `dev` mode — `vite preview` does **not** proxy
API requests; for a real deploy, serve the SPA and the API from the same
origin (or a reverse proxy).

**`tsx` keeps prompting to install a newer version**
The shell is using a global `npx tsx` and a newer one is published. Run the
**local** one instead: `cd backend && ./node_modules/.bin/tsx …` (or
`npx --no-install tsx`).

**`tsc` errors with `TS5097: An import path can only end with a '.ts' extension`**
The project is ESM (`"type": "module"`). `tsconfig.json` has
`allowImportingTsExtensions: true` + `noEmit: true` — make sure those are
intact, or downgrade all in-`src` imports to omit the `.ts` extension and
set `"moduleResolution": "Bundler"`.
