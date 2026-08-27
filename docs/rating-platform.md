# Furia Rating Platform — spec

**Status:** live (slice 1 shipped 2026-08-18) · **Owner:** Marcus
**Destination in repo:** `docs/rating-platform.md`

This is the doctrine the rating code is built to. `src/db/verdict_repo.ts`,
`src/web/verdict.ts` and the verdict routes in `src/web/server.ts` cite the
section numbers below; keep them in sync when either changes.

The one-line thesis: **Furia can prove who was actually in the room.** Every other
rating product on earth takes a star from anyone with an account. We take a
verdict from people whose presence we verified. That verified signal is the moat —
everything here protects it from being diluted.

---

## 1. What we are building

A rating on Furia is a **verdict on an event** — not a review of a venue, a
creator, or another fan. After an event happens, people who were there tell the
organiser (and, above a floor, the public) what the night was actually like.

The binding constraint on the whole platform is **response rate**: a rating system
is only worth the fraction of the room that bothers to answer. Every design
decision is measured against "does this cost us responses?" That is why the ask is
three taps and why we never add a fourth question lightly (§3.1).

---

## 2. Invariants (do not break these)

**§2.1 — The subject is an event, never a fan.** There is no fan→fan rating,
ever. Ratings attach to an `event` and are aggregated for the event and its host.
A person is never the thing being scored.

**§2.2 — Eligibility is structural, not a checkbox.** Who may rate is decided by
the shape of the core graph — a `presence` row, a `claim`, the event's end time —
not by a mutable "can_rate" flag. If someone is eligible it is because the graph
says so and we can point at the row.

**§2.3 — Facts in, aggregates computed.** We store one row per verdict (the raw
fact) and compute every mean, rate and public score **on read**. We never store a
denormalised average that can drift from its inputs. `roomScore()` and
`eventReport()` recompute from the verdict rows every time.

**§2.4 — Every fact is source-tagged.** Per ADR-0002, each verdict carries
`source` (`PRODUCT_SOURCE`, default `'furia'`) so that when a second product writes
into the same fan graph we can always tell which product observed which fact.

**§2.5 — Core-vs-product seam.** The rating platform is a **product** on top of the
core. It reads the core graph (`presence`, `claim`, `event`) but owns its own
tables (`verdict`) and never mutates the core. A later slice hangs off
`verdict_repo`, not off the core repos.

---

## 3. Rules

**§3.1 — Three questions is a hard ceiling.** Atmosphere (1–5), worth-it (1–5),
would-you-return (yes/no), plus an optional free-text note that only the organiser
ever sees. Adding a fourth question requires removing one. Response rate is why.

**§3.2 — One verdict per person per event.** Enforced structurally by a unique
index on `(event_id, fan_id)` — across all provenance tiers (§4).

**§3.3 — The note is organiser-only.** The verbatim note appears on `/manage` and
in no public surface. The shareable "verdict in" card shares the fact of being
there and the room's mood, never the note.

**§3.5 — Public floor.** A public room score is shown on the event page only once
there are at least `FLOOR_MIN_VERDICTS` (5) **verified** verdicts *and* those
verified verdicts are at least `FLOOR_MIN_FRACTION` (20%) of the room. Below the
floor the score is organiser-only. Both thresholds count verified verdicts only
(§4) — wider sentiment never lifts the floor.

**§3.6 — The mean is unweighted, permanently.** The public number is a plain mean
of verified verdicts. No Bayesian shrinkage, no recency weighting, no reputation
weighting. Simplicity is a trust feature: a fan can do the arithmetic themselves.

---

## 4. Provenance amendment (hosted-only, three tiers)

*Added 2026-08-18. Decision: hosted-only first (no bulk ingestion of third-party
events); non-attendee ("wider") sentiment is organiser-only at launch.*

The original slice let **only** door-scanned attendees rate. That is too narrow:
plenty of people experience a hosted event by stream or from elsewhere and have a
real opinion. But opening the gate naively would poison the verified signal (§2.1
thesis). So we **open the gate and tag the provenance**, and we keep the public
score verified-only.

Because it is our event, we already know how each person was there — so the tier is
**derived from the core graph, never chosen by the rater** (nobody can self-upgrade
to "in the room"):

| Tier | Graph basis | Strength | Counts toward public score? |
|------|-------------|----------|------------------------------|
| `in_room` | `presence.fidelity = 'in_room'` (door scan) | **Verified** | Yes |
| `online` | `presence.fidelity = 'online'` (stream check-in) | **Verified** | Yes |
| `off_platform` | no `presence` row | Wider / self-declared | **No — organiser-only** |

Rules that follow:

- **Who may rate, and when.** Verified attendees may rate as soon as they have a
  presence (in practice, once the event has started/ended). `off_platform` fans may
  rate **only after the event has ended** — there is nothing to have an opinion
  about beforehand, and it blocks pre-event brigading. "Ended" = `startsAt` plus a
  3-hour grace window, computed by the route and passed into `createVerdict`.
- **One per person across tiers** (§3.2). A fan gets exactly one verdict per event
  regardless of how they were there. `presence_id` is now nullable (off_platform
  has no scan); the unique index on `(event_id, fan_id)` enforces the rule for
  nulls too.
- **The public room score is verified-only.** `roomScore()` and the §3.5 floor
  count `in_room` + `online` only. `off_platform` verdicts are stored, tagged, and
  surfaced to the organiser as a **separate "wider audience — not in your public
  score"** block on `/manage`. They are never blended into the public number.
- **Why organiser-only for wider, for now.** It is genuinely useful reach/sentiment
  data for the host, but it is not the moat and we have not yet decided how (or
  whether) to show it publicly without eroding "the number means they were there."
  Keeping it organiser-only buys us that option value at zero cost to the public
  signal. Revisiting this is a deliberate future decision, not a default.

### Schema (migration 0059)

```
ALTER TABLE verdict ALTER COLUMN presence_id DROP NOT NULL;   -- off_platform has no scan
ALTER TABLE verdict ADD COLUMN attendance text NOT NULL DEFAULT 'in_room';
-- backfill existing rows from their presence fidelity
CREATE UNIQUE INDEX verdict_event_fan_uk ON verdict (event_id, fan_id);   -- one per person, all tiers
CREATE INDEX verdict_attendance_idx ON verdict (event_id, attendance);
```

### Explicitly out of scope for this slice

- **Bulk ingestion** of third-party events (e.g. a Bundesliga match not hosted on
  Furia). Deferred until hosted-only proves the loop. When we do it, ingested
  events and their verdicts carry a non-`furia` `source` (§2.4) and the same
  verified-only public rule applies — an ingested event simply has no verified tier
  until we run presence there.
- **Public display of wider sentiment.** Organiser-only until we decide otherwise.
