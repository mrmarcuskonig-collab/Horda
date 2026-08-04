# ADR-0002 — Platform readiness: one fan graph, many products

**Status:** Proposed · 2026-08-03
**Context owner:** Marcus (CEO)
**Applies to:** the hypothesis of building 3+ businesses under one operating entity that all
feed the same **fan identity & behavior graph** and sell to **similar buyers**. Extends
[ADR-0001](./ADR-0001-data-foundations.md).

## The decision in one line

The graph is the company; the products are surfaces. Make a small set of **cheap, reversible**
decisions now that keep the multi-product option open, and **explicitly defer every expensive
platform extraction** (separate services, shared SSO, event bus, warehouse, graph-in-its-own-DB)
until the *second* product is funded and real. We pay ~1% of the platform cost now to avoid
paying 100% of it against businesses that don't yet exist.

## The reframe

If four products all write to and read from one fan identity + behavior graph, then that graph —
who a fan is, who they follow, what they claimed, where they were scanned in (the "Record"),
and who drove whom (attribution) — **is the durable asset**. Events, tickets, banners, and
memberships are disposable product-specific scaffolding on top. Today the schema doesn't make
this distinction: fan behavior lives in Horda's flat tables as if Horda owned it. The rulings
below draw the line between *core graph* (protect, capture with rigor) and *product surface*
(stay fast, keep disposable) — without splitting anything yet.

## The test

Same lens as ADR-0001 (*capture beats compute*), applied to boundaries. A boundary decision
earns **"now"** only if skipping it means **unrecoverable data** (untagged facts we can never
re-attribute) or a boundary so **ruinous to retrofit** that deferring forecloses the option.
Everything else is a future refactor → **defer**.

## Rulings

### 1. Product-neutral identity — **DISCIPLINE NOW (≈ free)**
One `account` = one human, stable UUID (already true). Nothing product-specific ever lands on
the `account`/identity tables — Horda concepts belong on `athlete`/entity rows, not on the
person. This is the single highest-leverage boundary: it's what lets product #2 reuse the same
login and the same human with zero migration. Cost is a code-review rule, not a build.

### 2. Source-tag behavioral facts — **BUILD NOW (capture; irrecoverable)**
The behavioral records — `claim`, presence/`pass`, follows (`connection`/engagement),
attribution (`event_share`/promo) — must (a) be treated as **immutable facts** (who, what, when)
and (b) carry a **`source`/`product`** discriminator. Adding the column today is nearly free;
adding it after three products have written millions of untagged rows is a data-archaeology
project with no clean answer. **This is the one thing to do before launch** under the
platform lens. *(Implementation: a `0056_source_tagging` migration defaulting existing rows to
`'horda'`; deferred build, cheap capture.)*

### 3. Consent becomes purpose/product-scoped — **EXTEND the dormant consent model (0044)**
A behavior graph shared across *separate businesses* is precisely what GDPR/DSGVO
purpose-limitation governs: data a fan gave for events is **not** automatically usable by
business #2. The rights/consent schema from ADR-0001 must carry an explicit **purpose/product
scope**, and reads of the graph must respect it. Still blocked on counsel (per ADR-0001), but
the multi-product case makes *purpose scoping* a first-class requirement, not an optional field.
This is a trust asset as much as a legal one.

### 4. The repo layer is the contract; group core vs. product — **DISCIPLINE NOW**
The ~20 `src/db/*_repo.ts` modules are already the only path to the database. Keep that rule
absolute, and start grouping them explicitly: **core graph** (`auth`, `claim_rail`, `connection`,
engagement/follows, consent) vs. **Horda product** (`events`, `membership`, `promo_code`,
`payouts`, `event_format`). Nothing splits — but a clean function-call seam is trivially
convertible to a network boundary later, and a tangled one is not. A folder or naming convention
is enough to signal it.

## Explicitly deferred (do NOT build until product #2 is real)
- Splitting into separate services or databases.
- A shared identity/SSO service.
- A pub/sub event bus or subscriber services (an append-only domain-event *log* is already
  sanctioned by ADR-0001 §6; the *bus* is not).
- A cross-product data warehouse / analytics plane.

Building any of these now is the dominant risk: a year of platform for products that don't
exist and may reshape once they do. The four rulings above keep the option open at a fraction
of the cost of exercising it.

## Consequences
- Only one net-new build lands pre-launch (source tagging); everything else is discipline or an
  extension of already-decided work. Consistent with "the risk is being early, not wrong."
- The core/product line becomes visible in the codebase without any migration or service split,
  so the eventual extraction (if it happens) is a lift, not a rewrite.
- Reversible by construction: each deferred item has a cheap stub today (product-neutral IDs,
  source-tagged facts, purpose-scoped consent, repo seam) that keeps the expensive build possible
  without a miserable migration.

## The calls that are the CEO's, not the architecture's
- Are the three businesses **concrete enough** that the shared graph is a real bet, or a
  someday-maybe? The rulings are cheap enough to make regardless, but resourcing beyond them isn't.
- Do they **truly share buyers**? Shared demand-side is what actually justifies one operating
  entity — it's worth more than shared tech. If the buyer is genuinely the same, the sharpest
  version of this is **"one relationship, one identity, one consent surface, sold four ways"** —
  a go-to-market and data-rights decision as much as an architecture one.

## Meta-note
The seductive failure mode here is the mirror of ADR-0001's: a compelling multi-product thesis
tempts you to platformize before you have a platform's worth of products. Source tagging earns
its exception because it is *simultaneously cheap and irrecoverable*. Everything else is held to
that same bar — and most of it is a rule, not a build.
