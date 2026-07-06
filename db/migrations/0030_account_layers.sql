-- 0030: §1a layered-role account model. ONE account; the creator layer and admin
-- roles are optional flags on top of the base account (no separate personas).
-- `creator_layer` = the account has upgraded to a Creathor (public page + tiers).
-- `birth_year`    = for the 18+ gate on creator/admin (base accounts don't need it).
-- `creator_verified` = light verification (§1b); Featured shows verified only.
-- Defaults keep every existing athlete verified so the landing isn't emptied.
ALTER TABLE account ADD COLUMN IF NOT EXISTS creator_layer    boolean NOT NULL DEFAULT false;
ALTER TABLE account ADD COLUMN IF NOT EXISTS birth_year       int;
ALTER TABLE account ADD COLUMN IF NOT EXISTS creator_verified boolean NOT NULL DEFAULT true;
-- Backfill: anyone who already owns an entity is a creator.
UPDATE account SET creator_layer = true
  WHERE id IN (SELECT DISTINCT account_id FROM ownership) AND creator_layer = false;
