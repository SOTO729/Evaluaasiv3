# Despliegue en Azure — Evaluaasi Motor Universal V2

## 📋 Resumen

Esta guía describe la **infraestructura real** y el proceso de despliegue de la
plataforma en Microsoft Azure. El despliegue se realiza de forma **manual**
mediante los scripts de [`scripts/`](../scripts/) (no hay pipeline de CI/CD que
despliegue automáticamente; el único workflow de GitHub Actions existente es
`database-keepalive.yml`, que solo mantiene viva la base de datos).

> ⚠️ **Importante:** versiones anteriores de este documento describían una
> arquitectura basada en App Service + PostgreSQL + Front Door. Esa arquitectura
> **no es la que está en producción**. La infraestructura real usa **Azure
> Container Apps + Azure SQL (MSSQL) + Azure Static Web Apps**, como se detalla
> abajo.

---

## 🏗️ Arquitectura de Despliegue (real)

```
                    ┌──────────────────────────────┐
                    │   Azure Static Web Apps       │
                    │   (Frontend React/Vite)       │
                    │   app.evaluaasi.com (PROD)    │
                    │   dev.evaluaasi.com  (DEV)    │
                    └───────────────┬──────────────┘
                                    │ HTTPS (Axios + JWT)
                                    ▼
                    ┌──────────────────────────────┐
                    │   Azure Container Apps         │
                    │   (Backend Flask + Gunicorn)   │
                    │   evaluaasi-motorv2-api        │
                    │   evaluaasi-motorv2-api-dev    │
                    └───────────────┬──────────────┘
                                    │
       ┌───────────────┬───────────┼───────────────┬───────────────┐
       ▼               ▼           ▼               ▼               ▼
┌────────────┐ ┌────────────┐ ┌─────────┐ ┌──────────────┐ ┌──────────────┐
│ Azure SQL  │ │   Redis    │ │  Blob   │ │ Azure Comm.  │ │  Key Vault   │
│  (MSSQL)   │ │   Cache    │ │ Storage │ │ Svcs (email) │ │  (secrets)   │
└────────────┘ └────────────┘ └─────────┘ └──────────────┘ └──────────────┘

Imagen del backend almacenada en Azure Container Registry (ACR):
  evaluaasimotorv2acr.azurecr.io/motorv2-api
```

---

## 🧭 Recursos de Azure

| Recurso | Nombre |
|---------|--------|
| Resource Group | `evaluaasi-motorv2-rg` |
| Región | South Central US |
| Container Registry (ACR) | `evaluaasimotorv2acr.azurecr.io` |
| Imagen backend | `motorv2-api` |
| Container App (PROD) | `evaluaasi-motorv2-api` |
| Container App (DEV) | `evaluaasi-motorv2-api-dev` |
| SQL Server | `evaluaasi-motorv2-sql.database.windows.net` |
| Base de datos (PROD) | `evaluaasi` |
| Base de datos (DEV) | `evaluaasi_dev` |
| Static Web App (PROD) | `thankful-stone-07fbe5410` → `app.evaluaasi.com` |
| Static Web App (DEV) | `orange-sky-01755e210` → `dev.evaluaasi.com` |

### URLs

| Entorno | API | Frontend |
|---------|-----|----------|
| PROD | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api` | `https://app.evaluaasi.com` |
| DEV | `https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api` | `https://dev.evaluaasi.com` |

---

## ⚠️ Reglas críticas de despliegue

1. **La imagen Docker se llama `motorv2-api`** — nunca usar `evaluaasi-backend`
   ni `motorv2-backend`.
2. **Nunca usar `--yaml` en `az containerapp update`** — reemplaza la spec
   completa del contenedor y borra todas las variables de entorno. Usar
   `--image` + `--set-env-vars`.
3. **El frontend requiere builds separados** para DEV y PROD
   (`.env.dev` vs `.env.production`). Verificar la API URL "bakeada" antes de
   desplegar.
4. **Desplegar siempre a DEV primero**, probar, y luego a PROD.
5. **No commitear secretos.** Los deployment tokens de SWA, cadenas de conexión
   y contraseñas deben vivir en variables de entorno locales o en Key Vault, no
   en el repositorio. Ver sección de seguridad.

---

## 🚀 Despliegue con los scripts (método recomendado)

Los scripts automatizan build + push + update. Requieren `az` autenticado
(`az login`) y Docker en ejecución.

