-- 0039 — the create-event rework: visibility, capacity/waitlist, event sport.
--
-- WHY THESE THREE:
--   visibility  — "public vs private" was the first question organisers asked
--                 and the form had no answer. Unlisted events (a squad-only
--                 session, a private sparring) had to be faked by not sharing
--                 the link, which is not a guarantee — they still showed up in
--                 discovery. Now it's explicit and enforced server-side.
--   capacity/waitlist — capacity existed but was a bare number with no notion of
--                 "unlimited" (NULL did double duty as "unset" and "infinite")
--                 and no waitlist switch, even though claim_rail has shipped
--                 'waitlisted' since 0031. This makes the intent explicit.
--   sport_id    — event.sport_id existed but the create form never asked, so
--                 filtering by sport silently missed most user-created events.
--                 (Was on the changelog under "now building".)
--
-- All additive + idempotent: safe on a live DB, no backfill required.

ALTER TABLE event ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';
-- public   = listed in discovery, anyone can find it
-- unlisted = not listed anywhere; reachable only by direct link. NOT a security
--            boundary — it's "don't advertise this", not "nobody may read it".
ALTER TABLE event ADD CONSTRAINT event_visibility_ck CHECK (visibility IN ('public','unlisted')) NOT VALID;

-- NULL capacity has always meant "unlimited"; keep that, but make the waitlist
-- an explicit choice rather than something inferred from a full event.
ALTER TABLE event ADD COLUMN IF NOT EXISTS waitlist_enabled boolean NOT NULL DEFAULT false;

-- Approval required (Genehmigung erforderlich). admission='apply' already
-- encodes this, but as one of four mutually-exclusive admission values it
-- couldn't combine with "paid". As a flag it composes with any admission.
ALTER TABLE event ADD COLUMN IF NOT EXISTS approval_required boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS event_visibility_idx ON event (visibility) WHERE visibility = 'public';
