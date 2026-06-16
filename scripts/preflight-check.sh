#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
  local desc="$1" ok="$2"
  if [ "$ok" = "true" ]; then
    echo -e "  ${GREEN}✓${NC} $desc"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $desc"
    FAIL=$((FAIL + 1))
  fi
}

warn() {
  local desc="$1"
  echo -e "  ${YELLOW}⚠${NC} $desc"
  WARN=$((WARN + 1))
}

echo "═══ HMR Production Preflight Check ═══"
echo ""

# 1. Required env vars
echo "── Environment Variables ──"
check "NODE_ENV is set" "$([ -n "$NODE_ENV" ] && echo true || echo false)"
check "DATABASE_URL is set" "$([ -n "$DATABASE_URL" ] && echo true || echo false)"
check "JWT_SECRET is set" "$([ -n "$JWT_SECRET" ] && echo true || echo false)"
check "CREDENTIAL_ENCRYPTION_KEY is set" "$([ -n "$CREDENTIAL_ENCRYPTION_KEY" ] && echo true || echo false)"

# Check for insecure defaults
if [ "$JWT_SECRET" = "hmr-dev-secret-change-in-production" ]; then
  check "JWT_SECRET is not dev default" "false"
else
  check "JWT_SECRET is not dev default" "true"
fi

if [ "$CREDENTIAL_ENCRYPTION_KEY" = "hmr-dev-encryption-key-change-me!!" ]; then
  check "CREDENTIAL_ENCRYPTION_KEY is not dev default" "false"
else
  check "CREDENTIAL_ENCRYPTION_KEY is not dev default" "true"
fi

echo ""

# 2. Database connectivity
echo "── Database ──"
if [ -n "$DATABASE_URL" ]; then
  if command -v pg_isready &>/dev/null; then
    DB_HOST=$(echo "$DATABASE_URL" | sed -E 's/.*@([^:\/]+).*/\1/')
    DB_PORT=$(echo "$DATABASE_URL" | sed -E 's/.*:([0-9]+)\/.*/\1/')
    if pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -q 2>/dev/null; then
      check "PostgreSQL reachable at $DB_HOST:${DB_PORT:-5432}" "true"
    else
      check "PostgreSQL reachable at $DB_HOST:${DB_PORT:-5432}" "false"
    fi
  else
    warn "pg_isready not available, skipping DB check"
  fi
else
  check "DATABASE_URL provided" "false"
fi

echo ""

# 3. Gateway URLs
echo "── Gateway Services ──"
for VAR in PLATFORM_BE_API_URL CLAWHUB_API_URL PORTAL_API_URL XSPACE_API_URL CLAW_FARM_API_URL LITELLM_BASE_URL; do
  VAL=$(eval echo "\$$VAR")
  if [ -n "$VAL" ]; then
    check "$VAR configured ($VAL)" "true"
  else
    warn "$VAR not configured (will use local data)"
  fi
done

echo ""

# 4. Auth config
echo "── Authentication ──"
check "AUTH_DEFAULT_PROVIDER is set" "$([ -n "$AUTH_DEFAULT_PROVIDER" ] && echo true || echo false)"
if [ "$AUTH_DEFAULT_PROVIDER" = "platform-be-proxy" ]; then
  check "PLATFORM_BE_API_URL set for platform-be-proxy mode" "$([ -n "$PLATFORM_BE_API_URL" ] && echo true || echo false)"
fi

echo ""
echo "═══ Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${WARN} warnings${NC} ═══"

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Preflight check FAILED — fix issues before deploying.${NC}"
  exit 1
fi

echo -e "${GREEN}Preflight check passed.${NC}"
