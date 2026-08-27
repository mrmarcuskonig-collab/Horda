-- 0060_rebrand_source.sql — Horda → Furia rebrand, data side.
--
-- The provenance tag (ADR-0002 §2.4) recorded which product observed each fact.
-- Under the old name that value was 'horda'; the product is now 'furia'. This
-- migration flips the column DEFAULTs and backfills every existing row so the
-- public source-tag is consistent after the rename. Forward-only, idempotent.
ALTER TABLE claim        ALTER COLUMN source SET DEFAULT 'furia';
ALTER TABLE pass         ALTER COLUMN source SET DEFAULT 'furia';
ALTER TABLE presence     ALTER COLUMN source SET DEFAULT 'furia';
ALTER TABLE follow       ALTER COLUMN source SET DEFAULT 'furia';
ALTER TABLE event_share  ALTER COLUMN source SET DEFAULT 'furia';
ALTER TABLE verdict      ALTER COLUMN source SET DEFAULT 'furia';

UPDATE claim        SET source = 'furia' WHERE source = 'horda';
UPDATE pass         SET source = 'furia' WHERE source = 'horda';
UPDATE presence     SET source = 'furia' WHERE source = 'horda';
UPDATE follow       SET source = 'furia' WHERE source = 'horda';
UPDATE event_share  SET source = 'furia' WHERE source = 'horda';
UPDATE verdict      SET source = 'furia' WHERE source = 'horda';
