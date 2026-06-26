-- 0028: a creator shop with multiple item types — physical merch, gift-a-
-- membership, discount-code access, or a plain external link. Creator-owned.
CREATE TABLE IF NOT EXISTS shop_item (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind  text NOT NULL,
  owner_id    text NOT NULL,
  kind        text NOT NULL DEFAULT 'merch',   -- merch | gift_membership | discount | link
  title       text NOT NULL,
  subtitle    text,
  url         text,
  price_cents int,
  ord         int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_item_owner_idx ON shop_item (owner_kind, owner_id, ord);
