-- 0012_admission_payment_feature.sql
-- Luma-adapted admission + payment, online watch channels, and cross-posting.

-- in-person admission model
CREATE TYPE admission AS ENUM ('open', 'register', 'apply', 'paid');
-- registration state on top of an RSVP (apply -> pending -> confirmed; paid -> pending -> paid)
CREATE TYPE reg_status AS ENUM ('confirmed', 'pending', 'paid', 'declined');

ALTER TABLE event
  ADD COLUMN admission   admission NOT NULL DEFAULT 'open',
  ADD COLUMN price_cents int,
  ADD COLUMN currency    text NOT NULL DEFAULT 'EUR',
  ADD COLUMN streams     jsonb NOT NULL DEFAULT '{}'::jsonb;  -- {youtube,twitch,discord}

ALTER TABLE attendance
  ADD COLUMN status reg_status NOT NULL DEFAULT 'confirmed';

-- an entity featuring (re-sharing) an event it did not host, on its own profile
CREATE TABLE event_feature (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feat_kind   host_kind NOT NULL,   -- athlete / club / team / association
  feat_id     uuid NOT NULL,
  event_id    uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feat_kind, feat_id, event_id)
);
CREATE INDEX event_feature_idx ON event_feature(feat_kind, feat_id);
