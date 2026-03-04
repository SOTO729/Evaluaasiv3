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
    # Use --set-env-vars to ADD/UPDATE env vars without overwriting existing ones
    # The YAML only handles image, resources, probes, and scale
    cat > /tmp/deploy-dev-patch.yaml <<YAML
properties:
  template:
    containers:
      - name: $BACKEND_APP
        image: $ACR/$BACKEND_IMAGE:$REV
        resources:
          cpu: 0.25
          memory: 0.5Gi
        probes:
          - type: Liveness
            httpGet:
              path: /api/health
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 30
            failureThreshold: 3
            timeoutSeconds: 10
          - type: Startup
            httpGet:
              path: /api/health
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 10
            timeoutSeconds: 5
    scale:
      minReplicas: 1
      maxReplicas: 1
YAML
    az containerapp update \
        --name "$BACKEND_APP" \
        --resource-group "$RG" \
        --yaml /tmp/deploy-dev-patch.yaml \
        --set-env-vars \
            "GUNICORN_WORKERS=1" \
            "GUNICORN_TIMEOUT=120" \
        --output none
    rm -f /tmp/deploy-dev-patch.yaml
    
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
log "  Frontend: https://dev.evaluaasi.com"
log "  Login:    admin / Admin123!"
