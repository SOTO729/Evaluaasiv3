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

---
---

# Plan técnico: Chatbot-Agente de Soporte (IA)

> Hoja de ruta para convertir el chat candidato-soporte en un **agente con IA**
> (Azure OpenAI + tool-calling) capaz de responder y, de forma controlada, ejecutar
> acciones del rol `soporte`. **Estado: PROPUESTA / NO IMPLEMENTADO.** Documento de
> diseño; no hay código ni recursos creados todavía.

## Objetivo

Añadir un asistente de IA dentro del módulo de chat existente
(`SupportChatWorkspace`) que:
1. Responda dudas de candidatos en lenguaje natural (FAQ, navegación, estudio).
2. Ejecute acciones de **bajo riesgo** de forma autónoma.
3. **Prepare** acciones de riesgo medio para aprobación humana (human-in-the-loop).
4. **Escale a un humano** cualquier acción de alto riesgo o cuando no esté seguro.

## Por qué es factible

- El módulo de chat ya existe: modelos `SupportConversation` / `SupportMessage`,
  endpoints de envío, polling cada 7 s, adjuntos, plantillas.
- `SupportMessage.message_type` ya es extensible (`text`/`attachment`/`system`) →
  añadir `ai`/`bot`.
- `current_handler_role` ya distingue `support` / `coordinator` → añadir `bot`.
- Infraestructura Azure ya presente (Container Apps, Blob, Communication Services).
  Solo falta un recurso de **Azure OpenAI** con un modelo desplegado (`gpt-4o-mini`).

## Modelo de autonomía — 3 niveles de permiso

| Nivel | Política | Acciones | Riesgo |
|---|---|---|---|
| **1 — Autónomo** | El bot ejecuta solo | Responder, buscar/consultar, marcar leído, sugerir plantilla, cambiar estado de SU conversación, crear conversación | Bajo / reversible |
| **2 — Aprobación humana** | El bot **propone**, un humano de soporte aprueba/rechaza con un clic | Crear campus, crear/editar usuario, transferir a coordinador | Medio, controlado |
| **3 — Prohibido al bot** | El bot **nunca** ejecuta; solo escala | Ver/cambiar/generar contraseñas, activar/desactivar usuarios, enviar correos, datos financieros | Alto |

> Clasificación basada en las ~23 acciones reales del rol `soporte`
> (ver sección "Acciones del rol soporte" más abajo).

## Inventario de acciones del rol soporte (referencia)

**Lectura (Nivel 1 — libre):**
- `GET /api/support/users`, `/campuses`, `/partners`, `/calendar/sessions`
- `GET /api/support/chat/conversations`, `.../messages`, `/templates`
- `GET /api/partners/ecm-assignments` (analítica ECM)

**Escritura reversible / chat (Nivel 1):**
- `POST /api/support/chat/conversations` (crear conversación)
- `POST /api/support/chat/conversations/<id>/messages` (enviar mensaje)
- `POST /api/support/chat/conversations/<id>/read` (marcar leído)
- `PATCH /api/support/chat/conversations/<id>/status` (open/resolved/closed)
- `POST|PUT|DELETE /api/support/chat/templates` (plantillas)

**Escritura media (Nivel 2 — aprobación humana):**
- `POST /api/support/campuses` (crear campus)
- `POST /api/user-management/users` (crear usuario)
- `PUT /api/user-management/users/<id>` (editar usuario)
- `POST /api/support/chat/conversations/<id>/transfer` (transferir a coordinador)

**Alto riesgo (Nivel 3 — solo humano, el bot NO lo hace):**
- `PUT /api/user-management/users/<id>/password` (cambiar contraseña)
- `POST /api/user-management/users/<id>/generate-password` (generar contraseña)
- `GET /api/user-management/users/<id>/password` (ver contraseña en texto plano)
- `POST /api/user-management/users/<id>/toggle-active` (activar/desactivar)
- `POST /api/support/users/send-email` (enviar correos de la plataforma)

## Arquitectura propuesta

```
Candidato → SupportChatWorkspace → POST /messages
   → (si conversación en modo bot) → chatbot_agent_service
        → Azure OpenAI (tool-calling)
            → herramienta de LECTURA   → ejecuta y responde (Nivel 1)
            → herramienta de ESCRITURA media → crea BotActionRequest (Nivel 2)
            → acción de alto riesgo    → escala a humano (Nivel 3)
        → guarda respuesta como SupportMessage (sender=bot, message_type='ai')
```

