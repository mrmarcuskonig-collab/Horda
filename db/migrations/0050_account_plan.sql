-- 0050 — per-account pricing plan.
-- Lets different organisers sit on different plans (grandfathering, cohorts,
-- promos, A/B pricing experiments) without an all-or-nothing switch. The plan id
-- is resolved against pricing.ts (PLANS); the platform fee and feature
-- entitlements follow from it. Default 'free' — nobody is charged differently
-- until Horda Plus billing is wired.
ALTER TABLE account ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
