-- 0002_entities.sql
-- The entity graph: accounts, sports, and the node types from spec §2.

-- Minimal account anchor for ownership + RBAC. Full auth is a later slice;
-- this exists so ownership and role grants have something to reference.
CREATE TABLE account (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text UNIQUE NOT NULL,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- sport: top-level grouping. Only is_live=true appears in pickers.
CREATE TABLE sport (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text UNIQUE NOT NULL,
  name          text NOT NULL,
  is_live       boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  icon          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Fan: the DAU. Follows entities; never followed.
CREATE TABLE fan (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid REFERENCES account(id) ON DELETE SET NULL,
  handle       text UNIQUE,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Athlete: a PERSON. Self-create only — NEVER pre-built/ingested (spec §12.1, §4, §5).
-- The CHECK makes an ingested athlete physically impossible to insert.
CREATE TABLE athlete (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid REFERENCES account(id) ON DELETE SET NULL,  -- owner from the first second
  handle       text UNIQUE,
  display_name text NOT NULL,
  bio          text,
  source       entity_source NOT NULL DEFAULT 'native',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT athlete_never_ingested CHECK (source = 'native')
);

-- Association (Verband): governing body. Distinguishing power: may mint leagues.
CREATE TABLE association (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text UNIQUE,
  name         text NOT NULL,
  source       entity_source NOT NULL DEFAULT 'native',
  claim_status claim_status NOT NULL DEFAULT 'claimed',
  confidence   numeric,
  provenance   jsonb,
  ingested_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Club (Verein): the umbrella identity fans attach to. Sport-AGNOSTIC.
-- Its sports are the union of its teams' sports (derived, not stored).
CREATE TABLE club (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text UNIQUE,
  name         text NOT NULL,
  source       entity_source NOT NULL DEFAULT 'native',
  claim_status claim_status NOT NULL DEFAULT 'claimed',  -- seeded clubs land 'unclaimed'
  confidence   numeric,
  provenance   jsonb,
  ingested_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Team: the actual COMPETITOR. Single-sport. Belongs to exactly one club.
-- (Club ≠ Team — spec §12.6. This split is what makes multi-sport clubs,
--  men's/women's, and multiple divisions work, and what scopes RBAC + follows.)
CREATE TABLE team (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES club(id) ON DELETE CASCADE,
  sport_id   uuid NOT NULL REFERENCES sport(id),
  name       text NOT NULL,
  gender     text,
  division   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- League (Liga): a GOVERNED, ongoing competition with formal membership and
-- the auto-attend privilege. Only an association or a parent league may mint one.
-- variant_id / template_id FKs are added in 0004 (registry created later).
CREATE TABLE league (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  sport_id          uuid NOT NULL REFERENCES sport(id),
  variant_id        uuid NOT NULL,
  creator_type      league_creator_type NOT NULL,
  association_id    uuid REFERENCES association(id),
  parent_league_id  uuid REFERENCES league(id),
  membership_policy membership_policy NOT NULL DEFAULT 'approval_required',
  template_id       uuid,
  source            entity_source NOT NULL DEFAULT 'native',
  claim_status      claim_status NOT NULL DEFAULT 'claimed',
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- A league is governed: an association-minted league names its association;
  -- a league-minted sub-division names its parent. (spec §12.7)
  CONSTRAINT league_governed CHECK (
       (creator_type = 'association' AND association_id   IS NOT NULL)
    OR (creator_type = 'league'      AND parent_league_id IS NOT NULL)
  )
);

-- Event Series: a wrapper grouping events (tournament, race series, cup).
-- Confers NO membership; optional series-level standing.
CREATE TABLE event_series (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  league_id    uuid REFERENCES league(id),
  template_id  uuid,
  source       entity_source NOT NULL DEFAULT 'native',
  claim_status claim_status NOT NULL DEFAULT 'claimed',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Event: a single occasion (a match, race, fight night). One object, two flows:
-- participant (registration_mode) and spectator (spectator_access).
CREATE TABLE event (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  sport_id         uuid REFERENCES sport(id),
  variant_id       uuid,
  league_id        uuid REFERENCES league(id),
  event_series_id  uuid REFERENCES event_series(id),
  starts_at        timestamptz,
  location         text,
  registration_mode registration_mode NOT NULL DEFAULT 'open',
  spectator_access  spectator_access  NOT NULL DEFAULT 'free',
  source           entity_source NOT NULL DEFAULT 'native',
  claim_status     claim_status NOT NULL DEFAULT 'claimed',
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- entity_sport: multi-sport attachment + default marking.
-- Polymorphic by design (spec §3.1): an athlete OR an institution (club).
CREATE TABLE entity_sport (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       uuid NOT NULL,
  entity_type     entity_kind NOT NULL,
  sport_id        uuid NOT NULL REFERENCES sport(id),
  is_default      boolean NOT NULL DEFAULT false,
  last_variant_id uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, entity_type, sport_id)
);

-- RBAC: one system, hierarchically scoped. Club scope cascades to all teams;
-- team scope touches one team only (e.g. the women's coach). (spec §2)
CREATE TABLE role_grant (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  role       rbac_role NOT NULL,
  scope      rbac_scope NOT NULL,
  club_id    uuid REFERENCES club(id) ON DELETE CASCADE,
  team_id    uuid REFERENCES team(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rbac_scope_target CHECK (
       (scope = 'club' AND club_id IS NOT NULL AND team_id IS NULL)
    OR (scope = 'team' AND team_id IS NOT NULL AND club_id IS NULL)
  )
);

CREATE INDEX team_club_idx        ON team(club_id);
CREATE INDEX entity_sport_lookup  ON entity_sport(entity_id, entity_type);
CREATE INDEX role_grant_account   ON role_grant(account_id);
