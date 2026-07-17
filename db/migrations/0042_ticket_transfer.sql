-- 0042_ticket_transfer.sql
--
-- The transfer ledger. Resale is NOT OFFERED and NOT SHOWN (RESALE_ENABLED is
-- off; the AGB says so). This migration exists anyway, and that is the point.
--
-- WHY BUILD THE LEDGER BEFORE THE FEATURE
-- ---------------------------------------
-- The day resale turns on, the first question anyone asks — a fan disputing a
-- charge, an organiser refusing entry, a tax office, a court — is "how did this
-- person come to hold this ticket?". That question is answerable only if every
-- change of holder was recorded AS IT HAPPENED. A ledger added later can only
-- ever describe the future; every ticket sold before it existed is a hole.
-- Retrofitting provenance is impossible, so it is cheap now and priceless later.
--
-- THE MODEL: A TICKET NEVER CHANGES HANDS. IT IS REISSUED.
-- -------------------------------------------------------
-- Tickets are identity-bound (personengebunden, per the AGB) and a claim carries
-- the fan's identity. So a transfer is: void the seller's claim, mint a NEW claim
-- (and a NEW pass token, hence a NEW QR) for the buyer. We never hand a live QR
-- from one person to another.
--
-- This is the whole anti-tout position in one design choice. The moment a ticket
-- is a bearer instrument — a PDF that admits whoever holds it — the secondary
-- market is out of our hands and the fan at the door has no recourse. Reissue
-- means the old QR is dead the instant the transfer commits, so a screenshot
-- sold twice is worth nothing.
--
-- WHY price_cents AND face_value_cents BOTH
-- -----------------------------------------
-- Face value is captured at transfer time, not looked up later: the organiser can
-- change the price of a door tomorrow, and a ledger that recomputes history is
-- not a ledger. Holding both lets us enforce (and later prove we enforced) a
-- resale ceiling at face value.
--
-- WHY kind MATTERS LEGALLY, NOT JUST DESCRIPTIVELY
-- -----------------------------------------------
-- § 312g Abs. 2 Nr. 9 BGB exempts dated leisure events from the 14-day
-- withdrawal right — that exemption is what makes primary ticketing viable at
-- all. It is ARGUED that a SECONDARY sale does not enjoy it. If that is right, a
-- resale carries withdrawal rights a primary sale does not, and the two must be
-- distinguishable per row from the very first transfer. Hence 'gift' | 'resale'
-- | 'return' rather than a single boolean.

CREATE TABLE IF NOT EXISTS ticket_transfer (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  -- The claim that was GIVEN UP. Kept even after it is voided — the ledger is
  -- append-only history, not current state.
  from_claim_id    uuid REFERENCES claim(id) ON DELETE SET NULL,
  -- The claim MINTED for the new holder. NULL for a 'return' (nobody gets it).
  to_claim_id      uuid REFERENCES claim(id) ON DELETE SET NULL,
  from_fan_id      uuid REFERENCES fan(id) ON DELETE SET NULL,
  to_fan_id        uuid REFERENCES fan(id) ON DELETE SET NULL,
  -- 'gift'   — no money; 'resale' — money moved; 'return' — back to the organiser.
  kind             text NOT NULL CHECK (kind IN ('gift','resale','return')),
  -- What the buyer actually paid, and what the ticket originally cost. A gift is
  -- 0 and must be, or it is a resale wearing a friendlier word.
  price_cents      int NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  face_value_cents int NOT NULL DEFAULT 0 CHECK (face_value_cents >= 0),
  -- How many spots moved: a claim can be worth 4 tickets (party_size).
  party_size       int NOT NULL DEFAULT 1 CHECK (party_size >= 1),
  -- Free text for the operational reason ('organiser refund', 'fraud reversal').
  reason           text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- A ledger is only useful if you can walk it: by event (who is really coming),
-- by person (what did they sell), and in order.
CREATE INDEX IF NOT EXISTS ticket_transfer_event_idx ON ticket_transfer(event_id, created_at);
CREATE INDEX IF NOT EXISTS ticket_transfer_from_idx  ON ticket_transfer(from_fan_id);
CREATE INDEX IF NOT EXISTS ticket_transfer_to_idx    ON ticket_transfer(to_fan_id);

-- Current state on the claim itself, so the hot path (does this QR open the door)
-- never has to walk the ledger.
--
-- 'void' is a status a claim can be moved INTO and never out of. A voided claim
-- must not count toward capacity, must not open a door, and must not be silently
-- deleted — the seller's history is real and stays.
ALTER TABLE claim ADD COLUMN IF NOT EXISTS transferred_from_claim_id uuid REFERENCES claim(id) ON DELETE SET NULL;
ALTER TABLE claim ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE claim ADD COLUMN IF NOT EXISTS void_reason text;

-- Every capacity count in the app filters on status. A voided claim frees its
-- seat, which is the entire point of a resale.
CREATE INDEX IF NOT EXISTS claim_voided_idx ON claim(event_id) WHERE voided_at IS NULL;

-- 0031 put UNIQUE (event_id, fan_id) on claim: one claim per person per event.
-- Correct then, wrong the moment tickets can move — it makes the ledger
-- IMPOSSIBLE. Two consequences, both fatal:
--   * someone who gives their ticket away can never claim that event again,
--     because their voided row still occupies the unique slot forever;
--   * a ticket that comes back (A→B→A) cannot be recorded at all.
-- The invariant we actually want is "one LIVE claim per person per event", which
-- is a partial unique index. History is allowed to repeat; the present is not.
--
-- Finding this is the argument for building the ledger before the feature: the
-- constraint would have looked completely correct right up until the first
-- transfer failed in production, on a paid ticket, in front of a fan.
ALTER TABLE claim DROP CONSTRAINT IF EXISTS claim_event_id_fan_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS claim_one_live_per_fan ON claim(event_id, fan_id) WHERE voided_at IS NULL;
