-- 0058_verdict.sql — Rating platform, slice 1: the event-level Verdict.
--
-- ELIGIBILITY IS STRUCTURAL (§2.2): the primary link is a FK onto `presence` — the
-- row a real door-scan wrote — not a (fan_id, event_id) pair. There is no path,
-- repo or admin, that can record an opinion for someone who was never in the room.
-- ONE verdict per presence (UNIQUE). Scores are bounded in the schema too (CHECK),
-- not just server-side. Facts in, aggregates computed on read (§2.3) — this table
-- stores what was said; means/floors/rates live in verdict_repo. Source-tagged (§2.4).
CREATE TABLE IF NOT EXISTS verdict (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presence_id   uuid NOT NULL REFERENCES presence(id) ON DELETE CASCADE,
  event_id      uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  fan_id        uuid NOT NULL,
  atmosphere    int  NOT NULL CHECK (atmosphere BETWEEN 1 AND 5),
  worth_it      int  NOT NULL CHECK (worth_it BETWEEN 1 AND 5),
  return_intent boolean NOT NULL,
  note          text,                                    -- organiser-visible ONLY (§2.1)
  source        text NOT NULL DEFAULT 'horda',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (presence_id)
);
CREATE INDEX IF NOT EXISTS verdict_event_idx  ON verdict (event_id);
CREATE INDEX IF NOT EXISTS verdict_source_idx ON verdict (source);
