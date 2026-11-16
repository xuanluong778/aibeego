#!/usr/bin/env bash
# ==============================================================================
# Script: deploy-production.sh
# Muc dich: Tu dong hoa quy trinh deploy code moi tu GitHub len VPS Production
# He thong: Aibeego (https://aibeego.com)
# Stack: Next.js, Node.js (NestJS), Prisma, PostgreSQL, Redis, Docker Compose
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# 1. CAU HINH CO BAN (CONFIGURATION)
# ------------------------------------------------------------------------------
REPO_DIR="${REPO_DIR:-/var/www/marketingaut_usr/data/www/marketingautoaz.com}"
MIRROR_DIR="${MIRROR_DIR:-/var/www/aibeego_com_usr/data/www/aibeego.com}"
DOCKER_DIR="${DOCKER_DIR:-/opt/marketingaz}"
GIT_REMOTE_URL="${GIT_REMOTE_URL:-git@github.com:xuanluong778/dev.aibeego.git}"
GIT_REMOTE_NAME="${GIT_REMOTE_NAME:-dev-aibeego}"
GIT_BRANCH="${GIT_BRANCH:-main}"

COMPOSE_PROJECT="marketingaz"
COMPOSE_FILE_BASE="${DOCKER_DIR}/docker-compose.yml"
COMPOSE_FILE_VPS="${DOCKER_DIR}/docker-compose.vps.yml"
ENV_FILE="${DOCKER_DIR}/.env"
BACKUP_DIR="${DOCKER_DIR}/backups"

INTERNAL_HEALTH_URL="http://127.0.0.1:3999/api/v1/health"
PUBLIC_DOMAIN_URL="https://aibeego.com"

TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
PREV_COMMIT=""
NEW_COMMIT=""
CURRENT_BACKUP_FILE=""

# Mau sac hien thi terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ------------------------------------------------------------------------------
# 2. HAM TIEN ICH (LOGGING & HELPERS)
# ------------------------------------------------------------------------------
log_info()    { echo -e "${BLUE}[INFO]${NC} $(date +'%H:%M:%S') - $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $(date +'%H:%M:%S') - $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $(date +'%H:%M:%S') - $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $(date +'%H:%M:%S') - $1" >&2; }

cmd_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Ham thuc thi docker compose chuan Production (Tuyet doi khong dung docker-compose.local.yml)
run_compose() {
  docker compose -p "${COMPOSE_PROJECT}" -f "${COMPOSE_FILE_BASE}" -f "${COMPOSE_FILE_VPS}" "$@"
}

# ------------------------------------------------------------------------------
# 3. HAM ROLLBACK KHI CO SU CO (AUTOMATED ROLLBACK)
# ------------------------------------------------------------------------------
rollback() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    echo ""
    log_error "=========================================================="
    log_error "TIEN TRINH DEPLOY GAP SU CO! BAT DAU QUY TRINH XU LY LOI"
    log_error "=========================================================="

    if [[ -n "${PREV_COMMIT}" ]]; then
      log_warn "1. Rollback ma nguon git ve commit cu: ${PREV_COMMIT}"
      cd "${REPO_DIR}"
      git checkout -f "${PREV_COMMIT}" || true
      if [[ -d "${MIRROR_DIR}" ]]; then
        rsync -a --exclude 'node_modules' --exclude '.next' --exclude 'tmp' "${REPO_DIR}/" "${MIRROR_DIR}/" || true
      fi
    fi

    log_warn "2. Khoi phuc cac container truoc do..."
    cd "${DOCKER_DIR}"
    run_compose up -d --no-build api web nginx || true

    if [[ -n "${CURRENT_BACKUP_FILE}" && -f "${CURRENT_BACKUP_FILE}" ]]; then
      log_warn "3. Ban backup database da duoc luu tai:"
      log_warn "   ${CURRENT_BACKUP_FILE}"
      log_warn "   Neu can restore database ve trang thai truoc deploy, chay lenh:"
      log_warn "   docker exec -i marketingspa-postgres pg_restore -U marketingspa -d marketingspa --clean --if-exists < '${CURRENT_BACKUP_FILE}'"
    fi

    echo ""
    log_error "Deploy that bai. Kiem tra log chi tiet:"
    log_error "- API Log:    docker logs marketingspa-api --tail 50"
    log_error "- Web Log:    docker logs marketingspa-web --tail 50"
    log_error "- Nginx Log:  docker logs marketingspa-nginx --tail 50"
    log_error "=========================================================="
  fi
  exit $exit_code
}
trap rollback EXIT

