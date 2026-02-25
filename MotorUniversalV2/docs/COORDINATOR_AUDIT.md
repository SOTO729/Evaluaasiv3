# Auditoría Completa de Endpoints Accesibles al Rol "coordinator"

**Fecha:** Junio 2025  
**Alcance:** Todos los archivos en `backend/app/routes/`  
**Base de permisos del coordinador:**
```python
'coordinator': ['users:read', 'users:create', 'exams:read', 'groups:manage', 'balance:request']
```

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Patrones de Autenticación](#patrones-de-autenticación)
3. [Endpoints por Módulo](#endpoints-por-módulo)
   - [Partners (partners.py)](#partners)
   - [User Management (user_management.py)](#user-management)
   - [Balance (balance.py)](#balance)
   - [Badges (badges.py)](#badges)
   - [CONOCER Certificates (conocer.py)](#conocer)
   - [Exams (exams.py)](#exams)
   - [VM Sessions (vm_sessions.py)](#vm-sessions)
   - [Auth (auth.py)](#auth)
   - [Users (users.py)](#users)
   - [Standards (standards.py)](#standards)
   - [Study Contents (study_contents.py)](#study-contents)
   - [Verify (verify.py)](#verify)
   - [Activity (activity.py)](#activity)
   - [Health/Debug/Init/Reset](#health-debug-init-reset)
4. [Vulnerabilidades de Seguridad](#vulnerabilidades-de-seguridad)
5. [Recomendaciones](#recomendaciones)

---

## Resumen Ejecutivo

| Categoría | Cantidad |
|---|---|
| **Endpoints directamente accesibles al coordinador** | ~95+ |
| **Endpoints de solo lectura (exams:read)** | ~15 |
| **Endpoints sin autenticación (públicos)** | ~14 |
| **Vulnerabilidades CRÍTICAS** | 5 |
| **Vulnerabilidades ALTAS** | 4 |
| **Vulnerabilidades MEDIAS** | 6 |

---

## Patrones de Autenticación

El backend utiliza 5 patrones de autenticación distintos:

| Patrón | Descripción | Roles permitidos |
|---|---|---|
| `@coordinator_required` | Decorador en partners.py, balance.py | admin, developer, coordinator |
| `@management_required` | Decorador en user_management.py | admin, developer, coordinator |
| `_require_roles(*roles)` | Función inline en badges.py | Roles especificados por endpoint |
| `@require_permission(perm)` | Basado en `has_permission()` del modelo User | Según mapa de permisos |
| **Inline role check** | `if user.role not in [...]` | Variable |

---

## Endpoints por Módulo

### Partners
**Prefijo URL:** `/api/partners`  
**Archivo:** `partners.py` (15100 líneas)  
**Decorador:** `@coordinator_required` (permite admin, developer, coordinator)  
**Multi-tenant:** Filtra por `coordinator_id` via `_get_coordinator_filter()`

#### Partners CRUD
| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `/mexican-states` | jwt_required (solo) | Listar estados mexicanos | Sin role check |
| GET | `/countries` | jwt_required (solo) | Listar países | Sin role check |
| GET | `` | coordinator_required | Listar partners (filtrado por coordinator_id) | ✅ Multi-tenant |
| GET | `/<partner_id>` | coordinator_required + `_verify_partner_access` | Detalle de partner | ✅ |
| POST | `` | coordinator_required | Crear partner | ✅ |
| PUT | `/<partner_id>` | coordinator_required + `_verify_partner_access` | Actualizar partner | ✅ |
| DELETE | `/<partner_id>` | coordinator_required + `_verify_partner_access` | Soft delete partner | ✅ |

#### Partner States (Presencia estatal)
| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `/<partner_id>/states` | coordinator_required | Presencias estatales | ⚠️ **SIN `_verify_partner_access`** |
| POST | `/<partner_id>/states` | coordinator_required | Agregar presencia | ⚠️ **SIN `_verify_partner_access`** |
| DELETE | `/<partner_id>/states/<id>` | coordinator_required | Eliminar presencia | ⚠️ **SIN `_verify_partner_access`** |

#### Campuses
| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `/<partner_id>/campuses` | coordinator_required + `_verify_partner_access` | Listar planteles | ✅ |
| POST | `/<partner_id>/campuses` | coordinator_required + `_verify_partner_access` | Crear plantel (crea usuario responsable, devuelve contraseña temporal) | ✅ |
| GET | `/campuses/<campus_id>` | coordinator_required + `_verify_campus_access` | Detalle plantel | ✅ |
| PUT | `/campuses/<campus_id>` | coordinator_required + `_verify_campus_access` | Actualizar plantel | ✅ |
| DELETE | `/campuses/<campus_id>` | coordinator_required + `_verify_campus_access` | Soft delete plantel | ✅ |
| DELETE | `/campuses/<campus_id>/permanent-delete` | jwt_required + inline role check `admin,developer` | Eliminación permanente | ❌ Coordinador NO tiene acceso |
| POST | `/campuses/<campus_id>/activate` | coordinator_required + `_verify_campus_access` | Activar plantel | ✅ |
| POST | `/campuses/<campus_id>/deactivate` | coordinator_required + `_verify_campus_access` | Desactivar plantel | ✅ |
| POST | `/campuses/<campus_id>/configure` | coordinator_required + `_verify_campus_access` | Configurar plantel (tiers, costos, ECMs, VMs) | ✅ |
| GET | `/campuses/<campus_id>/config` | coordinator_required + `_verify_campus_access` | Config de plantel | ✅ |

#### Campus Responsables
| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| POST | `/campuses/<id>/responsable` | coordinator_required + `_verify_campus_access` | Crear responsable | ✅ |
| GET | `/campuses/<id>/responsable` | coordinator_required + `_verify_campus_access` | Obtener responsable | ✅ |
| PUT | `/campuses/<id>/responsable` | coordinator_required + `_verify_campus_access` | Actualizar responsable | ✅ |
| GET | `/campuses/<id>/available-responsables` | coordinator_required + `_verify_campus_access` | Listar responsables disponibles | ✅ |
| POST | `/campuses/<id>/assign-responsable` | coordinator_required + `_verify_campus_access` | Asignar responsable existente | ✅ |
| GET | `/campuses/<id>/responsables` | coordinator_required + `_verify_campus_access` | Todos los responsables | ✅ |
| POST | `/campuses/<id>/responsables` | coordinator_required + `_verify_campus_access` | Agregar responsable | ✅ |
| PUT | `/campuses/<id>/responsables/<uid>` | coordinator_required + `_verify_campus_access` | Actualizar permisos responsable | ✅ |
| DELETE | `/campuses/<id>/responsables/<uid>` | coordinator_required + `_verify_campus_access` | Desactivar responsable | ✅ |

#### Campus ECMs & Cycles
| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `/campuses/<id>/competency-standards` | coordinator_required + `_verify_campus_access` | ECMs del plantel | ✅ |
| PUT | `/campuses/<id>/competency-standards` | coordinator_required + `_verify_campus_access` | Actualizar ECMs | ✅ |
| GET | `/competency-standards/available` | coordinator_required | ECMs disponibles | ✅ Sin scoping necesario |
| GET | `/campuses/<id>/cycles` | coordinator_required + `_verify_campus_access` | Ciclos escolares | ✅ |
| POST | `/campuses/<id>/cycles` | coordinator_required + `_verify_campus_access` | Crear ciclo | ✅ |
| GET | `/cycles/<cycle_id>` | coordinator_required | Detalle ciclo | ⚠️ Sin verify access |
| PUT | `/cycles/<cycle_id>` | coordinator_required | Actualizar ciclo | ⚠️ Sin verify access |
| DELETE | `/cycles/<cycle_id>` | coordinator_required | Soft delete ciclo | ⚠️ Sin verify access |
| DELETE | `/cycles/<cycle_id>/permanent-delete` | admin/developer only | Eliminación permanente | ❌ No coordinador |

#### Groups
| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `/campuses/<id>/groups` | coordinator_required + `_verify_campus_access` | Listar grupos | ✅ |
| POST | `/campuses/<id>/groups` | coordinator_required + `_verify_campus_access` | Crear grupo | ✅ |
| GET | `/groups/list-all` | coordinator_required | Listar todos los grupos (filtrado) | ✅ Multi-tenant |
| GET | `/groups/search` | coordinator_required | Buscar grupos | ✅ Multi-tenant |
| GET | `/groups/<group_id>` | coordinator_required + `_verify_group_access` | Detalle grupo | ✅ |
| PUT | `/groups/<group_id>` | coordinator_required + `_verify_group_access` | Actualizar grupo | ✅ |
| DELETE | `/groups/<group_id>` | coordinator_required + `_verify_group_access` | Soft delete grupo | ✅ |
| GET | `/groups/<id>/config` | coordinator_required + `_verify_group_access` | Config de grupo | ✅ |
| PUT | `/groups/<id>/config` | coordinator_required + `_verify_group_access` | Actualizar config | ✅ |
| POST | `/groups/<id>/config/reset` | coordinator_required + `_verify_group_access` | Reset config | ✅ |
| GET | `/groups/<id>/members/count` | coordinator_required | Contar miembros | ⚠️ Sin verify access |

#### Group Members
| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `/groups/<id>/members` | coordinator_required + `_verify_group_access` | Listar miembros | ✅ |
| GET | `/groups/<id>/campus-responsables` | coordinator_required + `_verify_group_access` | Responsables del plantel del grupo | ✅ |
| POST | `/groups/<id>/members` | coordinator_required + `_verify_group_access` | Agregar miembro | ✅ |
| POST | `/groups/<id>/members/bulk` | coordinator_required + `_verify_group_access` | Carga masiva | ✅ |
| POST | `/groups/<id>/members/bulk-assign-by-criteria` | coordinator_required + `_verify_group_access` | Asignación por criterios | ✅ |
| PUT | `/groups/<id>/members/<mid>` | coordinator_required + `_verify_group_access` | Actualizar miembro | ✅ |
| DELETE | `/groups/<id>/members/<mid>` | coordinator_required + `_verify_group_access` | Eliminar miembro | ✅ |
| GET | `/groups/<id>/members/<mid>/check-assignments` | coordinator_required + `_verify_group_access` | Verificar asignaciones | ✅ |
| GET | `/candidates/search` | coordinator_required | Buscar candidatos | ✅ Multi-tenant |
| GET | `/groups/members/template` | coordinator_required | Plantilla Excel | ✅ |
| POST | `/groups/<id>/members/upload` | coordinator_required + `_verify_group_access` | Subir Excel | ✅ |

#### Group Exams (Asignaciones)
| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `/groups/<id>/exams` | coordinator_required + `_verify_group_access` | Exámenes del grupo | ✅ |
| GET | `/groups/<id>/exams/<eid>/detail` | coordinator_required + `_verify_group_access` | Detalle asignación | ✅ |
| POST | `/groups/<id>/assignment-cost-preview` | coordinator_required + `_verify_group_access` | Preview de costo | ✅ |
| POST | `/groups/<id>/exams` | coordinator_required + `_verify_group_access` | Asignar examen (deduce saldo) | ✅ |
| DELETE | `/groups/<id>/exams/<eid>` | coordinator_required + `_verify_group_access` | Desasignar examen | ✅ |
| GET | `/groups/<id>/exams/<eid>/members` | coordinator_required + `_verify_group_access` | Miembros del examen | ✅ |
| PUT | `/groups/<id>/exams/<eid>/members` | coordinator_required + `_verify_group_access` | Actualizar miembros | ✅ |
| POST | `/groups/<id>/exams/<eid>/members/add` | coordinator_required + `_verify_group_access` | Agregar miembros al examen | ✅ |
| GET | `/groups/<id>/exams/<eid>/members-detail` | coordinator_required + `_verify_group_access` | Detalle de miembros | ✅ |

#### Dashboard y User-Partner Links
| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `/dashboard` | coordinator_required | Dashboard del coordinador | ✅ |
| GET | `/<partner_id>/users` | coordinator_required + `_verify_partner_access` | Usuarios del partner | ✅ |
| POST | `/<partner_id>/users/<uid>` | coordinator_required + `_verify_partner_access` | Agregar usuario al partner | ✅ |
| DELETE | `/<partner_id>/users/<uid>` | coordinator_required + `_verify_partner_access` | Remover usuario | ✅ |
| GET | `/users/<uid>/partners` | coordinator_required | Partners de un usuario | ⚠️ Sin scoping |
| POST | `/users/<uid>/partners` | coordinator_required | Asignar partners a usuario | ⚠️ Sin scoping |

#### Candidate Self-service (NO coordinador)
| Método | Ruta | Protección | Descripción |
|---|---|---|---|
| GET | `/my-partners` | jwt_required | Mis partners (cualquier usuario) |
| GET | `/available` | jwt_required | Partners disponibles |
| POST | `/my-partners/<pid>` | jwt_required | Vincular a partner |
| DELETE | `/my-partners/<pid>` | jwt_required | Desvincular |

---

### User Management
**Prefijo URL:** `/api/user-management`  
**Archivo:** `user_management.py` (1875 líneas)  
**Decorador:** `@management_required` (permite admin, developer, coordinator)

| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `/users` | management_required | Listar usuarios (coordinador: solo candidato, responsable, responsable_partner con coordinator_id) | ✅ Multi-tenant |
| GET | `/users/<id>` | management_required | Detalle usuario | ✅ Con scoping coordinador |
| POST | `/users` | management_required | Crear usuario (coordinador puede crear: candidato, responsable, responsable_partner) | ✅ Restricción de roles |
| PUT | `/users/<id>` | management_required | Actualizar usuario (coordinador: solo candidato, responsable, responsable_partner con coordinator_id match) | ✅ Multi-tenant |
| PUT | `/users/<id>/password` | management_required | Cambiar contraseña (coordinador: solo sus usuarios) | ✅ Multi-tenant |
| POST | `/users/<id>/generate-password` | management_required | Generar contraseña temporal (coordinador: solo sus usuarios) | ✅ Multi-tenant |
| GET | `/users/<id>/password` | management_required | **Obtener contraseña descifrada** (coordinador: solo sus usuarios) | ⚠️ Expone contraseñas en plaintext |
| POST | `/users/<id>/toggle-active` | management_required | Activar/desactivar usuario | ✅ Multi-tenant |
| PUT | `/users/<id>/document-options` | management_required | Actualizar opciones de documentos | ✅ Multi-tenant |
| DELETE | `/users/<id>` | **admin_required** | Eliminar permanentemente | ❌ Solo admin |
| GET | `/stats` | management_required | Estadísticas de usuarios | ✅ Multi-tenant |
| POST | `/stats/invalidate` | management_required | Invalidar caché stats | ✅ |
| GET | `/roles` | management_required | Roles disponibles para creación | ✅ Filtrado |
| GET | `/available-campuses` | management_required | Planteles disponibles | ✅ |
| GET | `/available-partners` | management_required | Partners disponibles | ✅ |
| POST | `/candidates/bulk-upload` | management_required | Carga masiva Excel | ✅ Multi-tenant |
| GET | `/candidates/bulk-upload/template` | management_required | Descargar plantilla | ✅ |
| POST | `/export-credentials` | management_required | **Exportar credenciales en Excel con contraseñas** (coordinador: solo sus usuarios) | ⚠️ Expone contraseñas |

---

### Balance
**Prefijo URL:** `/api/balance`  
**Archivo:** `balance.py` (1973 líneas)  
**Decoradores:** `coordinator_required`, `financiero_required`, `approver_required`, `gerente_required`

#### Accesibles al coordinador:
| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `/my-balance` | jwt_required + inline coordinator check | Saldos del coordinador | ✅ |
| GET | `/my-transactions` | jwt_required + inline coordinator check | Historial de transacciones | ✅ |
| GET | `/my-requests` | jwt_required + inline coordinator check | Solicitudes de saldo | ✅ |
| POST | `/request` | coordinator_required + inline coordinator check | Crear solicitud de saldo/beca | ✅ |
| POST | `/request-batch` | coordinator_required + inline coordinator check | Crear múltiples solicitudes | ✅ |
| PUT | `/requests/<id>/cancel` | jwt_required(optional) + inline role check | Cancelar solicitud propia | ⚠️ Usa `coordinador` (con "r") en lugar de `coordinator` |
| GET | `/requests/<id>` | jwt_required(optional) + inline role check | Detalle de solicitud (solo propias) | ✅ |
| POST | `/upload-attachment` | jwt_required(optional) + inline role check `admin,developer,gerente,coordinator` | Subir adjunto | ✅ |
| PUT | `/request/<id>/attachments` | coordinator_required | Actualizar adjuntos de solicitud (solo propias) | ✅ |
| GET | `/assignment-history` | jwt_required + inline check | Historial de asignaciones | ✅ |

#### NO accesibles al coordinador:
| Método | Ruta | Protección | Descripción |
|---|---|---|---|
| GET | `/pending-requests` | financiero_required | Solicitudes pendientes |
| PUT | `/requests/<id>/review` | financiero_required | Revisar solicitud |
| GET | `/requests-for-approval` | approver_required | Solicitudes para aprobación |
| PUT | `/requests/<id>/approve` | approver_required | Aprobar solicitud |
| PUT | `/requests/<id>/reject` | approver_required | Rechazar solicitud |
| GET | `/coordinators` | financiero_required | Saldos de coordinadores |
| POST | `/adjustments` | approver_required | Ajuste manual |
| GET | `/stats` | financiero_required | Estadísticas de saldos |
| GET | `/delegation/financieros` | gerente_required | Financieros para delegación |
| PUT | `/delegation/financieros/<id>/toggle` | gerente_required | Toggle delegación |
| GET/POST | `/email-action/<token>` | Token propio | Acción desde email |

---

### Badges
**Prefijo URL:** `/api/badges`  
**Archivo:** `badges.py` (718 líneas)  
**Función auth:** `_require_roles(*roles)`

| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `/templates` | `admin, editor, coordinator` | Listar plantillas de insignias | ⚠️ **Sin multi-tenant: ve TODAS** |
| POST | `/templates` | `admin, editor, coordinator` | Crear plantilla | ⚠️ **Sin multi-tenant** |
| GET | `/templates/<id>` | `admin, editor, coordinator` | Detalle plantilla | ⚠️ |
| PUT | `/templates/<id>` | `admin, editor, coordinator` | Actualizar plantilla | ⚠️ **Puede editar plantillas de otros** |
| DELETE | `/templates/<id>` | `admin, editor` | Eliminar plantilla | ❌ Coordinador NO tiene acceso |
| POST | `/templates/<id>/image` | `admin, editor, coordinator` | Subir imagen de plantilla | ⚠️ |
| DELETE | `/templates/<id>/image` | `admin, editor, coordinator` | Eliminar imagen | ⚠️ |
| POST | `/issue` | `admin, editor, coordinator` | **Emitir insignia a CUALQUIER usuario** | 🔴 **SIN multi-tenant** |
| POST | `/issue-batch` | `admin, editor, coordinator` | **Emitir insignias en lote** | 🔴 **SIN multi-tenant** |
| GET | `/user/<user_id>` | `admin, editor, coordinator` | **Insignias de CUALQUIER usuario** | 🔴 **SIN multi-tenant** |
| GET | `/group/<group_id>` | `admin, editor, coordinator` | Insignias de grupo | ⚠️ **Sin verify group access** |
| GET | `/group/<group_id>/export-excel` | `admin, editor, coordinator` | Exportar insignias de grupo | ⚠️ |
| POST | `/group/<group_id>/issue-pending` | `admin, editor, coordinator` | Emitir insignias pendientes | ⚠️ |
| POST | `/<id>/revoke` | `admin, editor` | Revocar insignia | ❌ Coordinador NO |
| GET | `/my-badges` | jwt_required (cualquiera) | Mis insignias | ✅ |
| POST | `/<id>/claim` | jwt_required (cualquiera) | Reclamar insignia | ✅ |
| GET | `/<id>/linkedin-url` | jwt_required (cualquiera) | URL para LinkedIn | ✅ |

#### Endpoints PÚBLICOS (SIN autenticación):
| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `/<uuid>/credential.json` | NINGUNA | Credential JSON-LD | ✅ Público por diseño |
| GET | `/issuer` | NINGUNA | Perfil del emisor | ✅ Público por diseño |
| GET | `/verify/<code>` | NINGUNA | Verificar insignia | ✅ Público por diseño |
| POST | `/<id>/share` | NINGUNA | Registrar compartida | 🔴 **SIN AUTH - se puede abusar** |

---

### CONOCER
**Prefijo URL:** `/api/conocer`  
**Archivo:** `conocer.py` (873 líneas)  
**Auth:** Inline role checks

#### Accesibles al coordinador:
| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| POST | `/admin/upload-batch` | `admin, coordinator` | Subir ZIP de certificados CONOCER | ⚠️ **Sin multi-tenant: puede subir para cualquier usuario** |
| GET | `/admin/upload-batches` | `admin, coordinator` | Listar lotes de carga | ⚠️ **Ve TODOS los lotes, no solo los propios** |
| GET | `/admin/upload-batches/<id>` | `admin, coordinator` | Detalle de lote | ⚠️ |
| GET | `/admin/upload-batches/<id>/logs` | `admin, coordinator` | Logs del lote | ⚠️ |
| GET | `/admin/upload-batches/<id>/export` | `admin, coordinator` | Exportar logs Excel | ⚠️ |
| POST | `/admin/upload-batches/<id>/retry` | `admin, coordinator` | Reintentar lote | ⚠️ |

#### NO accesibles al coordinador:
| Método | Ruta | Protección | Descripción |
|---|---|---|---|
| POST | `/admin/certificates` | `admin, developer, editor` | Subir certificado individual |
| POST | `/admin/certificates/<id>/archive` | `admin, developer` | Archivar certificado |
| GET | `/admin/certificates/by-user/<uid>` | `admin, developer, editor, soporte` | Certificados por usuario |

---

### Exams
**Prefijo URL:** `/api/exams`  
**Archivo:** `exams.py` (4416 líneas)  
**Auth:** `require_permission()` basado en `has_permission()`  
**Permisos del coordinador:** `exams:read` (NO tiene create, update, delete)

#### Accesibles al coordinador (solo lectura):
| Método | Ruta | Protección | Descripción |
|---|---|---|---|
| GET | `` | jwt_required (sin permission check) | Listar exámenes |
| GET | `/<exam_id>` | jwt_required (sin permission check) | Detalle de examen |
| GET | `/<exam_id>/categories` | jwt_required (sin permission check) | Categorías del examen |
| GET | `/categories/<cat_id>/topics` | jwt_required (sin permission check) | Temas de categoría |
| GET | `/question-types` | jwt_required (sin permission check) | Tipos de preguntas |
| GET | `/topics/<topic_id>/questions` | jwt_required (sin permission check) | Preguntas de tema |
| GET | `/questions/<qid>` | jwt_required (sin permission check) | Detalle pregunta |
| GET | `/questions/<qid>/answers` | jwt_required (sin permission check) | Respuestas |
| GET | `/topics/<topic_id>/exercises` | jwt_required (sin permission check) | Ejercicios |
| GET | `/exercises/<eid>/details` | jwt_required (sin permission check) | Detalle ejercicio |
| GET | `/exercises/<eid>/steps` | jwt_required (sin permission check) | Pasos de ejercicio |
| GET | `/steps/<sid>` | jwt_required (sin permission check) | Paso individual |
| GET | `/steps/<sid>/actions` | jwt_required (sin permission check) | Acciones del paso |
| GET | `/actions/<aid>` | jwt_required (sin permission check) | Acción individual |
| GET | `/<exam_id>/validate` | `exams:read` | Validar examen |
| GET | `/<exam_id>/check-ecm-conflict` | `exams:read` | Verificar conflicto ECM |
| GET | `/<exam_id>/check-access` | jwt_required | Verificar acceso a examen |
| GET | `/<exam_id>/my-results` | jwt_required | Mis resultados |
| GET | `/results/<rid>/generate-pdf` | jwt_required | Generar PDF reporte |
| GET | `/results/<rid>/generate-certificate` | jwt_required | Generar certificado |
| GET | `/results/<rid>/debug-data` | jwt_required | Debug data resultado |
| POST | `/results/<rid>/request-pdf` | jwt_required | Solicitar PDF |
| GET | `/results/<rid>/pdf-status` | jwt_required | Estado del PDF |

#### NO accesibles al coordinador:
| Método | Ruta | Permiso requerido | Descripción |
|---|---|---|---|
| POST | `` | `exams:create` | Crear examen |
| POST | `/<exam_id>/clone` | `exams:create` | Clonar examen |
| PUT | `/<exam_id>` | `exams:update` | Actualizar examen |
| DELETE | `/<exam_id>` | `exams:delete` | Eliminar examen |
| POST | `/<exam_id>/publish` | `exams:update` | Publicar |
| POST | `/<exam_id>/unpublish` | `exams:update` | Despublicar |
| Todos los POST/PUT/DELETE de categories, topics, questions, answers, exercises, steps, actions | `exams:create/update/delete` | CRUD de contenido |

#### PÚBLICOS (SIN autenticación):
| Método | Ruta | Descripción | Notas seguridad |
|---|---|---|---|
| GET | `/exercises/ping` | Health check | ✅ |
| POST | `/migrate-exercise-tables` | **Crea tablas en la BD** | 🔴 **CRÍTICO: Sin auth** |
| POST | `/fix-ordering-answers` | **Modifica datos en BD** | 🔴 **CRÍTICO: Sin auth** |

---

### VM Sessions
**Prefijo URL:** `/api/vm-sessions`  
**Archivo:** `vm_sessions.py` (520 líneas)  
**Auth:** Inline role checks

| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `/check-access` | jwt_required + inline | Verificar acceso a VMs | ✅ (devuelve read_only para coordinador) |
| GET | `/sessions` | jwt_required + inline `coordinator` check | Listar sesiones (filtrado por campuses del coordinador) | ✅ Multi-tenant |
| POST | `/sessions` | jwt_required + inline `admin, coordinator` | Crear sesión de VM | ⚠️ Coordinador puede crear sesiones para otros usuarios |
| DELETE | `/sessions/<id>` | jwt_required + candidato check | Cancelar sesión | ✅ |
| PATCH | `/sessions/<id>/status` | `admin, developer, coordinator` | Actualizar estado sesión | ⚠️ **Sin verify que la sesión pertenece a campuses del coordinador** |
| GET | `/available-slots` | jwt_required + inline | Slots disponibles | ✅ (muestra detalles para coordinador) |

---

### Auth
**Prefijo URL:** `/api/auth`  
**Archivo:** `auth.py` (1167 líneas)  
**Aplica a TODOS los usuarios autenticados o público:**

| Método | Ruta | Protección | Descripción |
|---|---|---|---|
| POST | `/register` | PÚBLICO | Registro |
| POST | `/login` | PÚBLICO | Login |
| POST | `/refresh` | jwt_required(refresh=True) | Refrescar token |
| POST | `/logout` | jwt_required | Logout |
| GET | `/me` | jwt_required | Perfil propio |
| PUT | `/me` | jwt_required | Actualizar perfil |
| PUT | `/change-password` | jwt_required | Cambiar contraseña |
| POST | `/verify-password` | jwt_required | Verificar contraseña |
| POST | `/request-email-change` | jwt_required | Solicitar cambio email |
| POST | `/forgot-password` | PÚBLICO | Recuperar contraseña |
| POST | `/reset-password` | PÚBLICO | Resetear contraseña |
| POST | `/contact` | rate limited | Formulario contacto |
| GET | `/my-assignments` | jwt_required | Mis asignaciones |
| GET | `/campus-assignments` | jwt_required (responsable only) | Asignaciones del plantel |

---

### Users
**Prefijo URL:** `/api/users`  
**Archivo:** `users.py` (775 líneas)  
**Auth:** `has_permission('users:read')` para lista/detalle

| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `` | `users:read` | Listar usuarios | ✅ Coordinador tiene `users:read` |
| GET | `/<id>` | `users:read` | Detalle usuario | ⚠️ Sin multi-tenant filtering |
| GET | `/me/dashboard` | jwt_required (candidato) | Dashboard candidato | Solo candidatos |
| GET | `/me/editor-dashboard` | jwt_required + inline `admin, editor, editor_invitado` | Dashboard editor | ❌ Coordinador excluido |

---

### Standards
**Prefijo URL:** `/api/competency-standards`  
**Archivo:** `standards.py` (846 líneas)

| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `` | jwt_required (cualquiera) | Listar estándares | ✅ Solo lectura |
| GET | `/<id>` | jwt_required (cualquiera) | Detalle estándar | ✅ |
| GET | `/<id>/exams` | jwt_required (cualquiera) | Exámenes del estándar | ✅ |
| POST | `` | `admin, developer, editor` | Crear estándar | ❌ Coordinador excluido |
| PUT | `/<id>` | `admin, developer, editor` | Actualizar estándar | ❌ |
| DELETE | `/<id>` | `admin, developer, editor` | Eliminar estándar | ❌ |

---

### Study Contents
**Prefijo URL:** `/api/study-contents`  
**Archivo:** `study_contents.py` (3182 líneas)  
**Decorador CRUD:** `admin_or_editor_required` (admin, developer, editor, editor_invitado — **SIN coordinador**)

| Método | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| GET | `` | jwt_required (cualquiera) | Listar materiales | ✅ Solo lectura para coordinador |
| GET | `/<id>` | jwt_required (cualquiera) | Detalle material | ✅ |
| Todo POST/PUT/DELETE de materiales, sesiones, temas, contenido | admin_or_editor_required | CRUD de contenido | ❌ Coordinador excluido |

#### PÚBLICOS (SIN autenticación) — ¡PELIGRO!:
| Método | Ruta | Descripción | Notas seguridad |
|---|---|---|---|
| GET | `/setup-exams-table` | **Crea tablas en BD** | 🔴 **CRÍTICO** |
| GET | `/list-materials` | Lista materiales sin auth | 🔴 **Fuga de datos** |
| GET | `/debug-exams/<id>` | Debug info sin auth | 🔴 **Fuga de datos** |
| GET | `/setup-sessions-tables` | **Crea tablas en BD** | 🔴 **CRÍTICO** |
| GET | `/fix-sessions-fk` | **Modifica BD** | 🔴 **CRÍTICO** |
| POST | `/migrate-exams-table` | **Modifica BD** | 🔴 **CRÍTICO** |
| GET | `/setup-progress-tables` | **Crea tablas en BD** | 🔴 **CRÍTICO** |
| GET | `/debug-all-progress-records` | Debug data sin auth | ⚠️ |
| GET | `/debug-progress-tables` | Debug data sin auth | ⚠️ |

---

### Verify
**Prefijo URL:** `/api/verify`  
**Archivo:** `verify.py` (365 líneas)  
**Todos PÚBLICOS (por diseño):**

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/<code>` | Verificar certificado/reporte por código |

---

### Activity
**Prefijo URL:** `/api/activity`  
**Archivo:** `activity.py` (371 líneas)  
**Decorador:** `gerente_required` (admin, developer, gerente)

**❌ Coordinador NO tiene acceso a ningún endpoint de actividad.**

---

### Health/Debug/Init/Reset
**Todos PÚBLICOS o protegidos por token:**

| Archivo | Ruta | Protección | Descripción | Notas seguridad |
|---|---|---|---|---|
| health.py | `/api/health` | PÚBLICO | Health check | ✅ |
| health.py | `/api/ping` | PÚBLICO | Keep-alive | ✅ |
| health.py | `/api/warmup` | PÚBLICO | DB warmup | ✅ |
| init.py | `/api/init-database` | INIT_TOKEN header | Inicializar BD | ⚠️ Token hardcoded: `temp-init-token-12345` |
| reset.py | `/api/reset-database` | INIT_TOKEN header | **DROP + recrear todas las tablas** | 🔴 **Token hardcoded en producción** |
| debug.py | `/api/check-partners-routes` | PÚBLICO | Lista rutas registradas | ⚠️ Información interna |
| debug.py | `/api/create-group-study-tables` | PÚBLICO | **Crea tablas en BD** | 🔴 **CRÍTICO** |

---

## Vulnerabilidades de Seguridad

### 🔴 CRÍTICAS

| # | Ubicación | Vulnerabilidad | Impacto |
|---|---|---|---|
| **C1** | `exams.py:47` — `POST /api/exams/migrate-exercise-tables` | **Sin autenticación**, ejecuta `db.create_all()` | Cualquiera puede crear/modificar tablas en la BD |
| **C2** | `exams.py:69` — `POST /api/exams/fix-ordering-answers` | **Sin autenticación**, modifica datos | Cualquiera puede alterar respuestas de exámenes |
| **C3** | `study_contents.py:132,192,255,2338` — Múltiples rutas `/setup-*`, `/fix-*` | **Sin autenticación**, crean tablas y modifican la BD | Exposición total de la base de datos |
| **C4** | `debug.py` — `POST /api/create-group-study-tables` | **Sin autenticación**, crea tablas | Manipulación de esquema de BD |
| **C5** | `init.py` + `reset.py` — Token hardcoded `temp-init-token-12345` | Token predecible para `/api/reset-database` que hace **DROP ALL** | Destrucción total de datos si se descubre el token |

### 🟠 ALTAS

| # | Ubicación | Vulnerabilidad | Impacto |
|---|---|---|---|
| **A1** | `badges.py` — `POST /issue`, `POST /issue-batch` | Coordinador puede emitir insignias a **CUALQUIER usuario** del sistema sin restricción multi-tenant | Insignias fraudulentas emitidas a usuarios de otros coordinadores |
| **A2** | `badges.py` — `GET /user/<user_id>` | Coordinador puede ver insignias de **cualquier usuario** | Fuga de datos entre tenants |
| **A3** | `partners.py` — `GET/POST/DELETE /<partner_id>/states` | **Sin `_verify_partner_access()`**: cualquier coordinador puede ver/agregar/eliminar presencias estatales de cualquier partner | Modificación de datos cross-tenant |
| **A4** | `balance.py:479` — `cancel_request` compara `user.role == 'coordinador'` (con "r") en vez de `'coordinator'` | **Bug: los coordinadores NUNCA pueden cancelar sus propias solicitudes** porque el string no coincide | Funcionalidad rota |

### 🟡 MEDIAS

| # | Ubicación | Vulnerabilidad | Impacto |
|---|---|---|---|
| **M1** | `conocer.py` — Todos los endpoints `/admin/upload-batches*` | **Sin multi-tenant**: coordinador ve y gestiona TODOS los lotes de carga de certificados | Fuga de datos cross-tenant |
| **M2** | `badges.py:POST /<id>/share` | **Sin autenticación alguna**, endpoint POST público | Potencial abuso/spam del tracking de compartidos |
| **M3** | `vm_sessions.py` — `PATCH /sessions/<id>/status` | Coordinador puede cambiar estado de sesiones de VM **sin verificar que la sesión pertenece a sus campuses** | Modificación cross-tenant |
| **M4** | `users.py:GET /<id>` | Coordinador tiene permiso `users:read` pero **sin filtro multi-tenant** en detalle de usuario | Puede ver datos de usuarios de otros coordinadores |
| **M5** | `user_management.py:GET /users/<id>/password` | Endpoint que devuelve **contraseñas en texto plano** desencriptadas | Riesgo de exposición masiva de credenciales si se abusa. Solo scoped por coordinator_id, pero la práctica misma es insegura |
| **M6** | `partners.py` — `/users/<uid>/partners`, `/cycles/<cycle_id>` | Endpoints con `coordinator_required` pero **sin verificación de ownership** | Acceso cross-tenant potencial |

---

## Recomendaciones

### Prioridad Inmediata (CRÍTICA)

1. **Eliminar o proteger endpoints de migración/debug en producción:**
   - `POST /api/exams/migrate-exercise-tables`
   - `POST /api/exams/fix-ordering-answers`
   - `GET /api/study-contents/setup-*`, `/fix-*`, `/debug-*`
   - `POST /api/create-group-study-tables`
   - Todos deben requerir al mínimo `admin` + token, o estar detrás de un feature flag.

2. **Cambiar token de init/reset:**
   - `INIT_TOKEN` está hardcoded como `temp-init-token-12345`. Usar un token seguro de entorno o desactivar en producción.

3. **Corregir bug de rol en `balance.py:cancel_request`:**
   - Cambiar `user.role == 'coordinador'` → `user.role == 'coordinator'`

### Prioridad Alta

4. **Agregar multi-tenant a badges.py:**
   - Filtrar plantillas por `created_by` o por partners asociados al coordinador.
   - `POST /issue` y `/issue-batch` deben verificar que los `user_id` pertenecen a candidatos del coordinador.
   - `GET /user/<user_id>` debe verificar ownership.

5. **Agregar `_verify_partner_access` a endpoints de states:**
   - `GET/POST/DELETE /<partner_id>/states`

6. **Agregar multi-tenant a conocer.py:**
   - Filtrar `upload-batches` por `uploaded_by == coordinator_id`.

### Prioridad Media

7. **Agregar protección de auth a `POST /<id>/share` en badges.py.**

8. **Agregar `_verify_session_access` a `PATCH /sessions/<id>/status` en vm_sessions.py.**

9. **Agregar multi-tenant a `GET /api/users/<id>` en users.py** para coordinadores.

10. **Evaluar la necesidad del endpoint `GET /users/<id>/password`** que expone contraseñas en plaintext — considerar eliminarlo y usar solo generación de nuevas contraseñas temporales.

11. **Agregar `_verify_access` a endpoints de cycles y user-partners** en partners.py que actualmente solo tienen `coordinator_required`.

### Mejoras Generales

12. **Estandarizar patrones de auth:** Unificar los 5 patrones diferentes en un sistema consistente de decoradores.

13. **Auditar feature flags:** Los endpoints `/setup-*` y `/migrate-*` deben estar protegidos por un flag de entorno `ENABLE_MIGRATIONS=true`, no accesibles públicamente.

14. **Rate limiting:** Verificar que todos los endpoints de escritura tienen rate limiting apropiado.
