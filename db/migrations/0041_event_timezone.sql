-- 0041 — the event's own timezone. This fixes a live, dangerous bug.
--
-- WHAT WAS WRONG: <input type="datetime-local"> posts a naive wall-clock string
-- ("2030-09-12T20:00", no zone). It was handed straight to `::timestamptz`, so
-- POSTGRES resolved it in whatever timezone the SERVER runs in. The stored
-- instant therefore depended on the deploy environment rather than on the
-- organiser, and the event page rendered the naive value back — so it always
-- LOOKED right. The error only surfaced where it hurts: "add to calendar"
-- exported the wrong instant and fans arrived an hour out.
--
-- THE MODEL: an event happens at a PLACE at a WALL-CLOCK time. 20:00 at a
-- Kreuzberg gym is 20:00 in Berlin whether you read it from Berlin or Tokyo. So
-- we keep the absolute instant (starts_at, for calendars/ordering/"live now")
-- AND the venue's zone, and always display in the venue's zone, labelled.
ALTER TABLE event ADD COLUMN IF NOT EXISTS timezone text;

-- Existing rows: we cannot know what the organiser meant, and guessing would be
-- worse than admitting it. NULL = "unknown zone" and the app renders those in
-- UTC exactly as it always did — no silent shift of events already advertised.
-- New events carry a real zone from the moment this ships.
COMMENT ON COLUMN event.timezone IS
  'IANA zone of the venue (Europe/Berlin). NULL on rows created before 0041 — render those as before (UTC-naive); never back-fill a guess.';