# ------------------------------------------------------------------------------
# 4. BUOC 1: KIEM TRA TIEN DIEU KIEN (PRE-FLIGHT CHECKS)
# ------------------------------------------------------------------------------
echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}   QUY TRINH DEPLOY PRODUCTION CHO AIBEEGO (aibeego.com)       ${NC}"
echo -e "${CYAN}================================================================${NC}"
log_info "Kiem tra cac cong cu va file cau hinh can thiet..."

for tool in git docker curl rsync; do
  if ! cmd_exists "$tool"; then
    log_error "Thieu cong cu: $tool tren he thong. Vui long cai dat truoc."
    exit 1
  fi
done

if ! docker compose version >/dev/null 2>&1; then
  log_error "Docker Compose V2 chua duoc cai dat."
  exit 1
fi

if [[ ! -d "${REPO_DIR}" ]]; then
  log_error "Thu muc ma nguon REPO_DIR khong ton tai: ${REPO_DIR}"
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE_BASE}" || ! -f "${COMPOSE_FILE_VPS}" ]]; then
  log_error "Thieu file Docker Compose Production tai ${DOCKER_DIR}"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  log_error "Khong tim thay file ${ENV_FILE}. Khong the deploy vi thieu bien moi truong."
  exit 1
fi

log_success "Cau hinh Docker Production hop le."
log_info "Bao ve file .env: Khong ghi de file ${ENV_FILE}"

# ------------------------------------------------------------------------------
# 5. BUOC 2: BACKUP DATABASE TRUOC KHI CAP NHAT (DB BACKUP)
# ------------------------------------------------------------------------------
log_info "--- BUOC 1: BACKUP DATABASE TRUOC CAP NHAT ---"
mkdir -p "${BACKUP_DIR}"

# Kiem tra container PostgreSQL dang chay
if ! docker exec marketingspa-postgres pg_isready -U marketingspa >/dev/null 2>&1; then
  log_error "Container PostgreSQL (marketingspa-postgres) khong phan hoi."
  exit 1
fi

CURRENT_BACKUP_FILE="${BACKUP_DIR}/marketingspa_backup_${TIMESTAMP}.dump"
log_info "Dang tao ban dump tai: ${CURRENT_BACKUP_FILE} ..."

docker exec marketingspa-postgres pg_dump -U marketingspa -d marketingspa -F c -b > "${CURRENT_BACKUP_FILE}"

BACKUP_SIZE=$(stat -c%s "${CURRENT_BACKUP_FILE}" 2>/dev/null || stat -f%z "${CURRENT_BACKUP_FILE}" 2>/dev/null || echo 0)
if [[ "${BACKUP_SIZE}" -lt 100000 ]]; then
  log_error "File backup qua nho (${BACKUP_SIZE} bytes), co the qua trinh backup gap loi. Dung deploy."
  exit 1
fi
log_success "Backup database thanh cong (${BACKUP_SIZE} bytes): ${CURRENT_BACKUP_FILE}"

# ------------------------------------------------------------------------------
# 6. BUOC 3: CAP NHAT CODE MOI NHAT TU GITHUB
# ------------------------------------------------------------------------------
log_info "--- BUOC 2: PULL CODE MOI TU GITHUB (${GIT_REMOTE_URL} -> ${GIT_BRANCH}) ---"
cd "${REPO_DIR}"

PREV_COMMIT=$(git rev-parse HEAD)
log_info "Commit hien tai: ${PREV_COMMIT}"

# Cau hinh hoac cap nhat remote git
if ! git remote | grep -q "^${GIT_REMOTE_NAME}$"; then
  log_info "Them remote ${GIT_REMOTE_NAME}: ${GIT_REMOTE_URL}"
  git remote add "${GIT_REMOTE_NAME}" "${GIT_REMOTE_URL}"
