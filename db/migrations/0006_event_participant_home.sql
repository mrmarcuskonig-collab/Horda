-- 0006_event_participant_home.sql
-- Make matchup home/away explicit on the participation record. Nullable because
-- field events (a triathlon) have no home/away — only matchups set it.
ALTER TABLE event_participant ADD COLUMN is_home boolean;
