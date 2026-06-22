-- seed_trio.sql
-- The §3.2 worked example, fully populated, plus a small live entity graph.
-- Proves the registry holds the trio AND that result_participant ≠ standing unit.

-- ---- Sports --------------------------------------------------------------
INSERT INTO sport (key, name, is_live, display_order) VALUES
  ('football',  'Football',  true, 1),
  ('boxing',    'Boxing',    true, 2),
  ('triathlon', 'Triathlon', true, 3);

-- ---- Variants (§3.2) -----------------------------------------------------
INSERT INTO variant (sport_id, key, name, result_participant, shape, is_default_for_sport, display_order)
SELECT id, '11_a_side', '11-a-side', 'team', 'matchup', true, 1 FROM sport WHERE key='football';
INSERT INTO variant (sport_id, key, name, result_participant, shape, display_order)
SELECT id, 'futsal', 'Futsal', 'team', 'matchup', 2 FROM sport WHERE key='football';
INSERT INTO variant (sport_id, key, name, result_participant, shape, is_default_for_sport, display_order)
SELECT id, 'bout', 'Bout', 'individual', 'matchup', true, 1 FROM sport WHERE key='boxing';
INSERT INTO variant (sport_id, key, name, result_participant, shape, display_order)
SELECT id, 'boxstall_team', 'Boxstall team', 'individual', 'matchup', 2 FROM sport WHERE key='boxing';
INSERT INTO variant (sport_id, key, name, result_participant, shape, is_default_for_sport, display_order)
SELECT id, 'triathlon', 'Triathlon', 'individual', 'field', true, 1 FROM sport WHERE key='triathlon';
INSERT INTO variant (sport_id, key, name, result_participant, shape, display_order)
SELECT id, 'bundesliga', 'Bundesliga', 'individual', 'field', 2 FROM sport WHERE key='triathlon';

-- Helper: fetch a variant id by (sport key, variant key)
-- (inlined as subselects below)

-- ---- Standings -----------------------------------------------------------
-- Football 11-a-side: team · points_table · season  (unit == result_participant)
INSERT INTO variant_standing (variant_id, name, unit, engine, scope, config)
SELECT v.id, 'League table', 'team', 'points_table', 'season',
       '{"win":3,"draw":1,"loss":0,"tiebreakers":["goal_diff","goals_for","head_to_head"]}'
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='football' AND v.key='11_a_side';

INSERT INTO variant_standing (variant_id, name, unit, engine, scope, config)
SELECT v.id, 'League table', 'team', 'points_table', 'season',
       '{"win":3,"draw":1,"loss":0,"tiebreakers":["goal_diff","goals_for"]}'
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='football' AND v.key='futsal';

-- Boxing Bout: individual · win_loss_record · career  (unit == result_participant)
INSERT INTO variant_standing (variant_id, name, unit, engine, scope, config)
SELECT v.id, 'Career record', 'individual', 'win_loss_record', 'career', '{}'
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='boxing' AND v.key='bout';

-- Boxing Boxstall team: team · team_aggregate · season
--   *** result_participant = individual, standing unit = team -> THEY DIFFER ***
INSERT INTO variant_standing (variant_id, name, unit, engine, scope, config)
SELECT v.id, 'Boxstall table', 'team', 'team_aggregate', 'season', '{"aggregate":"bout_wins"}'
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='boxing' AND v.key='boxstall_team';

-- Triathlon individual: individual · time_leaderboard · event
INSERT INTO variant_standing (variant_id, name, unit, engine, scope, config)
SELECT v.id, 'Finish times', 'individual', 'time_leaderboard', 'event', '{"order":"asc"}'
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='triathlon' AND v.key='triathlon';

-- Triathlon Bundesliga: TWO standings at once —
--   individual · time_leaderboard · event  +  team · series_points · series
--   *** the team standing's unit differs from result_participant=individual ***
INSERT INTO variant_standing (variant_id, name, unit, engine, scope, config, display_order)
SELECT v.id, 'Race finish times', 'individual', 'time_leaderboard', 'event', '{"order":"asc"}', 1
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='triathlon' AND v.key='bundesliga';
INSERT INTO variant_standing (variant_id, name, unit, engine, scope, config, display_order)
SELECT v.id, 'Bundesliga table', 'team', 'series_points', 'series', '{"score_top_n":4}', 2
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='triathlon' AND v.key='bundesliga';

-- ---- Categories ----------------------------------------------------------
INSERT INTO category (variant_id, kind, key, name, ordinal)
SELECT v.id, 'division', 'div', 'Division', 1
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='football' AND v.key='11_a_side';
INSERT INTO category (variant_id, kind, key, name, ordinal)
SELECT v.id, 'division', 'div', 'Division', 1
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='football' AND v.key='futsal';

INSERT INTO category (variant_id, kind, key, name, ordinal, bounds)
SELECT v.id, 'weight_class', 'welterweight', 'Welterweight', 5, '{"max":66.7,"unit":"kg"}'
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='boxing' AND v.key='bout';
INSERT INTO category (variant_id, kind, key, name, ordinal, bounds)
SELECT v.id, 'weight_class', 'welterweight', 'Welterweight', 5, '{"max":66.7,"unit":"kg"}'
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='boxing' AND v.key='boxstall_team';

INSERT INTO category (variant_id, kind, key, name, ordinal)
SELECT v.id, 'age_group', 'm40_44', 'M40–44', 9
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='triathlon' AND v.key='triathlon';
INSERT INTO category (variant_id, kind, key, name, ordinal)
SELECT v.id, 'distance', 'olympic', 'Olympic', 2
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='triathlon' AND v.key='triathlon';
INSERT INTO category (variant_id, kind, key, name, ordinal)
SELECT v.id, 'division', 'div1', '1. Bundesliga', 1
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='triathlon' AND v.key='bundesliga';

