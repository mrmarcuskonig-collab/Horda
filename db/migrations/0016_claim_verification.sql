-- 0016_claim_verification.sql
-- Claiming a club/team/association/athlete page is no longer instant.
-- A claim is a REQUEST that must be verified before ownership is granted:
--   • email_domain      — claimant's email domain == the entity's official site → auto-verified
--   • channel_code      — a one-time code the claimant posts on their official site, then we re-check
--   • admin_grant       — the platform admin approves from the review queue
--   • association_vouch — the governing association (its owner) approves a member club/team
-- Until verified, the entity stays claim_status='unclaimed' and the claimant gets no owner tools.

ALTER TABLE account ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE TYPE claim_method        AS ENUM ('email_domain','channel_code','admin_grant','association_vouch');
CREATE TYPE claim_review_status AS ENUM ('pending','verified','rejected');

CREATE TABLE claim_request (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  target_kind  text NOT NULL CHECK (target_kind IN ('athlete','club','team','association')),
  target_id    uuid NOT NULL,
  method       claim_method        NOT NULL,
  status       claim_review_status NOT NULL DEFAULT 'pending',
  evidence     text,          -- optional URL / note supplied by the claimant
  channel_code text,          -- one-time token to place on the official channel
  decided_by   uuid REFERENCES account(id) ON DELETE SET NULL,
  decided_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, target_kind, target_id)   -- one open claim per account per entity
);
CREATE INDEX claim_request_target_idx ON claim_request (target_kind, target_id, status);
CREATE INDEX claim_request_status_idx ON claim_request (status);
