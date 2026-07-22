# Verified checkmark — the policy (decided)

**Who gets the ✓:** only a page that has passed **claim-verification** — i.e. someone
proved they own or officially represent that club, association, athlete, or team.
Signing up, self-creating a page, or hosting events gets you **nothing**. The badge
means "this is the official page," and it has to stay expensive enough to mean that.

This is already implemented in `src/db/claim_repo.ts` and tested in
`tests/claim.test.ts`. This doc records it as the deliberate policy so it isn't
re-litigated ad hoc.

## The bar — strongest first (automatic where possible, human only as a fallback)

1. **Email-domain match → auto-verified.** The claimant's email domain equals the
   entity's official website domain (e.g. `boss@fcbeispiel.de` claiming FC
   Beispiel, whose site is `fcbeispiel.de`). Instant, high-trust, zero human work.
2. **Channel code → auto-verified.** We issue a one-time code; they place it on
   their official site or social bio; we re-fetch and confirm. Instant once placed.
3. **Association vouch → review.** A governing association's verified owner approves
   one of its member clubs/teams. Human, but a trusted human.
4. **Admin grant → review.** The platform admin approves anything else via the
   `/claims` queue. The catch-all; used sparingly.

Ownership (edit rights, payouts, Featured eligibility) is granted **only** on
verification — never on the claim request itself.

## Athletes (self-created persons)

An athlete self-creates their page and is **unverified** until light verification.
Unverified athletes are excluded from Featured and carry no ✓. The cheapest
high-trust path for a person is proving they own a linked official social account
(the same domain/handle-ownership idea applied to a profile) or admin review.

## Why this is the right bar for grassroots (the VP call)

- **Credible:** a ✓ requires proof of representation, so fans can trust it.
- **Cheap to scale:** rules 1–2 are automatic, so growth isn't bottlenecked on a
  human reviewing every club.
- **Abuse-resistant:** a stranger can't self-serve a checkmark; the worst they can
  do is create an *unverified* page, which reads plainly as unverified.
- **Retrofit-proof:** built before strangers self-serve at scale, exactly when the
  header comment in claim_repo.ts says it's cheap to add and expensive to add later.

## Not changing

The bar itself is not being loosened or tightened right now — it's adopted as-is.
The one future tightening worth considering, once volume warrants it: require the
athlete social-handle-ownership check (not just admin review) before an athlete ✓.
