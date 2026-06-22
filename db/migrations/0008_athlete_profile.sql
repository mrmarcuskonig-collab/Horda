-- 0008_athlete_profile.sql
-- Athlete-controlled identity: the levers a fighter uses to make the profile
-- theirs and stand out (FURIA/Weverse direction). All athlete-owned.
-- Social links point OUT (Instagram/X/TikTok/YouTube/site) — Horda is the home
-- that routes to the social layer, it doesn't try to be it (spec §9).
ALTER TABLE athlete
  ADD COLUMN tagline    text,
  ADD COLUMN avatar_url text,
  ADD COLUMN banner_url text,
  ADD COLUMN links      jsonb NOT NULL DEFAULT '{}'::jsonb;  -- {instagram,x,tiktok,youtube,website,...}
