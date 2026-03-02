#!/usr/bin/env bash
# =============================================================================
# deploy-dev.sh  –  Deploy backend + frontend to DEVELOPMENT environment
# =============================================================================
# Usage:
#   ./scripts/deploy-dev.sh              # Deploy both
#   ./scripts/deploy-dev.sh backend      # Deploy backend only
#   ./scripts/deploy-dev.sh frontend     # Deploy frontend only
# =============================================================================
set -euo pipefail

# ---- Configuration ----
ACR="evaluaasimotorv2acr.azurecr.io"
RG="evaluaasi-motorv2-rg"

# Backend
BACKEND_IMAGE="motorv2-api"
BACKEND_APP="evaluaasi-motorv2-api-dev"

# Frontend
SWA_NAME="evaluaasi-motorv2-frontend-dev"
SWA_TOKEN="48095856cbbc3ce22b369395053701d6beabc05fb3b154f1040b2411de45c9fb01-678b9cba-bd31-4f93-a4a4-e13b8c127405010082401755e210"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="${1:-all}"

# ---- Helpers ----
log()  { echo -e "\033[1;34m[DEV]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[DEV] ✅ $*\033[0m"; }
fail() { echo -e "\033[1;31m[DEV] ❌ $*\033[0m"; exit 1; }

# ---- Generate a revision tag ----
REV="dev-$(date +%Y%m%d-%H%M%S)"

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
    log "Building frontend (dev)..."
    cd "$ROOT_DIR/frontend"
    
    # Build with dev env
    cp .env.dev .env.production.local   # Vite uses .env.production.local in build
    npm run build
    rm -f .env.production.local
    
    # Copy dev SWA config
    cp staticwebapp.config.dev.json dist/staticwebapp.config.json
    
    log "Deploying to Static Web App: $SWA_NAME"
    npx --yes @azure/static-web-apps-cli deploy dist \
        --deployment-token "$SWA_TOKEN" \
        --env production
    
    ok "Frontend deployed to dev SWA"
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
log "DEV URLs:"
log "  API:      https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
log "  Frontend: https://orange-sky-01755e210.1.azurestaticapps.net"
log "  Login:    admin / Admin123!"
