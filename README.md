# Furia — Backend

The data foundation for Furia: the system of record for real sport. This repo currently holds the **database schema** — the first product slice — built faithfully from `furia_master_spec.md`.

---

## ADR-001 — Stack (VP Eng call, 17 Jun 2026)

Decided fast, for a solo + AI-built v0 optimizing for time-to-working-product, type-safety, and fidelity to a genuinely relational domain model.

| Layer | Choice | Why |
|---|---|---|
| **Database** | PostgreSQL 16 | The spec is Postgres-shaped already — uuid PKs, `jsonb`, native enums, check constraints. Nothing else models this domain as honestly. |
| **Schema source of truth** | Versioned raw SQL migrations (`db/migrations`) | The schema *is* the product's spine; keep it ORM-agnostic, reviewable, and the canonical artifact. ORMs wrap it, never define it. |
| **App + API** | Next.js 15 (App Router, route handlers) + TypeScript | One framework for web + API; best-in-class for solo + AI; deploys trivially. *Next slice.* |
| **DB access** | Drizzle ORM | Typed, SQL-first, introspects the existing schema rather than fighting it. *Next slice.* |
| **Auth** | Auth.js (start), Clerk if we need org/RBAC UI fast | Minimal `account` table already anchors ownership + RBAC so we're not blocked. *Next slice.* |
| **AI extraction** | Separate worker service (the pre-ingestion pipeline) | The extract→map→resolve engine runs in two modes (batch crawl + interactive upload); isolate it from the request path. *Phase 3 slice.* |
| **Hosting** | Neon (Postgres) + Vercel (app) | Branchable Postgres for preview envs; zero-ops for a solo founder. *When we deploy.* |

**Mobile** (React Native / Expo) is post-v0; the fan DAU surface ships web-first.

### What I designed beyond the spec
The master spec (§11) flagged three things as "still to spec." I made the v0 calls here so the schema is complete and runnable:
- **The opt-in link lifecycle** — one `relationship_link` engine with a `kind` + `policy` + `state` machine, covering roster membership, league assignment, and matchups. `open_join` auto-accepts via trigger; `approval_required` stays `pending` until decided.
- **Event participation / auto-attend** — `event_participant` with `source` (`inherited` vs `direct`) and a per-event `status` layer on top of eligibility.
- **RBAC** — `role_grant` scoped to club (cascades) or a single team, anchored on a minimal `account`.

---

## The seven non-negotiables, encoded as constraints

Spec §12 lists the decisions that get "simplified" in handoff. Each is enforced in the schema, not just documented:

1. **Persons self-create, non-persons are seeded** → `athlete.source` has `CHECK (source = 'native')`. An ingested athlete is *impossible* to insert.
2. **`result_participant` ≠ standing `unit`** → two separate columns (`variant.result_participant`, `variant_standing.unit`); the trio seed proves they legitimately differ (Boxstall team, Triathlon Bundesliga).
3. **System of record, not a social venue** → no fan-to-fan tables exist. `follow` is fan→entity only; the only interpersonal links are real-world (roster, matchup).
4. **Density before breadth** → not a schema constraint (a GTM discipline).
5. **Catalog = data, engines = code** → `sport`/`variant`/`category`/standings/templates are data rows; the only code-level surface is the enum set.
6. **Club ≠ Team** → separate tables; `team.club_id` NOT NULL + `team.sport_id` NOT NULL (single-sport); `club` carries no sport (derived).
7. **Leagues are governed** → `league.creator_type` is restricted to `association | league`, with a CHECK that an association-minted league names its association and a league-minted one names its parent.

---

## Layout

```
db/
  migrations/
    0001_enums.sql        code-level enums + extensions
    0002_entities.sql     account, sport, fan, athlete, association, club, team,
                          league, event_series, event, entity_sport, role_grant
    0003_links.sql        follow, relationship_link (+auto-accept trigger),
                          roster/league_member views, event_participant
    0004_registry.sql     variant, variant_standing, category, variant_result_field,
                          template, template_standing, template_category,
                          data_integration_request, deferred FKs
    0005_results.sql      result (the universal spine)
  seed/
    seed_trio.sql         the §3.2 worked example, fully populated
  apply.sh               run all migrations + seed in order
  verify.sql             validation queries proving the invariants hold
```

