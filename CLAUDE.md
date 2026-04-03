# CLAUDE.md — Instrucciones para Claude Code

## Visión General del Proyecto

**Evaluaasi Motor Universal V2** es una plataforma educativa multi-tenant para evaluación, certificación y gestión de competencias. Permite a coordinadores gestionar partners, planteles (campus), grupos de candidatos, exámenes, materiales de estudio, insignias digitales (Open Badges 3.0), y certificaciones CONOCER.

El proyecto está en `MotorUniversalV2/` dentro del repositorio.

---

## Estructura del Repositorio

```
MotorUniversalV2/
├── backend/          # Flask API (Python 3.11)
├── frontend/         # React SPA (Vite + TypeScript)
├── azure-functions/  # Azure Functions (PDF generator)
├── docker/           # Configuraciones Docker adicionales
├── docs/             # Documentación del proyecto
├── scripts/          # Scripts de deploy (deploy-dev.sh, deploy-prod.sh)
└── docker-compose.yml
```

---

## Backend (Flask + SQLAlchemy + MSSQL)

### Directorio `backend/app/`

```
app/
├── __init__.py          # App factory, registro de blueprints, CORS
├── auto_migrate.py      # Migraciones automáticas al iniciar
├── models/              # 30+ modelos SQLAlchemy
│   ├── user.py          # Usuarios, roles, permisos
│   ├── exam.py          # Definición de exámenes
│   ├── question.py      # Preguntas (6 tipos)
│   ├── answer.py        # Opciones de respuesta
│   ├── result.py        # Resultados y certificados
│   ├── exercise.py      # Ejercicios interactivos (steps + actions)
│   ├── category.py      # Categorías de examen
│   ├── topic.py         # Temas dentro de categorías
│   ├── partner.py       # Partners, campuses, grupos, miembros
│   ├── balance.py       # Saldo coordinador, solicitudes de saldo, solicitudes de certificados
│   ├── badge.py         # Insignias digitales (OB 3.0)
│   ├── study_content.py # Materiales de estudio
│   ├── support_chat.py  # Chat candidato-soporte (conversaciones, mensajes, participantes)
│   ├── payment.py       # Pagos con MercadoPago (candidatos)
│   └── ...              # competency_standard, brand, voucher, activity_log, vm_session, etc.
├── routes/              # Blueprints Flask (~20 archivos)
│   ├── auth.py          # /api/auth/* — login, register, refresh, forgot/reset password
│   ├── exams.py         # /api/exams/* — CRUD exámenes, start, submit
│   ├── users.py         # /api/users/* — listado/gestión usuarios (admin/soporte)
│   ├── user_management.py # /api/user-management/* — CRUD usuarios, bulk create, export
│   ├── partners.py      # /api/partners/*, /api/campuses/*, /api/groups/*
│   ├── balance.py       # /api/balance/* — saldo, solicitudes, certificate-requests
│   ├── badges.py        # /api/badges/* — templates, issue, verify (OB 3.0)
│   ├── activity.py      # /api/activity/* — logs de auditoría
│   ├── support.py       # /api/support/* — calendario, sesiones
│   ├── support_chat.py  # /api/support/chat/* — conversaciones, mensajes
│   ├── verify.py        # /api/verify/* — verificación pública de certificados
│   ├── conocer.py       # /api/conocer/* — certificados CONOCER
│   ├── standards.py     # /api/standards/* — estándares de competencia (ECM)
│   ├── study_contents.py# /api/study-contents/* — materiales de estudio
│   ├── vm_sessions.py   # /api/vm-sessions/* — sesiones de máquina virtual
│   ├── payments.py      # /api/payments/* — checkout MercadoPago, webhooks, historial
│   ├── health.py        # /api/health, /api/ping, /api/warmup
│   └── exams_modular/   # Sub-módulo: categories, questions, exercises, evaluation, pdf
├── services/            # Lógica de negocio (8+ servicios)
│   ├── badge_service.py     # Generación y firma de insignias
│   ├── email_service.py     # Azure Communication Services
│   ├── linkedin_service.py  # OAuth2 LinkedIn
│   ├── renapo_service.py         # Validación CURP contra RENAPO (iterativa 6 rondas)
│   ├── mercadopago_service.py   # Integración MercadoPago (preferencias, webhooks)
│   └── conocer_*.py             # Procesamiento batch CONOCER
└── utils/               # Utilidades (10+ archivos)
    ├── azure_storage.py     # Azure Blob Storage
    ├── cache_utils.py       # Redis cache helpers
    ├── rate_limit.py        # Rate limiting
    ├── pdf_generator.py     # Generación de reportes PDF
    └── helpers.py           # Funciones comunes
```

