-- 0044_rights_grants.sql
--
-- THE RIGHTS SLATE. This is the "consent is not retrofittable" migration: the
-- structure that lets Furia's content corpus be born rights-clear. It is the
-- single piece of the four data-foundation asks that captures something we lose
-- forever if we don't ship it with the registration flow — everything else on
-- the roadmap (identity graph, ledger, event bus) is compute we can build later
-- over data we already capture. See docs/ADR-0001-data-foundations.md.
--
-- WHAT THIS IS NOT. The existing `consent` table (0031) is MESSAGING opt-in
-- (email/sms/push, transactional vs marketing). That is the wrong shape for
-- rights and is left untouched. Rights are about what may be DONE with a
-- person's likeness and record, not which channel we may contact them on.
--
-- DORMANT ON PURPOSE. These tables are additive and UNWIRED. No registration or
-- ticket flow writes to them yet — because the grant taxonomy must be a lawyer's
-- design before it is a product's. Shipping the schema now (empty) costs nothing;
-- wiring capture before legal review would poison the corpus's provenance story,
-- which is the exact failure the whole strategy is meant to avoid. The GDPR
-- traps that must be resolved BEFORE the first write are documented in
-- docs/consent-grant-model-for-legal-review.md — chiefly: (1) consent must be
-- freely given and NOT a condition of registering for an event, so licensing
-- grants cannot be bundled into entry; (2) minors (Art. 8 DSGVO = 16 in Germany)
-- need a guardian path, and a coach cannot grant commercial/likeness/AI rights on
-- an athlete's behalf. The schema is built to make those distinctions
-- expressible; it does not by itself make any particular grant lawful.
--
-- DESIGN PRINCIPLES
--   * Append-only. A grant and its withdrawal are separate immutable rows. We
--     never UPDATE a grant to "revoke" it — the history is the asset. Current
--     state is DERIVED (latest action per subject × scope). Enforced in the repo
--     layer (no UPDATE/DELETE), the same discipline as the money ledger.
--   * Scoped. Four independent scopes, each separately grantable and withdrawable.
--     A person may allow event-media likeness but refuse AI-training — and that
--     refusal must be a first-class, queryable fact.
--   * Versioned + immutable policy text. Every grant points at the exact policy
--     version (with a content hash) the person agreed to. "What did they actually
--     consent to, on what date, in what words" must be answerable years later.
--   * Withdrawal propagates. Every derived asset records which grants it depends
--     on (asset_consent_dep). When a grant is withdrawn, the assets that inherit
--     from it are findable in one query — not a manual fire drill.

-- Scope of a grant. Deliberately narrow and orthogonal.
CREATE TYPE rights_scope AS ENUM (
  'likeness_event_media',   -- your image may appear in media OF the event you were in
  'commercial_sponsor',     -- your likeness may be used in sponsor/commercial contexts
  'ai_training_licensing',  -- your media may be licensed and/or used to train models (rev-share)
  'data_processing'         -- processing of your competitive record beyond contract necessity
);

-- Who performed the grant, relative to the subject. A coach registering an
-- athlete is 'operator' and may NOT stand in for the person on likeness/
-- commercial/AI scopes — the app must refuse to record those from an operator.
CREATE TYPE rights_actor_role AS ENUM ('self', 'guardian', 'operator');

-- The action a grant row records. Append-only: a withdrawal is a new row.
CREATE TYPE rights_action AS ENUM ('granted', 'withdrawn');

-- Where/when the grant was captured — provenance for the "freely given" test.
-- 'registration' is the one to be most careful with: a licensing grant made a
-- condition of registering is not freely given.
CREATE TYPE rights_context AS ENUM ('registration', 'ticket_purchase', 'profile', 'backfill_import');

-- Immutable policy versions. The exact words a person agreed to, frozen. Never
-- edited in place; a new policy is a new row with a new version.
CREATE TABLE IF NOT EXISTS rights_policy (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope          rights_scope NOT NULL,
  version        text NOT NULL,               -- e.g. 'ai_training_licensing/2026-07-01'
  locale         text NOT NULL DEFAULT 'de',  -- the language the person actually read
  body           text NOT NULL,               -- the full grant text as shown
  body_sha256    text NOT NULL,               -- content hash; proves the text hasn't drifted
  rev_share_bps  int,                         -- default rev-share offered by THIS version (basis points), if any
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, version, locale)
);

-- The grant ledger. One immutable row per action. The person is anchored to
-- account(id) — the human node — never to a role table, because rights (and
-- money, and consent) attach to persons, not to whichever hat they wore that day.
CREATE TABLE IF NOT EXISTS rights_grant (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_account_id uuid NOT NULL REFERENCES account(id) ON DELETE RESTRICT, -- whose rights (RESTRICT: never orphan a grant)
  scope              rights_scope NOT NULL,
  action             rights_action NOT NULL,
  policy_id          uuid REFERENCES rights_policy(id),          -- what they agreed to (null only for withdrawals)
  rev_share_bps      int,                                        -- rev-share accepted on THIS grant (snapshot; may differ from policy default)
  actor_role         rights_actor_role NOT NULL,                 -- self | guardian | operator
  actor_account_id   uuid REFERENCES account(id) ON DELETE SET NULL, -- who clicked (may differ from subject)
  subject_is_minor   boolean NOT NULL DEFAULT false,             -- snapshot at grant time (age can't be recomputed reliably later)
  guardian_name      text,                                       -- required when actor_role = 'guardian'
  guardian_relation  text,
  context            rights_context NOT NULL,
  event_id           uuid REFERENCES event(id) ON DELETE SET NULL, -- the event this was captured at, if any
  supersedes_id      uuid REFERENCES rights_grant(id),           -- withdrawal → the grant it retracts
  provenance         jsonb NOT NULL DEFAULT '{}'::jsonb,         -- ip, user_agent, form version, locale shown
  captured_at        timestamptz NOT NULL DEFAULT now(),
  -- A grant of any commercial/AI scope by an 'operator' (coach) is never valid.
  -- The check makes the worst mistake physically impossible to store.
  CONSTRAINT rights_operator_cannot_grant_commercial CHECK (
    NOT (action = 'granted'
         AND actor_role = 'operator'
         AND scope IN ('commercial_sponsor', 'ai_training_licensing'))
  ),
  -- A guardian grant must name the guardian.
  CONSTRAINT rights_guardian_named CHECK (
    actor_role <> 'guardian' OR guardian_name IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS rights_grant_subject_idx ON rights_grant (subject_account_id, scope, captured_at DESC);
CREATE INDEX IF NOT EXISTS rights_grant_event_idx   ON rights_grant (event_id);

-- The dependency graph the strategy insists must exist in the schema from day
-- one: every derived asset records which grant(s) it stands on. Withdrawal
-- propagation is then a query, not a fire drill: "find every asset that depends
-- on a grant this person just withdrew."
CREATE TABLE IF NOT EXISTS asset_consent_dep (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id       uuid NOT NULL,             -- the clip / licensed excerpt / sponsored cut (asset table is future work)
  asset_kind     text NOT NULL,             -- 'clip' | 'licensed_excerpt' | 'sponsor_cut' | ...
  rights_grant_id uuid NOT NULL REFERENCES rights_grant(id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, rights_grant_id)
);
CREATE INDEX IF NOT EXISTS asset_consent_dep_grant_idx ON asset_consent_dep (rights_grant_id);
CREATE INDEX IF NOT EXISTS asset_consent_dep_asset_idx ON asset_consent_dep (asset_id);
