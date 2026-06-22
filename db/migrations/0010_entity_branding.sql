-- 0010_entity_branding.sql
-- Generic, owner-controlled branding for non-person entities (club/team/
-- association), mirroring the athlete's identity levers. Same idea: crest/avatar,
-- banner, tagline, and out-pointing social links — chosen by the entity's admins.
CREATE TYPE branding_entity AS ENUM ('club', 'team', 'association');
CREATE TABLE entity_branding (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type branding_entity NOT NULL,
  entity_id   uuid NOT NULL,
  tagline     text,
  avatar_url  text,   -- crest/badge
  banner_url  text,
  links       jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (entity_type, entity_id)
);
