-- 0024: a lightweight channel for creators to propose new page features, feeding
-- continuous product improvement. Tagged with sport so we see demand per sport.
CREATE TABLE IF NOT EXISTS feature_request (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid REFERENCES account(id) ON DELETE SET NULL,
  sport       text,
  context     text,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feature_request_created_idx ON feature_request (created_at DESC);
