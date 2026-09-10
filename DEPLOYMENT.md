# Deploying Summary Hub for free

This guide deploys the whole stack — Postgres, the Express/tsx backend, and
the Vue/Vite frontend — on hosts with a genuinely free tier (no credit card,
no trial-then-bill surprise). Total cost: **$0/month**, forever, for
personal/demo traffic.

## One-click path

The repo ships the config both hosts need, so the manual steps below shrink
to: create a Neon database, press two buttons, paste one connection string.

| Step | Action |
| ---- | ------ |
| 1 | Create a free Neon project at [neon.tech](https://neon.tech) and copy its connection string (keep `?sslmode=require`). Run `cd backend && DATABASE_URL="<that string>" npm run db:migrate` once from your machine. |
| 2 | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yussyafridayusfi/summary-podcast) — Render reads [`render.yaml`](render.yaml), creates the free API service, and prompts for `DATABASE_URL` (paste Neon's) plus the optional keys. Leave optional ones blank. Note the URL it gives you. |
| 3 | If the Render URL is **not** exactly `https://summary-hub-api.onrender.com`, edit the `destination` in [`frontend/vercel.json`](frontend/vercel.json) to match and push. |
| 4 | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyussyafridayusfi%2Fsummary-podcast&root-directory=frontend&project-name=summary-hub) — Vercel builds `frontend/` and applies the `/api/*` rewrite from `vercel.json`. Open the URL it gives you. |

