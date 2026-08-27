-- 0045_coorganizer.sql — the "other side" becomes a co-organizer, by invitation.
--
-- BEFORE: any logged-in fan could "Claim this side" of a versus event — an open
-- claim. That's not credible: the away club's side should be represented by the
-- away club, not by whoever clicked first.
--
-- AFTER: only the organizer can invite the other side, via a unique link meant
-- for a specific person (a manager/responsible person of the rival club/athlete
-- who may not be on Furia yet). They open the link, connect name + email (which
-- creates a personal account the normal magic-link way), and become a
-- CO-ORGANIZER of the event — either as a private person or through a page/club
-- they manage. A co-organizer CANNOT edit the main event, but can manage their
-- own page and share their own unique promo link, and can add side/bout events.

-- The invitation lives on the side party: a private token the organizer hands
-- out, and a pointer to the account that accepted it.
ALTER TABLE event_party ADD COLUMN IF NOT EXISTS invite_token text;
ALTER TABLE event_party ADD COLUMN IF NOT EXISTS claimed_by_account_id uuid;
-- A given invite token is unique (it IS the private URL). Partial unique index so
-- the many NULLs (parties with no invite) don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS event_party_invite_idx ON event_party (invite_token) WHERE invite_token IS NOT NULL;

-- Who co-organizes an event, and in what capacity. A co-organizer is granted
-- LIMITED rights (add side events, share their promo link) but NOT edit rights on
-- the main event — that's enforced in the app, this table is the grant record.
CREATE TABLE IF NOT EXISTS event_coorganizer (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  account_id     uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  party_id       uuid REFERENCES event_party(id) ON DELETE SET NULL,  -- the side they came in on
  as_entity_kind text,   -- club | team | athlete | association when they represent a page they manage; null = private person
  as_entity_id   text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, account_id)
);
CREATE INDEX IF NOT EXISTS event_coorganizer_acct_idx ON event_coorganizer (account_id);
