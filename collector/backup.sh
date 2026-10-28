#!/usr/bin/env bash
# Local whole-DB snapshot (optional). Since 2026-10-28 every table is archived day by day to R2 (marginpad-market,
# v1/<dataset>/<day>.csv.gz) by the worker's archiveMarket cron - that archive is the system of record, not this file.
# Raw events are pruned after 14 days, aggregates after 90 (collector/config.js).
# Run from cron, e.g.:  0 4 * * *  cd /srv/collector && ./backup.sh >> logs/backup.log 2>&1
set -euo pipefail

STAMP=$(date -u +%Y%m%d-%H%M%S)
DB="${SQLITE_PATH:-./data/liquidations.db}"
OUT="${BACKUP_DIR:-./backups}"
mkdir -p "$OUT"

# Consistent snapshot even while the collector writes (WAL mode). Needs the sqlite3 CLI installed.
sqlite3 "$DB" ".backup '$OUT/liquidations-$STAMP.db'"
gzip -f "$OUT/liquidations-$STAMP.db"

# keep the last 14 local snapshots
ls -1t "$OUT"/liquidations-*.db.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "backup written: $OUT/liquidations-$STAMP.db.gz"

# RECOMMENDED off-site copy (cents/month). Configure an rclone remote named 'r2' for Cloudflare R2:
#   rclone copy "$OUT/liquidations-$STAMP.db.gz" r2:marginpad-backups/
# (When you move to Postgres, replace the snapshot block above with:  pg_dump "$DATABASE_URL" | gzip > "$OUT/db-$STAMP.sql.gz" )
