-- Single statement only: ALTER TYPE ... ADD VALUE cannot run inside a
-- multi-statement transaction, so it lives alone (auto-committed) and is
-- idempotent via IF NOT EXISTS. Pairs with 0017's tier levels.
ALTER TYPE post_visibility ADD VALUE IF NOT EXISTS 'supporter';
