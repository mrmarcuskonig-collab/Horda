-- 0035_event_share.sql — attributable shares.
-- A plain share (copy the bare /e/:id link) is anonymous. A logged-in fan can
-- also share "under their name": we mint a per-(event,fan) token; claims that
-- arrive via that token are attributed to the sharer. Measurement only — no
-- money moves. One token per fan per event (idempotent).
CREATE TABLE IF NOT EXISTS event_share (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  fan_id     uuid NOT NULL,
  token      text NOT NULL UNIQUE,        -- goes in the ?via= link
  clicks     int  NOT NULL DEFAULT 0,     -- opens of the attributed link
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, fan_id)
);
CREATE INDEX IF NOT EXISTS event_share_event_idx ON event_share (event_id);
