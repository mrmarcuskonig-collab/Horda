-- 0056 — a profile gets two pieces of prose, not one. `tagline` is the one-line
-- about that sits next to the name; `description` is the longer body an owner
-- writes to say who they are and what they run. Both nullable — existing pages
-- keep whatever is already in tagline and simply have no description yet.
-- Nothing is backfilled: a club that wrote a paragraph into tagline still shows
-- it, and its owner can split it by hand whenever they next edit the page.
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE entity_branding ADD COLUMN IF NOT EXISTS description text;
