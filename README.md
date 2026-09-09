# Summary Hub (Podcast + Food Summary)

Turn messy podcast notes and tasting notes into crisp, **shareable summary
cards** with free AI.

Visitors start as anonymous guests (a UUID in `localStorage`, sent as
`x-user-id`). They can sign in with an emailed code; on first sign-in their
guest summaries are moved into the account. Signed-in requests use
`Authorization: Bearer <token>`.

**Highlights**

- 📱 Mobile-first UI: single-pane navigation on phones (list → detail, back
  gesture aware), bottom tab bar, two-pane on desktop, bottom sheets, toasts,
  44 px touch targets, safe-area insets.
- 🔐 **Passwordless auth**: sign up / sign in with a 6-digit code sent by
  email (SMTP) — or printed in the log + shown in the UI when no SMTP is set.
- 🧑‍🎨 **Account with generated avatar**: username, seven avatar styles
  (DiceBear + an AI-painted portrait), shuffle-able seed.
- 🗂 **Sections**: Podcast and Food share one summary shape but have their own
  labels, empty states, AI prompts and card badges. Add a section in
  `frontend/src/lib/sections.ts` + `backend/src/ai/summarize.ts`.
- 🎨 **Themes**: **Pixel** (default: light, paper-and-ink 8-bit skin with
  Press Start 2P / VT323 fonts, hard edges, chunky shadows, faint scanlines),
  Pixel Dark (CRT navy), plus modern Light, Dark and System.
- 🏠 **Dashboard**: home screen with counts per section, AI-written share,
  key points saved, top tags, recent summaries and quick "New" actions.
- ❔ **Built-in guide**: a six-step "How to use" sheet opens on first visit
  and stays one tap away from the dashboard, header and account sheet.
- ✨ **Generate with AI**: notes (+ optional episode URL) → headline, key
  takeaways, quotes, tags, mood and a cover-illustration prompt. Everything
  is editable before saving.
- 🖼 **Export share card**: square / story / wide PNG rendered on a canvas,
  with a free AI illustration in six playful styles, shuffle-able seeds,
  download, copy-to-clipboard and native share.
- 🆓 Runs on **free-tier models only**, with automatic fallback between
  providers. No key at all? Images still work; text needs one free key (or
  demo mode).

Want to put this live at no cost? See **[DEPLOYMENT.md](DEPLOYMENT.md)** for
a step-by-step guide to Neon (database) + Render (backend) + Vercel
(frontend) — $0/month, no credit card.

## Table of contents