### Roles del Sistema

| Rol | Descripción |
|-----|-------------|
| `admin` | Acceso total al sistema |
| `developer` | Igual que admin (interno) |
| `gerente` | Aprueba/rechaza solicitudes de saldo (último nivel), auditoría de chats, certificados |
| `financiero` | Revisa solicitudes de saldo (nivel intermedio) |
| `editor` | Crea/edita exámenes y materiales de estudio |
| `editor_invitado` | Editor con permisos limitados |
| `soporte` | Portal de soporte (chat, calendario, usuarios) |
| `coordinator` | Gestiona partners, planteles, grupos, saldo. Puede aprobar sus propias solicitudes |
| `responsable` | Administra un plantel (campus), crea candidatos, solicita certificados |
| `responsable_partner` | Administra un partner (nivel partner, no campus) |
| `responsable_estatal` | Responsable con vista de partner filtrada por estado |
| `auxiliar` | Auxiliar del coordinador |
| `candidato` | Estudiante, toma exámenes, paga con MercadoPago |

### Jerarquía de Roles (Multi-tenant)

```
admin/developer
  └─ coordinator (tiene partners, campuses, grupos)
       ├─ responsable (asignado a un campus, ligado a un coordinador)
       │    └─ candidato (miembro de un grupo)
       └─ auxiliar
```

### Flujo de Solicitudes de Saldo

```
Responsable crea solicitud de certificados
  → Coordinador revisa (approve/reject/modify)
    → Si approve: se crea BalanceRequest automáticamente
      → Financiero revisa
        → Gerente aprueba/rechaza
```

### Entry Point

- `run.py` — Crea app Flask, ejecuta auto-migraciones (bulk_upload + support_chat + payments)
- `startup.sh` — Script de arranque del contenedor (migraciones + gunicorn)
- `config.py` — 3 configs: DevelopmentConfig (SQLite), ProductionConfig (MSSQL), TestingConfig

### Dependencias Clave

- Flask 3.0.0 + Flask-JWT-Extended + Flask-SQLAlchemy + Flask-Migrate
- pymssql (Azure SQL / MSSQL) — base de datos de producción
- argon2-cffi — hashing de contraseñas
- azure-storage-blob, azure-identity, azure-keyvault-secrets
- gunicorn + gevent — servidor de producción
- playwright — verificación CURP contra RENAPO
- reportlab + PyMuPDF — generación de PDF

---

## Frontend (React + TypeScript + Vite)

### Directorio `frontend/src/`

