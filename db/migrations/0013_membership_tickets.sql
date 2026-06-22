-- 0013_membership_tickets.sql
-- Closeness monetization: paid membership tiers + members-only content (FOMO),
-- and transferable tickets (gift / resale). Monetize access; keep shares free.

-- a paid tier offered by an athlete/club/team (one per owner in v0)
CREATE TABLE membership_tier (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind  host_kind NOT NULL,
  owner_id    uuid NOT NULL,
  name        text NOT NULL,
  price_cents int NOT NULL,
  currency    text NOT NULL DEFAULT 'EUR',
  perks       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_kind, owner_id)
);

-- a fan's membership; member_no is the founding-member number (1,2,3…)
CREATE TABLE membership (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id      uuid NOT NULL REFERENCES fan(id) ON DELETE CASCADE,
  owner_kind  host_kind NOT NULL,
  owner_id    uuid NOT NULL,
  member_no   int NOT NULL,
  status      text NOT NULL DEFAULT 'active',
  started_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fan_id, owner_kind, owner_id)
);
CREATE INDEX membership_owner_idx ON membership(owner_kind, owner_id);

-- posts can be public or members-only (the FOMO drop)
CREATE TYPE post_visibility AS ENUM ('public', 'members');
ALTER TABLE post ADD COLUMN visibility post_visibility NOT NULL DEFAULT 'public';

-- transferable tickets for paid events (gift / resale)
CREATE TYPE ticket_status AS ENUM ('held', 'listed', 'transferred');
CREATE TABLE ticket (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  holder_fan_id    uuid NOT NULL REFERENCES fan(id),
  issued_to_fan_id uuid NOT NULL REFERENCES fan(id),
  status           ticket_status NOT NULL DEFAULT 'held',
  list_price_cents int,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_event_idx ON ticket(event_id);
CREATE INDEX ticket_holder_idx ON ticket(holder_fan_id);
