-- 0025: the remaining build-order surface — richer events, profile media,
-- sponsors, newsletter, handle reservations, and banner reposition/video.
-- All additive and idempotent so it replays cleanly on the live DB.

-- Events: online vs in-person, and simple recurrence. (cover_url already exists
-- and serves as the attached image.)
ALTER TABLE event ADD COLUMN IF NOT EXISTS location_kind  text NOT NULL DEFAULT 'in_person';  -- in_person | online | hybrid
ALTER TABLE event ADD COLUMN IF NOT EXISTS recurrence     text NOT NULL DEFAULT 'none';        -- none | weekly | monthly
ALTER TABLE event ADD COLUMN IF NOT EXISTS recurrence_until timestamptz;

-- Athlete banner: optional looping video + a stored focal point/zoom so a photo
-- can be repositioned instead of re-cropped. banner_pos is JSON {x,y,zoom}.
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS banner_video_url text;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS banner_pos       text;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS avatar_pos       text;

-- Native media grid (photos / videos / social embeds) per profile.
CREATE TABLE IF NOT EXISTS profile_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind  text NOT NULL,
  owner_id    uuid NOT NULL,
  kind        text NOT NULL DEFAULT 'image',   -- image | video | embed
  url         text NOT NULL,
  caption     text,
  ord         int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profile_media_owner_idx ON profile_media (owner_kind, owner_id, ord);

-- Sponsors a creator chooses to surface (logo + link). Brand-safe, creator-owned.
CREATE TABLE IF NOT EXISTS sponsor (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind  text NOT NULL,
  owner_id    uuid NOT NULL,
  name        text NOT NULL,
  url         text,
  logo_url    text,
  ord         int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sponsor_owner_idx ON sponsor (owner_kind, owner_id, ord);

-- Newsletter: fans opt in to a creator's updates (and a platform-wide list when
-- owner_kind = 'furia'). Send is handled by the existing email adapter.
CREATE TABLE IF NOT EXISTS newsletter_subscriber (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind  text NOT NULL,
  owner_id    text NOT NULL,
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_kind, owner_id, email)
);

-- Handle-claim vitality campaign: let people reserve their @handle before they
-- finish building, so the land-grab itself drives signups.
CREATE TABLE IF NOT EXISTS handle_reservation (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle      text NOT NULL UNIQUE,
  email       text NOT NULL,
  kind        text,                            -- athlete | club | other
  created_at  timestamptz NOT NULL DEFAULT now()
);
