# Deploy plan (feature/rebrand-aibeego — DnD + Footer ID + autosave tx)

**Không áp dụng cho đến khi bạn duyệt.** Production hiện tại không đổi trong bước này.

## Artifacts

| Vai trò | Bundle / commit |
|---------|-----------------|
| Web release (sau build mới) | `deploy/aibeego-vps/bundles/` + `manifest.json` |
| Web rollback | `rollback-1b5032b-cb7dOatf6l-M` (BUILD_ID `cb7dOatf6l-MUfKOMGBfy`) |
| Web hiện prod | `release-973fd6e-nohCJ_P34fZa` (BUILD_ID `nohCJ_P34fZaEe_lVZjrp`) |
| API | Source `landing-pages.service.ts` (sanitize ngoài `$transaction`) — cần rebuild/restart `marketingspa-api` |

## Backup trước promote (không đụng DB)

```bash
REPO=/var/www/marketingaut_usr/data/www/marketingautoaz.com
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p /var/www/aibeego_com_usr/data/backups/web-promote-$STAMP
# Snapshot bundle đang chạy trong container
docker cp marketingspa-web:/app/apps/web/tmp/aibeego-next \
  /var/www/aibeego_com_usr/data/backups/web-promote-$STAMP/aibeego-next-live
docker exec marketingspa-web cat /app/apps/web/tmp/aibeego-next/BUILD_ID \
  > /var/www/aibeego_com_usr/data/backups/web-promote-$STAMP/BUILD_ID.txt
# Snapshot API dist nếu dùng image/build local
docker inspect marketingspa-api --format '{{.Image}} {{.Created}}' \
  > /var/www/aibeego_com_usr/data/backups/web-promote-$STAMP/api-image.txt
```

## Promote web (versioned bundle — không docker cp ad-hoc)

```bash
cd "$REPO"
node scripts/aibeego-web-bundle-archive.cjs --label release-dnd-fix
node scripts/aibeego-web-bundle-link-current.cjs --bundle <id-from-manifest>
# Copy symlink target vào container (hoặc bind mount sau khi bạn duyệt compose)
SRC="$REPO/deploy/aibeego-vps/bundles/current"
docker exec -u root marketingspa-web rm -rf /app/apps/web/tmp/aibeego-next
docker cp "$SRC/." marketingspa-web:/app/apps/web/tmp/aibeego-next
docker exec -u root marketingspa-web chown -R nextjs:nodejs /app/apps/web/tmp/aibeego-next
docker restart marketingspa-web
# Chờ health
curl -sk -o /dev/null -w "%{http_code}\n" https://aibeego.com/login
```

## Promote API (autosave sanitize ngoài tx)

```bash
cd /opt/marketingaz
# Rebuild chỉ api từ source repo (đã có sanitizedIncoming)
docker compose -p marketingaz -f docker-compose.yml -f docker-compose.vps.yml build api
docker compose -p marketingaz -f docker-compose.yml -f docker-compose.vps.yml up -d --no-deps api
curl -sk https://aibeego.com/api/v1/health
```

## Rollback web

```bash
node scripts/aibeego-web-bundle-link-current.cjs --bundle rollback-1b5032b-cb7dOatf6l-M
# hoặc bundle backup trong web-promote-$STAMP
docker exec -u root marketingspa-web rm -rf /app/apps/web/tmp/aibeego-next
docker cp /var/www/aibeego_com_usr/data/backups/web-promote-$STAMP/aibeego-next-live/. \
  marketingspa-web:/app/apps/web/tmp/aibeego-next
docker exec -u root marketingspa-web chown -R nextjs:nodejs /app/apps/web/tmp/aibeego-next
docker restart marketingspa-web
```

## Rollback API

```bash
# Quay image tag trước promote (ghi trong api-image.txt) hoặc:
docker compose -p marketingaz -f docker-compose.yml -f docker-compose.vps.yml \
  up -d --no-deps --no-build api   # nếu giữ image cũ tagged
# Không restore DB — chỉ đổi binary API.
```

## Kiểm tra sau promote

```bash
LP_QA_SOURCE_PAGE_ID=... LP_QA_ALLOW_JWT_MINT=1 ... \
  node scripts/with-root-env.cjs node scripts/qa-landing-page-builder-post-deploy.cjs
node scripts/test-landing-page-add-components-dnd.cjs
```