```
src/
├── App.tsx              # 65+ rutas lazy-loaded, guards por rol
├── main.tsx             # React Query provider, entry point
├── index.css            # Tailwind CSS global + custom styles
├── components/
│   ├── layout/Layout.tsx    # Navbar + sidebar, branding dinámico por campus
│   ├── auth/                # AuthProvider, ProtectedRoute
│   ├── ui/                  # GlobalNotifications, OptimizedImage, SearchableSelect
│   └── ...                  # chat/, landing/, partners/, etc.
├── pages/               # 75+ páginas organizadas por rol
│   ├── auth/            # Login, Register, ForgotPassword, ResetPassword
│   ├── landing/         # LandingPage, Privacy, Terms
│   ├── exams/           # ExamsList, Create, Edit, Preview
│   ├── study-contents/  # Materiales: List, Create, Detail, Reading/Video editors
│   ├── standards/       # ECM: Standards, Brands, CertificateTemplate
│   ├── partners/        # Partners, Campuses, Groups, Members, Assignments
│   ├── responsable/     # MiPlantel, SolicitarCertificados, MisSolicitudes
│   ├── coordinador/     # MiSaldo, SolicitudesResponsables, Historial
│   ├── financiero/      # Dashboard, Solicitudes
│   ├── gerente/         # Dashboard, Approvals, Finanzas, Monitoreo, ChatAudit, Certificados
│   ├── badges/          # BadgeTemplates, BadgeTemplateForm
│   ├── support/         # Dashboard, Campuses, Users, Calendar, Chat
│   ├── certificates/    # CertificatesPage, EvaluationReport, ResultDetail
│   └── verify/          # VerifyPage (público)
├── services/            # 19 servicios API (Axios)
│   ├── api.ts               # Axios instance + interceptors (auth, 401 refresh)
│   ├── authService.ts       # login, register, logout, refresh
│   ├── examService.ts       # CRUD exámenes + preguntas
│   ├── partnersService.ts   # Partners, campuses, grupos
│   ├── balanceService.ts    # Saldo, solicitudes, certificate-requests
│   ├── badgeService.ts      # Insignias OB 3.0
│   ├── userManagementService.ts # CRUD usuarios
│   ├── paymentService.ts     # MercadoPago checkout, historial pagos
│   ├── supportChatService.ts # Chat candidato-soporte
│   └── ...                  # studyContent, support, standards, activity, dashboard, etc.
├── store/               # Zustand
│   ├── authStore.ts         # Auth state + persist + cache clearing
│   └── notificationStore.ts
├── hooks/               # Custom hooks
├── types/index.ts       # TypeScript interfaces globales
├── test/setup.ts        # Vitest setup
└── __tests__/           # 20+ archivos de test (Vitest + RTL)
```

### Stack Frontend

- **React 18.2** + TypeScript 5.6
- **Vite 5.0** — build + dev server
- **React Router DOM 6.21** — routing con lazy loading
- **Zustand 4.4** — state management (auth, notifications)
- **React Query 5.13** — server state + caching
- **Tailwind CSS 3.3** — styling + branding dinámico
- **React Hook Form 7.49 + Zod** — formularios + validación
- **Axios 1.6** — HTTP client con interceptors
- **Vitest 1.0 + Testing Library** — tests unitarios
- **Lucide React** — iconografía

### Convenciones Frontend

- Rutas lazy-loaded con `React.lazy()` + `Suspense`
- Servicios en `services/` siguen patrón: funciones async que llaman a `api.get/post/put/delete`
- Guards por rol en `App.tsx` (RestrictedForGerenteFin, ReportsGuard, SupportGuard)
- Path alias `@/*` → `./src/*`
- Tests en `__tests__/` con naming `[ComponentName].test.tsx`

---

## Infraestructura Azure

### Recursos

| Recurso | Nombre |
|---------|--------|
| Resource Group | `evaluaasi-motorv2-rg` |
| ACR | `evaluaasimotorv2acr.azurecr.io` |
| SQL Server | `evaluaasi-motorv2-sql.database.windows.net` |
| Container App DEV | `evaluaasi-motorv2-api-dev` |
| Container App PROD | `evaluaasi-motorv2-api` |
| SWA DEV | `orange-sky-01755e210.1.azurestaticapps.net` (custom: dev.evaluaasi.com) |
| SWA PROD | `thankful-stone-07fbe5410.6.azurestaticapps.net` (custom: app.evaluaasi.com) |

### Bases de Datos

| | DEV | PROD |
|---|---|---|
| DB Name | `evaluaasi_dev` | `evaluaasi` |
| Server | `evaluaasi-motorv2-sql.database.windows.net` | (mismo servidor) |
| User | `evaluaasi_admin` | `evaluaasi_admin` |
| Password | `EvalAasi2024_newpwd!` | `EvalAasi2024_newpwd!` |
| Datos | ~16 partners, datos de prueba | ~1 partner, datos reales |

### API URLs

- **DEV**: `https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api`
- **PROD**: `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api`

### Credenciales de Prueba

- **Admin**: `admin` / `admin123`
- **Editor**: `editor` / `editor123`
- **Alumno**: `alumno` / `alumno123`

---

## Procedimientos de Deploy

