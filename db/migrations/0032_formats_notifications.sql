-- 0032: multi-format attendance + notifications + a live window.
--
-- One event, several ways to attend it — e.g. a German championship a fan can
-- (a) attend in person (ticketed on Furia), (b) watch on TikTok Live, or
-- (c) watch on a sport-specific media provider. Attendance for EVERY format is
-- confirmed on Furia, so the organizer sees exactly what to expect per channel
-- and optimises supply (seats vs streams) from one invite+ticketing surface.
--
-- A claim carries the single format the fan committed to (they can switch),
-- keeping per-format counts clean.

-- live window: an optional end so we can mark an event "happening right now".
ALTER TABLE event ADD COLUMN IF NOT EXISTS ends_at timestamptz;

CREATE TABLE IF NOT EXISTS event_format (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  kind            text NOT NULL DEFAULT 'in_person',   -- in_person | stream
  label           text NOT NULL,                        -- "In person", "TikTok Live", "Sportdeutschland.TV"
  channel_url     text,                                 -- where to watch (stream formats)
  requires_ticket boolean NOT NULL DEFAULT false,       -- tickets sold on Furia
  price_cents     int,                                  -- if ticketed
  capacity        int,                                  -- optional per-format cap
  sort            int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_format_event_idx ON event_format (event_id, sort);

-- the format a claim committed to (single-choice; nullable = legacy / default).
ALTER TABLE claim ADD COLUMN IF NOT EXISTS format_id uuid REFERENCES event_format(id) ON DELETE SET NULL;

-- app notifications (organizer + fan). Text kind, decoupled from the older
-- engagement `notification` enum. Targeted at a fan_id (every account has one).
CREATE TABLE IF NOT EXISTS app_notification (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id      uuid NOT NULL,                            -- recipient
  kind        text NOT NULL,                            -- claim_new | claim_confirmed | event_live | season_created
  headline    text NOT NULL,
  href        text,
  event_id    uuid REFERENCES event(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  read        boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS app_notification_fan_idx ON app_notification (fan_id, read, created_at DESC);