```bash
cd MotorUniversalV2

# --- DEV ---
./scripts/deploy-dev.sh             # backend + frontend
./scripts/deploy-dev.sh backend     # solo backend
./scripts/deploy-dev.sh frontend    # solo frontend

# --- PROD (pide confirmación interactiva) ---
./scripts/deploy-prod.sh            # backend + frontend
./scripts/deploy-prod.sh backend    # solo backend
./scripts/deploy-prod.sh frontend   # solo frontend
```

Cada ejecución genera un tag de revisión único (`dev-<fecha>` / `rev<epoch>`).

---

## 🐳 Despliegue Backend (Azure Container Apps)

### 1. Build y push de la imagen a ACR

```bash
cd MotorUniversalV2/backend

ACR="evaluaasimotorv2acr.azurecr.io"
REV="rev$(date +%s)"

# Autenticarse en ACR
az acr login --name evaluaasimotorv2acr

# Build (usar --no-cache cuando haya cambios de código)
docker build --no-cache -t "$ACR/motorv2-api:$REV" .

# Push
docker push "$ACR/motorv2-api:$REV"
```

> La imagen instala Chromium para Playwright (validación CURP/RENAPO), por lo
> que incluye dependencias del sistema adicionales (ver `backend/Dockerfile`).
> El contenedor arranca con Gunicorn en el puerto **8000**.

### 2. Actualizar el Container App

```bash
RG="evaluaasi-motorv2-rg"

# --- DEV ---
az containerapp update \
  --name evaluaasi-motorv2-api-dev \
  --resource-group "$RG" \
  --image "$ACR/motorv2-api:$REV" \
  --cpu 0.25 --memory 0.5Gi \
  --min-replicas 1 --max-replicas 1 \
  --set-env-vars "GUNICORN_WORKERS=1" "GUNICORN_TIMEOUT=120" "DEPLOY_VERSION=$REV" \
  --output none

# --- PROD (tras validar en DEV) ---
az containerapp update \
  --name evaluaasi-motorv2-api \
  --resource-group "$RG" \
  --image "$ACR/motorv2-api:$REV" \
  --cpu 0.5 --memory 1Gi \
  --min-replicas 1 --max-replicas 3 \
  --set-env-vars "GUNICORN_WORKERS=2" "GUNICORN_TIMEOUT=120" "DEPLOY_VERSION=$REV" \
  --output none
```

### 3. Variables de entorno del backend

Se configuran en el Container App (Azure Portal o `az containerapp update
--set-env-vars`). No deben estar en el repositorio. Principales:

| Variable | Descripción |
|----------|-------------|
| `FLASK_ENV` | `production` |
| `DATABASE_URL` | Cadena MSSQL (`mssql+pymssql://...`) |
| `SECRET_KEY` | Clave Flask (generar con `openssl rand -base64 32`) |
| `JWT_SECRET_KEY` | Clave JWT |
| `REDIS_URL` | Cadena de Redis |
| `CORS_ORIGINS` | Orígenes permitidos (separados por coma) |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob Storage |
| `ACS_CONNECTION_STRING` | Azure Communication Services (email) |
| `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` | MercadoPago |
| `ED25519_PRIVATE_KEY_PEM` / `ED25519_PUBLIC_KEY_PEM` | Firma Open Badges 3.0 |
| `ENABLE_DEV_ENDPOINTS` | Dejar en `false` en producción (habilita endpoints destructivos init/reset/debug) |

### 4. Migraciones de base de datos

Las migraciones se ejecutan **automáticamente al arrancar el contenedor**:

- `backend/startup.sh` corre scripts `migrate_*.py` / `add_*.py` y luego
  `flask db upgrade`.
- `app/auto_migrate.py` agrega columnas faltantes dinámicamente en el arranque.

No se requiere paso manual de migración en un despliegue normal.

---

## 🌐 Despliegue Frontend (Azure Static Web Apps)

El frontend se construye con Vite y se publica con la CLI de SWA usando un
**deployment token**. El token **no debe estar en el repositorio**: expórtalo
como variable de entorno (`SWA_TOKEN`) antes de desplegar.

```bash
cd MotorUniversalV2/frontend

# --- DEV ---
cp .env.dev .env.production.local        # Vite usa este archivo en build
npm run build
rm -f .env.production.local
cp staticwebapp.config.dev.json dist/staticwebapp.config.json
# Verificar que la API URL bakeada contenga "-dev":
grep -o 'evaluaasi-motorv2-api[^"]*\.io/api' dist/assets/index-*.js | sort -u
npx --yes @azure/static-web-apps-cli deploy dist \
  --deployment-token "$SWA_TOKEN" \
  --env production

# --- PROD ---
npm run build                            # usa .env.production por defecto
# Verificar que la API URL bakeada NO contenga "-dev":
grep -o 'evaluaasi-motorv2-api[^"]*\.io/api' dist/assets/index-*.js | sort -u
npx --yes @azure/static-web-apps-cli deploy dist \
  --deployment-token "$SWA_TOKEN" \
  --env production
```

