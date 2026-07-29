-- 0049_event_cancel.sql
--
-- Cancelling an event. An organiser can call it off; ticket-holders and fans who
-- liked it get told, with a message the organiser writes. We keep the row (never
-- delete) so the audit trail, the tickets and the attribution survive, and the
-- public page can honestly say "cancelled" instead of 404-ing.
ALTER TABLE event ADD COLUMN IF NOT EXISTS cancelled_at   timestamptz;
ALTER TABLE event ADD COLUMN IF NOT EXISTS cancel_message text;
