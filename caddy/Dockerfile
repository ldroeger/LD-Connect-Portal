FROM caddy:2-alpine

# Script das beim Start das Caddyfile anlegt falls nicht vorhanden
COPY caddy-entrypoint.sh /caddy-entrypoint.sh
RUN chmod +x /caddy-entrypoint.sh

ENTRYPOINT ["/caddy-entrypoint.sh"]