### ⚠️ REGLAS CRÍTICAS

1. **Imagen Docker se llama `motorv2-api`** — NUNCA usar `evaluaasi-backend` ni `motorv2-backend`
2. **NUNCA usar `--yaml` en `az containerapp update`** — borra todas las variables de entorno
3. **Frontend requiere builds separados** para DEV y PROD — `--mode dev` vs `--mode production`
4. **SIEMPRE verificar la API URL bakeada** con grep antes de deployar frontend
5. **SWA deploy usa `--env default`** — no usar `--env production`
6. **Deploy siempre a DEV primero**, probar, luego PROD

### Deploy Backend

```bash
cd MotorUniversalV2/backend

# 1. Build (SIEMPRE --no-cache para cambios de código)
docker build --no-cache -t evaluaasimotorv2acr.azurecr.io/motorv2-api:latest .

# 2. Tag con identificador único
TAG="rev-$(date +%s)"
docker tag evaluaasimotorv2acr.azurecr.io/motorv2-api:latest "evaluaasimotorv2acr.azurecr.io/motorv2-api:$TAG"

# 3. Push a ACR
docker push "evaluaasimotorv2acr.azurecr.io/motorv2-api:$TAG"

# 4. Deploy a DEV
az containerapp update \
  --name evaluaasi-motorv2-api-dev \
  --resource-group evaluaasi-motorv2-rg \
  --image "evaluaasimotorv2acr.azurecr.io/motorv2-api:$TAG" \
  -o none

# 5. PROBAR en DEV, después deploy a PROD
az containerapp update \
  --name evaluaasi-motorv2-api \
  --resource-group evaluaasi-motorv2-rg \
  --image "evaluaasimotorv2acr.azurecr.io/motorv2-api:$TAG" \
  -o none
```

### Deploy Frontend

```bash
cd MotorUniversalV2/frontend

# --- DEV ---
npx vite build --mode dev --emptyOutDir
# Verificar URL bakeada (DEBE mostrar -dev):
grep -o 'evaluaasi-motorv2-api[^"]*\.io/api' dist/assets/index-*.js | sort -u
npx @azure/static-web-apps-cli deploy dist \
  --deployment-token "48095856cbbc3ce22b369395053701d6beabc05fb3b154f1040b2411de45c9fb01-678b9cba-bd31-4f93-a4a4-e13b8c127405010082401755e210" \
  --env default

# --- PROD ---
npx vite build --mode production --emptyOutDir
# Verificar URL bakeada (SIN -dev):
grep -o 'evaluaasi-motorv2-api[^"]*\.io/api' dist/assets/index-*.js | sort -u
npx @azure/static-web-apps-cli deploy dist \
  --deployment-token "33c2e6e0d0322fad0add224319545ce1dfa963782d21e37986e4079985b7c84006-c720933c-1760-4077-a094-2434c3620a6a010271907fbe5410" \
  --env default
```

### Scripts de Deploy Automatizados

Existen scripts en `MotorUniversalV2/scripts/`:
- `deploy-dev.sh [backend|frontend|all]` — Deploy a DEV
- `deploy-prod.sh [backend|frontend|all]` — Deploy a PROD (pide confirmación)

---

## Desarrollo Local

### Con Docker Compose (PostgreSQL local)

```bash
cd MotorUniversalV2
docker-compose up -d
# Backend: http://localhost:5000/api
# Frontend: http://localhost:5173
# Swagger: http://localhost:5000/apidocs
```

### Sin Docker (directo)

```bash
# Backend
cd MotorUniversalV2/backend
pip install -r requirements.txt
FLASK_ENV=development python run.py
# Usa SQLite local en modo development

# Frontend
cd MotorUniversalV2/frontend
npm install
npm run dev
# Usa proxy a localhost:5000 (configurado en vite.config.ts)
```

---

## Testing

### Frontend Tests (Vitest)

```bash
cd MotorUniversalV2/frontend
npx vitest run              # Todos los tests
npx vitest run --reporter verbose  # Con detalle
npx vitest run src/__tests__/MisSolicitudesPage.test.tsx  # Un archivo específico
```

