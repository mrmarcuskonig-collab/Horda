-- 0015_region.sql — a region tag for taste-filtering on the start screen.
ALTER TABLE club ADD COLUMN region text;
ALTER TABLE athlete ADD COLUMN region text;
