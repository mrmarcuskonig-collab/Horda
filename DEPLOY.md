# Bringing Horda live — runbook

The app is a single Node 22 web process. It talks to a real **Postgres server**
(set `DATABASE_URL`) — Neon, Render Postgres, RDS, anything. It boots, runs its
own SQL migrations, and seeds itself on first run. With no `DATABASE_URL` set it
falls back to an embedded PGlite database (local dev + tests only).

Verified: against a real wire-protocol Postgres the web process serves every
page using **~115 MB RAM** (fits a free 512 MB instance).

> Do **not** run the embedded PGlite in production — its WASM engine alone
> reserves ~480 MB (won't fit small instances) and it isn't backed up.
> Always set `DATABASE_URL` in production.

---

## The 4 things only you can do
1. **Create a Postgres database** and copy its connection string. Easiest free option: **Neon** (neon.tech) — free tier, persistent, doesn't expire. (Render Postgres or any managed Postgres works too.)
2. **Pick a host** for the web process (any Docker host). Easiest: **Render** (Docker runtime; free tier is fine now). Vercel is *not* ideal — it's serverless; use a container host.
3. **Point a domain** at it (e.g. `app.horda.app`).
4. **Set env vars** (below) — `DATABASE_URL` is required; `HORDA_DEMO=0` for a real pilot.

Everything else is done. No persistent disk needed — the database lives in Postgres.

## Environment
| var | value | why |
|---|---|---|
| `DATABASE_URL` | `postgresql://…` | **required in prod** — your Postgres connection string (Neon etc.). TLS auto-enabled unless the URL says `sslmode=disable`. |
| `PORT` | provided by host | listen port (Render injects this automatically) |
| `HORDA_DEMO` | `0` (prod) / `1` (showcase) | `0` = browsing open, acting needs sign-up, owner tools need ownership; `1` shows seeded demo content without login |

## Render (one web service + a Neon database)
1. Create a free database at **neon.tech**, copy the connection string.
2. Render → **New → Web Service** → your GitHub repo → **Language: Docker** → Free instance.
3. **Environment** → add `DATABASE_URL` = the Neon string, and `HORDA_DEMO` = `1` (or `0`).
4. Deploy. (No disk, no Root Directory tweaks — files sit at the repo root.)

`render.yaml` is included if you prefer "New → Blueprint", but the manual steps above are simplest.

## Any Docker host
```bash
docker build -t horda .
docker run -d -p 80:8787 -e DATABASE_URL='postgresql://…' -e HORDA_DEMO=0 horda
```

---

## Before real fans rely on it (cheap now, expensive later)
- **Claim verification** — today claiming is instant. Add the official-channel/federation check before strangers can claim pages.
- **URL scheme** — commit to `/athlete/:id`, `/club/:id`, `/e/:id`. Changing later breaks shared links; keep redirects if you ever do.
- **Real money** — checkout is stubbed. Wire Stripe in the single `/e/:id/pay` path before charging.
- **Images** — uploads are stored inline in the DB; move blobs to object storage (S3/R2) behind the existing `*_url` fields before volume grows.
- **Auth hardening** — scrypt + cookie sessions are fine for a pilot; add password reset + rate limiting, or front with a managed auth provider, before scale.

None of these block a **closed pilot** with one club and one fighter you onboard yourself.
