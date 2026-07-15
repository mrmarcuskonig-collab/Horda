-- 0036_multi_party.sql — the multi-party events spine (Horda_Multi_Party_Events_Architecture.md).
-- An event is not a single-owner object: many entities attach to one event, each
-- with a role and an auto promo link. Sub-events nest via parent_event_id and roll
-- attribution up. Measurement only at launch — no money movement.

-- Sub-event tree (fight card / race-within-a-race) + the archetype of the event.
ALTER TABLE event ADD COLUMN IF NOT EXISTS parent_event_id uuid REFERENCES event(id) ON DELETE CASCADE;
ALTER TABLE event ADD COLUMN IF NOT EXISTS archetype text NOT NULL DEFAULT 'single';  -- single | versus | multi
CREATE INDEX IF NOT EXISTS event_parent_idx ON event (parent_event_id);

-- event_party: the join between an event and a participant (or an unclaimed
-- placeholder for a rival who hasn't joined Horda yet). Every party carries a
-- ready-to-share promo link; claims/tickets that arrive via it are attributed here.
CREATE TABLE IF NOT EXISTS event_party (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  role         text NOT NULL,                    -- organizer | side | attending_athlete | sponsor | venue | promoter
  side         text,                             -- 'A' | 'B' for versus events, else null
  entity_kind  text,                             -- athlete | club | team | association | brand ; null when unclaimed/custom
  entity_id    text,                             -- null when an unclaimed placeholder / custom link
  placeholder  text,                             -- display name for an unclaimed counterparty or a custom link label
  status       text NOT NULL DEFAULT 'accepted', -- invited | accepted | claimed | unclaimed | removed
  kind         text NOT NULL DEFAULT 'auto',     -- auto (a real participant) | custom (a "+ create custom link")
  promo_token  text NOT NULL UNIQUE,             -- goes in the /e/:id?p=<token> promo link
  clicks       int  NOT NULL DEFAULT 0,          -- opens of this party's promo link
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_party_event_idx ON event_party (event_id, role);
CREATE INDEX IF NOT EXISTS event_party_entity_idx ON event_party (entity_kind, entity_id);
