# Despliegue en Azure - Evaluaasi Motor Universal V2

## 📋 Resumen

Esta guía detalla el proceso de despliegue de la aplicación en Microsoft Azure.

## 🏗️ Arquitectura de Despliegue

```
┌─────────────────────────────────────────────┐
│         Azure Front Door (CDN)              │
│         + Web Application Firewall          │
└─────────────────┬───────────────────────────┘
                  │
      ┌───────────┴──────────┐
      │                      │
┌─────▼──────┐      ┌───────▼────────┐
│  Frontend  │      │    Backend     │
│ Static Web │      │   App Service  │
│    App     │      │  (Linux P1v2)  │
└────────────┘      └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
      ┌───────▼──────┐ ┌───▼────┐ ┌─────▼──────┐
      │  PostgreSQL  │ │ Redis  │ │   Blob     │
      │  Serverless  │ │ Cache  │ │  Storage   │
      └──────────────┘ └────────┘ └────────────┘
```

## 💰 Costos Estimados (USD/mes)

| Servicio | SKU | Costo |
|----------|-----|-------|
| Azure App Service | P1v2 (Linux) | $78 |
| Azure Database PostgreSQL | Serverless (2vCores) | $40 |
| Azure Redis Cache | Basic C0 | $16 |
| Azure Blob Storage | Standard LRS | $5 |
| Static Web Apps | Free/Standard | $0-$9 |
| Azure Front Door | Standard | $35 |
| **TOTAL** | | **~$174/mes** |

## 🚀 Despliegue Backend (Flask API)

### 1. Crear App Service

```bash
# Variables
RESOURCE_GROUP="evaluaasi-rg"
LOCATION="eastus"
APP_SERVICE_PLAN="evaluaasi-plan"
WEBAPP_NAME="evaluaasi-api"

# Crear grupo de recursos
az group create --name $RESOURCE_GROUP --location $LOCATION

# Crear App Service Plan (Linux)
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --is-linux \
  --sku P1v2

# Crear Web App con Python 3.11
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $WEBAPP_NAME \
  --runtime "PYTHON|3.11"
```

### 2. Configurar PostgreSQL Serverless

```bash
# Variables
POSTGRES_SERVER="evaluaasi-db"
ADMIN_USER="evaluaasi_admin"
ADMIN_PASSWORD="YourSecurePassword123!"

# Crear servidor PostgreSQL Flexible Serverless
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_SERVER \
  --location $LOCATION \
  --admin-user $ADMIN_USER \
  --admin-password $ADMIN_PASSWORD \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 15 \
  --storage-size 32 \
  --public-access 0.0.0.0

# Crear base de datos
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $POSTGRES_SERVER \
  --database-name evaluaasi

# Permitir acceso desde Azure Services
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_SERVER \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 3. Configurar Redis Cache

```bash
REDIS_NAME="evaluaasi-redis"

az redis create \
  --resource-group $RESOURCE_GROUP \
  --name $REDIS_NAME \
  --location $LOCATION \
  --sku Basic \
  --vm-size c0

# Obtener connection string
az redis list-keys --resource-group $RESOURCE_GROUP --name $REDIS_NAME
```

### 4. Configurar Blob Storage

```bash
STORAGE_ACCOUNT="evaluaasistorage"

# Crear storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

# Crear container
az storage container create \
  --name evaluaasi-uploads \
  --account-name $STORAGE_ACCOUNT \
  --public-access off

# Obtener connection string
az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP
```

### 5. Configurar Variables de Entorno

```bash
# Construir DATABASE_URL
DATABASE_URL="postgresql://${ADMIN_USER}:${ADMIN_PASSWORD}@${POSTGRES_SERVER}.postgres.database.azure.com:5432/evaluaasi"

# Configurar variables en App Service
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $WEBAPP_NAME \
  --settings \
    FLASK_ENV="production" \
    DATABASE_URL="$DATABASE_URL" \
    REDIS_URL="redis://:REDIS_KEY@${REDIS_NAME}.redis.cache.windows.net:6380?ssl=True" \
    SECRET_KEY="$(openssl rand -base64 32)" \
    JWT_SECRET_KEY="$(openssl rand -base64 32)" \
    AZURE_STORAGE_ACCOUNT_NAME="$STORAGE_ACCOUNT" \
    AZURE_STORAGE_ACCOUNT_KEY="STORAGE_KEY" \
    AZURE_STORAGE_CONTAINER_NAME="evaluaasi-uploads"
