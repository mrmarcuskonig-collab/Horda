# Bringing Furia live — runbook

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
3. **Point a domain** at it (e.g. `app.furia.app`).
4. **Set env vars** (below) — `DATABASE_URL` is required; `FURIA_DEMO=0` for a real pilot.

Everything else is done. No persistent disk needed — the database lives in Postgres.

## Environment
| var | value | why |
|---|---|---|
| `DATABASE_URL` | `postgresql://…` | **required in prod** — your Postgres connection string (Neon etc.). TLS auto-enabled unless the URL says `sslmode=disable`. |
| `PORT` | provided by host | listen port (Render injects this automatically) |
| `FURIA_DEMO` | `0` (prod) / `1` (showcase) | `0` = browsing open, acting needs sign-up, owner tools need ownership; `1` shows seeded demo content without login |
| `STRIPE_SECRET_KEY` | `sk_test_…` / `sk_live_…` | optional — enables **real card payments** (Stripe Checkout) for paid tickets + memberships. Unset = payments stay stubbed. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | optional but recommended with Stripe — signing secret for the `/stripe/webhook` endpoint. Grants access even if the buyer closes the tab, and **delivers subscription cancellations** (member auto‑reverts to free). |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | optional — upgrades AI-first onboarding **copy** (headline/tagline/bio written by Claude). Unset = a built-in deterministic generator (still produces copy, links + the on-brand cover). |
| `FURIA_AI_MODEL` | e.g. `claude-3-5-haiku-latest` | optional — which Claude model writes onboarding copy (default is a fast, cheap one). Set to a stronger model for higher-quality copy. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud console | optional — enables “Continue with Google”. In the Google OAuth client, set the redirect URI to `https://joinfuria.com/auth/google/callback`. |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | from Meta for Developers | optional — enables “Continue with Facebook” (redirect URI `https://joinfuria.com/auth/facebook/callback`). |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | from your bucket provider | optional — enables **object storage** for uploaded photos (S3, Cloudflare R2, Backblaze B2). All four required together. Unset = images stored inline in the DB (today's behavior). |
| `S3_PUBLIC_BASE` | `https://cdn.joinfuria.com` | optional — public URL prefix for stored images (e.g. an R2 public bucket or CDN). Defaults to `S3_ENDPOINT/S3_BUCKET`. |
| `S3_REGION` | `auto` (R2) / `us-east-1` (AWS) | optional — bucket region; `auto` for Cloudflare R2. |
| `RESEND_API_KEY` | `re_…` | optional — enables real transactional email (password reset) via Resend. Unset = a dev emailer that surfaces the reset link on-screen instead of sending. |
| `EMAIL_FROM` | `Furia <marcus@spaghetti.ventures>` | optional — the From address for sent email. **Must be a domain you've verified in Resend (SPF + DKIM).** Defaults to `CONTACT_EMAIL`. Move this to `noreply@joinfuria.com` once that domain is verified — see the note below. |
| `CONTACT_EMAIL` | `marcus@spaghetti.ventures` | optional — the human contact address used by the Impressum, support links and the email footer. Single source of truth; defaults to `marcus@spaghetti.ventures`. |
| `FURIA_URL` | `https://joinfuria.com` | optional — canonical origin used to build Stripe return URLs **and password-reset links**. If unset, derived from the request host (fine on Render). |

| `GEO_PROVIDER` | `photon` (default) | optional — venue/address autocomplete. `photon` = komoot's public OSM geocoder, no key, works out of the box. `mapbox` = commercial (needs `MAPBOX_TOKEN`). `off` = curated city list only, nothing leaves our server. |
| `PHOTON_URL` | `https://photon.komoot.io` | optional — point at your OWN Photon instance once volume justifies it (see the note below). |
| `MAPBOX_TOKEN` | `pk.…` | optional — only read when `GEO_PROVIDER=mapbox`. |

### Address autocomplete — why Photon, and when to move off it
"Type a coffee shop, pick the address" needs a geocoding provider. Two things
decided this:

**Nominatim is not an option**, despite being the obvious OSM choice. Its usage
policy explicitly forbids exactly this feature — *"Auto-complete search … you
must not implement such a service on the client side using the API."* Violating
it gets the server's IP banned, and you'd find out via silent 403s in production.
https://operations.osmfoundation.org/policies/nominatim/

**Photon** (by komoot) is the same OpenStreetMap data through a geocoder built
for search-as-you-type. No key, no card, and typeahead is the intended use.

The catch, and it's real: `photon.komoot.io` is komoot's **public demo server**.
They offer no availability guarantee and will throttle or ban excessive use. That
is fine at launch volume and not fine forever. Two exits, both cheap:
- **Self-host Photon** (Apache-2.0, ~two files to run) and set `PHOTON_URL`.
  Nothing else changes.
- **Switch to Mapbox** — set `GEO_PROVIDER=mapbox` + `MAPBOX_TOKEN`. Commercial
  SLA, generous free tier.

Lookups are proxied server-side (keys stay off the client, and the user's typing
goes to us rather than straight to a third party), cached in-process for 10
minutes, and never fire below 3 characters. If the provider is down the field
silently falls back to a curated city list — an address box that suggests nothing
looks broken, so it always suggests something.

### Email sender — a note before launch
Right now magic links are sent **from `marcus@spaghetti.ventures`** while a user is
signing up **on `joinfuria.com`**. That works, and it means only one domain
(`spaghetti.ventures`) needs SPF/DKIM verification in Resend today. But the
mismatch has a cost: a login link arriving from a different domain than the site
the user just used looks like phishing — to the user *and* to spam filters, which
score unaligned From-domains harshly. Deliverability on a signup email is the
whole funnel.

**Before launch:** verify `joinfuria.com` in Resend (SPF + DKIM + DMARC), then set
`EMAIL_FROM="Furia <noreply@joinfuria.com>"`. Leave `CONTACT_EMAIL` as the human
address — the Impressum and support links should point at a mailbox you read.
Nothing in the code needs to change; both are env vars.

## Payments (Stripe) — only you can do this
Card data never touches Furia — we use Stripe's hosted Checkout and only store the result. To turn real payments on:
1. Create a free **Stripe** account → Developers → API keys.
2. Copy the **Secret key** (start with the **test** key `sk_test_…`).
3. In Render → **Environment** → add `STRIPE_SECRET_KEY` = that key. (Set `FURIA_URL=https://joinfuria.com` too.)
4. Redeploy. Paid tickets now open Stripe Checkout (one-time); paid memberships open a monthly subscription. After paying, the buyer is redirected back and access is granted automatically.
5. When you've tested with Stripe **test cards** (e.g. `4242 4242 4242 4242`), swap in the **live** key `sk_live_…` to charge real money.

> Do **not** paste your secret key into chat — only into Render's env settings.

### Webhook (recommended — makes access reliable + cancellations work)
The app exposes `POST /stripe/webhook`. To enable it:
1. Stripe → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://joinfuria.com/stripe/webhook`.
3. Select events: **`checkout.session.completed`** and **`customer.subscription.deleted`**.
4. Create it, then copy the **Signing secret** (`whsec_…`).
5. Render → Environment → add `STRIPE_WEBHOOK_SECRET` = that value. Redeploy.

With this set, access is granted server‑to‑server even if the buyer closes the tab, and when a subscription is cancelled (by the member or Stripe) the membership auto‑reverts to free on the next page load. Without the secret the endpoint safely rejects all calls (returns 400) and the redirect path still grants access on success.

## Render (one web service + a Neon database)
1. Create a free database at **neon.tech**, copy the connection string.
2. Render → **New → Web Service** → your GitHub repo → **Language: Docker** → Free instance.
3. **Environment** → add `DATABASE_URL` = the Neon string, and `FURIA_DEMO` = `1` (or `0`).
4. Deploy. (No disk, no Root Directory tweaks — files sit at the repo root.)

`render.yaml` is included if you prefer "New → Blueprint", but the manual steps above are simplest.

## Any Docker host
```bash
docker build -t furia .
docker run -d -p 80:8787 -e DATABASE_URL='postgresql://…' -e FURIA_DEMO=0 furia
```

---

## Before real fans rely on it (cheap now, expensive later)
- **Claim verification** — today claiming is instant. Add the official-channel/federation check before strangers can claim pages.
- **URL scheme** — commit to `/athlete/:id`, `/club/:id`, `/e/:id`. Changing later breaks shared links; keep redirects if you ever do.
- **Real money** — checkout is stubbed. Wire Stripe in the single `/e/:id/pay` path before charging.
- **Images** — uploads are stored inline in the DB; move blobs to object storage (S3/R2) behind the existing `*_url` fields before volume grows.
- **Auth hardening** — scrypt + cookie sessions are fine for a pilot; add password reset + rate limiting, or front with a managed auth provider, before scale.

None of these block a **closed pilot** with one club and one fighter you onboard yourself.
