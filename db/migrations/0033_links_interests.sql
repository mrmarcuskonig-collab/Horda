-- 0033: the entity connection graph + fan interests.
--
-- entity_link connects a CHILD to the next-higher PARENT it belongs to:
--   athlete → club, club → league / association / series.
-- Either side can request; the parent admits/rejects and can later remove.
-- status: pending | active | removed. This is what powers the "Clubs & Leagues"
-- cards on an athlete page and the club↔league relationships.
CREATE TABLE IF NOT EXISTS entity_link (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_kind   text NOT NULL,                 -- athlete | club
  child_id     text NOT NULL,
  parent_kind  text NOT NULL,                 -- club | association | league | series
  parent_id    text NOT NULL,
  role         text,                          -- 'player', 'member', 'competitor'
  status       text NOT NULL DEFAULT 'pending', -- pending | active | removed
  requested_by text,                          -- 'child' | 'parent'
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_kind, child_id, parent_kind, parent_id)
);
CREATE INDEX IF NOT EXISTS entity_link_child_idx  ON entity_link (child_kind, child_id, status);
CREATE INDEX IF NOT EXISTS entity_link_parent_idx ON entity_link (parent_kind, parent_id, status);

-- fan_interest: sports / regions a fan cares about. Set automatically when a
-- guest filters discover and then signs up (their filter becomes their feed).
CREATE TABLE IF NOT EXISTS fan_interest (
  fan_id     uuid NOT NULL,
  kind       text NOT NULL,                   -- sport | region
  value      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fan_id, kind, value)
);
