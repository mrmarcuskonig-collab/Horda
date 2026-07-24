-- 0047_notification_pref.sql
--
-- Per-account notification preferences (the Luma-style "how do you want to be
-- notified" page). One row per (account, category, channel); absence = the
-- default (on). Email is the only live channel today; the table already carries
-- a `channel` column so WhatsApp / push slot in later without another migration.
CREATE TABLE IF NOT EXISTS notification_pref (
  account_id uuid NOT NULL,
  category   text NOT NULL,
  channel    text NOT NULL DEFAULT 'email',
  enabled    boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, category, channel)
);
