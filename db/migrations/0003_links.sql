-- 0003_links.sql
-- The two link primitives + participation. Everything social reuses these.

-- OPEN FOLLOW: one-directional, fan -> (club | team | athlete).
-- A follow is a subscription to real-world information, not a friendship.
-- There is deliberately NO fan<->fan edge anywhere in the schema (spec §9, §12.3).
CREATE TABLE follow (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id      uuid NOT NULL REFERENCES fan(id) ON DELETE CASCADE,
  target_type follow_target_type NOT NULL,
  target_id   uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fan_id, target_type, target_id)
);

-- DOUBLE OPT-IN: ONE engine with a policy flag (spec §2).
-- Covers athlete<->team roster, team/athlete<->league assignment, and matchups.
CREATE TABLE relationship_link (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         link_kind NOT NULL,
  a_type       link_side_type NOT NULL,   -- initiating side
  a_id         uuid NOT NULL,
  b_type       link_side_type NOT NULL,   -- accepting side
  b_id         uuid NOT NULL,
  policy       membership_policy NOT NULL,
  state        link_state NOT NULL DEFAULT 'pending',
  initiated_by uuid REFERENCES account(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz,
  -- The link engine only accepts the shapes the spec defines.
  CONSTRAINT link_shape CHECK (
       (kind = 'roster_membership' AND a_type = 'athlete' AND b_type = 'team')
    OR (kind = 'league_assignment' AND a_type IN ('team','athlete') AND b_type = 'league')
    OR (kind = 'matchup'          AND a_type IN ('athlete','team') AND b_type IN ('athlete','team'))
  )
);

-- Policy flag in action: open_join auto-accepts (Kreisliga, open clubs);
-- approval_required stays pending until a manage-roster holder decides.
CREATE OR REPLACE FUNCTION auto_accept_open_join() RETURNS trigger AS $$
BEGIN
  IF NEW.policy = 'open_join' AND NEW.state = 'pending' THEN
    NEW.state := 'accepted';
    NEW.decided_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_accept_open_join
  BEFORE INSERT ON relationship_link
  FOR EACH ROW EXECUTE FUNCTION auto_accept_open_join();

-- Convenience views over accepted links (the live roster / league membership).
CREATE VIEW roster AS
  SELECT a_id AS athlete_id, b_id AS team_id, created_at
  FROM relationship_link
  WHERE kind = 'roster_membership' AND state = 'accepted';

CREATE VIEW league_member AS
  SELECT a_type AS member_type, a_id AS member_id, b_id AS league_id, created_at
  FROM relationship_link
  WHERE kind = 'league_assignment' AND state = 'accepted';

-- PARTICIPATION / AUTO-ATTEND.
-- 'inherited' = league member auto-enrolled (consent once, at league join).
-- 'direct'    = registered into a standalone event/series.
-- status sits on top of eligibility (lineup / withdrawal); individual sports
-- default it to 'selected' (the team case adds the override the individual ignores).
CREATE TABLE event_participant (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  participant_type participant_unit NOT NULL,
  participant_id   uuid NOT NULL,
  source           participation_source NOT NULL,
  status           participation_status NOT NULL DEFAULT 'available',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, participant_type, participant_id)
);

CREATE INDEX follow_target_idx     ON follow(target_type, target_id);
CREATE INDEX rel_link_a_idx        ON relationship_link(a_type, a_id);
CREATE INDEX rel_link_b_idx        ON relationship_link(b_type, b_id);
CREATE INDEX event_participant_idx ON event_participant(participant_type, participant_id);
