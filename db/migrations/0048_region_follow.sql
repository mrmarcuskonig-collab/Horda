-- 0048_region_follow.sql
--
-- Followable cities / regions. Like sports, a region is a text key (a city name
-- such as 'Berlin'), not a uuid entity — so it gets its own tiny join table.
-- Following a city means its events flow into your feed and it shows up under
-- Following alongside the athletes, clubs and sports you back.
CREATE TABLE IF NOT EXISTS region_follow (
  fan_id     uuid NOT NULL,
  region     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fan_id, region)
);
CREATE INDEX IF NOT EXISTS region_follow_region_idx ON region_follow (region);
