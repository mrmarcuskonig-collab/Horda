-- 0056_source_tagging.sql — ADR-0002 ruling #2 (+ #3).
--
-- Tag every BEHAVIORAL FACT with the product that produced it, so a shared fan
-- graph across future products can attribute, scope, and consent per product
-- without re-attributing millions of untagged rows after the fact. Cheap now,
-- irrecoverable if skipped. Existing rows are, by definition, Horda's → default.
--
-- Facts, not state: claim (intent to attend), presence (proof of attendance —
-- the "Record"), follow (the identity/interest edge), event_share (attribution).
ALTER TABLE claim        ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'horda';
ALTER TABLE pass         ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'horda';
ALTER TABLE presence     ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'horda';
ALTER TABLE follow       ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'horda';
ALTER TABLE event_share  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'horda';

-- Indexed because per-product analytics/scoping will filter on it constantly.
CREATE INDEX IF NOT EXISTS claim_source_idx       ON claim (source);
CREATE INDEX IF NOT EXISTS presence_source_idx    ON presence (source);
CREATE INDEX IF NOT EXISTS follow_source_idx       ON follow (source);
CREATE INDEX IF NOT EXISTS event_share_source_idx ON event_share (source);

-- ADR-0002 ruling #3: consent becomes purpose/product-scoped. The rights model
-- (0044, always applied before this) is dormant pending legal, but a shared graph
-- across SEPARATE businesses is exactly what GDPR/DSGVO purpose-limitation governs —
-- data given for events is not automatically usable by another product. Make
-- purpose + product EXPRESSIBLE now (nullable; the legal design decides how they're
-- enforced).
ALTER TABLE rights_grant ADD COLUMN IF NOT EXISTS product text;
ALTER TABLE rights_grant ADD COLUMN IF NOT EXISTS purpose text;