```

### 6. Desplegar Código

#### Opción A: Despliegue desde Git (Recomendado)

```bash
# Configurar despliegue desde GitHub
az webapp deployment source config \
  --name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP \
  --repo-url https://github.com/YOUR_USERNAME/evaluaasi \
  --branch main \
  --manual-integration

# O configurar CI/CD con GitHub Actions
az webapp deployment github-actions add \
  --resource-group $RESOURCE_GROUP \
  --name $WEBAPP_NAME \
  --repo YOUR_USERNAME/evaluaasi \
  --branch main \
  --login-with-github
```

#### Opción B: Despliegue ZIP

```bash
cd backend
zip -r deploy.zip . -x "*.pyc" -x "__pycache__/*" -x "venv/*"

az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $WEBAPP_NAME \
  --src deploy.zip
```

### 7. Ejecutar Migraciones

```bash
# Conectarse por SSH
az webapp ssh --resource-group $RESOURCE_GROUP --name $WEBAPP_NAME

# Dentro del SSH
flask db upgrade
python seed.py  # Opcional: datos de prueba
```

## 🌐 Despliegue Frontend (React)

### Opción 1: Azure Static Web Apps (Recomendado)

```bash
STATIC_APP_NAME="evaluaasi-frontend"

# Crear Static Web App
az staticwebapp create \
  --name $STATIC_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --source https://github.com/YOUR_USERNAME/evaluaasi \
  --branch main \
  --app-location "/frontend" \
  --output-location "dist" \
  --login-with-github

# Configurar variable de entorno
az staticwebapp appsettings set \
  --name $STATIC_APP_NAME \
  --setting-names VITE_API_URL="https://${WEBAPP_NAME}.azurewebsites.net/api"
```

### Opción 2: Storage Account + CDN

```bash
# Build local
cd frontend
npm run build

# Upload a Blob Storage
az storage blob upload-batch \
  --source ./dist \
  --destination '$web' \
  --account-name $STORAGE_ACCOUNT

# Habilitar Static Website
az storage blob service-properties update \
  --account-name $STORAGE_ACCOUNT \
  --static-website \
  --index-document index.html \
  --404-document index.html

# Crear CDN
CDN_PROFILE="evaluaasi-cdn"
CDN_ENDPOINT="evaluaasi"

az cdn profile create \
  --resource-group $RESOURCE_GROUP \
  --name $CDN_PROFILE \
  --sku Standard_Microsoft

az cdn endpoint create \
  --resource-group $RESOURCE_GROUP \
  --profile-name $CDN_PROFILE \
  --name $CDN_ENDPOINT \
  --origin $STORAGE_ACCOUNT.z13.web.core.windows.net \
  --origin-host-header $STORAGE_ACCOUNT.z13.web.core.windows.net
```

## 🔒 Seguridad

### 1. Habilitar HTTPS

```bash
# Para App Service (automático)
az webapp update \
  --resource-group $RESOURCE_GROUP \
  --name $WEBAPP_NAME \
  --https-only true

# Para Static Web Apps (automático)
```

### 2. Configurar Custom Domain

```bash
# Para App Service
az webapp config hostname add \
  --webapp-name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP \
  --hostname api.tudominio.com

# Para Static Web Apps
az staticwebapp hostname set \
  --name $STATIC_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --hostname tudominio.com
```

### 3. Configurar Azure Key Vault

```bash
KEYVAULT_NAME="evaluaasi-kv"

# Crear Key Vault
az keyvault create \
  --name $KEYVAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Agregar secrets
az keyvault secret set --vault-name $KEYVAULT_NAME --name "SECRET-KEY" --value "your-secret"
az keyvault secret set --vault-name $KEYVAULT_NAME --name "JWT-SECRET-KEY" --value "your-jwt-secret"
az keyvault secret set --vault-name $KEYVAULT_NAME --name "DATABASE-URL" --value "$DATABASE_URL"

# Dar permisos a App Service
WEBAPP_IDENTITY=$(az webapp identity assign \
  --resource-group $RESOURCE_GROUP \
  --name $WEBAPP_NAME \
  --query principalId -o tsv)

az keyvault set-policy \
  --name $KEYVAULT_NAME \
  --object-id $WEBAPP_IDENTITY \
  --secret-permissions get list