## Run it

```bash
createdb furia
./db/apply.sh furia
psql furia -f db/verify.sql
```

---

## ADR-002 — Slice 2: the computation engines (17 Jun 2026)

**Context.** No GDPR / EU-database-rights counsel is available yet, which blocks the *batch public-data crawl* — the one part of the pre-ingestion pipeline with real legal exposure. So I deferred the crawler and built the piece with zero legal dependency and zero external data: the **standings/result engines** — the "engines = code" half of *catalog = data, engines = code*. They're also the thing every visible surface (a table, a match report, a profile record) depends on.

**What shipped (`src/engines/`).** All five `standing_engine` strategies, a dispatcher, and the spine→headline summarizer:

| Engine | Used by | Proves |
|---|---|---|
| `points_table` | football league table | matchup pairing, GD/points, tiebreakers |
| `win_loss_record` | boxing career record | per-individual career ledger |
| `time_leaderboard` | triathlon finishers | field ranking by time, DNF/DNS handling |
| `team_aggregate` | Boxstall (gym) team | **individual results → team standing** |
| `series_points` | triathlon Bundesliga | **individual races → club season table** |

The last two are the runtime proof of spec §12.2: `variant.result_participant = individual` while `standing.unit = team`, computed correctly. `tests/trio.test.ts` runs the full §3.2 example through the engines — **12/12 assertions pass** (`npm test`, Node 22+, native TypeScript, no deps).

**Deferred, not dropped.** The extract→map→resolve pipeline's *user-upload mode* (snap a scoresheet / paste fixtures — user-initiated on their own data, much lower legal exposure) is the natural next slice and can proceed before the crawl. The *batch crawl* stays parked until counsel exists.

## Layout (added in slice 2)

```
src/engines/
  types.ts            spine row, standing def/row, engine interface
  points_table.ts     win_loss_record.ts   time_leaderboard.ts
  team_aggregate.ts   series_points.ts     summarize.ts
  index.ts            engine registry + computeStanding() dispatcher
tests/
  trio.test.ts        the §3.2 example, executed end-to-end (12/12)
```

---

## ADR-003 — Slice 3: user-upload ingestion (17 Jun 2026)

**Context.** Batch crawling is off until counsel exists (per your call). So this slice builds the *other* mode of the same extract→map→resolve engine: **user-upload**, where the input is data the user brought (pasted fixtures, a results block, a scoresheet). User-initiated, on their own data — no scraping, no database-rights / GDPR exposure — and it's the spec's highest-leverage adoption move ("snap the scoresheet, paste the WhatsApp fixtures").

