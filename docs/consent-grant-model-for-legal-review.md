# Consent / rights grant model — for legal review

**Purpose:** Horda wants its grassroots-sport content corpus to be *born rights-clear* —
every athlete's likeness/commercial/AI-licensing permission captured as structured, versioned
data at the moment of registration or ticket purchase, so we can later answer programmatically
"may X be used for purpose Y." This document asks counsel to design the **grant taxonomy and
the capture flow**; the database structure that will hold your answers is already built
(`db/migrations/0044_rights_grants.sql`) but **is not yet wired to any user flow** and will not
be until you sign off. Please review this model and the copy, not just a checkbox.

## What we are proposing to capture (four independent scopes)

| Scope | Plain meaning | Notes for review |
|---|---|---|
| `likeness_event_media` | Your image may appear in media *of the event you took part in*. | Closest to "necessary/expected" for a public event; lowest risk. |
| `commercial_sponsor` | Your likeness may be used in sponsor/commercial contexts. | Higher bar; almost certainly cannot be bundled into entry. |
| `ai_training_licensing` | Your media may be **licensed** and/or used to **train models**, with a revenue-share. | Highest bar; the monetisable one; the one most likely to fail "freely given" if bundled. |
| `data_processing` | Processing of your competitive record beyond contract necessity. | Standard GDPR processing consent. |

Each scope is **separately grantable and separately withdrawable**. A person may allow
event-media likeness and refuse AI training, and that refusal is a first-class stored fact.

## The specific questions we need answered

1. **Freely-given / unbundling.** We believe an `ai_training_licensing` (and probably
   `commercial_sponsor`) grant **cannot be a condition of registering** for an event (GDPR
   Art. 7(4), Recital 43). Our plan is therefore to present these as clearly optional,
   separately-toggled, non-blocking. **Is that sufficient, and where exactly must the line be?**
   (Consequence if we get this wrong: the corpus's provenance is challengeable, which defeats
   the entire "rights-clear" value proposition.)

2. **Minors.** Grassroots skews young. Germany sets the digital-consent age at 16 (Art. 8
   DSGVO). We propose: under-16 → **guardian** grant only; commercial/AI scopes for minors
   possibly disallowed entirely regardless of guardian. **What is your rule per scope per age
   band?** (The schema stores `subject_is_minor`, `actor_role='guardian'`, guardian name +
   relationship, and can hard-block scopes.)

3. **Who may grant on whose behalf.** A **coach registering an athlete** is an *operator*, not
   the person. We have hard-coded that an operator can record `likeness_event_media` but the
   database **rejects** an operator granting `commercial_sponsor` or `ai_training_licensing`.
   **Is `likeness_event_media` by an operator itself acceptable, or must even that be the
   athlete's own act?**

4. **Withdrawal propagation.** GDPR withdrawal must reach *derived* assets. We store, for every
   derived asset (clip, licensed excerpt), the exact grant(s) it depends on, so withdrawal is a
   query not a manual hunt. **What is the required timeline and scope of propagation** (e.g.
   must already-licensed excerpts be recalled, or only future use halted)?

5. **Versioned proof.** Every grant points at the **exact policy text** (with a content hash),
   locale, and timestamp the person saw. **Does this satisfy your evidentiary standard for
   demonstrating what was consented to, years later?**

6. **Revenue-share as a term.** The AI/licensing grant carries a rev-share (basis points),
   snapshotted on the grant. **Does bundling an economic term into the consent affect its
   validity, and how should the rev-share be presented so it is not seen as inducement that
   undermines "freely given"?**

## What the schema already guarantees (so you review policy, not plumbing)
- **Immutable, append-only.** A grant and its withdrawal are separate rows; nothing is edited
  in place. Full history is preserved.
- **Per-scope, per-person, versioned, timestamped, hashed policy text.**
- **Enforced actor rules:** operator cannot grant commercial/AI (DB check); guardian grant must
  name the guardian (DB check).
- **Asset→grant dependency graph** for withdrawal propagation.
- **Anchored to the person** (`account`), not to a role — so a grant survives the person also
  being a ticket-buyer or organiser.

## What is explicitly NOT built yet (awaiting your design)
- The capture UI/copy and where each scope is presented (registration vs. profile).
- The age-gating rules and guardian flow specifics.
- Whether any scope is offered at all in v1, or only `likeness_event_media` + `data_processing`
  to start conservatively.

**Recommendation to the business:** ship v1 capturing only the low-risk scopes
(`likeness_event_media`, `data_processing`), and hold `commercial_sponsor` /
`ai_training_licensing` until counsel has designed a compliant, unbundled, minor-safe flow.
Capturing the safe scopes now still starts the rights-clear corpus; capturing the risky ones
badly would taint it.
