-- 0054 — event banner style.
-- The default event banner is a dynamic treatment of the host's picture (see
-- src/web/banner.ts), served at /e/:id/banner.svg. `banner_style` picks the design
-- (ember / mono / cool / bold); null = the default (ember). A custom uploaded cover
-- (event.cover_url) always wins over the generated banner.
ALTER TABLE event ADD COLUMN IF NOT EXISTS banner_style text;
