-- 0052 — custom event URL (Furia Plus feature).
-- A Plus organiser can give an event a memorable slug, e.g. joinfuria.com/e/derby.
-- Null = no custom slug (the event is reached by its uuid, as before). Unique,
-- case-insensitively, across events. Gating (who may set it) lives in the app via
-- hasEntitlement(plan,'custom_url') — the column itself is plan-agnostic.
ALTER TABLE event ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS event_slug_uidx ON event (lower(slug)) WHERE slug IS NOT NULL;