- [Stack](#stack)
- [Project layout](#project-layout)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Deploying for free](#deploying-for-free)
- [AI providers (all free)](#ai-providers-all-free)
- [Auth, accounts & themes](#auth-accounts--themes)
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
| Backend  | Node 22+, Express 4, TypeScript (run via `tsx`), Drizzle ORM, `pg`, nodemailer |
| Database | Postgres 13+, **or** zero-setup in-memory mode (`STORAGE=memory`) |
| Frontend | Vite 6, Vue 3 (`<script setup>`), TypeScript, plain CSS           |

Both sides are type-checked on every build. No bundler magic on the backend
— `tsx` runs `.ts` directly with ESM `*.ts` import paths.

## Project layout

```
podcast-summary/
├── backend/
│   ├── drizzle/                  # generated SQL migrations (commit these)
│   ├── src/
│   │   ├── ai/
│   │   │   ├── providers.ts      # free-tier provider registry + fallback order
│   │   │   ├── text.ts           # OpenAI-compatible chat client with fallback chain
│   │   │   ├── summarize.ts      # notes (+URL) → structured summary JSON
│   │   │   ├── image.ts          # illustration styles + image providers
│   │   │   └── mock.ts           # demo mode (AI_TEXT_PROVIDER=mock)
│   │   ├── db/
│   │   │   ├── schema.ts         # pgTable definitions
│   │   │   ├── client.ts         # pg.Pool + drizzle() instance
│   │   │   ├── migrate.ts        # CLI runner
│   │   │   └── summaries.ts      # repo (Postgres or in-memory) + input sanitising
│   │   ├── middleware/
│   │   │   └── user.ts           # requireUser: validates x-user-id header
│   │   ├── routes/
│   │   │   ├── summaries.ts      # CRUD router
│   │   │   └── ai.ts             # /api/ai: providers, summarize, image proxy
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
    │   │   ├── SummaryList.vue   # searchable list, skeletons, empty state
    │   │   ├── SummaryForm.vue   # editor + "Generate with AI" panel
    │   │   ├── SummaryView.vue   # detail: cover, takeaways, quotes, tabs
    │   │   ├── ExportSheet.vue   # share-card generator (canvas + AI image)
    │   │   ├── BottomSheet.vue   # swipe-to-dismiss sheet / desktop dialog
    │   │   ├── ConfirmDialog.vue
    │   │   └── Toast.vue
    │   ├── composables/          # useToast, useMedia
    │   ├── lib/card.ts           # canvas share-card renderer
    │   ├── App.vue               # mode: view / create / edit; mobile pane switching
    │   ├── main.ts
    │   ├── styles.css
    │   └── env.d.ts
    ├── vite.config.ts            # /api → :4000 proxy
    ├── tsconfig.json
    ├── index.html
    └── package.json
```

## Prerequisites

- **Node 22+** (`node -v`)
- Everything else is optional:
  - **Postgres** for persistent storage (any version ≥ 13; 17 has
    `gen_random_uuid()` built-in, which is what we rely on). Without it the
    app runs fine in **in-memory mode** — see below.
  - **psql** CLI, only needed if you create the database by hand
    (ships with Postgres.app, or `brew install libpq` / `apt install postgresql-client`)
  - A free **Groq** or **Gemini** API key for real AI summaries (see
    [AI providers](#ai-providers-all-free)); without one the app falls back to
    a deterministic **demo mode**.
  - An **SMTP** account for real verification emails; without one, sign-in
    codes are printed in the backend log and shown in the UI (see
    [Auth, accounts & themes](#auth-accounts--themes)).

## Quick start

The fastest path — **no Postgres, no API keys, no mail server** — runs the
whole app with in-memory storage and demo AI:

```bash
# from the repo root

# --- 1) Backend ---------------------------------------------------------------
cd backend
npm install
cp .env.example .env
echo "STORAGE=memory" >> .env           # skip Postgres entirely
echo "AI_TEXT_PROVIDER=mock" >> .env    # skip AI keys entirely (optional)
npm run dev                             # http://localhost:4000

# --- 2) Frontend (in a new terminal) -------------------------------------------
cd ../frontend
npm install
npm run dev                             # http://localhost:5173
```

Open <http://localhost:5173>. The Vite dev server proxies `/api/*` to the
backend on `:4000`, so the frontend never needs to know the backend URL.
Sign-up codes appear as a "DEV" hint right in the sign-in sheet — no email
needed. **Data resets whenever the backend restarts.**

### With a real Postgres database

Skip the two `echo` lines above and instead:

```bash
# 0) Have Postgres running and reachable (see "Setting up Postgres" below)

cd backend
npm install
cp .env.example .env
# edit .env: set DATABASE_URL, e.g.
#   DATABASE_URL=postgres://postgres:yourpassword@localhost:5432/podcast_summary
psql "$DATABASE_URL_ADMIN" -c 'CREATE DATABASE podcast_summary;'   # one-time, see below
npm run db:generate                     # regenerate SQL if you changed src/db/schema.ts
npm run db:migrate                      # apply all migrations in backend/drizzle/
npm run dev                             # http://localhost:4000

cd ../frontend
npm install
npm run dev                             # http://localhost:5173
```

Add a free `GROQ_API_KEY` or `GEMINI_API_KEY` (and optionally `SMTP_*`) to
`backend/.env` for real AI summaries and real emails — see
[AI providers](#ai-providers-all-free) and
[Auth, accounts & themes](#auth-accounts--themes).

### Setting up Postgres

Pick whichever is easiest on your machine:

**Local install (Windows/macOS/Linux)** — after installing, Postgres creates
a default `postgres` superuser. If you don't know its password, set one:

```bash
# macOS (Homebrew) / Linux: usually no password is required locally, try
psql -U postgres -c "ALTER USER postgres PASSWORD 'postgres';"

# Windows: open "SQL Shell (psql)" from the Start menu (it prompts for the
# password set during install), then:
ALTER USER postgres PASSWORD 'postgres';
```

Then set `DATABASE_URL=postgres://postgres:postgres@localhost:5432/podcast_summary`
in `backend/.env` and create the database once:

```bash
psql -h localhost -U postgres -c 'CREATE DATABASE podcast_summary;'
```

**DBngin** (macOS/Windows GUI, no password headaches): install from
[dbngin.com](https://dbngin.com), start a Postgres engine on the default
port, then the `postgres` user typically has **no password** — use
`DATABASE_URL=postgres://postgres@localhost:5432/podcast_summary`.

**Docker** (any OS, no local install):

```bash
docker run -d --name podcast-summary-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=podcast_summary \
  -p 5432:5432 postgres:17
```

then `DATABASE_URL=postgres://postgres:postgres@localhost:5432/podcast_summary`
— skip the `CREATE DATABASE` step, the image creates it from `POSTGRES_DB`.

**Hosted** (Neon, Supabase, Railway, RDS, …): copy the connection string they
give you straight into `DATABASE_URL` (keep `?sslmode=require` if they
include it) and skip the local `CREATE DATABASE` step.

Verify Postgres is reachable before running migrations:

```bash
pg_isready -h localhost -p 5432        # → "accepting connections"
# or, without pg_isready installed:
nc -zv localhost 5432
```

> **Switching back to in-memory mode later** is just setting
> `STORAGE=memory` in `backend/.env` (or clearing `DATABASE_URL`) and
> restarting the backend — no code changes needed.

## Deploying for free

Everything above is local dev. To put the app on the public internet at
$0/month — Neon for Postgres, Render for the backend, Vercel for the
frontend, plus optional free email and AI keys — see
**[DEPLOYMENT.md](DEPLOYMENT.md)**. It covers exact host settings, the env
vars each service needs, a required one-line fix for a devDependency
deploy-blocker, a single-service alternative, and deployment-specific
troubleshooting.

## AI providers (all free)

Everything AI-related is optional and configured with environment variables
in `backend/.env`. The backend tries providers in order and falls through on
rate limits or errors. Check what is active at `GET /api/ai/providers`.

### Text (summaries)

| Provider    | Model (default)        | Free tier (Sept 2026)                        | Env var              |
| ----------- | ---------------------- | -------------------------------------------- | -------------------- |
| **Groq**    | `openai/gpt-oss-120b`  | ~1 000 req/day, 30 req/min, ~500 tok/s       | `GROQ_API_KEY`       |
| **Gemini**  | `gemini-2.5-flash`     | Free via AI Studio, 1 M-token context        | `GEMINI_API_KEY`     |
| Cerebras    | `llama-3.3-70b`        | 30 req/min, ~1 M tokens/day                  | `CEREBRAS_API_KEY`   |
| OpenRouter  | `openrouter/free`      | 20 req/min, 50 req/day (1 000 with $10 top-up)| `OPENROUTER_API_KEY` |
| Pollinations| `openai-fast` (GPT-OSS 20B) | No key, but anonymous tier now rejects all but tiny prompts | `POLLINATIONS_TOKEN` (optional) |
| Demo        | `mock`                 | Offline; stitches a summary from your notes  | `AI_TEXT_PROVIDER=mock` |

Recommendation: add **one** of Groq or Gemini. Groq is the fastest; Gemini
handles very long transcripts. Force a provider with `AI_TEXT_PROVIDER=groq`
(default `auto` picks the first with a key). All providers are called through
the OpenAI chat-completions dialect, so adding another is a one-entry change
in `backend/src/ai/providers.ts`.

### Images (share-card illustrations)

| Provider              | Model                             | Free tier                                   | Env vars                        |
| --------------------- | --------------------------------- | ------------------------------------------- | ------------------------------- |
| **Pollinations**      | `flux` / `sana` (anonymous)       | No key. ~1 req / 15 s anonymously; a free token removes the logo and lifts limits | `POLLINATIONS_TOKEN` (optional) |
| Cloudflare Workers AI | `@cf/black-forest-labs/flux-1-schnell` | 10 000 neurons/day (~2 000 small images) | `CF_ACCOUNT_ID`, `CF_API_TOKEN` |
| Hugging Face          | `black-forest-labs/FLUX.1-schnell` | Monthly free inference credits             | `HF_TOKEN`                      |

Images are fetched **through the backend** (`GET /api/ai/image`) so the
canvas stays untainted for PNG export and tokens never reach the browser.
The same prompt + seed always yields the same picture, and responses are
cached for a day.

The card's illustration prompt is generated by the text model as a short,
**concrete** scene ("a smiling moon wearing headphones above a cozy bed").
Six style wrappers (`playful`, `doodle`, `retro`, `neon`, `paper`,
`minimal`) live in `backend/src/ai/image.ts`; typography is drawn by the
frontend, so the model is told to produce no text.

Free tiers change without notice. Re-check limits before relying on them:
[Groq](https://console.groq.com/docs/models), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing),
[Pollinations API docs](https://github.com/pollinations/pollinations/blob/master/APIDOCS.md),
[Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/).

## Auth, accounts & themes

### Passwordless sign-in

1. `POST /api/auth/request-code` with `{ mode: "signup", email, username }`
   or `{ mode: "signin", email }`. A 6-digit code is stored hashed
   (10-minute TTL, 5 attempts, 30 s resend throttle) and emailed.
2. `POST /api/auth/verify` with `{ email, code, guestId? }` returns
   `{ token, user, created, claimed }`. `guestId` (the browser's anonymous
   UUID) moves that guest's summaries into the account.
3. The frontend stores the token in `localStorage` and sends
   `Authorization: Bearer <token>` on every request. A 401 with
   `code: "UNAUTHENTICATED"` clears it and fires an `auth:expired` event.

Email delivery uses nodemailer. Without `SMTP_HOST` the backend logs the code
and, unless `NODE_ENV=production`, returns it as `devCode` so the UI can show
a "DEV: your code is …" hint. Set the `SMTP_*` variables in `.env.example`
for real mail. Unknown emails on sign-in get the same success response as
known ones, so the endpoint does not leak who has an account.

Tables: `users` (unique email, username, avatar style + seed),
`email_codes`, `sessions` (hashed tokens, 30-day TTL, cascade on user delete).

### Avatars

`GET/PATCH /api/auth/me` manage `username`, `avatarStyle` and `avatarSeed`
(`"shuffle"` generates a new seed). Styles are DiceBear collections
(`adventurer`, `notionists`, `fun-emoji`, `bottts`, `pixel-art`, `thumbs`),
rendered client-side from `api.dicebear.com`, plus `ai`, which paints a
portrait through our `/api/ai/image` proxy.

### Sections

`summaries.kind` is `podcast` (default) or `food`. `GET /api/summaries?kind=food`
filters; create/update accept `kind`. The UI keeps the current section in
`localStorage` and shows it in the header, bottom tab bar (mobile) or
segmented control (desktop). Section copy lives in
`frontend/src/lib/sections.ts`; the AI prompt framing per kind lives in
`backend/src/ai/summarize.ts` (`KIND_BRIEF`).

### Themes

`<html data-theme="pixel|pixel-dark|light|dark">`, or no attribute for
"system" (modern palette following `prefers-color-scheme`). **Pixel (light)
is the default** for new visitors. All tokens are CSS variables in
`frontend/src/styles.css`; both pixel variants share the structural rules
under `[data-theme^="pixel"]` (fonts, zero radii, offset shadows, scanlines)
and differ only in palette. The choice is saved in `localStorage` and applied
by an inline script in `index.html` before first paint. Switch it from the
account sheet or the header button, which cycles
Pixel → Pixel Dark → Light → Dark → System.

### Dashboard & guide

The home view (`Dashboard.vue`) calls `GET /api/summaries/stats`, which
returns counts for the caller only: total, per-kind, AI-written, with cover,
created this week, takeaways saved, the top 12 tags and the 6 most recent
summaries. Tiles for Podcast/Food jump into a new summary of that kind;
recent rows open the summary in its section. The stats are recomputed after
every create, edit, delete, cover save or sign-in.

`HelpSheet.vue` is the six-step guide. It opens automatically once
(`summary-hub:seen-help` in `localStorage`), and afterwards from the ❔ button
in the header (desktop), on the dashboard, or from the empty state.

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

- Two storage backends, chosen by `backend/src/db/storage.ts`:
  `STORAGE=memory` (or no `DATABASE_URL`) uses an **in-memory** store — zero
  setup, data resets on every backend restart. Otherwise **Postgres** via
  Drizzle is used, and the app **does not** auto-migrate on boot — always run
  `npm run db:migrate` after pulling or switching a fresh database in.
- Do not auto-seed on boot; use an explicit `db:seed` script if you add one.
- `gen_random_uuid()` is built in on Postgres 13+ — no `pgcrypto` extension
  needed. `defaultRandom()` on a `uuid` column maps to it.
- Migrations live in `backend/drizzle/` (`0000` summaries table, `0001` adds
  AI fields, `0002` adds `users`/`email_codes`/`sessions` + `summaries.kind`).
  Generate new ones with `npm run db:generate` after editing
  `backend/src/db/schema.ts`, apply with `npm run db:migrate`. Commit the
  generated `.sql` files; never hand-edit one that's already been applied.

Manual queries:

```bash
psql -h localhost -U postgres -d podcast_summary
> \dt                                           -- list tables
> SELECT id, kind, podcast_name, session_title FROM summaries;
> SELECT id, email, username FROM users;
```

## Auth model

Two layers: every visitor starts as an **anonymous guest**, and can
optionally **sign in** to a real account. See
[Auth, accounts & themes](#auth-accounts--themes) for the full sign-in flow.

1. On first load, [frontend/src/api/user.ts](frontend/src/api/user.ts) calls
   `crypto.randomUUID()`, stores it in `localStorage` under
   `podcast-summary:user-id`, and returns it. This is the **guest ID**.
2. Every request carries `x-user-id: <guest uuid>`. If the user has signed
   in, it *also* carries `Authorization: Bearer <token>` — when both are
   present the backend prefers the bearer token and resolves the real
   account.
3. The backend [requireUser](backend/src/middleware/user.ts) middleware
   validates whichever identity is present and attaches it to `req.userId`
   (either `users.id` or the guest uuid) plus `req.user` when signed in.
4. Every data-access function takes `userId` as its first argument and
   filters by it in `WHERE`. Cross-user reads return `404` (not `403`) on
   purpose — we don't leak existence. An invalid/expired bearer token gets a
   `401` rather than silently falling back to guest mode, so the frontend
   knows to prompt sign-in again.
5. Signing in for the first time **claims** all summaries created as that
   guest (matched by `x-user-id`) into the new account — see `claimGuest` in
   [backend/src/db/auth.ts](backend/src/db/auth.ts).

To reset to a fresh guest, open DevTools and run
`localStorage.removeItem('podcast-summary:user-id')`, then refresh. To sign
out of an account, use the account sheet in the app (clears
`summary-hub:token`).

## API reference

Base URL: `http://localhost:4000` (dev) — all routes under `/api/summaries`.
**Every request must include** `x-user-id: <uuid>`.

| Method | Path                 | Body                                            | Returns         | Status          |
| ------ | -------------------- | ----------------------------------------------- | --------------- | --------------- |
| GET    | `/api/summaries`     | `?kind=podcast\|food` (optional)                 | `{ items }`     | 200             |
| GET    | `/api/summaries/stats` | —                                             | dashboard stats | 200             |
| GET    | `/api/summaries/:id` | —                                               | summary         | 200 / 404       |
| POST   | `/api/summaries`     | `{ podcastName, sessionTitle, url?, content? }` | created summary | 201 / 400       |
| PUT    | `/api/summaries/:id` | same shape as POST                              | updated         | 200 / 400 / 404 |
| PATCH  | `/api/summaries/:id` | any subset of fields                            | updated         | 200 / 404       |
| DELETE | `/api/summaries/:id` | —                                               | —               | 204 / 404       |
| GET    | `/health`            | —                                               | `{ ok: true }`  | 200             |

AI routes (`/api/ai`):

| Method | Path                | Body / query                                                     | Returns                                        |
| ------ | ------------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| GET    | `/api/ai/providers` | —                                                                | active text/image providers, styles, `needsKey`|
| POST   | `/api/ai/summarize` | `{ podcastName, sessionTitle, notes, url?, tone?, language? }`   | `{ headline, summary, takeaways, quotes, tags, mood, coverPrompt, suggestedStyle, provider, model, usedUrl }` |
| GET    | `/api/ai/image`     | `?prompt=&style=&seed=&w=&h=`                                    | `image/jpeg` (cached 24 h)                     |

`POST /api/ai/summarize` needs `x-user-id` (or a bearer token) and accepts
`kind`; the other two are public. Errors carry `{ error, code }` with `code`
∈ `NO_PROVIDER` (add a key), `RATE_LIMITED`, `PROVIDER_FAILED`.

Auth routes (`/api/auth`):

| Method | Path                     | Body                                   | Returns                                |
| ------ | ------------------------ | -------------------------------------- | -------------------------------------- |
| GET    | `/api/auth/config`       | —                                      | `{ mailer, devCodes, avatarStyles }`   |
| POST   | `/api/auth/request-code` | `{ mode, email, username? }`           | `{ ok, resendIn, devCode? }` / 400 / 409 / 429 |
| POST   | `/api/auth/verify`       | `{ email, code, guestId? }`            | `{ token, user, created, claimed }` / 400 / 429 |
| GET    | `/api/auth/me`           | bearer                                 | `{ user }` / 401                       |
| PATCH  | `/api/auth/me`           | `{ username?, avatarStyle?, avatarSeed? }` | `{ user }`                          |
| POST   | `/api/auth/logout`       | bearer                                 | 204                                    |

`GET /api/summaries` accepts `?kind=podcast|food`.

Summary shape:

```json
{
  "id": "uuid",
  "userId": "uuid (users.id or guest uuid)",
  "kind": "podcast | food",
  "podcastName": "string (restaurant / cuisine for food)",
  "sessionTitle": "string",
  "url": "string | null",
  "content": "string",
  "headline": "string | null",
  "aiSummary": "string | null",
  "takeaways": ["string"],
  "quotes": ["string"],
  "tags": ["string"],
  "mood": "string | null",
  "coverPrompt": "string | null",
  "coverStyle": "playful | doodle | retro | neon | paper | minimal | null",
  "coverSeed": "number | null",
  "createdAt": "ISO-8601 string",
  "updatedAt": "ISO-8601 string"
}
```

All fields except the two titles are optional on write; unknown fields are
dropped and lengths are capped server-side (`sanitizeInput`).

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
- `x-user-id` and, when signed in, `Authorization: Bearer <token>` are set in
  exactly one place: [frontend/src/api/client.ts](frontend/src/api/client.ts)
  → `request()`.
- `req.userId` / `req.user` are resolved in exactly one place:
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

**"Add a free API key to unlock real AI summaries" banner**
No text provider with a key is configured. Put `GROQ_API_KEY=` or
`GEMINI_API_KEY=` in `backend/.env` and restart the backend. For a quick
look without any key, set `AI_TEXT_PROVIDER=mock`.

**Generate returns 429 / "rate-limited"**
Free tiers have per-minute caps. Wait a bit, or add a second provider's key
so the fallback chain has somewhere to go.

**Share card shows a gradient instead of an illustration**
The image provider failed or timed out (anonymous Pollinations is ~1 request
per 15 s). Hit "Shuffle" again, or add `POLLINATIONS_TOKEN` /
Cloudflare / Hugging Face credentials.

**Sign-in code doesn't arrive by email**
No `SMTP_HOST` is set, so nothing was actually emailed — the code is printed
in the backend terminal and shown as a "DEV" hint in the sign-in sheet
instead. Set the `SMTP_*` variables in `backend/.env` for real delivery.

**"sign in required" / 401 with `code: "UNAUTHENTICATED"`**
The stored bearer token is missing, expired (30-day TTL), or belonged to a
restarted in-memory backend (sessions don't survive `STORAGE=memory`
restarts). Sign in again; the frontend auto-clears the stale token on this
response.

**My summaries disappeared after restarting the backend**
You're on `STORAGE=memory` (the default without `DATABASE_URL`) — it's
intentionally ephemeral. Point `DATABASE_URL` at a real Postgres database and
run `npm run db:migrate` to persist data across restarts.

**`psql: error: connection to server … FATAL: password authentication failed for user "postgres"`**
Your `DATABASE_URL` password doesn't match what Postgres has. Either reset
it (`ALTER USER postgres PASSWORD 'postgres';` from an admin `psql` session)
or update `DATABASE_URL` to match — see
[Setting up Postgres](#setting-up-postgres).

**`psql: error: connection to server … FATAL: database "podcast_summary" does not exist`**
Run `psql -h localhost -U postgres -c 'CREATE DATABASE podcast_summary;'`
once (skip this if you used the Docker `POSTGRES_DB` option, which creates
it automatically).

**`pg_isready` says "no response" / connection refused**
Postgres isn't running or isn't listening on the port in `DATABASE_URL`.
If using DBngin, launch it and start the Postgres engine; if using Docker,
`docker start podcast-summary-db`; if using a hosted database, check its
dashboard. Or just switch to `STORAGE=memory` and skip Postgres for now.

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
