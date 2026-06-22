#!/usr/bin/env bash
# Apply all migrations in order, then seed. Usage: ./db/apply.sh <dbname>
set -euo pipefail
DB="${1:-horda}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in "$DIR"/migrations/*.sql; do
  echo "-> applying $(basename "$f")"
  psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "-> seeding trio"
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$DIR/seed/seed_trio.sql"
echo "done."
