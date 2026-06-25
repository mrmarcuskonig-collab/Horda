-- 0023: athletes own their page layout. `sport` is now stored (was only derived)
-- so we can offer sport-appropriate default sections; `layout` is the athlete's
-- chosen ordered list of {key,on} sections.
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS layout jsonb;
