-- 0064_challenge_event.sql — link a challenge to the specific events that count.
--
-- A challenge no longer means "all my events in a window"; it counts attendance at
-- an explicit set of events (one, a selected series, or — for a sponsor — an event
-- the issuer doesn't organise). Eligibility = distinct linked events attended.
CREATE TABLE IF NOT EXISTS challenge_event (
  challenge_id uuid NOT NULL REFERENCES challenge(id) ON DELETE CASCADE,
  event_id     uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  PRIMARY KEY (challenge_id, event_id)
);
CREATE INDEX IF NOT EXISTS challenge_event_event_idx ON challenge_event (event_id);