Both buttons deploy the repository's **default branch (`main`)**. If your
work is still on a feature branch, merge it first (or change `branch:` in
`render.yaml` and pick the branch in Vercel's import screen).

The blueprint sets `NODE_ENV=production`, which hides the dev sign-in-code
hint — correct for a public URL, since otherwise anyone could sign in as any
email. Until you add SMTP (Step 4 below), sign-in codes are only visible in
Render's **Logs** tab. Everything else (guest mode, AI demo/real, export)
works immediately.

## Table of contents

- [One-click path](#one-click-path)
- [The free stack](#the-free-stack)
- [Two ways to wire frontend ↔ backend](#two-ways-to-wire-frontend--backend)
- [Before you start: a required fix](#before-you-start-a-required-fix)
- [Step 1 — Database on Neon](#step-1--database-on-neon)
- [Step 2 — Backend on Render](#step-2--backend-on-render)
- [Step 3 — Frontend on Vercel](#step-3--frontend-on-vercel)
- [Step 4 — Email for sign-in codes (optional)](#step-4--email-for-sign-in-codes-optional)
- [Step 5 — Real AI summaries (optional)](#step-5--real-ai-summaries-optional)
- [Post-deploy smoke test](#post-deploy-smoke-test)
- [Alternative: one service instead of two](#alternative-one-service-instead-of-two)
- [Alternative hosts](#alternative-hosts)
- [Free-tier limits at a glance](#free-tier-limits-at-a-glance)
- [Redeploying after changes](#redeploying-after-changes)
- [Troubleshooting](#troubleshooting)

---

## The free stack

| Piece                  | Host                                | Why this one                                                                 |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| Postgres                | **[Neon](https://neon.tech)**        | Free tier never expires, no card, auto-wakes on the next query (no manual "resume" click) |
| Backend (Express/tsx)   | **[Render](https://render.com)**     | Only major PaaS with a perpetual $0 web-service tier and no card required     |
| Frontend (Vite build)   | **[Vercel](https://vercel.com)**     | Free static hosting whose rewrites can proxy `/api/*` to Render with zero code changes |
| Email (sign-in codes)   | **[Brevo](https://www.brevo.com)** (optional) | 300 free transactional emails/day over plain SMTP — drops straight into the app's existing `SMTP_*` env vars |
| AI text summaries       | **[Groq](https://console.groq.com/keys)** or **[Gemini](https://aistudio.google.com/apikey)** (optional) | Already wired into the app's provider chain; free key, no card |
| AI cover illustrations  | **Pollinations** (already default)   | No key needed, works out of the box                                          |

Why not some other obvious names:

- **Render's own free Postgres** expires and is deleted 30 days after
  creation — fine for a weekend test, wrong for anything you want to keep.
- **Supabase's** free projects pause after a week of inactivity and need a
  **manual** "resume" click in their dashboard before they respond again —
  bad for a public demo nobody is actively babysitting. Neon's scale-to-zero
  instead just adds a short delay on the next query; no one has to click
  anything.
- **Railway** dropped its indefinite free plan: new accounts get a one-time
  $5 trial credit, then $1/month in credits on the "Free" plan — rarely
  enough to keep a 24/7 web service up. Treat it as a paid host now.
- **Fly.io** removed its free allowance entirely in 2024; a card is required
  after a 2-hour trial.

## Two ways to wire frontend ↔ backend

The frontend's API client (`frontend/src/api/client.ts`) always calls a
**relative** path — `fetch('/api/...')`. That's perfect for one origin, but
Render and Vercel each give you a *different* domain. Pick one:

**A. Rewrite proxy (recommended below, zero code changes).** Vercel forwards
any request to `/api/*` on to your Render URL server-side. The browser only
ever talks to your Vercel domain, so there's no CORS to configure and the
frontend code doesn't need to know the backend's address at all.

**B. One service.** Skip Vercel; have the Express app also serve the built
frontend files, so everything lives at a single Render URL. Simpler
infrastructure (one host, one URL), at the cost of one small code change.
Covered in [Alternative: one service instead of two](#alternative-one-service-instead-of-two).

This guide uses **A** for steps 1–5.

## Before you start: a required fix

The backend's `start` script runs `tsx src/server.ts` — `tsx` is the runtime
that actually executes the TypeScript server, not a dev-only tool. Render
(like most Node hosts) sets `NODE_ENV=production` during install, which
makes `npm install` skip `devDependencies` — and `tsx` used to live there.
Following this guide on an unpatched checkout would install cleanly and then
fail to start.

**This is already fixed on this branch**: `tsx` was moved to
`dependencies` in [backend/package.json](backend/package.json), and
`package-lock.json` was regenerated to match. Verified with a simulated
production install:

```bash
cd backend
npm ci --omit=dev   # exactly what Render runs
node_modules/.bin/tsx src/server.ts   # boots cleanly
```

If you're deploying a fork or an older commit, make the same change before
continuing.

## Step 1 — Database on Neon

1. Sign up at [neon.tech](https://neon.tech) (no card). Create a project —
   any region close to where Render will run is fine.
2. On the project dashboard, copy the **connection string** from the
   "Connect" panel. It looks like:
   ```
   postgresql://neondb_owner:XXXXXXXX@ep-something-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   Keep the `?sslmode=require` suffix — the app's `pg`/Drizzle client reads
   it automatically and enables TLS with no extra code. Don't also set a
   separate `ssl` option anywhere; that's the one combination that *does*
   break (see [Troubleshooting](#troubleshooting)).
3. Run the migrations from your machine, pointed at Neon:
   ```bash
   cd backend
   DATABASE_URL="postgresql://...neon-connection-string...?sslmode=require" npm run db:migrate
   ```
   You should see `✅ migrations applied`. This applies every file in
   `backend/drizzle/` (currently `0000`–`0002`) — the `summaries`, `users`,
   `email_codes` and `sessions` tables.
4. Keep the connection string; you'll paste it into Render next.

## Step 2 — Backend on Render

Fastest: use the **Deploy to Render** button in [One-click path](#one-click-path);
it applies the settings below from [`render.yaml`](render.yaml). To do it
by hand instead:

1. Push this repo to GitHub (already done if you're working from
   `feature/auth-sections-themes` or `main`).
2. In the [Render dashboard](https://dashboard.render.com), **New → Web
   Service**, connect the GitHub repo.
3. Configure:

   | Field            | Value                        |
   | ----------------- | ----------------------------- |
   | Root Directory    | `backend`                     |
   | Runtime            | Node                          |
   | Build Command      | `npm ci`                      |
   | Start Command      | `npm start`                   |
   | Instance Type      | Free                          |
   | Health Check Path  | `/health`                     |

4. Add environment variables (Render's **Environment** tab):

   | Key                 | Value                                                          |
   | -------------------- | ---------------------------------------------------------------- |
   | `DATABASE_URL`       | the Neon connection string from step 1                          |
   | `APP_URL`             | your Vercel URL once you know it, e.g. `https://summary-hub.vercel.app` (used only for OpenRouter attribution headers; safe to leave unset for now and add later) |
   | `AI_TEXT_PROVIDER`    | `mock` to start (swap for `auto` once you add a real key — see [Step 5](#step-5--real-ai-summaries-optional)) |

   Do **not** set `STORAGE=memory` here — that mode resets on every restart
   and Render restarts your free instance whenever it spins down from
   inactivity, so every guest's data would vanish constantly. Leaving
   `DATABASE_URL` set (and `STORAGE` unset) uses Postgres, which is what you
   want.

   Render sets `PORT` for you automatically; the app already reads
   `process.env.PORT`, so don't set it yourself.

5. Deploy. First build takes a couple of minutes. Once live, note the URL —
   something like `https://summary-hub-api.onrender.com`.
6. Confirm it's up:
   ```bash
   curl https://summary-hub-api.onrender.com/health
   # {"ok":true}
   ```

**About the free tier's spin-down**: after 15 minutes with no requests,
Render stops the instance. The next request wakes it — expect **30–60
seconds** before that first response, then normal speed until it idles
again. See [Keeping it awake](#keeping-it-awake-optional) if that matters
for your use case.

## Step 3 — Frontend on Vercel

1. In [Vercel](https://vercel.com), **Add New → Project**, import the same
   GitHub repo.
2. Configure:

   | Field             | Value    |
   | ------------------ | -------- |
   | Root Directory      | `frontend` |
   | Framework Preset    | Vite     |
   | Build Command       | `npm run build` (auto-detected) |
   | Output Directory    | `dist` (auto-detected) |

3. [`frontend/vercel.json`](frontend/vercel.json) already ships in the
   repo and proxies `/api/*` to `https://summary-hub-api.onrender.com`. If
   Render gave your service a different URL, change the `destination`
   there, commit and push — Vercel picks it up on the next deploy. No
   frontend code changes needed; `fetch('/api/...')` transparently reaches
   Render through Vercel's edge, same-origin from the browser's point of
   view.

4. Deploy. Open the Vercel URL — the app should load, the dashboard should
   show "You're a guest," and creating a summary should work end to end
   (using demo-mode AI until you complete Step 5).

5. Optional: go back to the Render environment variables and set `APP_URL`
   to this Vercel URL now that you have it.

## Step 4 — Email for sign-in codes (optional)

Without this, sign-up/sign-in still works: the 6-digit code is printed in
Render's log viewer and, since `NODE_ENV` isn't `production` unless you set
it, also returned to the UI as a "DEV" hint. That's fine for trying the app
yourself, but real visitors can't see your server logs, so give them actual
email:

1. Sign up at [Brevo](https://www.brevo.com/free-smtp-server/) (free, no
   card). Verify a sender email/domain — required before Brevo will relay
   mail on your behalf.
2. **SMTP & API → SMTP**: copy your SMTP login and generate an SMTP key.
3. Add these to Render's environment variables:

   | Key           | Value                              |
   | -------------- | ------------------------------------ |
   | `SMTP_HOST`     | `smtp-relay.brevo.com`              |
   | `SMTP_PORT`     | `587`                               |
   | `SMTP_SECURE`   | `false`                             |
   | `SMTP_USER`     | your Brevo SMTP login (an email address) |
   | `SMTP_PASS`     | the SMTP key Brevo generated         |
   | `SMTP_FROM`     | `"Summary Hub <you@your-verified-domain>"` |
   | `NODE_ENV`      | `production` (hides the dev-code hint now that real mail works) |

4. Redeploy (Render redeploys automatically on env var changes). Sign up
   with a real email and confirm the code arrives.

300 emails/day (about 9,000/month) is generous for sign-in codes on a small
app. [Resend](https://resend.com) (3,000/month, 100/day, SMTP host
`smtp.resend.com`) is a solid alternative with the same drop-in `SMTP_*`
shape.

## Step 5 — Real AI summaries (optional)

Demo mode (`AI_TEXT_PROVIDER=mock`) stitches a summary from the notes
without calling a model — fine for kicking the tires, not what you want
live. Add one free key:

| Key             | Where to get it                                            |
| ---------------- | ------------------------------------------------------------ |
| `GROQ_API_KEY`    | [console.groq.com/keys](https://console.groq.com/keys) — fastest, ~1k req/day free |
| `GEMINI_API_KEY`  | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — 1M-token context |

Add the key to Render's environment variables, remove (or set to `auto`)
`AI_TEXT_PROVIDER`, redeploy. Full provider details, rate limits and the
image-provider options (Pollinations/Cloudflare/Hugging Face) are already
documented in [README.md § AI providers](README.md#ai-providers-all-free).

## Post-deploy smoke test

```bash
API=https://summary-hub-api.onrender.com
WEB=https://summary-hub.vercel.app

curl -s $API/health                          # {"ok":true}
curl -s $API/api/ai/providers | head -c 200   # provider list, no auth needed
curl -s -o /dev/null -w '%{http_code}\n' $WEB # 200
```

Then in the browser: open the Vercel URL, confirm the first-run guide
appears, create a summary, generate with AI, export a card, sign up with a
real email if you configured Brevo, and confirm the guest summary gets
claimed into the new account.

## Alternative: one service instead of two

If you'd rather manage one host and one URL, have Express serve the built
frontend directly instead of using Vercel + a rewrite. This needs a small,
optional code change (not applied to this repo — apply it yourself if you
want this path):

```ts
// backend/src/server.ts — add near the other app.use() calls, AFTER the
// /api routes so API paths are never shadowed by the SPA fallback.
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

app.use(express.static(frontendDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(frontendDist, "index.html"));
});
```

Then on Render: set **Root Directory** to the repo root (not `backend`), and

| Field         | Value                                                          |
| -------------- | ------------------------------------------------------------------ |
| Build Command   | `npm --prefix frontend install && npm --prefix frontend run build && npm --prefix backend install` |
| Start Command   | `npm --prefix backend start`                                      |

Skip Step 3 (no Vercel project, no `vercel.json`) — everything is served
from the one Render URL. Trade-off: a single free instance now also spins
down the frontend along with the API, so the very first load after idle
carries the same 30–60s cold start.

## Alternative hosts

Swap-ins if you'd rather not use the ones above — each keeps the same
zero/near-zero cost, with different trade-offs:

- **Frontend**: [Netlify](https://netlify.com) works the same way as Vercel
  — add `_redirects` with `/api/*  https://your-backend/api/:splat  200` in
  `frontend/public/` instead of `vercel.json`.
  [Cloudflare Pages](https://pages.cloudflare.com) has unlimited static
  bandwidth but its own redirects **can't** target an external domain —
  you'd need a Cloudflare Worker in front to proxy, which is more setup for
  no real benefit here.
- **Backend**: none of the free alternatives researched for this guide
  (Fly.io, Railway) offer a comparably durable free tier as of writing —
  see [The free stack](#the-free-stack) for why they were skipped.
- **Database**: [Supabase](https://supabase.com) works if you're willing to
  manually resume the project after a week of inactivity, or you wire up a
  scheduled keep-alive ping.

## Free-tier limits at a glance

| Host   | Free ceiling                                             | What happens past it                              |
| ------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| Render  | 750 instance-hours/month, spins down after 15 min idle      | Service suspended until next month, or upgrade ($7/mo) |
| Neon    | 0.5 GB storage, 100 compute-hours/month, scale-to-zero after 5 min idle | Reads/writes start failing until next cycle or upgrade |
| Vercel  | 100 GB bandwidth/month                                       | Overage billing kicks in (or upgrade)                 |
| Brevo   | 300 emails/day                                                | Sends queue/fail until the daily reset                |

For a personal project or a small group of testers, none of these ceilings
are realistic to hit.

## Keeping it awake (optional)

Render's cold start is the only real UX cost of this stack. If it bothers
you, a free uptime pinger (e.g. [UptimeRobot](https://uptimerobot.com), free
tier) hitting `GET /health` every 10–14 minutes keeps the instance warm.
Two things to weigh first: it burns into your 750 monthly instance-hours
faster (750 hours ≈ 31 days, so an always-warm instance uses almost all of
it), and it's arguably against the spirit of a free tier meant for
low-traffic use. For a demo or portfolio piece, the 30–60s wait on the
first visit of the day is usually an acceptable trade.

## Redeploying after changes

Both Render and Vercel auto-deploy on every push to the branch you
connected. For a schema change specifically:

1. `cd backend && npm run db:generate` locally (writes a new file under
   `backend/drizzle/`), commit it.
2. Push. Render redeploys the API with the new code.
3. Run the new migration against Neon once, from your machine:
   ```bash
   DATABASE_URL="<neon-connection-string>" npm run db:migrate
   ```
   (Render doesn't run migrations automatically — matches the "no
   auto-migrate on boot" rule in the main README.)

## Troubleshooting

**Render deploy succeeds but the service immediately crashes**
Almost always the `tsx`-in-devDependencies problem described in
[Before you start](#before-you-start-a-required-fix). Confirm your
`backend/package.json` has `tsx` under `dependencies`, not
`devDependencies`, and that `package-lock.json` was regenerated afterward
(`npm install` locally, commit the lockfile).

**First request after idle takes ~30–60s, sometimes returns a Render error page**
Expected cold-start behavior on the free tier. Retry once; see
[Keeping it awake](#keeping-it-awake-optional) if it's a dealbreaker.

**Frontend loads but every API call 404s or hangs**
Check `frontend/vercel.json` was actually committed and that the
`destination` URL matches your real Render URL exactly (including
`https://` and no trailing slash before `/api`). Redeploy Vercel after
editing it — rewrites are read at build time.

**`self-signed certificate in certificate chain` connecting to Neon**
This happens when a connection string's `?sslmode=require` and a
*separately passed* `ssl` object disagree — the URL always wins, silently.
This repo's `backend/src/db/client.ts` only ever passes `connectionString`,
never a separate `ssl` option, so this shouldn't occur out of the box. If
you've customized `client.ts`, remove any extra `ssl` config and let the
connection string's `sslmode=require` do the work.

**Sign-in codes never arrive after configuring Brevo**
Brevo requires sender verification before it will relay mail — check
**Senders & IP** in the Brevo dashboard for a "pending verification"
warning. Also check spam, and confirm `SMTP_FROM` uses the exact verified
address or domain.

**Guest summaries didn't move over after signing in**
The claim only fires once, at the moment of `POST /api/auth/verify`, and
only for the guest ID present in the browser making that request. If you
tested sign-up from a different browser/device than the one with the guest
data, there's nothing to claim from — this matches the documented behavior
in [README.md § Auth model](README.md#auth-model).
