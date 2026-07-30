-- 0055 — vanity handles for clubs / teams / federations, so a page is reachable
-- at joinhorda.com/<handle> (athletes already have athlete.handle). Null = no
-- vanity URL yet (the page is still reachable by its /kind/:id path). Unique,
-- case-insensitively, per table; global uniqueness across entity kinds is
-- enforced in the app (handles_repo) so one /<handle> is never ambiguous.
ALTER TABLE club ADD COLUMN IF NOT EXISTS handle text;
ALTER TABLE team ADD COLUMN IF NOT EXISTS handle text;
ALTER TABLE association ADD COLUMN IF NOT EXISTS handle text;
CREATE UNIQUE INDEX IF NOT EXISTS club_handle_uidx ON club (lower(handle)) WHERE handle IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS team_handle_uidx ON team (lower(handle)) WHERE handle IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS association_handle_uidx ON association (lower(handle)) WHERE handle IS NOT NULL;