else
  git remote set-url "${GIT_REMOTE_NAME}" "${GIT_REMOTE_URL}"
fi

log_info "Fetching commit moi tu ${GIT_REMOTE_NAME}/${GIT_BRANCH}..."
git fetch "${GIT_REMOTE_NAME}" "${GIT_BRANCH}"

REMOTE_COMMIT=$(git rev-parse "${GIT_REMOTE_NAME}/${GIT_BRANCH}")
log_info "Commit tren GitHub: ${REMOTE_COMMIT}"

# Kiem tra xem co code moi khong
FORCE_DEPLOY="${FORCE_DEPLOY:-0}"
if [[ "${PREV_COMMIT}" == "${REMOTE_COMMIT}" && "${FORCE_DEPLOY}" != "1" ]]; then
  log_warn "He thong da o commit moi nhat (${REMOTE_COMMIT})."
  log_info "De ep buoc build lai, chay: FORCE_DEPLOY=1 ./deploy-production.sh"
else
  log_info "Chuyen sang branch ${GIT_BRANCH} va cap nhat code..."
  git checkout -B "${GIT_BRANCH}" "${GIT_REMOTE_NAME}/${GIT_BRANCH}"
  git reset --hard "${GIT_REMOTE_NAME}/${GIT_BRANCH}"
  NEW_COMMIT=$(git rev-parse HEAD)
  log_success "Da cap nhat code thanh cong den commit: ${NEW_COMMIT}"
fi

# Dong bo sang thu muc mirror (neu co)
if [[ -d "${MIRROR_DIR}" ]]; then
  log_info "Dong bo code sang thu muc mirror: ${MIRROR_DIR}..."
  rsync -a --delete \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude 'tmp' \
    --exclude '.env' \
    --exclude '.env.production' \
    --exclude '.env.local' \
    --exclude 'backups' \
    --exclude 'uploads' \
    "${REPO_DIR}/" "${MIRROR_DIR}/" || log_warn "Dong bo mirror co canh bao, tiep tuc tien trinh deploy."
fi

# ------------------------------------------------------------------------------
# 7. BUOC 4: PRISMA MIGRATION (NEU CO THAY DOI SCHEMA)
# ------------------------------------------------------------------------------
log_info "--- BUOC 3: KIEM TRA VA CHAY PRISMA MIGRATIONS ---"
MIGRATION_CHANGED=0
if [[ -n "${PREV_COMMIT}" && -n "${NEW_COMMIT}" && "${PREV_COMMIT}" != "${NEW_COMMIT}" ]]; then
  if git diff --name-only "${PREV_COMMIT}" "${NEW_COMMIT}" | grep -q "^packages/database/prisma"; then
    MIGRATION_CHANGED=1
  fi
fi

