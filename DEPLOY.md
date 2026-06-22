# Bringing Horda live — runbook

The app is a single Node 22 process with an embedded database (PGlite). For a pilot there is **no separate database to provision**. It boots, seeds itself on first run, and persists to a mounted volume.

Verified: `node src/web/server.ts` serves the live start screen on `$PORT`.

---

## The 4 things only you can do
1. **Pick a host** (any Docker host works). Easiest: **Render** or **Fly.io** (configs below). Vercel is *not* ideal — it's serverless and our process holds an embedded DB; use a container host.
2. **Attach a persistent disk** mounted at `/data` (so data survives restarts). ~1 GB is plenty for a pilot.
3. **Point a domain** at it (e.g. `app.horda.app`).
4. **Set env vars** (below) — especially `HORDA_DEMO=0` for a real pilot.

Everything else is done.

## Environment
| var | value | why |
|---|---|---|
| `PORT` | `8787` | listen port |
| `HORDA_DATA` | `/data` | persist the embedded DB to the mounted disk |
| `HORDA_DEMO` | `0` (prod) / `1` (showcase) | `0` = browsing open, acting needs sign-up, owner tools need ownership |

## Render (one service)
`render.yaml` is included — push the repo to GitHub and "New → Blueprint", or create a Web Service from the Dockerfile and add a 1 GB disk at `/data`.

## Fly.io
```bash
fly launch --no-deploy            # generates an app; keep the included Dockerfile
fly volumes create horda_data --size 1
# in fly.toml: mount horda_data → /data; set [env] PORT=8787, HORDA_DATA=/data, HORDA_DEMO=0
fly deploy
```

## Any Docker host
```bash
docker build -t horda .
docker run -d -p 80:8787 -v horda-data:/data -e HORDA_DEMO=0 horda
```

---

## Before real fans rely on it (cheap now, expensive later)
- **Claim verification** — today claiming is instant. Add the official-channel/federation check before strangers can claim pages.
- **URL scheme** — commit to `/athlete/:id`, `/club/:id`, `/e/:id`. Changing later breaks shared links; keep redirects if you ever do.
- **Real money** — checkout is stubbed. Wire Stripe in the single `/e/:id/pay` path before charging.
- **Images** — uploads are stored inline in the DB; move blobs to object storage (S3/R2) behind the existing `*_url` fields before volume grows.
- **Auth hardening** — scrypt + cookie sessions are fine for a pilot; add password reset + rate limiting, or front with a managed auth provider, before scale.

None of these block a **closed pilot** with one club and one fighter you onboard yourself.
