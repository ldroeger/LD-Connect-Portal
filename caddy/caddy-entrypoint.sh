#!/bin/sh
set -e

mkdir -p /app-data/caddy

# Caddyfile immer neu schreiben (stellt korrekte Formatierung sicher)
printf '{\n    auto_https off\n}\n\n:80 {\n    encode gzip\n    request_body {\n        max_size 200MB\n    }\n    reverse_proxy frontend:80\n}\n' > /app-data/caddy/Caddyfile.default

# Nur überschreiben wenn es das Default-File oder leer/fehlerhaft ist
# Nutze Default wenn kein eigenes Caddyfile vorhanden
if [ ! -f /app-data/caddy/Caddyfile ] || grep -q 'max_size 200MB }' /app-data/caddy/Caddyfile; then
  echo "Erstelle/korrigiere Caddyfile..."
  cp /app-data/caddy/Caddyfile.default /app-data/caddy/Caddyfile
  echo "Caddyfile erstellt."
fi

exec caddy run --config /app-data/caddy/Caddyfile --adapter caddyfile --watch
