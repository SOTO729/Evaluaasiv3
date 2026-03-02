#!/usr/bin/env bash
# =============================================================================
# deploy-prod.sh  –  Deploy backend + frontend to PRODUCTION environment
# =============================================================================
# Usage:
#   ./scripts/deploy-prod.sh              # Deploy both
#   ./scripts/deploy-prod.sh backend      # Deploy backend only
#   ./scripts/deploy-prod.sh frontend     # Deploy frontend only
# =============================================================================
set -euo pipefail

# ---- Configuration ----
ACR="evaluaasimotorv2acr.azurecr.io"
RG="evaluaasi-motorv2-rg"

# Backend
BACKEND_IMAGE="motorv2-api"
BACKEND_APP="evaluaasi-motorv2-api"

# Frontend
SWA_NAME="evaluaasi-motorv2-frontend"
SWA_TOKEN="33c2e6e0d0322fad0add224319545ce1dfa963782d21e37986e4079985b7c84006-c720933c-1760-4077-a094-2434c3620a6a010271907fbe5410"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="${1:-all}"

# ---- Helpers ----
log()  { echo -e "\033[1;35m[PROD]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[PROD] ✅ $*\033[0m"; }
fail() { echo -e "\033[1;31m[PROD] ❌ $*\033[0m"; exit 1; }
warn() { echo -e "\033[1;33m[PROD] ⚠️  $*\033[0m"; }

# ---- Confirmation ----
warn "You are about to deploy to PRODUCTION"
read -p "Continue? (y/N) " -n 1 -r
echo
[[ $REPLY =~ ^[Yy]$ ]] || { log "Aborted."; exit 0; }

# ---- Generate a revision tag ----
REV="rev$(date +%s)"

# ---- Deploy backend ----
deploy_backend() {
    log "Building backend image: $ACR/$BACKEND_IMAGE:$REV"
    cd "$ROOT_DIR/backend"
    docker build -t "$ACR/$BACKEND_IMAGE:$REV" .
    
    log "Pushing image to ACR..."
    docker push "$ACR/$BACKEND_IMAGE:$REV"
    
    log "Updating Container App: $BACKEND_APP"
    az containerapp update \
        --name "$BACKEND_APP" \
        --resource-group "$RG" \
        --image "$ACR/$BACKEND_IMAGE:$REV" \
        --output none
    
    ok "Backend deployed ($REV)"
}

# ---- Deploy frontend ----
deploy_frontend() {
    log "Building frontend (production)..."
    cd "$ROOT_DIR/frontend"
    
    # Build uses .env.production by default
    npm run build
    
    log "Deploying to Static Web App: $SWA_NAME"
    npx --yes @azure/static-web-apps-cli deploy dist \
        --deployment-token "$SWA_TOKEN" \
        --env production
    
    ok "Frontend deployed to production SWA"
}

# ---- Main ----
case "$TARGET" in
    backend)
        deploy_backend
        ;;
    frontend)
        deploy_frontend
        ;;
    all)
        deploy_backend
        deploy_frontend
        ;;
    *)
        fail "Unknown target: $TARGET (use: backend, frontend, or all)"
        ;;
esac

echo ""
log "PROD URLs:"
log "  API:      https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
log "  Frontend: https://thankful-stone-07fbe5410.6.azurestaticapps.net"
