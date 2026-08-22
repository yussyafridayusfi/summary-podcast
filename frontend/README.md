# Podcast Summary — Frontend

Vite + Vue 3 + TypeScript SPA. Talks to the Express API at `/api/summaries`
(proxied to `http://localhost:4000` in dev).

## Run

```bash
npm install
npm run dev    # http://localhost:5173
```

Each browser gets a random user ID stored in `localStorage` and sent on every
request as `x-user-id`. That keeps users separated on the backend without any
login flow.
