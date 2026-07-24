-- 0046_sport_follow_phone.sql
--
-- Two small additions:
--
-- 1) FOLLOWABLE SPORTS. The `follow` table keys on a uuid target_id + an enum
--    target_type, so it can only hold entity follows (club / team / athlete /
--    association). Sports are identified by a text key ('boxing', 'esports'),
--    not a uuid — so they get their own tiny join table. A fan can now follow a
--    whole sport, and its events flow into their feed like any other follow.
--
-- 2) OPTIONAL PHONE on the account — used only for event reminders (Horda stays
--    magic-link, passwordless; phone is never required and never a login factor).
CREATE TABLE IF NOT EXISTS sport_follow (
  fan_id     uuid NOT NULL,
  sport_key  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fan_id, sport_key)
);
CREATE INDEX IF NOT EXISTS sport_follow_sport_idx ON sport_follow (sport_key);

ALTER TABLE account ADD COLUMN IF NOT EXISTS phone text;