# Referenciar en App Settings
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $WEBAPP_NAME \
  --settings \
    SECRET_KEY="@Microsoft.KeyVault(SecretUri=https://${KEYVAULT_NAME}.vault.azure.net/secrets/SECRET-KEY/)" \
    JWT_SECRET_KEY="@Microsoft.KeyVault(SecretUri=https://${KEYVAULT_NAME}.vault.azure.net/secrets/JWT-SECRET-KEY/)"
```

## 📊 Monitoreo

### 1. Application Insights

```bash
APPINSIGHTS_NAME="evaluaasi-insights"

# Crear Application Insights
az monitor app-insights component create \
  --app $APPINSIGHTS_NAME \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP

# Obtener Instrumentation Key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app $APPINSIGHTS_NAME \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey -o tsv)

# Configurar en App Service
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $WEBAPP_NAME \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY="$INSTRUMENTATION_KEY"
```

### 2. Configurar Alertas

```bash
# Alerta por alta latencia
az monitor metrics alert create \
  --name "High Response Time" \
  --resource-group $RESOURCE_GROUP \
  --scopes /subscriptions/SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$WEBAPP_NAME \
  --condition "avg http_response_time > 1000" \
  --window-size 5m \
  --evaluation-frequency 1m

# Alerta por errores
az monitor metrics alert create \
  --name "High Error Rate" \
  --resource-group $RESOURCE_GROUP \
  --scopes /subscriptions/SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$WEBAPP_NAME \
  --condition "avg http_server_errors > 10" \
  --window-size 5m \
  --evaluation-frequency 1m
```

## 🔄 CI/CD con GitHub Actions

### Backend Workflow (.github/workflows/backend.yml)

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      
      - name: Run tests
        run: |
          cd backend
          pytest
      
      - name: Deploy to Azure
        uses: azure/webapps-deploy@v2
        with:
          app-name: ${{ secrets.AZURE_WEBAPP_NAME }}
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: ./backend
```

### Frontend Workflow (.github/workflows/frontend.yml)

```yaml
name: Deploy Frontend

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install and Build
        run: |
          cd frontend
          npm ci
          npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
      
      - name: Deploy to Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/frontend"
          output_location: "dist"
```

## 🧪 Ambiente de Staging

```bash
# Crear slot de staging para App Service
az webapp deployment slot create \
  --name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP \
  --slot staging

# Desplegar a staging
az webapp deployment source config \
  --name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP \
  --slot staging \
  --repo-url https://github.com/YOUR_USERNAME/evaluaasi \
  --branch develop

# Swap staging -> production
az webapp deployment slot swap \
  --resource-group $RESOURCE_GROUP \
  --name $WEBAPP_NAME \
  --slot staging \
  --target-slot production
```

## 📝 Checklist de Despliegue

- [ ] Crear recursos de Azure (App Service, PostgreSQL, Redis, Storage)
- [ ] Configurar variables de entorno en App Service
- [ ] Configurar Key Vault para secrets sensibles
- [ ] Ejecutar migraciones de base de datos
- [ ] Cargar datos iniciales (si aplica)
- [ ] Desplegar backend a App Service
- [ ] Desplegar frontend a Static Web Apps
- [ ] Configurar dominios personalizados
- [ ] Habilitar HTTPS
- [ ] Configurar Application Insights
- [ ] Configurar alertas de monitoreo
- [ ] Configurar CI/CD con GitHub Actions
- [ ] Crear slot de staging
- [ ] Probar funcionalidad end-to-end
- [ ] Configurar backup de base de datos

## 🆘 Troubleshooting

### Error: "Application Error"
```bash
# Ver logs en tiempo real
az webapp log tail --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP

# Descargar logs
az webapp log download --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP
```

### Error: "Database connection failed"
```bash
# Verificar firewall rules
az postgres flexible-server firewall-rule list \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_SERVER

# Probar conexión
az postgres flexible-server connect \
  --name $POSTGRES_SERVER \
  --admin-user $ADMIN_USER \
  --admin-password $ADMIN_PASSWORD \
  --database-name evaluaasi
```

### Error: "CORS"
- Verificar configuración CORS en `backend/app/__init__.py`
- Asegurar que frontend URL esté en whitelist

## 📚 Recursos

- [Azure App Service Docs](https://docs.microsoft.com/azure/app-service/)
- [Azure Static Web Apps Docs](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure PostgreSQL Docs](https://docs.microsoft.com/azure/postgresql/)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure/)
