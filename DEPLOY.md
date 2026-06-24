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
| `STRIPE_SECRET_KEY` | `sk_test_…` / `sk_live_…` | optional — enables **real card payments** (Stripe Checkout) for paid tickets + memberships. Unset = payments stay stubbed. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | optional but recommended with Stripe — signing secret for the `/stripe/webhook` endpoint. Grants access even if the buyer closes the tab, and **delivers subscription cancellations** (member auto‑reverts to free). |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | optional — upgrades AI-first onboarding **copy** (headline/tagline/bio written by Claude). Unset = a built-in deterministic generator (still produces copy, links + the on-brand cover). |
| `HORDA_AI_MODEL` | e.g. `claude-3-5-haiku-latest` | optional — which Claude model writes onboarding copy (default is a fast, cheap one). Set to a stronger model for higher-quality copy. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud console | optional — enables “Continue with Google”. In the Google OAuth client, set the redirect URI to `https://joinhorda.com/auth/google/callback`. |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | from Meta for Developers | optional — enables “Continue with Facebook” (redirect URI `https://joinhorda.com/auth/facebook/callback`). |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | from your bucket provider | optional — enables **object storage** for uploaded photos (S3, Cloudflare R2, Backblaze B2). All four required together. Unset = images stored inline in the DB (today's behavior). |
| `S3_PUBLIC_BASE` | `https://cdn.joinhorda.com` | optional — public URL prefix for stored images (e.g. an R2 public bucket or CDN). Defaults to `S3_ENDPOINT/S3_BUCKET`. |
| `S3_REGION` | `auto` (R2) / `us-east-1` (AWS) | optional — bucket region; `auto` for Cloudflare R2. |
| `RESEND_API_KEY` | `re_…` | optional — enables real transactional email (password reset) via Resend. Unset = a dev emailer that surfaces the reset link on-screen instead of sending. |
| `EMAIL_FROM` | `Horda <noreply@joinhorda.com>` | optional — the From address for sent email. Must be a domain you've verified in Resend. |
| `HORDA_URL` | `https://joinhorda.com` | optional — canonical origin used to build Stripe return URLs **and password-reset links**. If unset, derived from the request host (fine on Render). |

## Payments (Stripe) — only you can do this
Card data never touches Horda — we use Stripe's hosted Checkout and only store the result. To turn real payments on:
1. Create a free **Stripe** account → Developers → API keys.
2. Copy the **Secret key** (start with the **test** key `sk_test_…`).
3. In Render → **Environment** → add `STRIPE_SECRET_KEY` = that key. (Set `HORDA_URL=https://joinhorda.com` too.)
4. Redeploy. Paid tickets now open Stripe Checkout (one-time); paid memberships open a monthly subscription. After paying, the buyer is redirected back and access is granted automatically.
5. When you've tested with Stripe **test cards** (e.g. `4242 4242 4242 4242`), swap in the **live** key `sk_live_…` to charge real money.

> Do **not** paste your secret key into chat — only into Render's env settings.

### Webhook (recommended — makes access reliable + cancellations work)
The app exposes `POST /stripe/webhook`. To enable it:
1. Stripe → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://joinhorda.com/stripe/webhook`.
3. Select events: **`checkout.session.completed`** and **`customer.subscription.deleted`**.
4. Create it, then copy the **Signing secret** (`whsec_…`).
5. Render → Environment → add `STRIPE_WEBHOOK_SECRET` = that value. Redeploy.

With this set, access is granted server‑to‑server even if the buyer closes the tab, and when a subscription is cancelled (by the member or Stripe) the membership auto‑reverts to free on the next page load. Without the secret the endpoint safely rejects all calls (returns 400) and the redirect path still grants access on success.

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