**Pipeline (`src/pipeline/`).** `extract → map → resolve → stage`:
- **extract** — a rule-based parser (the testable core *and* the fallback) lifts fixtures/results out of messy German/intl text. An `LLMExtractor` adapter has the identical interface so a model can be swapped in for photos/OCR/freeform with no change downstream.
- **resolve** — Sørensen–Dice fuzzy matching with German umlaut/ß normalization and club-noise stripping (FC/SV/TSV…), producing a confidence score and an `auto` / `review` / `new` decision per side.
- **map** — resolved results materialize into the universal spine (one row per side, `source='ingested'`), so they flow straight into the slice-2 engines.
- **stage** — `ingestUserUpload()` splits output into `ready` vs `needs_review`; **low confidence never auto-commits** (spec §5 guardrail — a wrong result on a fan's own team is worse than a missing one). Scope is non-person entities only; the pipeline never mints an athlete.

**Proof it works end-to-end.** `tests/pipeline.test.ts` pastes a messy WhatsApp-style schedule and a results block: dates/times/scores parse, known teams auto-link, an unknown opponent is flagged `new` and routed to review, and the extracted results feed the standings engine to produce a live league table (FC Beispiel top on 7 pts, GD +6). **17/17 pass.** Two real bugs were caught and fixed in the process (a regex boundary that ate the trailing date dot; missing umlaut expansion).

## Layout (added in slice 3)

```
src/pipeline/
  types.ts     extract/resolve/stage contracts
  extract.ts   rule-based extractor + LLM adapter seam
  resolve.ts   fuzzy entity resolution (Dice + de-noising)
  map.ts       results -> universal spine
  index.ts     ingestUserUpload() orchestrator
tests/
  pipeline.test.ts   messy paste -> table, end-to-end (17/17)
```

---

## ADR-004 — Slice 4: the read/feed layer + the payoff (17 Jun 2026)

**Context.** Three slices built the spine (schema), the math (engines), and the intake (ingestion). This slice turns them into the thing a fan or a tenant actually *sees* — the spec's hard bars: *time-to-first-wow in seconds, zero blank screens*. It's the proof the whole stack hangs together: one paste → a finished page.

**What shipped (`src/read/`).** Read models assembled purely from the spine — `buildClubPage()` produces a league table (via the slice-2 engine), the club's recent form with natural-language headlines, upcoming fixtures (with low-confidence ones honestly flagged), a season record, and a coverage feed. `renderClubPage()` renders it as a strictly monochrome (Ink/Bone) page. **System of record, not a venue:** the feed only carries results and fixtures — there is no fan-to-fan item type to render (spec §9).

**The demo (`examples/demo.ts`).** Pastes a messy WhatsApp results dump + a fixtures list and writes `furia-club-page.html`: FC Beispiel, 3W-1D, top of the table on 10 pts, with headlines ("FC Beispiel beat SpVgg Altdorf 4–0") and upcoming matches — all from raw text, no DB. **10/10 read tests pass; 39/39 across the whole suite.**

## Layout (added in slice 4)

```
src/read/
  types.ts     ClubPageModel, feed/table/form/upcoming types
  build.ts     buildClubPage() — spine -> read models
  render.ts    renderClubPage() — monochrome HTML
examples/
  demo.ts      paste -> ingest -> engines -> rendered club page
tests/
  read.test.ts read models + render (10/10)
```

---

## ADR-005 — Slice 5: persistence (it's a real app now) (17 Jun 2026)

**Context.** The first four slices ran in memory. This slice puts a database under them and closes the live-Postgres verification owed since slice 1.

**Decisions.**
- **Embedded Postgres via PGlite** for dev + tests — the actual Postgres engine (v18) compiled to WASM, running in-process. Zero-ops for a solo bootstrapper, and it lets the *real* schema, the constraints, and the triggers run in CI with no server. Production swaps in server-Postgres (Neon) behind the same one-method `Database` interface (`src/db/index.ts`).
- **Dropped the `pgcrypto` dependency** — `gen_random_uuid()` has been in Postgres core since v13. Cleaner schema, one less moving part.
- **Added `event_participant.is_home`** (migration 0006) so matchup home/away is explicit rather than inferred.

**What shipped (`src/db/`).** A `Database` adapter + `applySchema`/`applySeed` runners over the real `db/` SQL; a repo that **commits** ingested results/fixtures into the schema (events + spine rows + participation, `source='ingested'`, `needs_review` held back) and **reads the club page back out of the DB** by reusing the slice-2 engines and slice-4 read layer verbatim — only the data source changed.

**Verification, finally on real Postgres.** `tests/db.test.ts` applies all 6 migrations on PGlite, commits a paste, reads the club page from the database, and checks the invariants **at runtime**: an `ingested` athlete insert is *rejected*, an ungoverned league insert is *rejected*, and the `open_join` trigger auto-accepts. **12/12.** The whole suite: **51/51.**

## Layout (added in slice 5)

```
src/db/
  index.ts     Database interface + PGlite adapter + applySchema/applySeed
  repo.ts      commit (ingest -> DB) + getClubPage (DB -> read models)
db/migrations/
  0006_event_participant_home.sql
examples/
  persist-demo.ts   paste -> commit to Postgres -> read page back -> render
tests/
  db.test.ts   persistence + runtime invariants on live Postgres (12/12)
```

---

## ADR-006 — Slice 6: the fandom layer (fan↔athlete engagement) (17 Jun 2026)

**Context.** Furia is predominantly a fandom product: the point is *closeness between fans and the athletes/teams they back.* The structural graph (clubs, teams, associations, leagues) built in slices 1–5 is the substrate that makes that closeness real and verified — it is never the point. This slice builds the engagement surfaces on the **hub-and-spoke** axis the spec mandates (§1, §9): fans follow entities, the hub broadcasts to fans, fans engage with **real outcomes**.

**The fan↔fan guardrail is structural, not a convention.** The schema cannot express a fan-to-fan venue:
- `post_author_type` is `athlete | club | team` — there is **no `fan`**, so a fan literally cannot author feed content. Posts are hub→spoke broadcasts.
- `follow_target_type` is `club | team | athlete` — a fan **cannot be followed**.
- `prediction` is a fan vs a **real event outcome**; `notification` is system → fan.
There is no fan→fan edge anywhere. *(Both guardrails are asserted in the test.)*

**What shipped (`src/engagement/`, `src/db/engagement_repo.ts`, migration 0007).** `post` / `prediction` / `notification` tables; follow, athlete broadcast with follower notification fan-out, "your call" predictions on real fixtures, prediction settlement on the result (fan vs the result — correct iff you picked the winner), a personalized **fan feed** (coverage of everyone you follow), and the **athlete profile / idol surface** (record via the slice-2 `win_loss_record` engine, followers, recent results, posts, next fight).

**Proof (`tests/engagement.test.ts`).** A boxing idol surface, on live Postgres: two fans follow a fighter → he posts a callout (both notified) → they call the bout (one each way) → the result settles their calls → his profile shows 1-0-0 with the KO headline, and each fan's home shows the post + result in their feed and their prediction graded. **13/13**, and the two guardrail assertions pass.

---

## ADR-007 — Slice 7: the web app (you can click it) (17 Jun 2026)

**Context.** Six slices made a correct backend; none of it was visible. This slice puts a running, server-rendered web app on top so the fandom loop is something you actually *use*.

**Stack call.** I deferred the full Next.js toolchain and shipped a **zero-dependency SSR app on Node's built-in `http`**, over the existing DB + engagement repo. Reasons: it boots instantly, runs in CI with no build step, and each route is already a pure `data → HTML` function that lifts straight into a Next route handler when we want React interactivity and deployment. Pragmatic now, no dead end later.

**What shipped (`src/web/`).**
- **Athlete profile / idol surface** — record, followers, a **Follow** button, the next fight with **"your call?"** predict buttons, the fighter's broadcasts, recent results.
- **Fan home** — "Your Furia": notifications, your graded calls, and a personalized feed that's pure coverage of who you follow (the guardrail line is right on the page).
- **Club page** — league table, form, upcoming.
- `seed.ts` builds a demo world on boot (a 2-0 boxer with a callout + upcoming fight; a football club with a table; a fan following both). `follow`/`predict` are real POST actions that persist.

**Proof (`tests/web.test.ts`).** Boots the server, drives every route over HTTP, **POSTs a real prediction and confirms it persisted**, and snapshots the three screens. **12/12.** Whole suite: **76/76.**

```bash
npm run web     # → http://localhost:8787  (home / fan / athlete / club, live)
```

---

## ADR-008 — Slice 8: athlete surface, Weverse-style (17 Jun 2026)

**Context.** Furia is predominantly a fandom product, so the athlete page is the marquee surface. Reworked it to match the Weverse/FURIA pattern, made sports-specific, and athlete-owned.

- **Athlete-controlled identity** — banner, avatar, tagline, and **social links rendered as platform icons** (not words), pointing OUT (Instagram/X/TikTok/YouTube/site). Migration 0008.
- **Athlete-curated affiliations** — the athlete chooses which clubs/teams/leagues/gym/promotion/events to show (sidebar chips, like Weverse's member list). Migration 0009 (`athlete_affiliation`).
- **Record made legible** — `2–0–0` now labeled *Wins–Losses–Draws*.
- **Attendance, not "your call"** — the next-event CTA is now *Join for free / Buy tickets / Stream live*, and the athlete/organizer picks which channels are offered per event (`event.ticket_url`, `event.stream_url`, `spectator_access`; `attendance` table). Reads "You're not attending yet" → "You're going ✓".
- **Public, with a sign-up gate** — anyone can browse; a guest who acts on anything except **Shop** is routed to `/signup`, with a bottom "log in to continue" bar (`?guest=1` renders the guest view).
- **Dark, monochrome, two-column** layout mirroring Weverse — still strictly Ink/Bone.

`tests/web.test.ts` checks all of it incl. both registered and guest views, and an attend action over HTTP. **19/19**; whole suite **83/83**. Snapshots: `furia-app-athlete.html` (registered) and `furia-app-athlete-guest.html` (public).

---

## ADR-009 — Slice 9: club / team / association surfaces on a shared shell (17 Jun 2026)

**Context.** Apply the athlete surface's treatment to every non-person entity, without four divergent pages.

**Decision.** Factor the Weverse-style dark surface into one reusable shell (`src/web/shell.ts` — hero, tabs, sidebar card, members lists, attendance, gate, dark table) driven by a single `ProfileVM`. Generic owner-controlled branding for all of them (migration 0010 `entity_branding`: crest/avatar, banner, tagline, out-pointing social icons).

**Surfaces.**
- **Club** — crest hero, **teams as the members list**, league table, matchday attendance (Join/tickets/stream), club broadcast, shop.
- **Team** — roster as members (links to each player's athlete page), **parent-club link**, its league table, next-match attendance.
- **Association (Verband)** — **member clubs + sanctioned competitions** (derived: association → league → member team → club), notices. No shop.

All public with the same guest sign-up gate (Shop exempt). The fan↔fan guardrail still holds end to end — posts are authored by club/team/athlete (never fans), and `post_author_type` has no `association` either, so governing bodies broadcast via notices, not a feed of users.

`tests/web.test.ts` covers all three plus a guest gate; snapshots `furia-app-{club,team,association}.html`. **29/29 web, 93/93 suite.**

---

## ADR-010 — Slice 10: one dark theme + real image uploads (17 Jun 2026)

**Theme.** The fandom surfaces were dark; the home/feed/sign-up pages were light. Unified the whole app on the dark Ink/Bone theme (the shared `layout()` and the standalone club render now match the profile shell). Still strictly two colours.

**Uploads.** Athletes and entity owners can now set a real crest/avatar + banner. Implementation: an owner-only **Edit panel** with file inputs; the client reads the files to **data URLs** and posts them, the server stores them in the existing `avatar_url` / `banner_url` columns. No object storage, no static-file route, no multipart parser — the images persist in Postgres and render immediately in the hero/avatar. (For production scale we'd move blobs to object storage behind the same URL field; the render path doesn't change.) Endpoints: `POST /athlete/:id/branding`, `POST /entity/:type/:id/branding` (partial-merge so a crest upload doesn't wipe the tagline). The panel only shows to a signed-in owner, never a guest.

`tests/web.test.ts` uploads a PNG to an athlete and a club and asserts both render as `<img>`. **32/32 web, 96/96 suite.**

---

## ADR-011 — Slice 11: content & share engine (the acquisition loop) (17 Jun 2026)

**Context.** Close the funnel (spec §4): turn the structured spine into shareable artifacts that travel to IG/TikTok/X and pull fans back. The platform manufactures the content fans post elsewhere.

**The bright line, enforced.** Every artifact restates **recorded facts only** — names, scores, method, date, record. Nothing invents a quote, a voice, or a stat (spec §4). The generators are deterministic functions over the spine (`src/content/report.ts`, `cards.ts`); an LLM may later *polish phrasing* behind the same interface but can't change the facts. A test asserts there's no fabricated quote/first-person voice.

**What shipped (`src/content/`).**
- **Stat cards** — vertical 1080×1350 SVG, strictly Ink/Bone, raven motif, `furia.app` footer (result card, fight card, week-drop card).
- **Factual recaps** — match report, fight hype, and a personalized **"your week" drop** from a fan's coverage.
- **Public share pages** — `/share/result/:id`, `/share/fight/:id`, `/share/week/:fan`: open to everyone (the one gate exception alongside Shop — shares must reach non-users), showing the card, the recap, outbound **Share on X / WhatsApp / download**, and a **"This is the Furia — Join free"** CTA. Share affordances sit on the athlete (results + matchup), club/team (matchday), and fan home (week drop).

`tests/content.test.ts` (8) checks the bright line + cards; `tests/web.test.ts` checks the public share routes. **107/107 across 7 suites.**

---

## ADR-012 — Real marks, no wordmark (18 Jun 2026)

The supplied brand assets are now wired verbatim (`src/web/brand.ts`): the **raven** on everyday surfaces (every page header, the favicon, default avatars) and the **crest** on ceremonial ones (the share cards). **There is no wordmark anywhere** — the bird is the identity. All placeholder "FURIA" type was removed across the app, the standalone club render, and the share cards; `/favicon.svg` is served from the delivered asset. A test asserts the share card carries the crest path and contains no "FURIA" text. **107/107.**

---

## ADR-013 — Slice 12: scheduled events & RSVP (Luma-style) (18 Jun 2026)

**Context.** Athletes and institutions need to schedule their own events and have fans respond — the organizer flow (spec §6.4), and the supply-side counterpart to the fan attend flow.

**What shipped (migration 0011, `events_repo.ts`, `web/events.ts`).**
- **Host & schedule** — any athlete/club/team/association gets a *Schedule an event* CTA → a create form (title, date/time, location, description, cover upload, free-RSVP / ticket-link / stream-link, capacity). The `event` table gained `host_kind/host_id/description/cover_url/capacity`; no new table.
- **Public event page** (`/e/:id`) — cover, host, when/where, description, live going/interested counts, and the four responses: **Going / Can't go / Stream live / Interested** (`attend_mode` extended). Public to view; responding needs a free account (the gate); **add-to-calendar** exports a real `.ics` (`/e/:id/ics`).
- **Host management** (`/manage/:id`) — counts + the guest list grouped by response.
- Each profile lists its upcoming events.

`tests/events.test.ts` (7) covers create / four-way RSVP / upsert-on-change / counts / guest list / ICS; `tests/web.test.ts` covers the public page, the calendar route, an RSVP over HTTP, the guest gate, and the create form. **121/121 across 8 suites.**

---

## ADR-014 — Slice 13: admission, payment, watch-live & cross-posting (18 Jun 2026)

**Context.** Round out events to Luma parity, adapted to sport.

- **Admission types** (`event.admission`): **open** (free, walk-in), **register** (free, RSVP required), **apply** (request → host approves), **paid** (buy a ticket). The page CTA, the guest list, and the manage view all key off this.
- **Payment from the start** — paid events carry `price_cents`/`currency`, a **checkout** step, and a `paid` registration state. Stripe is the production swap; the charge is stubbed so the full price → checkout → ticket → guest-list flow is live and tested.
- **Watch live (online)** — per-event `streams` (YouTube / Twitch / Discord) render as "Watch on …" actions.
- **Approvals** — `apply` events go `pending` → host approves in `/manage`; counts separate going from pending.
- **Cross-posting** (`event_feature`) — any entity can **feature** an event hosted by another; profiles show hosted + featured (labelled, "via {host}"). Seeded: the athlete features the club's ticketed launch; the club features the federation's apply-only ceremony.

`tests/events.test.ts` + `tests/web.test.ts` cover all four admissions, the checkout→paid flow, watch channels, approvals, and a cross-post on a profile. **126/126 across 8 suites.**

---

## ADR-015 — Slice 14: closeness monetization & spread (18 Jun 2026)

**Context.** The thesis says coverage retains, *closeness monetizes and spreads* — the least-built half. Principle held: **monetize access/depth; keep the shareable artifacts free** (they're the spread fuel).

- **Paid supporter tiers** (Weverse-style) — an athlete/club sets a tier (price, perks); fans **become members**, get a **founding member number**, a badge, and unlock **members-only content**. (Pulled forward from the spec's v2.)
- **Members-only drops (the FOMO spread)** — posts gain `visibility public|members`; non-members see a locked teaser with a join CTA; members see it. Joining produces a **shareable "founding member #N — you're in"** moment (X/WhatsApp) that recruits the next fan.
- **Transferable tickets** — paid checkout now issues a `ticket`; holders can **gift** (to a @handle) or **list for resale**; others **buy listings** — a working secondary market on top of the built ticketing.

Bright line intact: monetization is access + status, never faked intimacy or a fan-to-fan venue. `tests/membership.test.ts` (13) + web tests cover tiers, founding-member numbering, FOMO gating, the member-status share, and gift→transfer / list→buy. **145/145 across 9 suites.**

---

## ADR-016 — Slice 15: identity, auth & ownership (18 Jun 2026)

**Context.** Before a real tenant + their fans depend on it, get the costly-to-change piece right: who you are and what you own.

- **Accounts + sessions** — real signup/login (scrypt-hashed passwords; managed auth/bcrypt is the prod swap), cookie sessions (migration 0014: `account.password_hash`, `session`).
- **Ownership** — an `ownership` table maps an account to the entities (athlete/club/team/association) it controls; an athlete is also owned by the account that self-created it. `owns()` drives **authorization**: edit branding, schedule events, post, manage, set a tier — all gated on ownership, not merely "logged in."
- **Claim** — `/claim/:kind/:id` grants ownership and flips a non-person entity to `claimed`. The verification gradient (official-channel, federation cross-check) is the next layer; the pilot is instant-claim, logged + revocable.
- **Demo fallback** — with `FURIA_DEMO=1` (default) an unauthenticated visitor is the demo account that owns the seeded world, so the app is browsable and the whole suite runs without login. Set `FURIA_DEMO=0` in production: then browsing is open but acting requires sign-up, and owner tools require ownership.

`tests/auth.test.ts` (11) covers signup→session, password verify, a fan owning nothing (no owner tools, can still engage), claim→owner tools appear, logout. **156/156 across 10 suites.**

## ADR-017 — Slice 16: the live start screen (19 Jun 2026)

**Context.** A new visitor should land *in the product*, not on a marketing page (Weverse-style): real coverage, immediately engaging, with appetite for more and a quick way to tune to taste.

- `/` is now a **live discover screen** rendered from the DB: live & upcoming events, athletes, clubs, and latest results — all real entities, all public to browse.
- **Taste filter** — sport + region chips (region added to club/athlete, migration 0015) that narrow the screen via `/?sport=&region=`.
- **Gated personalization** — a "Your Furia — pick 3 and your feed already knows you" card that, for guests, leads to sign-up; for members, opens their feed. (Browsing open; acting = account.)
- No marketing copy — the page *is* the product. Logged-in vs guest differ only in the header CTA and the personalization card.

`tests/web.test.ts` covers the chips, that real coverage shows, the gated feed CTA, and that filtering narrows to taste. **160/160 across 10 suites.**

## Deploy

The app is a single Node process — embedded Postgres (PGlite), no external DB to provision for a pilot.

```bash
docker build -t furia . && docker run -p 8787:8787 -v furia-data:/data furia
# or, locally:
FURIA_DATA=./.furia-data npm run web
```

Env: `PORT` (8787), `FURIA_DATA` (persist the DB to a volume; omit = in-memory), `FURIA_DEMO` (`0` disables the demo fallback for production). The DB is created + seeded on first boot and reused on restart.

**Production swaps, each behind a seam already in the code:** managed Postgres (Neon) behind the one-method `Database` interface; Stripe in the single checkout/pay path; object storage for uploaded images behind the existing `*_url` fields; a managed auth provider for `auth_repo`. None changes the app logic.

## Test everything

```bash
for t in trio pipeline read db engagement content web; do node tests/$t.test.ts; done   # 107/107
npm run web                      # whole app: profiles, feed, attendance, shareable cards
node examples/persist-demo.ts    # paste -> Postgres -> rendered club page
```
