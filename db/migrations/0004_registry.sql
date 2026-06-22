-- 0004_registry.sql
-- The competition-format registry (spec §3.1). Catalog = data, engines = code.
-- A new variant reusing an existing engine is a row you add, live immediately.

-- variant: the format-bearing unit. One sport -> many variants.
CREATE TABLE variant (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id             uuid NOT NULL REFERENCES sport(id) ON DELETE CASCADE,
  key                  text NOT NULL,
  name                 text NOT NULL,
  result_participant   participant_unit NOT NULL,   -- WHO a result belongs to
  shape                competition_shape NOT NULL,
  is_default_for_sport boolean NOT NULL DEFAULT false,
  is_active            boolean NOT NULL DEFAULT true,
  display_order        int NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sport_id, key)
);

-- variant_standing: 1..N per variant. `unit` (what the ranking ranks) is a
-- SEPARATE column from variant.result_participant (who a result belongs to).
-- This split is what lets an individual sport host a team competition with no
-- new result type (spec §3, §12.2). Collapsing them breaks the trio.
CREATE TABLE variant_standing (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id    uuid NOT NULL REFERENCES variant(id) ON DELETE CASCADE,
  name          text NOT NULL,
  unit          participant_unit NOT NULL,
  engine        standing_engine NOT NULL,
  scope         standing_scope NOT NULL,
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- points, tiebreakers — editable data
  display_order int NOT NULL DEFAULT 0
);

-- category: slices results into separate standings. 0..N per variant.
CREATE TABLE category (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES variant(id) ON DELETE CASCADE,
  kind       category_kind NOT NULL,
  key        text NOT NULL,
  name       text NOT NULL,
  ordinal    int NOT NULL DEFAULT 0,
  bounds     jsonb,                       -- e.g. {"max":66.7,"unit":"kg"}
  is_active  boolean NOT NULL DEFAULT true,
  UNIQUE (variant_id, key)
);

-- variant_result_field: defines the result detail schema AND the entry form.
CREATE TABLE variant_result_field (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id    uuid NOT NULL REFERENCES variant(id) ON DELETE CASCADE,
  key           text NOT NULL,
  label         text NOT NULL,
  type          result_field_type NOT NULL,
  applies_to    field_scope NOT NULL,
  required      boolean NOT NULL DEFAULT false,
  unit          text,
  options       jsonb,                    -- allowed values when type = enum
  display_order int NOT NULL DEFAULT 0,
  UNIQUE (variant_id, key)
);

-- template: a named, reusable CONFIGURATION of a variant. Owned, shareable,
-- cloneable. The zero-blank-state path. A template is data, never new math.
CREATE TABLE template (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  sport_id    uuid NOT NULL REFERENCES sport(id),
  variant_id  uuid NOT NULL REFERENCES variant(id),
  owner_type  template_owner NOT NULL,
  owner_id    uuid,
  visibility  template_visibility NOT NULL DEFAULT 'private',
  is_official boolean NOT NULL DEFAULT false,
  cloned_from uuid REFERENCES template(id),
  usage_count int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT template_owner_id CHECK (
    (owner_type = 'system' AND owner_id IS NULL)
    OR (owner_type <> 'system' AND owner_id IS NOT NULL)
  )
);

CREATE TABLE template_standing (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid NOT NULL REFERENCES template(id) ON DELETE CASCADE,
  name          text NOT NULL,
  unit          participant_unit NOT NULL,
  engine        standing_engine NOT NULL,
  scope         standing_scope NOT NULL,
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order int NOT NULL DEFAULT 0
);

CREATE TABLE template_category (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES template(id) ON DELETE CASCADE,
  kind        category_kind NOT NULL,
  key         text NOT NULL,
  name        text NOT NULL,
  ordinal     int NOT NULL DEFAULT 0,
  bounds      jsonb
);

-- data_integration_request: the user-initiated arm of the ingestion pipeline.
-- Every request is also a feed/partnership lead (deepening the data moat).
CREATE TABLE data_integration_request (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_type entity_kind NOT NULL,            -- institution (club/league/association)
  requester_id   uuid NOT NULL,
  provider_name  text NOT NULL,
  provider_url   text,
  data_types     jsonb NOT NULL DEFAULT '[]'::jsonb,
  status         integration_status NOT NULL DEFAULT 'requested',
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Deferred FKs now that the registry exists.
ALTER TABLE league      ADD CONSTRAINT league_variant_fk  FOREIGN KEY (variant_id)      REFERENCES variant(id);
ALTER TABLE league      ADD CONSTRAINT league_template_fk  FOREIGN KEY (template_id)     REFERENCES template(id);
ALTER TABLE event       ADD CONSTRAINT event_variant_fk    FOREIGN KEY (variant_id)      REFERENCES variant(id);
ALTER TABLE event_series ADD CONSTRAINT es_template_fk      FOREIGN KEY (template_id)     REFERENCES template(id);
ALTER TABLE entity_sport ADD CONSTRAINT es_last_variant_fk  FOREIGN KEY (last_variant_id) REFERENCES variant(id);

CREATE INDEX variant_sport_idx       ON variant(sport_id);
CREATE INDEX variant_standing_v_idx  ON variant_standing(variant_id);
CREATE INDEX category_variant_idx    ON category(variant_id);
CREATE INDEX template_variant_idx    ON template(variant_id);
