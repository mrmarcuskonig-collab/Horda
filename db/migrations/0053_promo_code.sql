-- 0053 — event promo codes.
-- An organiser can offer discount codes on an event's paid tickets: 10 / 20 / 50
-- percent off, or a free code (percent_off = 100). Several codes per event, each a
-- memorable string the fan types at claim/checkout. `uses` counts redemptions so
-- the organiser sees which codes are working (and can cap them later). Codes are
-- unique per event, case-insensitively.
CREATE TABLE IF NOT EXISTS promo_code (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  code         text NOT NULL,
  percent_off  int  NOT NULL DEFAULT 0,   -- 10 | 20 | 50 | 100 (100 = free)
  max_uses     int,                        -- null = unlimited
  uses         int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS promo_code_event_code_uidx ON promo_code (event_id, lower(code));
CREATE INDEX IF NOT EXISTS promo_code_event_idx ON promo_code (event_id, created_at);
