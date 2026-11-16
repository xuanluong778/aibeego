#!/usr/bin/env bash
# Reproducible isolated QA. Never sources production .env or changes DNS/nginx services.
set -euo pipefail
ulimit -c 0
cd "$(dirname "$0")/../.."
export DATABASE_URL='postgresql://platformqa:platformqa-local-only@127.0.0.1:15449/platformqa'
export NODE_OPTIONS='--max-old-space-size=1024'
qa_container='aibeego-platform-qa-pg'
if docker container inspect "$qa_container" >/dev/null 2>&1; then
  echo 'QA container already exists; inspect it before running. It will not be replaced.' >&2
  exit 1
fi
mkdir -p .platform-subdomain-qa
python3 scripts/platform-subdomain-qa/production-snapshot.py .platform-subdomain-qa/production-before.json
docker run -d --name "$qa_container" --memory 192m --cpus 0.5 \
  -e POSTGRES_USER=platformqa -e POSTGRES_PASSWORD=platformqa-local-only -e POSTGRES_DB=platformqa \
  -p 127.0.0.1:15449:5432 --tmpfs /var/lib/postgresql/data:rw,size=128m \
  postgres:16-alpine -c shared_buffers=16MB -c max_connections=12 >/dev/null
trap 'docker rm -f "$qa_container" >/dev/null' EXIT
for attempt in {1..40}; do
  if docker exec "$qa_container" pg_isready -U platformqa -d platformqa >/dev/null 2>&1; then break; fi
  sleep 0.25
done
pnpm --filter @marketingspa/database exec prisma generate
pnpm --filter @marketingspa/shared build
pnpm --filter @marketingspa/database build
pnpm --filter @marketingspa/database exec prisma db push --skip-generate
NODE_OPTIONS=--max-old-space-size=384 node scripts/platform-subdomain-qa/compile.cjs
NODE_OPTIONS=--max-old-space-size=384 pnpm --filter @marketingspa/api exec tsc --target ES2022 --module commonjs --moduleResolution node --strict --esModuleInterop --skipLibCheck --noUncheckedIndexedAccess --noEmit src/landing-pages/landing-page-platform-domain.ts
NODE_OPTIONS=--max-old-space-size=384 pnpm exec tsc -p scripts/platform-subdomain-qa/tsconfig.web.json
node scripts/test-landing-platform-subdomains.cjs | tee .platform-subdomain-qa/api-tests.log
node scripts/test-landing-platform-nginx.cjs | tee .platform-subdomain-qa/nginx-tests.log
node scripts/test-landing-platform-publish-ui.cjs | tee .platform-subdomain-qa/ui-tests.log
python3 scripts/platform-subdomain-qa/production-snapshot.py .platform-subdomain-qa/production-after.json --compare .platform-subdomain-qa/production-before.json
git diff --check
