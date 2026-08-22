# Podcast Summary — Backend

Express + TypeScript (tsx) + Drizzle ORM on Postgres.

## Setup

```bash
cp .env.example .env       # adjust DATABASE_URL if needed
npm install
# create the database once (DBngin default user is `postgres`, no password)
psql -h localhost -U postgres -c 'CREATE DATABASE podcast_summary;'
npm run db:generate        # generate SQL migrations from schema.ts
npm run db:migrate         # apply migrations
npm run dev                # http://localhost:4000
```

## Auth model

Anonymous. Clients must send an `x-user-id: <uuid>` header. Each user only sees
their own summaries.

## API

All routes under `/api/summaries` and require `x-user-id`.

| Method | Path                 | Body                                            | Returns     |
| ------ | -------------------- | ----------------------------------------------- | ----------- |
| GET    | `/api/summaries`     | —                                               | `{ items }` |
| GET    | `/api/summaries/:id` | —                                               | summary     |
| POST   | `/api/summaries`     | `{ podcastName, sessionTitle, url?, content? }` | created     |
| PUT    | `/api/summaries/:id` | same as POST                                    | updated     |
| PATCH  | `/api/summaries/:id` | partial fields                                  | updated     |
| DELETE | `/api/summaries/:id` | —                                               | 204         |
