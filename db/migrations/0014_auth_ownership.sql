-- 0014_auth_ownership.sql
-- Real identity: accounts with passwords, sessions, and ownership of entities.
-- (account already exists with id/email/display_name.)

ALTER TABLE account ADD COLUMN password_hash text;

CREATE TABLE session (
  token      text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- which account owns/administers which entity (athlete/club/team/association)
CREATE TABLE ownership (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  owner_kind host_kind NOT NULL,
  owner_id   uuid NOT NULL,
  role       text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, owner_kind, owner_id)
);
CREATE INDEX ownership_account_idx ON ownership(account_id);
CREATE INDEX ownership_entity_idx ON ownership(owner_kind, owner_id);