- Configuración en `vite.config.ts` (sección `test`)
- Setup en `src/test/setup.ts`
- Usa: jsdom, @testing-library/react, @testing-library/user-event

### Backend Tests (Pytest)

```bash
cd MotorUniversalV2/backend
python -m pytest tests/ -v                    # Todos
python -m pytest tests/test_certificate_requests.py -v  # Uno específico
```

- Tests de integración contra API DEV (no mocks)
- Login fixture con retry para cold starts
- Algunos tests se skipean si no hay coordinador asignado en DEV

---

## Base de Datos

### Motor: Azure SQL (MSSQL)

- **Producción**: MSSQL vía `pymssql`
- **Development local**: SQLite (automático por `config.py`)
- **Connection pooling**: pool_size=20, pool_recycle=300, pool_pre_ping=True

### Restricciones MSSQL Conocidas

- **No permite múltiples ON DELETE CASCADE/SET NULL** en FKs al mismo padre → usar `ondelete="NO ACTION"` en modelos con múltiples FKs a User
- Las migraciones se ejecutan con `auto_migrate.py` al arrancar + Flask-Migrate

### Migraciones

El proyecto usa dos estrategias:
1. **auto_migrate.py** — Agrega columnas faltantes dinámicamente al iniciar
2. **Scripts individuales** en `backend/` (e.g., `migrate_certificate_request_v2.py`) para migraciones complejas
3. **Flask-Migrate** (`flask db upgrade`) en `startup.sh`

Para migraciones manuales contra Azure SQL:
```python
# Ejemplo: migrate_certificate_request_v2.py
import pymssql
conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password='EvalAasi2024_newpwd!',
    database='evaluaasi_dev'  # o 'evaluaasi' para PROD
)
```

---

## Variables de Entorno Frontend

| Archivo | API URL | Uso |
|---------|---------|-----|
| `.env` | PROD URL | Base (fallback) |
| `.env.dev` | DEV URL (`-dev`) | `vite build --mode dev` |
| `.env.production` | PROD URL | `vite build --mode production` |

```
VITE_API_URL=https://evaluaasi-motorv2-api[-dev].purpleocean-384694c4.southcentralus.azurecontainerapps.io/api
VITE_ENV=development|production
```

---

## Modelo de Datos Principal

### Jerarquía Organizacional
```
Partner (empresa/institución)
  └─ Campus (plantel/sede)
       └─ CandidateGroup (grupo de candidatos)
            └─ GroupMember (candidato asignado)
                 └─ GroupExam / GroupExamMember (examen asignado)
```

### Jerarquía de Exámenes
```
Exam
  └─ Category (peso porcentual)
       └─ Topic (peso porcentual)
            ├─ Question (6 tipos: true/false, multiple choice, multiple select, ordering, drag-drop, column-grouping)
            │    └─ Answer (opciones)
            └─ Exercise (simulador)
                 └─ ExerciseStep
                      └─ ExerciseAction
```

### Materiales de Estudio
```
StudyMaterial (curso)
  └─ StudySession (unidad)
       └─ StudyTopic (tema)
            ├─ StudyReading (lectura markdown)
            ├─ StudyVideo (video + transcripción)
            ├─ StudyDownloadableExercise (PDF descargable)
            └─ StudyInteractiveExercise (ejercicio interactivo)
                 └─ StudyInteractiveExerciseStep → Actions
```

### Flujo Financiero
```
CoordinatorBalance (saldo por campus)
BalanceRequest (solicitud saldo/beca: pending → approved/rejected)
BalanceTransaction (registro inmutable de movimientos)
CertificateRequest (solicitud de certificados: pending → seen → approved_by_coordinator → forwarded → in_review → approved/rejected)
```

---

## Convenciones de Código

### Backend
- Modelos con método `to_dict()` para serialización
- Blueprints registrados en `app/__init__.py`
- JWT requerido: `@jwt_required()` en rutas protegidas
- Roles verificados manualmente: `current_user = get_jwt_identity(); user = User.query.get(current_user)`
- Rate limiting en endpoints sensibles (login, register, password reset)
- Azure Blob Storage para archivos subidos

