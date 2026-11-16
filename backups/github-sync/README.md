# Database snapshot (dev / local sync)

**Cảnh báo:** File `.zip` chứa **toàn bộ dữ liệu PostgreSQL** (user, org, landing page, …). Chỉ dùng repo **private**. Không chia sẻ public.

## Khôi phục trên máy khác (Docker Postgres)

```bash
unzip -o marketingspa-sync-*.zip
docker cp marketingspa.dump marketingspa-postgres:/tmp/
docker exec marketingspa-postgres pg_restore -U marketingspa -d marketingspa --clean --if-exists -Fc /tmp/marketingspa.dump
```

Hoặc xem `DEPLOY-LOCAL-DOCKER.md` trong repo.

## Tạo lại snapshot

```bash
docker exec marketingspa-postgres pg_dump -U marketingspa -d marketingspa -Fc -f /tmp/marketingspa.dump
docker cp marketingspa-postgres:/tmp/marketingspa.dump ./backups/github-sync/
```