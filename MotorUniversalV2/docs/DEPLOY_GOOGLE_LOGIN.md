# Despliegue: Inicio de sesión con Google (OAuth)

> Guía para que un agente/operador con acceso a Azure complete el despliegue del
> feature **"Iniciar sesión con Google"**. El código ya está commiteado y pusheado
> a `main` (commit `53030db`). **Falta desplegar backend + frontend y configurar
> variables de entorno.**

---

## ⚠️ Acción de seguridad OBLIGATORIA antes de desplegar

El `client_secret` de Google fue **expuesto en texto plano** durante el desarrollo.
**DEBE regenerarse** antes de usarse en producción:

1. Ir a **Google Cloud Console** → proyecto `evaluaasi-498021`.
2. **APIs y servicios → Credenciales →** cliente OAuth `317711219136-...`.
3. **Restablecer secreto** (Reset secret) y copiar el nuevo valor.
4. Usar ese **nuevo** secreto en la variable `GOOGLE_CLIENT_SECRET` (paso 3 del backend).

> El `client_id` es público, no requiere regenerarse.
> El secreto **NO** se guarda en el repositorio: va solo como variable de entorno en Azure.

---

## Resumen del cambio

| Componente | Archivo | Qué hace |
|---|---|---|
| Backend config | `backend/config.py` | Lee `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` de env |
| Backend endpoint | `backend/app/routes/auth.py` | Nuevo `POST /api/auth/google` (flujo authorization-code) |
| Frontend provider | `frontend/src/main.tsx` | `GoogleOAuthProvider` con `VITE_GOOGLE_CLIENT_ID` |
| Frontend servicio | `frontend/src/services/authService.ts` | `googleLogin(code)` → `/auth/google` |
| Frontend UI | `frontend/src/pages/auth/LoginPage.tsx` | Botón Google (popup auth-code) + manejo de errores |
| Frontend env | `frontend/.env.dev`, `.env.production`, `.env.example` | `VITE_GOOGLE_CLIENT_ID` |

**Política:** *solo vinculación* — el correo de Google debe pertenecer a un usuario
existente y activo. NO crea cuentas automáticamente. Respeta bloqueo por intentos
y cuentas inactivas. El `id_token` se valida (`aud`/`iss`/`email_verified`).

---

## Pre-requisitos en Google Cloud Console

En el cliente OAuth, agregar los **Orígenes de JavaScript autorizados** (el flujo
popup usa `redirect_uri='postmessage'`, por lo que importan los orígenes JS, no las
redirect URIs):

- `http://localhost:5173`
- `https://dev.evaluaasi.com`
- `https://orange-sky-01755e210.1.azurestaticapps.net`
- `https://app.evaluaasi.com`
- `https://thankful-stone-07fbe5410.6.azurestaticapps.net`

---

## Datos de infraestructura

| | Valor |
|---|---|
| ACR (registry name) | `evaluaasimotorv2acr` (dominio `evaluaasimotorv2acr.azurecr.io`) |
| Resource Group | `evaluaasi-motorv2-rg` |
| Imagen backend | `motorv2-api` (NUNCA `evaluaasi-backend`) |
| Container App DEV | `evaluaasi-motorv2-api-dev` |
| Container App PROD | `evaluaasi-motorv2-api` |
| SWA DEV | `evaluaasi-motorv2-frontend-dev` (custom: dev.evaluaasi.com) |
| SWA PROD | `evaluaasi-motorv2-frontend` (custom: app.evaluaasi.com) |
| Backend Dockerfile | `MotorUniversalV2/backend/Dockerfile` |
| API DEV | `https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api` |
| API PROD | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api` |

> Los **tokens de despliegue de SWA** están en `MotorUniversalV2/scripts/deploy-dev.sh`
> y `deploy-prod.sh` (variable `SWA_TOKEN`).

> ⚠️ Los recursos de Azure están en el tenant **GUILLERMO SOTO ALONSO**
> (`6a9e87fc-3258-4b17-9b74-c2ccb412b70d`), que requiere **MFA**. La cuenta debe
> tener permisos sobre `evaluaasi-motorv2-rg` (Contributor o equivalente).

---

## Reglas críticas de despliegue

1. La imagen Docker se llama **`motorv2-api`** — nunca otro nombre.
2. **NUNCA usar `--yaml`** en `az containerapp update` — borra todas las env vars.
   Usar siempre `--image` + `--set-env-vars`.
3. Frontend requiere builds separados DEV vs PROD (`--mode dev` vs `--mode production`).
4. Verificar la **API URL bakeada** con `grep` antes de desplegar frontend.
5. SWA deploy usa `--env default` (o `--env production` según el script existente).
6. **Siempre desplegar a DEV primero, probar, luego PROD.**
7. **Orden obligatorio: backend primero, luego frontend.** El botón de Google no
   funciona hasta que el backend exponga `/api/auth/google`.

---

## Paso 0 — Autenticación en Azure

Si no hay Docker local, se puede construir la imagen en la nube con `az acr build`.
Azure CLI puede instalarse sin admin vía pip en un venv. En este equipo ya quedó
instalado en `C:\Users\diego\.azcli-venv` (ejecutable: `...\Scripts\az.bat`).

```powershell
# Login al tenant correcto (requiere MFA)
& "$env:USERPROFILE\.azcli-venv\Scripts\az.bat" login --tenant 6a9e87fc-3258-4b17-9b74-c2ccb412b70d --use-device-code

