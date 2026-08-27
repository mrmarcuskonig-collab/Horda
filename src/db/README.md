# `src/db` — the data layer, grouped core vs. product

Every read/write to Postgres goes through a repo module here — the app never issues
SQL directly. That single seam is what ADR-0002 relies on: a clean function-call
boundary today is trivially convertible to a network boundary later; a tangled one is
not. Nothing is split into services now. This file just makes the line **visible**.

## Core graph — the shared fan identity & behavior graph
The durable asset. If a second product is ever built under the same operating entity,
*this* is what it reads and writes. Guard it: stable IDs, source-tagged facts
(see `product.ts`), purpose-scoped consent.

- `auth_repo.ts` — accounts, sessions, ownership, `ownedEntities` (identity + who-controls-what)
- `handles_repo.ts` — the global handle namespace (one identity, one vanity URL)
- `claim_rail_repo.ts` — claims, passes, verified presence (the "Record"), standing
- `connection_repo.ts` — entity↔entity relationship graph
- `engagement_repo.ts` — follows (the identity/interest edge) + fan read models
- `entity_repo.ts` — the athlete/club/team/association entities themselves
- `product.ts` — the product-source primitive every fact write is tagged with

## Consent / rights (dormant, pending legal)
- (schema `0044_rights_grants.sql`, extended by `0056` with product + purpose scope)

## Furia product — surfaces on top of the graph
Product-specific. A different product would have its *own* equivalents; these are
Furia's. Kept deliberately separable from the core above.

- `events_repo.ts`, `event_format_repo.ts` — events, ways-in, attribution shares
- `membership_repo.ts` — memberships/tiers
- `promo_code_repo.ts` — event promo codes
- `payouts_repo.ts` — Stripe Connect payouts
- `transfer_repo.ts` — ticket transfer/resale mechanics
- `coorg_repo.ts` — co-organiser + versus-side model
- `content_repo.ts`, `hook_repo.ts`, `layout_repo.ts`, `extras_repo.ts` — page content/surfaces
- `discover_repo.ts`, `notif_repo.ts` — discovery + notifications

## Rule
When you add a write that records **what a fan did** (an intent, an attendance, an
edge, an attribution), it belongs in the **core graph** and must carry a `source`
(default `PRODUCT_SOURCE` from `product.ts`). Product-specific state does not.