> Obtener el deployment token sin exponerlo en el repo:
> ```bash
> az staticwebapp secrets list \
>   --name <swa-name> --resource-group evaluaasi-motorv2-rg \
>   --query "properties.apiKey" -o tsv
> ```

### Variables de entorno del frontend

| Archivo | API URL | Uso |
|---------|---------|-----|
| `.env` | PROD URL | Base (fallback) |
| `.env.dev` | DEV URL (`-dev`) | `build` para DEV |
| `.env.production` | PROD URL | `build` para PROD |

```
VITE_API_URL=https://evaluaasi-motorv2-api[-dev].purpleocean-384694c4.southcentralus.azurecontainerapps.io/api
VITE_ENV=development|production
```

---

## 🔒 Seguridad

> 🚨 **Acción pendiente:** actualmente hay deployment tokens de SWA y
> credenciales en claro dentro del repositorio (en `scripts/deploy-*.sh`,
> `CLAUDE.md` y varios scripts de prueba). Deben **rotarse** y moverse a
> variables de entorno / Key Vault. Esta guía asume que los secretos se
> proporcionan vía variables de entorno (`$SWA_TOKEN`, app settings del
> Container App), no desde el repo.

### Buenas prácticas

1. **Key Vault para secretos del backend.** Referenciar en el Container App:
   ```bash
   az keyvault secret set --vault-name <kv> --name SECRET-KEY --value "$(openssl rand -base64 32)"
   # Referenciar como secret del Container App / managed identity
   ```
2. **Rotar** la contraseña de Azure SQL y los deployment tokens de ambas SWA
   tras cualquier exposición.
3. **HTTPS** está habilitado por defecto tanto en Static Web Apps como en
   Container Apps.
4. **`ENABLE_DEV_ENDPOINTS=false`** en producción (los blueprints
   `init`/`reset`/`debug` contienen operaciones destructivas).

---

## 📊 Monitoreo y logs

```bash
# Logs del Container App en tiempo real
az containerapp logs show \
  --name evaluaasi-motorv2-api \
  --resource-group evaluaasi-motorv2-rg \
  --follow

# Revisiones activas
az containerapp revision list \
  --name evaluaasi-motorv2-api \
  --resource-group evaluaasi-motorv2-rg \
  -o table
```

El endpoint `/api/health` expone el estado del servicio (usado por el
healthcheck del contenedor).

---

## 🆘 Troubleshooting

### El backend no arranca
```bash
az containerapp logs show --name evaluaasi-motorv2-api \
  --resource-group evaluaasi-motorv2-rg --tail 200
```
Revisar que `DATABASE_URL`, `SECRET_KEY` y `JWT_SECRET_KEY` estén configuradas
(en `ProductionConfig.init_app` se valida que existan).

### Error de conexión a la base de datos
Verificar las reglas de firewall del SQL Server y que el Container App tenga
acceso saliente al servidor `evaluaasi-motorv2-sql.database.windows.net`.

### El frontend apunta al backend equivocado
La API URL se "bakea" en build. Verificar con:
```bash
grep -o 'evaluaasi-motorv2-api[^"]*\.io/api' dist/assets/index-*.js | sort -u
```
DEV debe mostrar `-dev`; PROD no.

### Errores de CORS
Verificar `CORS_ORIGINS` en las variables del Container App y la configuración
en `backend/app/__init__.py`.

---

## 📝 Checklist de despliegue

- [ ] `az login` y `az acr login --name evaluaasimotorv2acr`
- [ ] Docker en ejecución
- [ ] Variables de entorno del backend configuradas en el Container App
- [ ] `SWA_TOKEN` exportado como variable de entorno (no en el repo)
- [ ] Desplegar a **DEV** y validar end-to-end
- [ ] Verificar la API URL bakeada del frontend
- [ ] Desplegar a **PROD**
- [ ] Revisar logs y `/api/health`

---

## 📚 Recursos

- [Azure Container Apps Docs](https://learn.microsoft.com/azure/container-apps/)
- [Azure Static Web Apps Docs](https://learn.microsoft.com/azure/static-web-apps/)
- [Azure SQL Database Docs](https://learn.microsoft.com/azure/azure-sql/)
- [Azure Container Registry Docs](https://learn.microsoft.com/azure/container-registry/)
- [Azure CLI Reference](https://learn.microsoft.com/cli/azure/)
