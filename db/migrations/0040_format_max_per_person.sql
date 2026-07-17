-- 0040 — how many spots one person may take, per way-in.
--
-- The model was already right: an event has one or more WAYS TO ATTEND
-- (event_format: in person, stream A, stream B), each with its own price and
-- capacity, and the fan picks one (claim.format_id). A hybrid event genuinely
-- offers two doors and the fan chooses — that is not one question with one
-- answer, and v80's single "how do people get in?" radio wrongly made it one.
--
-- What was missing:
--   max_per_person — "can a fan bring three mates?" had no answer. claim.party_size
--                    has existed since 0031 but nothing ever set it, and no
--                    organiser could permit it. Per FORMAT, not per event: you
--                    might allow 4 tickets at the door and exactly 1 stream seat
--                    (a stream seat for four people is meaningless).
ALTER TABLE event_format ADD COLUMN IF NOT EXISTS max_per_person int NOT NULL DEFAULT 1;

-- Guard the obvious footgun: 0 or negative would silently make a format
-- unclaimable, and the organiser would never know why nobody came.
ALTER TABLE event_format ADD CONSTRAINT event_format_maxpp_ck CHECK (max_per_person >= 1) NOT VALID;

-- Per-format claim counting. Capacity is per format (100 seats in the hall,
-- unlimited on the stream) — counting claims event-wide would let the hall
-- selling out close the stream too.
CREATE INDEX IF NOT EXISTS claim_format_idx ON claim (format_id) WHERE format_id IS NOT NULL;
