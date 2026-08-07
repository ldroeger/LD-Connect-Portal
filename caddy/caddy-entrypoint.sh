#!/bin/sh
set -e

# Verzeichnis anlegen
mkdir -p /app-data/caddy

# Standard-Caddyfile anlegen wenn noch nicht vorhanden
if [ ! -f /app-data/caddy/Caddyfile ]; then
  echo "Erstelle initiales Caddyfile..."
  cat > /app-data/caddy/Caddyfile << 'CADDYEOF'
{
    auto_https off
}

:80 {
    encode gzip
    request_body {
        max_size 200MB
    }
    reverse_proxy frontend:80
}
CADDYEOF
  echo "Caddyfile erstellt."
fi

# Caddy starten
exec caddy run --config /app-data/caddy/Caddyfile --adapter caddyfile --watch
