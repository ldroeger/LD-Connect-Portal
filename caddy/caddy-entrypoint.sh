#!/bin/sh
set -e

mkdir -p /app-data/caddy

if [ ! -f /app-data/caddy/Caddyfile ]; then
  echo "Erstelle initiales Caddyfile..."
  printf '%s\n' '{' '    auto_https off' '}' '' ':80 {' '    encode gzip' '    request_body {' '        max_size 200MB' '    }' '    reverse_proxy frontend:80' '}' > /app-data/caddy/Caddyfile
  echo "Caddyfile erstellt."
fi

exec caddy run --config /app-data/caddy/Caddyfile --adapter caddyfile --watch
