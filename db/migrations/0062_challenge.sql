-- 0062_challenge.sql — challenges as programmable incentives on the graph.
--
-- A challenge is issued by a host (club/athlete/team/association): "attend N of my
-- events in this window → a reward". Furia is only the ELIGIBILITY LEDGER — it
-- computes who qualified from real `presence`; the issuer fulfils the reward
-- manually, off-platform (raffle-style). No points, no badges, no auto-rewards.
-- Metric is 'attendance' for now (counts verified presences at the issuer's events).
CREATE TABLE IF NOT EXISTS challenge (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_kind  host_kind NOT NULL,
  issuer_id    uuid NOT NULL,
  title        text NOT NULL,
  metric       text NOT NULL DEFAULT 'attendance',
  threshold    int  NOT NULL DEFAULT 1 CHECK (threshold >= 1),
  window_start timestamptz,
  window_end   timestamptz,
  reward_text  text NOT NULL DEFAULT '',
  source       text NOT NULL DEFAULT 'furia',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS challenge_issuer_idx ON challenge (issuer_kind, issuer_id, created_at DESC);