if [[ "${MIGRATION_CHANGED}" -eq 1 || "${RUN_MIGRATION:-0}" == "1" ]]; then
  log_info "Phat hien thay doi trong schema Prisma. Tien hanh chay migrations..."
  
  # Chay migrate deploy an toan thong qua docker run tren network marketingaz_default
  DB_PASS=$(grep -E "^POSTGRES_PASSWORD=" "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  DB_USER=$(grep -E "^POSTGRES_USER=" "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "marketingspa")
  DB_NAME=$(grep -E "^POSTGRES_DB=" "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "marketingspa")

  docker run --rm \
    --network marketingaz_default \
    -v "${REPO_DIR}:/app" \
    -w /app \
    -e DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@postgres:5432/${DB_NAME}?schema=public" \
    node:20-alpine \
    sh -c "node node_modules/.bin/prisma migrate deploy --schema=packages/database/prisma/schema.prisma"
  
  log_success "Prisma migrations hoan tat."
else
  log_info "Khong co thay doi Prisma migration. Bo qua buoc migrate."
fi

# ------------------------------------------------------------------------------
# 8. BUOC 5: BUILD LAI DOCKER IMAGES (API, WEB, WORKER)
# ------------------------------------------------------------------------------
log_info "--- BUOC 4: BUILD DOCKER IMAGES CHO PRODUCTION ---"
cd "${DOCKER_DIR}"

log_info "Dang build image api, web..."
run_compose build --pull api web

# Build worker neu service worker ton tai trong compose
if run_compose config --services | grep -q "^worker$"; then
  log_info "Dang build image worker..."
  run_compose build worker || log_warn "Khong build duoc worker, tiep tuc voi api va web."
fi

log_success "Build Docker images hoan tat."

# ------------------------------------------------------------------------------
# 9. BUOC 6: RESTART CAC DICH VU UNG DUNG
# ------------------------------------------------------------------------------
log_info "--- BUOC 5: RESTART CAC APPLICATION SERVICES ---"
cd "${DOCKER_DIR}"

SERVICES_TO_UP="api web nginx"
if run_compose config --services | grep -q "^worker$"; then
  SERVICES_TO_UP="api web worker nginx"
fi

log_info "Khoi dong lai cac service: ${SERVICES_TO_UP}..."
run_compose up -d --remove-orphans ${SERVICES_TO_UP}

log_success "Cac container da duoc khoi dong."

# ------------------------------------------------------------------------------
# 10. BUOC 7: KIEM TRA HE THONG SAU DEPLOY (HEALTH CHECKS)
# ------------------------------------------------------------------------------
log_info "--- BUOC 6: KIEM TRA HE THONG SAU KHI DEPLOY ---"

# 10.1 Kiem tra Database
log_info "1. Kiem tra PostgreSQL container..."
if docker exec marketingspa-postgres pg_isready -U marketingspa >/dev/null 2>&1; then
  log_success "PostgreSQL dang hoat dong tot."
else
  log_error "PostgreSQL khong phan hoi!"
  exit 1
fi

# 10.2 Kiem tra Redis
log_info "2. Kiem tra Redis container..."
if docker exec marketingspa-redis redis-cli ping | grep -q "PONG"; then
  log_success "Redis dang hoat dong tot (PONG)."
else
  log_warn "Redis khong phan hoi PONG."
fi

# 10.3 Kiem tra API noi bo qua Nginx proxy
log_info "3. Kiem tra API Health Check tai ${INTERNAL_HEALTH_URL}..."
API_OK=0
for i in $(seq 1 30); do
  if curl -fsS "${INTERNAL_HEALTH_URL}" >/dev/null 2>&1; then
    API_OK=1
    break
  fi
  echo -n "."
  sleep 2
done
echo ""

if [[ "${API_OK}" -eq 1 ]]; then
  HEALTH_RESP=$(curl -fsS "${INTERNAL_HEALTH_URL}")
  log_success "API Health OK: ${HEALTH_RESP}"
else
  log_error "API khong phan hoi tai ${INTERNAL_HEALTH_URL} sau 60 giay."
  log_error "Kiem tra log: docker logs marketingspa-api --tail 30"
  exit 1
fi

# 10.4 Kiem tra Production Domain
log_info "4. Kiem tra domain chinh ${PUBLIC_DOMAIN_URL}..."
DOMAIN_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -I "${PUBLIC_DOMAIN_URL}" || echo "000")
if [[ "${DOMAIN_HTTP_CODE}" =~ ^(200|301|302)$ ]]; then
  log_success "Domain ${PUBLIC_DOMAIN_URL} tra ve HTTP code: ${DOMAIN_HTTP_CODE}"
else
  log_warn "Domain ${PUBLIC_DOMAIN_URL} tra ve HTTP code: ${DOMAIN_HTTP_CODE} (Kiem tra Host Nginx hoac SSL)"
fi

# ------------------------------------------------------------------------------
# 11. HOAN TAT & HIEN THI TRANG THAI
# ------------------------------------------------------------------------------
echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}       DEPLOY PRODUCTION THANH CONG! (${PUBLIC_DOMAIN_URL})    ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "Commit da deploy:   ${NEW_COMMIT:-$PREV_COMMIT}"
echo -e "Branch:             ${GIT_BRANCH} (${GIT_REMOTE_URL})"
echo -e "Ban backup DB:      ${CURRENT_BACKUP_FILE}"
echo -e "Trang thai dich vu:"
docker ps --filter "name=marketingspa" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Huy bo trap EXIT de khong bao loi khi script ket thuc thanh cong
trap - EXIT
exit 0
