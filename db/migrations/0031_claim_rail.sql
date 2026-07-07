-- 0031: the claim rail — the atomic unit of the pivot. A claim is a fan
-- committing to a scarce, counted event; a pass is its identity-bound token;
-- a presence is the verified fact that they showed up (fidelity-weighted).
-- Standing accrues from presences and unlocks earned access (never sold).

-- Event becomes claimable + capped. (capacity already exists; enforced NOT NULL
-- in code so legacy rows survive.) Tiers + registration modes from the strategy.
ALTER TABLE event ADD COLUMN IF NOT EXISTS tier              text NOT NULL DEFAULT 'gathering'; -- main | gathering | one_on_one
ALTER TABLE event ADD COLUMN IF NOT EXISTS registration_mode text NOT NULL DEFAULT 'open';      -- open | approval | standing
ALTER TABLE event ADD COLUMN IF NOT EXISTS standing_threshold int NOT NULL DEFAULT 0;           -- presences required if mode=standing
ALTER TABLE event ADD COLUMN IF NOT EXISTS is_participation  boolean NOT NULL DEFAULT false;     -- start-line vs spectate

CREATE TABLE IF NOT EXISTS claim (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  fan_id      uuid NOT NULL,
  status      text NOT NULL DEFAULT 'claimed',   -- claimed | waitlisted | approved | verified | no_show | refunded
  party_size  int  NOT NULL DEFAULT 1,
  price_cents int,
  source_edge text,                              -- how the claim arrived: athlete link / invite / qr / directory
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, fan_id)
);
CREATE INDEX IF NOT EXISTS claim_event_idx ON claim (event_id, status);
CREATE INDEX IF NOT EXISTS claim_fan_idx   ON claim (fan_id, status);

CREATE TABLE IF NOT EXISTS pass (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    uuid NOT NULL REFERENCES claim(id) ON DELETE CASCADE,
  fan_id      uuid NOT NULL,
  token       text NOT NULL UNIQUE,              -- QR/verify token (identity-bound)
  transferable boolean NOT NULL DEFAULT false,   -- non-transferable by default; identity-rebind only
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pass_claim_idx ON pass (claim_id);

CREATE TABLE IF NOT EXISTS presence (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    uuid NOT NULL REFERENCES claim(id) ON DELETE CASCADE,
  fan_id      uuid NOT NULL,
  event_id    uuid NOT NULL,
  fidelity    text NOT NULL DEFAULT 'in_room',   -- in_room | online (weights the north star)
  verified_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid,                              -- account that scanned/checked in
  UNIQUE (claim_id)
);
CREATE INDEX IF NOT EXISTS presence_fan_idx   ON presence (fan_id, verified_at DESC);
CREATE INDEX IF NOT EXISTS presence_owner_idx ON presence (event_id);

-- Standing = verified-presence count per fan × crowd (owner). Materialized on read.
CREATE TABLE IF NOT EXISTS standing (
  fan_id      uuid NOT NULL,
  owner_kind  text NOT NULL,
  owner_id    text NOT NULL,
  presences   int  NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fan_id, owner_kind, owner_id)
);

-- Consent ledger: per fan × owner × channel, transactional vs marketing, revocable.
CREATE TABLE IF NOT EXISTS consent (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id      uuid NOT NULL,
  owner_kind  text NOT NULL,
  owner_id    text NOT NULL,
  channel     text NOT NULL,                     -- email | sms | whatsapp | push
  class       text NOT NULL DEFAULT 'marketing', -- transactional | marketing
  granted_at  timestamptz,
  revoked_at  timestamptz,
  provenance  text,
  UNIQUE (fan_id, owner_kind, owner_id, channel, class)
);
CREATE INDEX IF NOT EXISTS consent_owner_idx ON consent (owner_kind, owner_id, class);
