#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# deploy.sh — Deploy de Evaluaasi MotorV2
# Uso:
#   ./scripts/deploy.sh dev        → Deploy a staging (desarrollo)
#   ./scripts/deploy.sh prod       → Deploy a producción
#   ./scripts/deploy.sh prod api   → Solo deploy backend
#   ./scripts/deploy.sh prod web   → Solo deploy frontend
# ═══════════════════════════════════════════════════════════════
set -e

# ─── Colores ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── Configuración ───────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"

ACR_NAME="evaluaasimotorv2acr"
ACR_IMAGE="motorv2-api"
CONTAINER_APP_NAME="evaluaasi-motorv2-api"
RESOURCE_GROUP="evaluaasi-motorv2-rg"

SWA_TOKEN="33c2e6e0d0322fad0add224319545ce1dfa963782d21e37986e4079985b7c84006-c720933c-1760-4077-a094-2434c3620a6a010271907fbe5410"

# ─── Argumentos ──────────────────────────────────────────────
ENV="${1:-dev}"
TARGET="${2:-all}"  # all | api | web

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
    echo -e "${RED}❌ Uso: $0 [dev|prod] [all|api|web]${NC}"
    exit 1
fi

# ─── Verificar branch ───────────────────────────────────────
CURRENT_BRANCH=$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)

if [[ "$ENV" == "prod" && "$CURRENT_BRANCH" != "main" ]]; then
    echo -e "${RED}❌ Para deploy a producción debes estar en branch 'main'${NC}"
    echo -e "${YELLOW}   Estás en: $CURRENT_BRANCH${NC}"
    echo -e "${YELLOW}   Ejecuta: git checkout main && git merge develop${NC}"
    exit 1
fi

if [[ "$ENV" == "dev" && "$CURRENT_BRANCH" != "develop" ]]; then
    echo -e "${YELLOW}⚠️  No estás en branch 'develop' (estás en: $CURRENT_BRANCH)${NC}"
    read -p "   ¿Continuar de todas formas? (s/N): " confirm
    if [[ "$confirm" != "s" && "$confirm" != "S" ]]; then
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
if [[ "$ENV" == "prod" ]]; then
    echo -e "${RED}  🚀 DEPLOY A PRODUCCIÓN${NC}"
else
    echo -e "${GREEN}  🔧 DEPLOY A DESARROLLO (staging)${NC}"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "  Branch:  $CURRENT_BRANCH"
echo -e "  Target:  $TARGET"
echo ""

# ─── Confirmar producción ────────────────────────────────────
if [[ "$ENV" == "prod" ]]; then
    read -p "  ¿Confirmar deploy a PRODUCCIÓN? (escribe 'si'): " confirm
    if [[ "$confirm" != "si" ]]; then
        echo -e "${YELLOW}Cancelado.${NC}"
        exit 0
    fi
fi

# ─── Backend (API) ───────────────────────────────────────────
if [[ "$TARGET" == "all" || "$TARGET" == "api" ]]; then
    echo ""
    echo -e "${BLUE}📦 Construyendo backend...${NC}"
    
    if [[ "$ENV" == "prod" ]]; then
        # Obtener siguiente número de revisión
        LATEST_TAG=$(az acr repository show-tags --name "$ACR_NAME" --repository "$ACR_IMAGE" --orderby time_desc --top 1 -o tsv 2>/dev/null || echo "rev0")
        if [[ "$LATEST_TAG" == rev* ]]; then
            CURRENT_REV=${LATEST_TAG#rev}
            NEXT_REV=$((CURRENT_REV + 1))
        else
            NEXT_REV=1
        fi
        TAG="rev${NEXT_REV}"
        
        echo -e "${GREEN}  Tag: $ACR_IMAGE:$TAG${NC}"
        az acr build --registry "$ACR_NAME" \
            --image "$ACR_IMAGE:$TAG" \
            --image "$ACR_IMAGE:latest" \
            "$BACKEND_DIR" 2>&1 | tail -3
        
        echo -e "${BLUE}🚀 Desplegando backend rev${NEXT_REV}...${NC}"
        az containerapp update \
            --name "$CONTAINER_APP_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --image "${ACR_NAME}.azurecr.io/${ACR_IMAGE}:${TAG}" \
            2>&1 | tail -1
        
        echo -e "${GREEN}✅ Backend desplegado: $ACR_IMAGE:$TAG${NC}"
    else
        # Dev: build con tag dev-latest
        echo -e "${YELLOW}  Tag: $ACR_IMAGE:dev-latest${NC}"
        az acr build --registry "$ACR_NAME" \
            --image "$ACR_IMAGE:dev-latest" \
            "$BACKEND_DIR" 2>&1 | tail -3
        
        echo -e "${GREEN}✅ Backend construido: $ACR_IMAGE:dev-latest${NC}"
        echo -e "${YELLOW}  ℹ️  En dev, el backend NO se despliega automáticamente${NC}"
        echo -e "${YELLOW}     (usa el mismo backend de producción)${NC}"
    fi
fi

# ─── Frontend (Web) ──────────────────────────────────────────
if [[ "$TARGET" == "all" || "$TARGET" == "web" ]]; then
    echo ""
    echo -e "${BLUE}🔨 Construyendo frontend...${NC}"
    
    cd "$FRONTEND_DIR"
    
    if [[ "$ENV" == "prod" ]]; then
        # Build modo producción (usa .env.production)
        echo -e "  Modo: production"
        npm run build 2>&1 | tail -3
        
        echo -e "${BLUE}🚀 Desplegando frontend a producción...${NC}"
        npx @azure/static-web-apps-cli deploy dist \
            --deployment-token "$SWA_TOKEN" \
            --env production 2>&1 | tail -3
        
        echo -e "${GREEN}✅ Frontend desplegado a producción${NC}"
    else
        # Build modo development (usa .env.development → tiene VITE_APP_ENV=development)
        echo -e "  Modo: development (staging)"
        VITE_APP_ENV=development npm run build -- --mode development 2>&1 | tail -3
        
        echo -e "${BLUE}🚀 Desplegando frontend a staging...${NC}"
        npx @azure/static-web-apps-cli deploy dist \
            --deployment-token "$SWA_TOKEN" \
            --env preview 2>&1 | tail -3
        
        echo -e "${GREEN}✅ Frontend desplegado a staging (preview environment)${NC}"
    fi
    
    cd "$ROOT_DIR"
fi

# ─── Resumen ─────────────────────────────────────────────────
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Deploy completado${NC}"
if [[ "$ENV" == "prod" ]]; then
    echo -e "  🌐 https://app.evaluaasi.com"
else
    echo -e "  🔧 URL de staging aparecerá en Azure SWA"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
