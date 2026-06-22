-- 0007_engagement.sql
-- The fandom layer: hub-and-spoke fan<->athlete engagement (spec §1, §9).
-- Hard guardrail, enforced by what these tables CAN'T express:
--   * a POST is authored by an athlete/club/team -> its followers (broadcast).
--     post_author_type has NO 'fan' value, so a fan cannot author feed content.
--   * a PREDICTION is a fan vs a real outcome — never vs another fan.
--   * a NOTIFICATION is system -> fan.
-- There is no fan->fan edge anywhere in the schema. Keep the graph, refuse the venue.

-- An athlete/club/team speaking to its followers.
CREATE TYPE post_author_type AS ENUM ('athlete', 'club', 'team');   -- intentionally no 'fan'
CREATE TABLE post (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_type post_author_type NOT NULL,
  author_id   uuid NOT NULL,
  body        text NOT NULL,
  event_id    uuid REFERENCES event(id) ON DELETE SET NULL,  -- optional tie to a fixture/result
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- A fan's call on a real upcoming outcome. Fan vs the result.
CREATE TYPE prediction_status AS ENUM ('open', 'correct', 'incorrect', 'void');
CREATE TABLE prediction (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id              uuid NOT NULL REFERENCES fan(id) ON DELETE CASCADE,
  event_id            uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  pick_participant_id uuid NOT NULL,        -- who the fan thinks wins (an athlete or team)
  status              prediction_status NOT NULL DEFAULT 'open',
  created_at          timestamptz NOT NULL DEFAULT now(),
  settled_at          timestamptz,
  UNIQUE (fan_id, event_id)                 -- one call per fan per event
);

-- System -> fan re-engagement signal (the recurring live moment is the hook).
CREATE TYPE notification_kind AS ENUM ('post', 'kickoff', 'result', 'fixture');
CREATE TABLE notification (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id     uuid NOT NULL REFERENCES fan(id) ON DELETE CASCADE,
  kind       notification_kind NOT NULL,
  headline   text NOT NULL,
  event_id   uuid REFERENCES event(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read       boolean NOT NULL DEFAULT false
);

CREATE INDEX post_author_idx     ON post(author_type, author_id);
CREATE INDEX prediction_fan_idx  ON prediction(fan_id);
CREATE INDEX prediction_event_idx ON prediction(event_id);
CREATE INDEX notification_fan_idx ON notification(fan_id, read);