# Verificar acceso al RG (debe devolver "true")
& "$env:USERPROFILE\.azcli-venv\Scripts\az.bat" group exists --name evaluaasi-motorv2-rg
```

> Reemplazar `az.bat` por `az` si se usa una instalación normal de Azure CLI.

---

## Paso 1 — Build de la imagen del backend (en la nube, sin Docker)

```powershell
cd "<repo>/MotorUniversalV2/backend"
$REV = "rev-$(Get-Date -Format yyyyMMdd-HHmmss)"
& "$env:USERPROFILE\.azcli-venv\Scripts\az.bat" acr build `
  --registry evaluaasimotorv2acr `
  --image "motorv2-api:$REV" .
```

> Con Docker local, alternativamente:
> `docker build -t evaluaasimotorv2acr.azurecr.io/motorv2-api:$REV .` →
> `az acr login --name evaluaasimotorv2acr` → `docker push ...`

---

## Paso 2 — Desplegar backend a DEV + variables de Google

```powershell
& "$env:USERPROFILE\.azcli-venv\Scripts\az.bat" containerapp update `
  --name evaluaasi-motorv2-api-dev `
  --resource-group evaluaasi-motorv2-rg `
  --image "evaluaasimotorv2acr.azurecr.io/motorv2-api:$REV" `
  --set-env-vars `
    "GOOGLE_CLIENT_ID=317711219136-47u7ogn6mg08omr0b2drjpk6jv80m4nb.apps.googleusercontent.com" `
    "GOOGLE_CLIENT_SECRET=<SECRETO_REGENERADO>" `
  --output none
```

**Probar DEV:**
- `GET .../api/health` debe responder OK.
- Abrir el frontend DEV e intentar "Iniciar sesión con Google" con un correo de un
  usuario existente. Debe iniciar sesión. Con un correo no registrado debe mostrar
  "No existe una cuenta con ese correo".

---

## Paso 3 — Desplegar backend a PROD (tras validar DEV)

```powershell
& "$env:USERPROFILE\.azcli-venv\Scripts\az.bat" containerapp update `
  --name evaluaasi-motorv2-api `
  --resource-group evaluaasi-motorv2-rg `
  --image "evaluaasimotorv2acr.azurecr.io/motorv2-api:$REV" `
  --set-env-vars `
    "GOOGLE_CLIENT_ID=317711219136-47u7ogn6mg08omr0b2drjpk6jv80m4nb.apps.googleusercontent.com" `
    "GOOGLE_CLIENT_SECRET=<SECRETO_REGENERADO>" `
  --output none
```

---

## Paso 4 — Desplegar frontend (NO requiere Docker ni az)

El frontend ya tiene `VITE_GOOGLE_CLIENT_ID` en `.env.dev` y `.env.production`.

### DEV
```powershell
cd "<repo>/MotorUniversalV2/frontend"
npx vite build --mode dev --emptyOutDir
# Verificar URL bakeada (DEBE mostrar -dev):
Select-String -Path dist/assets/index-*.js -Pattern 'evaluaasi-motorv2-api[^"]*\.io/api' | Select-Object -First 1
npx @azure/static-web-apps-cli deploy dist `
  --deployment-token "<SWA_TOKEN_DEV de deploy-dev.sh>" `
  --env default
```

### PROD
```powershell
cd "<repo>/MotorUniversalV2/frontend"
npx vite build --mode production --emptyOutDir
# Verificar URL bakeada (SIN -dev):
Select-String -Path dist/assets/index-*.js -Pattern 'evaluaasi-motorv2-api[^"]*\.io/api' | Select-Object -First 1
npx @azure/static-web-apps-cli deploy dist `
  --deployment-token "<SWA_TOKEN_PROD de deploy-prod.sh>" `
  --env default
```

> Alternativa: usar los scripts existentes `MotorUniversalV2/scripts/deploy-dev.sh`
> y `deploy-prod.sh` (requieren bash + Docker + az).

---

## Verificación final (checklist)

- [ ] `client_secret` **regenerado** en Google Cloud Console.
- [ ] Orígenes JS autorizados configurados en Google Cloud Console.
- [ ] Imagen `motorv2-api:$REV` construida en ACR.
- [ ] Container App DEV actualizada con `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
- [ ] Login con Google probado en DEV (usuario existente y no existente).
- [ ] Container App PROD actualizada con las mismas env vars.
- [ ] Frontend DEV desplegado (URL bakeada con `-dev` verificada).
- [ ] Frontend PROD desplegado (URL bakeada sin `-dev` verificada).
- [ ] Login con Google probado en PROD.

---

## Pendiente futuro (fuera de alcance)

- **Inicio de sesión con Microsoft (Entra ID):** el botón existe pero es decorativo
  (sin `onClick`). Falta implementarlo cuando se tengan las credenciales de Microsoft.
