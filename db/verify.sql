-- verify.sql — proves the schema holds and the non-negotiables are enforced.

\echo '== INVARIANT 2: result_participant != standing unit (the team-in-individual-sport case) =='
SELECT s.name AS sport, v.name AS variant,
       v.result_participant AS result_belongs_to,
       vs.unit AS standing_ranks,
       vs.engine
FROM variant_standing vs
JOIN variant v ON v.id = vs.variant_id
JOIN sport   s ON s.id = v.sport_id
WHERE vs.unit <> v.result_participant
ORDER BY s.name, v.name;
-- Expect: Boxing/Boxstall team and Triathlon/Bundesliga.

\echo ''
\echo '== Trio coverage: every variant with its standings =='
SELECT s.name AS sport, v.name AS variant, v.result_participant, v.shape,
       string_agg(vs.unit || '/' || vs.engine || '/' || vs.scope, ', ' ORDER BY vs.display_order) AS standings
FROM variant v
JOIN sport s ON s.id = v.sport_id
LEFT JOIN variant_standing vs ON vs.variant_id = v.id
GROUP BY s.name, v.name, v.result_participant, v.shape, v.display_order, s.display_order
ORDER BY s.display_order, v.display_order;

\echo ''
\echo '== Live graph: auto-accept trigger worked (open_join links are accepted) =='
SELECT kind, a_type, b_type, policy, state, (decided_at IS NOT NULL) AS decided
FROM relationship_link ORDER BY kind;

\echo ''
\echo '== Auto-attend: league member auto-enrolled into the fixture =='
SELECT e.name AS event, ep.participant_type, ep.source, ep.status
FROM event_participant ep JOIN event e ON e.id = ep.event_id;

\echo ''
\echo '== Club has many teams, club is sport-agnostic (sports derived from teams) =='
SELECT c.name AS club, count(t.id) AS teams,
       string_agg(DISTINCT sp.name, ', ') AS derived_sports
FROM club c LEFT JOIN team t ON t.club_id = c.id
LEFT JOIN sport sp ON sp.id = t.sport_id
GROUP BY c.name;

\echo ''
\echo '== Table count =='
SELECT count(*) AS tables FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
