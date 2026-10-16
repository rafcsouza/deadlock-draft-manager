#!/usr/bin/env bash
# Backup diário do banco (contas, histórico, vínculos). Roda pelo cron do servidor:
#   bash ~/app/deploy/backup.sh
# Guarda as últimas 14 cópias em ~/backups e, se existir ~/.config/tatinuanga/backup-url
# (link de upload do Object Storage da Oracle, só escrita), manda uma cópia para lá também.
set -euo pipefail

APP_DIR="$HOME/app"
LOCAL_DIR="$HOME/backups"
URL_FILE="$HOME/.config/tatinuanga/backup-url"
KEEP=14

mkdir -p "$LOCAL_DIR"
name="app-$(date -u +%Y-%m-%d-%H%M).db"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# VACUUM INTO gera uma cópia consistente sem parar o site.
cd "$APP_DIR"
node -e '
const { DatabaseSync } = require("node:sqlite")
new DatabaseSync("data/app.db").exec(`VACUUM INTO '\''${process.argv[1]}'\''`)
' "$tmp/$name" 2>/dev/null
gzip -9 "$tmp/$name"
cp "$tmp/$name.gz" "$LOCAL_DIR/"

# Mantém só as cópias locais mais recentes.
ls -1t "$LOCAL_DIR"/app-*.db.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f

if [ -f "$URL_FILE" ]; then
  curl -fsS -X PUT --data-binary "@$tmp/$name.gz" "$(cat "$URL_FILE")$name.gz"
  echo "$(date -u +%FT%TZ) backup $name.gz enviado"
else
  echo "$(date -u +%FT%TZ) backup $name.gz só local (sem $URL_FILE)"
fi
