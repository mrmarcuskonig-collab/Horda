-- 0011_events_luma.sql
-- Scheduled events (Luma-style) hosted by an athlete/club/team/association,
-- and the fan RSVP responses. Reuses the existing event + attendance tables.

-- richer RSVP responses (attendance already had going/ticket/stream)
ALTER TYPE attend_mode ADD VALUE IF NOT EXISTS 'not_going';
ALTER TYPE attend_mode ADD VALUE IF NOT EXISTS 'interested';

-- who can host a scheduled event
CREATE TYPE host_kind AS ENUM ('athlete', 'club', 'team', 'association');

-- event becomes a first-class scheduled occasion when host_kind is set
ALTER TABLE event
  ADD COLUMN description text,
  ADD COLUMN cover_url   text,
  ADD COLUMN host_kind   host_kind,
  ADD COLUMN host_id     uuid,
  ADD COLUMN capacity    int;

CREATE INDEX event_host_idx ON event(host_kind, host_id);
