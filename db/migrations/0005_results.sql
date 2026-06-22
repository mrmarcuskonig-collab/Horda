-- 0005_results.sql
-- The universal spine. Every result, ingested or native, materializes one
-- uniform row per participant so feed/profile/notifications stay sport-agnostic.
-- A matchup expands to per-side rows; a field entry yields one row per finisher.

CREATE TABLE result (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  variant_id       uuid NOT NULL REFERENCES variant(id),
  category_id      uuid REFERENCES category(id),
  participant_id   uuid NOT NULL,                 -- athlete or team
  participant_type participant_unit NOT NULL,
  outcome          result_outcome NOT NULL,       -- generalized across sports
  rank             int,                           -- placement (field); null for plain matchups
  headline         text NOT NULL,                 -- precomputed display string
  detail           jsonb NOT NULL DEFAULT '{}'::jsonb,  -- validated vs variant_result_field
  source           entity_source NOT NULL DEFAULT 'native',  -- 'ingested' | 'native'
  recorded_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX result_event_idx       ON result(event_id);
CREATE INDEX result_participant_idx ON result(participant_type, participant_id);
CREATE INDEX result_variant_idx     ON result(variant_id);
