-- 0017_tiers_loyalty.sql
-- Substack-style tiering, tailored to sport:
--   Follow (free, = the follow relationship) · Supporter (paid, monthly/annual)
--   · Clubhouse (premium, ~2x annual Supporter, gated behind real exclusives).
-- "Superfan" is a STATUS, not a tier: granted by a Clubhouse membership, OR
-- earned for free by loyalty (attend, predict, and especially share).

-- tiers become multi-level, with a monthly and an annual price
-- (all statements idempotent so this can be (re)applied to an existing DB)
ALTER TABLE membership_tier ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'supporter';
ALTER TABLE membership_tier ADD COLUMN IF NOT EXISTS price_annual_cents int;
ALTER TABLE membership_tier DROP CONSTRAINT IF EXISTS membership_tier_level_chk;
ALTER TABLE membership_tier ADD CONSTRAINT membership_tier_level_chk CHECK (level IN ('supporter','clubhouse'));
-- one tier per (owner, level) instead of one per owner
ALTER TABLE membership_tier DROP CONSTRAINT IF EXISTS membership_tier_owner_kind_owner_id_key;
ALTER TABLE membership_tier DROP CONSTRAINT IF EXISTS membership_tier_owner_level_key;
ALTER TABLE membership_tier ADD CONSTRAINT membership_tier_owner_level_key UNIQUE (owner_kind, owner_id, level);

-- a membership now records which tier the fan is on and how they're billed
ALTER TABLE membership ADD COLUMN IF NOT EXISTS tier_level text NOT NULL DEFAULT 'supporter';
ALTER TABLE membership ADD COLUMN IF NOT EXISTS billing text NOT NULL DEFAULT 'free';

-- NOTE: post_visibility enum values 'supporter'/'clubhouse' are added in their
-- own single-statement migrations (0021/0022). ALTER TYPE ... ADD VALUE must not
-- share a multi-statement transaction, so it is intentionally NOT here.

-- loyalty: append-only points per fan per entity. Superfan status is the rolling
-- 90-day sum crossing a threshold, so it always reflects *current* loyalty.
CREATE TABLE IF NOT EXISTS loyalty_event (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id      uuid NOT NULL REFERENCES fan(id) ON DELETE CASCADE,
  owner_kind  host_kind NOT NULL,
  owner_id    uuid NOT NULL,
  kind        text NOT NULL,
  points      int NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loyalty_event_score_idx ON loyalty_event (owner_kind, owner_id, fan_id, created_at);
