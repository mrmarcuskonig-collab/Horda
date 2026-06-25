-- Single statement only (see 0021). Adds the premium tier's post visibility.
ALTER TYPE post_visibility ADD VALUE IF NOT EXISTS 'clubhouse';
