-- 0001_enums.sql
-- Code-level enums. Adding a value here is the ONE thing that needs an engineer.
-- Everything else (sports, variants, categories, standings, templates) is editable data.

-- gen_random_uuid() is in PostgreSQL core since v13 — no extension needed.

-- ---- Spec §3.1 enums (the registry contract) -----------------------------
CREATE TYPE participant_unit    AS ENUM ('individual','team');
CREATE TYPE competition_shape   AS ENUM ('matchup','field');
CREATE TYPE standing_engine     AS ENUM ('points_table','win_loss_record','time_leaderboard','series_points','team_aggregate');
CREATE TYPE standing_scope      AS ENUM ('season','career','event','series');
CREATE TYPE category_kind       AS ENUM ('weight_class','age_group','distance','division','gender','custom');
CREATE TYPE result_field_type   AS ENUM ('integer','decimal','duration','enum','boolean','text');
CREATE TYPE field_scope         AS ENUM ('per_side','per_participant','shared');
CREATE TYPE entity_kind         AS ENUM ('athlete','institution');
CREATE TYPE result_outcome      AS ENUM ('win','loss','draw','finished','dnf','dns','no_contest');
CREATE TYPE template_owner      AS ENUM ('system','association','league','club');
CREATE TYPE template_visibility AS ENUM ('public','unlisted','private');
CREATE TYPE integration_status  AS ENUM ('requested','in_review','connected','declined');

-- ---- v0 machinery (spec §11 "still to spec" — VP Eng calls, see README) ---
CREATE TYPE entity_source       AS ENUM ('ingested','native');   -- provenance for seedable entities
CREATE TYPE claim_status        AS ENUM ('unclaimed','claimed'); -- claim-don't-create substrate
CREATE TYPE membership_policy   AS ENUM ('open_join','approval_required');
CREATE TYPE link_kind           AS ENUM ('roster_membership','league_assignment','matchup');
CREATE TYPE link_state          AS ENUM ('pending','accepted','rejected','withdrawn');
CREATE TYPE link_side_type      AS ENUM ('athlete','team','club','league');
CREATE TYPE follow_target_type  AS ENUM ('club','team','athlete');
CREATE TYPE participation_status AS ENUM ('selected','available','withdrawn','dns');
CREATE TYPE participation_source AS ENUM ('inherited','direct');
CREATE TYPE registration_mode   AS ENUM ('open','binding','qualification_gated','paid_entry');
CREATE TYPE spectator_access    AS ENUM ('free','paid_ticket');
CREATE TYPE rbac_role           AS ENUM ('owner','admin','editor','finance');
CREATE TYPE rbac_scope          AS ENUM ('club','team');
CREATE TYPE league_creator_type AS ENUM ('association','league');  -- only governing bodies mint leagues
