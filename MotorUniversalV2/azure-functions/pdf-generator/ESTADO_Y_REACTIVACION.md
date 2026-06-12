# Estado del Function pdf-generator — DOCUMENTACIÓN DE DESACTIVACIÓN

> Auditado el 2026-06-12 durante la migración MSSQL → PostgreSQL
> (ver `AUDITORIA_MIGRACION.md` en la raíz del repo, Inventario 7).
> Estado confirmado con el equipo: **aparentemente muerto / sin uso contra el esquema V2**.

## Por qué se considera muerto

1. **Sus modelos no corresponden al esquema V2 actual.** `database.py` declara TODOS
   los ids como `UNIQUEIDENTIFIER` (incluido `exams.id`), pero en la base V2 real
   `exams.id` es `INT` autoincrement y las PKs de usuarios/resultados son
   `VARCHAR(36)`. Cualquier query de este Function contra la BD V2 fallaría por
   conversión de tipos. Esto indica que fue escrito contra el esquema **legacy
   (V1/ACEMS)**.
2. **Stack de conexión distinto al backend**: usa `mssql+pyodbc` con ODBC Driver 18 y
   variables propias (`DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`), mientras el
   backend V2 usa `DATABASE_URL` con pymssql.
3. El flujo vigente de PDFs del backend V2 (`backend/app/utils/pdf_generator.py` +
   endpoints `request-pdf`/`pdf-status` en `routes/exams.py`) no depende de este
   Function para los reportes estándar.

## Decisión de la migración a PostgreSQL

**Queda FUERA del alcance de la migración.** No se tocó su código. Si la BD MSSQL
legacy a la que apunta sigue existiendo, el Function seguiría funcionando igual
(la migración V2 → PostgreSQL no lo afecta).

## Si hay que reactivarlo contra V2/PostgreSQL

Checklist completo:

1. **Reescribir `database.py`:**
   - Eliminar `from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER`.
   - Modelos alineados al esquema V2 real (fuente de verdad: `backend/app/models/`):
     `users.id` → `String(36)`; `exams.id` → `Integer`; `results.id` → `String(36)`,
     `results.exam_id` → `Integer`, `results.user_id` → `String(36)`.
   - Connection string: reemplazar el bloque ODBC por la misma `DATABASE_URL` del
     backend (`postgresql://...` post-migración). Mantener compatibilidad por env var.
2. **`requirements.txt` del Function:** quitar `pymssql`, agregar `psycopg2-binary`.
3. **Red:** el Flexible Server de PostgreSQL debe permitir el acceso desde la subnet
   o IPs salientes del Function App (regla de firewall o VNet integration).
4. **Disparador:** revisa la cola (`azure-storage-queue`) que lo alimenta — verificar
   si algún componente del backend aún encola mensajes (buscar `QueueClient` /
   nombre de la cola en `backend/`); a la fecha de esta auditoría no se encontró
   productor activo en el backend V2.
5. **Alternativa recomendada si se reactiva la funcionalidad:** absorber la
   generación al backend (ya tiene ReportLab y los modelos correctos) y usar el
   Function solo como trigger HTTP/cola sin acceso directo a BD, pidiendo los datos
   al API. Evita mantener dos capas de modelos sincronizadas — exactamente el
   problema que lo dejó obsoleto.

## Referencias

- `database.py` — modelos legacy intactos (no tocar sin leer este documento).
- `functions.zip` — artefacto de deploy previo, conservado tal cual.
- `AUDITORIA_MIGRACION.md` (raíz del repo) — Inventario 7 y riesgo #5.
