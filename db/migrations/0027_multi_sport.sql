-- 0027: athletes can compete in more than one sport (e.g. swimming + cycling).
-- Stored as a comma-separated list of sport keys; the existing `sport` column
-- stays as the primary sport (drives the per-sport default page layout).
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS sports text;
