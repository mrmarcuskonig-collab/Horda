# ADR-0001 — Data foundations: what to capture now vs. compute later

**Status:** Accepted · 2026-07-20
**Context owner:** Marcus (CEO)
**Applies to:** the four "data-model, not AI" asks — identity graph, consent/rights, ledger, API/event-driven.

## The decision in one line

Apply *"capture beats compute"* to the asks themselves. Only data we **lose forever**
if uncaptured gets built before product-market fit; everything that is **code we can
write later** is deferred until the product that needs it exists. By that test, exactly
one of the four is a genuine pre-launch emergency.

## The test

For each ask: *if we skip it now, is the loss unrecoverable data, or merely a future
refactor?* Unrecoverable → build the capture now. Refactor → defer.

## Rulings

### §3 Consent / rights — **BUILD NOW (capture)** — shipped as migration `0044_rights_grants.sql`
Consent captured at registration cannot be recreated after the fact; emailing 40k past
participants for retroactive permission is legally fraught and poisons provenance. This is
the one unambiguous "capture beats compute" case, so the **structure** ships with the first
registration flow.

**But the strategy has a legal hole that changes the schema**, and the tables are therefore
**dormant/unwired** until counsel signs off (see `consent-grant-model-for-legal-review.md`):
- GDPR consent must be *freely given* and **not a condition of the service** (Art. 7(4),
  Recital 43). An AI-training/licensing grant bundled into "register for this race" risks
  being **invalid** — and invalid consent is worse than none, because the corpus's
  provenance story collapses exactly when a licensee audits it.
- Grassroots skews **minor**. Art. 8 DSGVO sets the age at 16 in Germany; commercial use of a
  minor's likeness needs guardian consent. A **coach cannot** grant likeness/commercial/AI
  rights on an athlete's behalf.

The schema is built to make these distinctions *expressible and enforceable* (scoped grants,
`actor_role` with a DB check that an operator/coach can't grant commercial/AI, a guardian
path, immutable versioned policy text, and an asset→grant dependency graph so withdrawal
propagates). It does **not** by itself make any grant lawful — that's the lawyer's design.

### §1 Identity graph — **MOSTLY ALREADY BUILT; capture the missing signals only**
The person/role split exists (`account` anchors `fan`/`athlete`/entities via `account_id`);
results are already structured (`result` table, typed participant, enum outcome, validated
jsonb — *not* free text); stable UUIDs throughout; a registry/links layer (0003/0004) exists.
The only irrecoverable gap is **cross-account resolution** (same human, two emails; coach-
entered athletes) and **merge tooling with an audit trail**. Fix = capture linkage signals at
registration (phone, DOB, "registered-by" pointer) so a future dedup is *possible*. **Do not**
build the graph engine now. *(Deferred build; capture fields are cheap and can ride the same
registration work as consent.)*

### §5 General ledger — **DEFER the ledger; capture money-events append-only**
A double-entry ledger with speculative entry types (sponsor fees, licensing royalties) models
products that don't exist yet — we'd design them wrong and migrate anyway. Nothing here is
truly unrecoverable (Stripe retains the record). **Now:** an append-only `money_event` log +
model accounts as potential **payees** (payout_account/Connect already seeded, 0038/0196–197).
**Later:** formalize double-entry when the *second* real revenue type (sponsor) lands.

### §6 API-first / event-driven — **REFRAME to logic-first; add an event log, skip the bus**
Literal "zero UI-only endpoints" means turning the SSR app into an SPA+API — which **destroys
the crawlability/SEO/schema.org work just shipped** for AI event discovery, and tanks shipping
speed at the worst time. Correct version: push logic into a **service layer** both the SSR
routes and a future JSON/MCP endpoint call (then MCP is a ~2-week wrapper, SSR stays). Add an
**append-only domain-event log** now (cheap; it's the audit trail *and* the licensing-gateway
metering primitive). **Skip** pub/sub + subscriber services until a second service needs them.

## Consequences
- Highest-value, highest-risk item (consent) is captured in structure now and blocked on
  legal for capture — the right sequencing.
- We explicitly avoid building a Series-B data platform for a <50-user product. The dominant
  risk is being **early**, not wrong.
- Reversible: every deferred item has a cheap "capture" stub now (linkage fields, money-event
  log, event log) that keeps the expensive build possible later without a miserable migration.

## Meta-note
The source strategy doc is unusually well-argued, which is precisely why the failure mode is
seduction into building all four now. Consent earns the exception because it is *simultaneously
cheap and irrecoverable*. Everything else is held to that same bar.
