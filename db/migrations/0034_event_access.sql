-- 0034: the event access model — how attendees actually get in.
--
-- Every event is one of two clear modes, decided by the organizer at creation:
--   'ticket' — attendees register (free or paid), receive a ticket with a QR
--              code, and show it at the venue. The organizer scans it → verified
--              presence, so they know exactly who showed up. (in-person default)
--   'link'   — attendees just receive the details / stream link (public or paid);
--              no QR, no door check-in. (online default)
--
-- Orthogonal to price (admission: open/register/apply/paid) and where
-- (location_kind + location: a physical address, or a YouTube/Instagram/Zoom link).
ALTER TABLE event ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'ticket';

-- Online-only events default to link delivery (there's no door to scan at).
UPDATE event SET access_mode='link' WHERE location_kind='online' AND access_mode='ticket';
