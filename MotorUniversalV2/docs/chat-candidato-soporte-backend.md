# Chat candidato-soporte (backend)

## Objetivo
Implementar un módulo de chat entre `candidato` y `soporte/admin` sin romper los flujos actuales de soporte ni Azure.

## Alcance
- Modelo de datos: conversaciones, participantes, mensajes y estado de lectura.
- Endpoints REST para crear/listar conversaciones, enviar mensajes, marcar leído y obtener historial paginado.
- Autorización por rol y validaciones de payload.
- Pruebas básicas en SQLite local (sin tocar Azure DB).

## Modelo de datos
Nuevas tablas:
- `support_conversations`
  - `id`, `candidate_user_id`, `created_by_user_id`, `assigned_support_user_id`
  - `subject`, `status` (`open|resolved|closed`), `priority` (`low|normal|high`)
  - `created_at`, `updated_at`, `last_message_at`
- `support_conversation_participants`
  - `id`, `conversation_id`, `user_id`, `participant_role`
  - `joined_at`, `last_read_at`, `last_read_message_id`
  - unique: (`conversation_id`, `user_id`)
- `support_messages`
  - `id`, `conversation_id`, `sender_user_id`
  - `content`, `message_type`
  - `attachment_url`, `attachment_name`, `attachment_mime_type`, `attachment_size_bytes`
  - `created_at`, `edited_at`

## Endpoints
Base: `/api/support/chat`

- `POST /conversations`
  - Candidato: crea conversación para sí mismo.
  - Soporte/admin/developer: puede crear para un `candidate_user_id`.
- `GET /conversations`
  - Candidato: solo las suyas.
  - Soporte/admin/developer: todas (filtro opcional `assigned_to_me=true`).
- `POST /conversations/<conversation_id>/messages`
  - Envía mensaje de texto o adjunto.
- `GET /conversations/<conversation_id>/messages?page=1&per_page=50`
  - Historial paginado.
- `POST /conversations/<conversation_id>/read`
  - Actualiza estado leído (`last_read_at` / `last_read_message_id`).
- `PATCH /conversations/<conversation_id>/status`
  - Actualiza estado (`open|resolved|closed`).
  - Soporte/admin/developer: puede usar todos.
  - Candidato: puede usar `open` y `resolved` para sus conversaciones.

## UI frontend (incluida)
- Candidato:
  - Ruta: `/chat-soporte`
  - Acceso desde menú de usuario (dropdown en navbar, junto a perfil/cerrar sesión).
- Soporte/Admin/Developer:
  - Ruta: `/support/communication`
  - Ventana especial de soporte bajo `SupportLayout`.

## Reglas de autorización
- Roles permitidos en chat: `candidato`, `soporte`, `admin`, `developer`.
- Candidato no puede consultar conversaciones ajenas.
- Soporte/admin/developer puede consultar y responder cualquier conversación.
- No hay borrado de conversaciones en esta versión (se conserva historial).

## Validaciones
- `content` máximo configurable (`SUPPORT_CHAT_MAX_MESSAGE_LENGTH`, default 4000).
- `subject` máximo configurable (`SUPPORT_CHAT_MAX_SUBJECT_LENGTH`, default 255).
- Adjuntos opcionales por metadatos:
  - `attachment.url` obligatorio si hay adjunto.
  - `attachment.mime_type` en whitelist (`SUPPORT_CHAT_ATTACHMENT_MIMES`).
  - `attachment.size_bytes` <= `SUPPORT_CHAT_ATTACHMENT_MAX_BYTES` (default 10 MB).
- Mensaje debe tener `content` o `attachment`.

## Tiempo real recomendado
Fase 1 (rápida y estable):
- Polling cada 5-10s en lista y conversación activa.
- Endpoint de historial paginado + `last_message_at` para detectar cambios.

Fase 2 (tiempo real):
- Opción A: SSE por conversación para notificaciones de nuevos mensajes.
- Opción B: WebSocket para bidireccional (chat typing, presence, acks).
- Para Azure, usar un broker (Redis pub/sub o Azure Web PubSub) para escalar múltiples instancias.

## Adjuntos (si aplica)
- Mantener upload fuera del módulo chat (no subir binario directo aquí).
- Flujo recomendado:
  1. Frontend obtiene URL de upload desde servicio existente.
  2. Sube archivo al storage.
  3. Envía a chat solo metadatos (`url`, `name`, `mime_type`, `size_bytes`).
- Esto evita impactar los flujos actuales de Azure Storage.

## Compatibilidad Azure DB
- Se agregó auto-migración idempotente en arranque: `check_and_create_support_chat_tables()`.
- Solo crea tablas nuevas del chat si no existen.
- No modifica tablas actuales de soporte ni flujos Azure existentes.

## Pruebas básicas
Archivo: `backend/tests/test_support_chat.py`

Cobertura inicial:
- Flujo candidato ↔ soporte completo.
- Restricción de acceso entre candidatos.
- Creación de conversación por soporte para candidato.

Ejecutar:
```bash
cd MotorUniversalV2/backend
pytest -q tests/test_support_chat.py
```

## Checklist para PR limpio
1. Confirmar rama base: `feature/chat-candidato-soporte` desde `jefe/main`.
2. Verificar `git status` solo con archivos del módulo chat.
3. Ejecutar tests locales del módulo.
4. Validar manualmente endpoints con token de candidato y soporte.
5. No incluir cambios de `azure-functions` ni otras features.
6. Adjuntar en PR: alcance, endpoints, validaciones, evidencia de pruebas.