### Componentes nuevos (backend)

1. `app/services/chatbot_agent_service.py`
   - Cliente Azure OpenAI (function calling).
   - Definición de **herramientas** (cada una mapea a un endpoint/servicio interno),
     etiquetadas por nivel de permiso.
   - Construcción de contexto/system prompt + (Fase 2) RAG.
2. Usuario "bot" del sistema (registro en `users`) para `sender_user_id`.
3. `current_handler_role = "bot"` y `message_type = "ai"`.
4. (Fase 2) Modelo `BotActionRequest` para la cola de aprobación:
   `id, conversation_id, tool_name, payload(JSON), status(pending/approved/rejected),
   proposed_at, decided_by_user_id, decided_at`.
5. Endpoints:
   - `POST /api/support/chat/conversations/<id>/bot-reply` (disparar/forzar respuesta).
   - `GET /api/support/chat/bot-actions?status=pending` (cola de aprobación).
   - `POST /api/support/chat/bot-actions/<id>/approve|reject`.

### Componentes nuevos (frontend)

- `SupportChatWorkspace.tsx`: estilo propio para mensajes del bot, indicador
  "Asistente IA", botón **"Hablar con un humano"**.
- (Fase 2) Panel de **acciones propuestas por el bot** con botones Aprobar/Rechazar.
- Servicio `chatbotService.ts` para los nuevos endpoints.

### Variables de entorno (Azure Container Apps)

```
AZURE_OPENAI_ENDPOINT=https://<recurso>.openai.azure.com/
AZURE_OPENAI_KEY=<clave>
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-08-01-preview
CHATBOT_ENABLED=true
```

## Seguridad (obligatorio)

- **Prompt injection**: el texto del candidato NUNCA debe poder elevar permisos.
  Las herramientas de Nivel 2/3 se controlan en el **backend**, no por lo que diga
  el modelo. El modelo solo *propone*; el backend decide si requiere aprobación.
- **Nunca** exponer al modelo datos sensibles (CURP completa, contraseñas, pagos).
- **Auditoría**: registrar cada acción del bot en `ActivityLog`
  ("ejecutado por bot" / "aprobado por <humano>").
- **Rate limiting** en los endpoints del bot (reutilizar utilidades existentes).
- El bot **no** debe tomar acciones financieras ni de certificación.

## Costos estimados (Azure OpenAI, por uso)

| Escenario | Configuración | Costo mensual aprox. |
|---|---|---|
| Fase 1 (FAQ, sin RAG) | gpt-4o-mini, ~5,000 msgs/mes | ~$3–6 USD |
| Fase 2 (RAG en Azure SQL) | mini + embeddings en BD propia | ~$5–12 USD |
| Volumen alto + Azure AI Search | mini + AI Search básico | ~$80–130 USD (mayoría fijo del AI Search) |

- gpt-4o-mini: ~$0.15/1M tokens entrada, ~$0.60/1M salida → ~$0.0005–0.001 por interacción.
- Embeddings (`text-embedding-3-small`): ~$0.02/1M tokens, indexado una sola vez.
- Infra: **$0 adicional** (corre dentro del backend Flask actual).
- Azure AI Search es **evitable** al inicio usando embeddings en Azure SQL.

## Fases de implementación

1. **Fase 1 — Bot conversacional + Nivel 1**: responde dudas + acciones reversibles
   + escala a humano. (Esfuerzo: medio.)
2. **Fase 2 — Nivel 2 (human-in-the-loop)**: cola `BotActionRequest` + UI de
   aprobación. (Esfuerzo: medio-alto.)
3. **Fase 3 — RAG + métricas**: contexto desde materiales de estudio; medir % resuelto
   por el bot reutilizando la encuesta de satisfacción existente.

## Pre-requisitos

- Crear recurso **Azure OpenAI** en la suscripción (sujeto a cuota/región) y desplegar
  `gpt-4o-mini`.
- Definir el alcance inicial del bot (FAQ + navegación + dudas de estudio).
- Confirmar la política de aprobación para acciones de Nivel 2.
