-- 0029: per-athlete theme (palette, accent, type style, overlay) for the §4a
-- banner system. Stored as JSON tokens — never raw layout/CSS. Drives the
-- auto-generated banner, OG image, and all themed share assets.
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS theme text;
