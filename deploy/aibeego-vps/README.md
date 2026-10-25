# aibeego.com VPS Docker overlay

Canonical copies of files under `/opt/marketingaz` that are **not** in the monorepo root by default.

## Sync to VPS runtime

```bash
REPO=/var/www/marketingaut_usr/data/www/marketingautoaz.com
rsync -a "$REPO/deploy/aibeego-vps/docker/web-start.sh" /opt/marketingaz/docker/web-start.sh
rsync -a "$REPO/deploy/aibeego-vps/docker/web-api-proxy.js" /opt/marketingaz/docker/web-api-proxy.js
rsync -a "$REPO/deploy/aibeego-vps/docker-compose.vps.yml" /opt/marketingaz/docker-compose.vps.yml
chmod +x /opt/marketingaz/docker/web-start.sh
```

After sync, recreate **web** only if entrypoint/volumes changed (not required for `web-start.sh` content-only edits — remount needs recreate).

## Web bundle (`tmp/aibeego-next`)

Build on host:

```bash
cd "$REPO"
SKIP_PM2_WEB_RELOAD=1 NEXT_DIST_DIR=tmp/aibeego-next pnpm --filter @marketingspa/web build
```

Promote to running container (does **not** survive `docker compose up --force-recreate` unless a bind mount is added):

```bash
docker cp "$REPO/apps/web/tmp/aibeego-next" marketingspa-web:/app/apps/web/tmp/aibeego-next
docker exec -u root marketingspa-web chown -R nextjs:nodejs /app/apps/web/tmp/aibeego-next
docker restart marketingspa-web
```

Rollback bundle path on host: `apps/web/tmp/aibeego-next` + manifest in `data/backups/` (see `ROLLBACK-WEB.md` in aibeego backups).
