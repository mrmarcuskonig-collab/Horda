-- 0059_verdict_provenance.sql — provenance amendment to the rating platform.
--
-- After a hosted event ends, ANYONE can leave a verdict, tagged by how they were
-- there: in_room / online (both a real Furia presence → VERIFIED) or off_platform
-- (no presence → self-declared, organiser-only, never in the public score).
--
--   * presence_id becomes NULLABLE — off_platform verdicts have no scan.
--   * `attendance` records the tier; existing rows are verified attendees, so they
--     backfill from their presence fidelity (default 'in_room' for safety).
--   * one verdict per (event, fan) across ALL tiers — a unique index enforces it
--     even for off_platform rows, where presence_id is null.
ALTER TABLE verdict ALTER COLUMN presence_id DROP NOT NULL;
ALTER TABLE verdict ADD COLUMN IF NOT EXISTS attendance text NOT NULL DEFAULT 'in_room';
UPDATE verdict v SET attendance = COALESCE((SELECT p.fidelity FROM presence p WHERE p.id = v.presence_id), 'in_room')
  WHERE v.presence_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS verdict_event_fan_uk ON verdict (event_id, fan_id);
CREATE INDEX IF NOT EXISTS verdict_attendance_idx ON verdict (event_id, attendance);
