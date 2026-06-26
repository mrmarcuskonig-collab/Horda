-- 0026: Build Order #3 "The Hook" — event rooms, collective/rivalry goals, and
-- typed analytics. All additive + idempotent; extends the existing event + tier
-- model (no parallel systems).

-- Event Room: a time-bound space layered on an existing event.
ALTER TABLE event ADD COLUMN IF NOT EXISTS room_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE event ADD COLUMN IF NOT EXISTS room_label   text;                         -- "Matchday" | "Fight Night" | "Race Day" …
ALTER TABLE event ADD COLUMN IF NOT EXISTS room_tier    text NOT NULL DEFAULT 'supporter';  -- who sees the LIVE room: public|supporter|clubhouse
ALTER TABLE event ADD COLUMN IF NOT EXISTS room_state   text NOT NULL DEFAULT 'auto';       -- auto|live|recap (creator override)
ALTER TABLE event ADD COLUMN IF NOT EXISTS result       text;                          -- outcome the creator posts; drives recap + AI recap

-- Messages inside a room: fan chat, fan reactions, and athlete behind-the-scenes.
CREATE TABLE IF NOT EXISTS room_message (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  author_kind text NOT NULL DEFAULT 'fan',     -- fan | athlete
  fan_id      uuid,                             -- server-resolved viewer (null for athlete posts)
  kind        text NOT NULL DEFAULT 'chat',     -- chat | bts | reaction
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS room_message_event_idx ON room_message (event_id, created_at);

-- Collective & rivalry goals.
CREATE TABLE IF NOT EXISTS goal (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind    text NOT NULL,
  owner_id      text NOT NULL,
  metric        text NOT NULL DEFAULT 'superfans',  -- superfans | members | support
  threshold     int  NOT NULL,
  reward        text NOT NULL,
  reward_post_id uuid,                               -- optional: post unlocked (made public) on hit
  status        text NOT NULL DEFAULT 'active',      -- active | reached
  reached_at    timestamptz,
  rival_kind    text,                                -- rivalry: the opponent owner
  rival_id      text,
  window_start  timestamptz,
  window_end    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goal_owner_idx ON goal (owner_kind, owner_id, status);

-- Typed product analytics — the validation data for this release.
CREATE TABLE IF NOT EXISTS analytics_event (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,                    -- event_room_open | superfan_converted | event_day_conversion | next_event_return | goal_signup | artifact_share | ai_asset_posted …
  owner_kind  text,
  owner_id    text,
  fan_id      uuid,
  event_id    uuid,
  props       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_event_name_idx  ON analytics_event (name, created_at);
CREATE INDEX IF NOT EXISTS analytics_event_owner_idx ON analytics_event (owner_kind, owner_id, name);