### Frontend
- Páginas lazy-loaded en `App.tsx`
- Servicios retornan data directamente (no Response objects)
- `authStore` (Zustand) para estado de autenticación
- React Query para server state (queries + mutations)
- Tailwind CSS para estilos, con branding dinámico por campus
- Formularios con React Hook Form + validación Zod

### Git
- Commits en español o inglés
- Prefijos: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`
- Branch principal: `main`

---

## Últimas Features Implementadas

### Pagos por Candidato — MercadoPago (abril 2026)
- Modelo `Payment` con estados (pending → approved → rejected)
- Servicio `mercadopago_service.py` — creación de preferencias, webhooks IPN
- Rutas `/api/payments/*` — checkout, webhook, historial por usuario
- Frontend: `CandidateCheckoutModal`, `CheckoutForm`, `MisPagosPage`
- Candidatos pueden pagar exámenes directamente sin pasar por coordinador

### Chat Candidato-Soporte (marzo 2026)
- Modelos: `SupportConversation`, `SupportConversationParticipant`, `SupportMessage`
- Blueprint `/api/support/chat/*` — conversaciones, mensajes, mark-read, status
- Frontend: `SupportChatWorkspace` (modo candidato + modo soporte)
- Plantillas de mensajes con emojis (`ChatTemplateManager`)
- Última conexión / estado en línea / auto-refresh configurable
- Bloqueo de chat fuera de horario (9-17 hrs centro de México)
- Auditoría de chats para gerente (`ChatAuditPage`)

### Aislamiento Multi-Tenant (marzo-abril 2026)
- Coordinadores solo ven SUS partners, campuses, grupos y usuarios
- `_verify_group_access()` aplicado en 20+ endpoints de grupos
- Filtrado de candidatos por plantel para responsables
- Rol `responsable_estatal` — vista de partner filtrada por estado
- Tests extensivos: isolation, coordinator sharing, group isolation

### Branding Dinámico Candidato (marzo-abril 2026)
- Logo y colores del campus en dashboard del candidato
- Paleta personalizada aplicada en: exámenes, materiales, certificación, dashboard
- Logo del partner en certificados EDUIT (posición x:910 y:1135 pts)
- Issuer logo en plantillas de insignias
- Logo más grande en configuración de campus

### Configuración de Exámenes (abril 2026)
- Subpágina `ExamConfigPage` para editores — configuración avanzada de exámenes
- Página de exámenes pendientes para candidatos (`PendingExamsPage`)

### Portal Gerente (marzo-abril 2026)
- Auditoría de chats de soporte (`ChatAuditPage`)
- Analítica de certificados (`GerenteCertificadosPage`)
- Sub-links en navbar (aprobaciones, finanzas, certificados, monitoreo)
- Coordinador puede aprobar sus propias solicitudes de saldo
- CC al coordinador en emails de solicitud de saldo

### CURP y Validación (marzo 2026)
- Verificación CURP iterativa 6 rondas + validación dígito verificador
- Recuperación automática de usuarios huérfanos con CURP pendiente
- Recuperación basada en estatus en vez de tiempo

### Certificación Candidato (marzo 2026)
- Pestañas visuales de certificación con selección automática por última actividad
- `CertificationPathCard` — tarjeta visual de ruta de certificación

### UI/UX General
- Navbar sticky usando flex column layout
- Saludo personalizado en dashboard
- Módulo actividad para editores
- Cambiar "ítems" por "reactivos" en diálogo de entrega de examen
- Modal de generar contraseña — fix cierre prematuro

### Flujo Solicitudes de Certificados (marzo 2026)
- **Responsable** puede solicitar certificados desde su portal
- **Coordinador** ve las solicitudes en "Solicitudes de Responsables"
- **Coordinador** puede aprobar, rechazar o modificar
- Al aprobar, se crea automáticamente un `BalanceRequest` que sigue al flujo financiero→gerente
- Soporta adjuntos (PDF, imágenes) vía Azure Blob Storage

### Asignación Coordinador (marzo 2026)
- Responsables deben estar vinculados a un coordinador

### Branding Personalizado (marzo 2026)
- Planteles pueden personalizar logo, colores, y título