-- ---- Result fields (the entry form, per variant) -------------------------
INSERT INTO variant_result_field (variant_id, key, label, type, applies_to, required, unit, display_order)
SELECT v.id, 'score', 'Goals', 'integer', 'per_side', true, 'goals', 1
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='football' AND v.key='11_a_side';

INSERT INTO variant_result_field (variant_id, key, label, type, applies_to, required, options, display_order)
SELECT v.id, 'method', 'Method', 'enum', 'shared', true,
       '["KO","TKO","UD","SD","MD","DQ","Draw"]', 1
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='boxing' AND v.key='bout';
INSERT INTO variant_result_field (variant_id, key, label, type, applies_to, required, unit, display_order)
SELECT v.id, 'round', 'Round', 'integer', 'shared', false, 'round', 2
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='boxing' AND v.key='bout';

INSERT INTO variant_result_field (variant_id, key, label, type, applies_to, required, unit, display_order)
SELECT v.id, 'finish_time', 'Finish time', 'duration', 'per_participant', true, 's', 1
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='triathlon' AND v.key='triathlon';

-- ---- Official system templates (first official = seeded variant defaults) -
INSERT INTO template (name, description, sport_id, variant_id, owner_type, owner_id, visibility, is_official)
SELECT 'Standard league table (3-1-0)', 'Three points a win, goal difference tiebreak.',
       s.id, v.id, 'system', NULL, 'public', true
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='football' AND v.key='11_a_side';

INSERT INTO template_standing (template_id, name, unit, engine, scope, config)
SELECT t.id, 'League table', 'team', 'points_table', 'season',
       '{"win":3,"draw":1,"loss":0,"tiebreakers":["goal_diff","goals_for"]}'
FROM template t WHERE t.name='Standard league table (3-1-0)';

INSERT INTO template (name, description, sport_id, variant_id, owner_type, owner_id, visibility, is_official)
SELECT 'Pro career record', 'Win-loss-draw career ledger by weight class.',
       s.id, v.id, 'system', NULL, 'public', true
FROM variant v JOIN sport s ON s.id=v.sport_id WHERE s.key='boxing' AND v.key='bout';

-- ---- A small LIVE entity graph (exercises the relational machinery) -------
-- An association that can mint leagues; a club with two teams; a governed
-- league; an open-join roster (auto-accepts); auto-attend into a fixture.
INSERT INTO account (email, display_name) VALUES ('admin@example-club.de', 'Club Admin');
INSERT INTO association (key, name) VALUES ('bfv', 'Bayerischer Fußball-Verband');

INSERT INTO club (key, name, source, claim_status)
VALUES ('fc-beispiel', 'FC Beispiel', 'native', 'claimed');

INSERT INTO team (club_id, sport_id, name, gender, division)
SELECT c.id, s.id, 'FC Beispiel — 1. Herren', 'men', 'Kreisliga'
FROM club c, sport s WHERE c.key='fc-beispiel' AND s.key='football';
INSERT INTO team (club_id, sport_id, name, gender, division)
SELECT c.id, s.id, 'FC Beispiel — Damen', 'women', 'Bezirksliga'
FROM club c, sport s WHERE c.key='fc-beispiel' AND s.key='football';

-- A governed league (association-minted), pinned to football 11-a-side.
INSERT INTO league (name, sport_id, variant_id, creator_type, association_id, membership_policy)
SELECT 'Kreisliga 1', s.id, v.id, 'association', a.id, 'open_join'
FROM sport s
  JOIN variant v ON v.sport_id=s.id AND v.key='11_a_side'
  JOIN association a ON a.key='bfv'
WHERE s.key='football';

-- An athlete self-creates (source forced 'native' by the schema) and joins the
-- men's team. open_join policy -> the trigger auto-accepts the roster link.
INSERT INTO athlete (display_name, handle, source) VALUES ('Lukas Beispiel', 'lukas', 'native');
INSERT INTO relationship_link (kind, a_type, a_id, b_type, b_id, policy)
SELECT 'roster_membership', 'athlete', ath.id, 'team', t.id, 'open_join'
FROM athlete ath, team t
WHERE ath.handle='lukas' AND t.name='FC Beispiel — 1. Herren';

-- The team is assigned to the league (open_join -> auto-accepted).
INSERT INTO relationship_link (kind, a_type, a_id, b_type, b_id, policy)
SELECT 'league_assignment', 'team', t.id, 'league', l.id, 'open_join'
FROM team t, league l
WHERE t.name='FC Beispiel — 1. Herren' AND l.name='Kreisliga 1';

-- A league fixture; the member team is auto-attended (source='inherited').
INSERT INTO event (name, sport_id, variant_id, league_id, starts_at, location, registration_mode, spectator_access)
SELECT 'Kreisliga 1 — Matchday 1', s.id, v.id, l.id,
       now() + interval '7 days', 'Sportplatz Beispiel', 'open', 'free'
FROM sport s
  JOIN variant v ON v.sport_id=s.id AND v.key='11_a_side'
  JOIN league l ON l.name='Kreisliga 1'
WHERE s.key='football';

INSERT INTO event_participant (event_id, participant_type, participant_id, source, status)
SELECT e.id, 'team', t.id, 'inherited', 'selected'
FROM event e, team t
WHERE e.name='Kreisliga 1 — Matchday 1' AND t.name='FC Beispiel — 1. Herren';

-- A fan follows the club (fan -> entity; never fan -> fan).
INSERT INTO fan (handle, display_name) VALUES ('superfan', 'Super Fan');
INSERT INTO follow (fan_id, target_type, target_id)
SELECT f.id, 'club', c.id FROM fan f, club c WHERE f.handle='superfan' AND c.key='fc-beispiel';
