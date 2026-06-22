-- 0009_attend_affiliations.sql
-- Spectator options + attendance + athlete-curated affiliations.

-- The athlete/organizer chooses which ways fans can engage with an event.
-- spectator_access (free|paid_ticket) already exists; these add the channels.
ALTER TABLE event
  ADD COLUMN ticket_url text,   -- present => "Buy tickets" offered
  ADD COLUMN stream_url text;   -- present => "Stream live" offered

-- A fan's attendance choice on an event (Join / ticket / stream).
CREATE TYPE attend_mode AS ENUM ('going', 'ticket', 'stream');
CREATE TABLE attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id     uuid NOT NULL REFERENCES fan(id) ON DELETE CASCADE,
  event_id   uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  mode       attend_mode NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fan_id, event_id)
);

-- Links the athlete CHOOSES to show on their profile: their gym/club/team/
-- league/promotion/events. Athlete-curated (presence here = shown).
CREATE TYPE affiliation_kind AS ENUM ('club', 'team', 'league', 'gym', 'promotion', 'event', 'custom');
CREATE TABLE athlete_affiliation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    uuid NOT NULL REFERENCES athlete(id) ON DELETE CASCADE,
  kind          affiliation_kind NOT NULL,
  label         text NOT NULL,
  href          text,          -- internal route (/club/..) or external url
  display_order int NOT NULL DEFAULT 0
);

CREATE INDEX attendance_event_idx ON attendance(event_id);
CREATE INDEX affiliation_athlete_idx ON athlete_affiliation(athlete_id, display_order);
