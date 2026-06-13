# AUDITORÍA DE MIGRACIÓN — Azure SQL (MSSQL) → PostgreSQL 16

> Generada el 2026-06-12 sobre la rama `migracion-postgres`.
> Alcance: `MotorUniversalV2/backend` + `MotorUniversalV2/azure-functions`.
> Excluidos por decisión previa: scripts one-off (`migrate_*.py`, `add_*.py`) ya aplicados.

## Resumen ejecutivo

**Veredicto: MIGRACIÓN LIGERA.** La superficie real de cambios es mucho menor que la
estimada a ciegas: el código ya es mayormente portable (corre en Postgres local vía
docker-compose), `auto_migrate.py` ya ramifica por dialecto en sus secciones grandes,
las búsquedas ya usan `ilike`/`LOWER()` en su mayoría, y no hay stored procedures.

Totales de cambios de código identificados:

| Categoría | Cambios | Archivos |
|---|---|---|
| Booleanos `= 1/0` en SQL crudo | **19 líneas** | partners.py (16), models/partner.py, debug.py, conocer_scheduler.py |
| Concatenación T-SQL con `+` | **8 líneas** | partners.py |
| `SELECT TOP n` → `LIMIT` | **5 líneas** | debug.py (3), partners.py (1), curp_queue_worker.py (1) |
| DDL crudo sin guardia de dialecto | **3 funciones + 1 ruta** | study_contents.py, init.py, debug.py |
| `LIKE` case-sensitive real | **1 línea** | badge_service.py |
| Azure Function (capa de datos) | **1 módulo** (ver hallazgo especial) | pdf-generator/database.py |

## Inventario 1 — Booleanos comparados con 0/1 en SQL crudo (RIESGO #1)

En PG `boolean = integer` lanza `operator does not exist`. Corrección: `= TRUE` /
`= FALSE` (válido también en MSSQL moderno NO — en MSSQL `BIT = 1`; usar literal
portable no existe → **decisión: cambiar a `= TRUE/FALSE` al momento del corte, o
usar parámetro bindeado booleano que SQLAlchemy adapta por dialecto** — recomendado:
parámetro bindeado, funciona en ambos motores sin rama).

| Ubicación | Query | Corrección |
|---|---|---|
| `app/models/partner.py:1141` | `sc.is_published = 1` | bind param booleano |
| `app/routes/partners.py:3965` | `gsm.is_active = 1` | bind param booleano |
| `app/routes/partners.py:9578` | `sc.is_published = 1` | bind param booleano |
| `app/routes/partners.py:9593` | `sc.is_published = 1` | bind param booleano |
| `app/routes/partners.py:15402` | `sc.is_published = 1` | bind param booleano |
| `app/routes/partners.py:15846` | `cs.is_active = 1` | bind param booleano |
| `app/routes/partners.py:15989` | `brands WHERE is_active = 1` | bind param booleano |
| `app/routes/partners.py:16346` | `is_included = 1` | bind param booleano |
| `app/routes/partners.py:16393` | `is_completed = 1` | bind param booleano |
| `app/routes/partners.py:16569` | `brands WHERE is_active = 1` | bind param booleano |
| `app/routes/partners.py:16952` | `is_included = 1` | bind param booleano |
| `app/routes/partners.py:17012` | `is_completed = 1` | bind param booleano |
| `app/routes/partners.py:17738` | `is_included = 1` | bind param booleano |
| `app/routes/partners.py:17777` | `is_completed = 1` | bind param booleano |
| `app/routes/partners.py:19078` | `cg.is_active = 1` | bind param booleano |
| `app/routes/partners.py:19088` | `c.enable_tier_advanced = 1` | bind param booleano |
| `app/routes/partners.py:19605` | `c.enable_tier_advanced = 1` | bind param booleano |
| `app/routes/debug.py:372` | `ex.is_published = 1` | bind param booleano |
| `app/services/conocer_scheduler.py:92` | `c.enable_tier_advanced = 1` | bind param booleano |

Verificado que NO hay variantes `<>`, `!=`, `CASE WHEN bool = 1` ni params enteros
bindeados a columnas booleanas (la única instancia, `auto_migrate.py:3421`, ya es
dialecto-aware con `True if db_type != 'mssql' else 1`).

Nota: columnas `status`/`result` son `Integer` en los modelos — `status = 1` NO se toca.

## Inventario 2 — Concatenación de strings con `+` (T-SQL)

PG usa `||`. Corrección recomendada: `CONCAT(a, b, c)`, que es portable
(MSSQL 2012+ y PG) y además maneja NULLs como string vacío (revisar semántica de
cada caso: en T-SQL `'x' + NULL = NULL`, en CONCAT no — los usos actuales envuelven
con COALESCE precisamente para eso, así que CONCAT simplifica).

| Ubicación | Patrón |
|---|---|
| `app/routes/partners.py:16144` | `COALESCE(' ' + u.second_surname, '')` |
| `app/routes/partners.py:16192` | ídem |
| `app/routes/partners.py:16753` | ídem |
| `app/routes/partners.py:16792` | ídem |
| `app/routes/partners.py:17327` | ídem |
| `app/routes/partners.py:17366` | ídem |
| `app/routes/partners.py:19017` | `LOWER(u.name + ' ' + COALESCE(...))` |
| `app/routes/partners.py:19285` | ídem |

`partners.py:4985` usa `+` pero en expresión SQLAlchemy Core (`' ' + sa_func.nullif(...)`)
— el dialecto lo traduce solo (emite `||` en PG). **No se toca.**

## Inventario 3 — DDL crudo no portable

`auto_migrate.py` (179 sentencias DDL) **ya ramifica por dialecto**: 130 checks
`db_type ==` y ramas `postgresql` explícitas en las secciones de creación de tablas
(verificado en muestras: group_exam_members, campus_competency_standards,
exam_progress). **No requiere reescritura general** — solo verificación de humo al
arrancar contra PG limpio.

Pendientes SIN guardia de dialecto (T-SQL puro: `DATETIME DEFAULT GETDATE()`):

| Ubicación | Qué es | Acción |
|---|---|---|
| `app/routes/study_contents.py:84` `ensure_study_material_exams_table()` | CREATE TABLE study_material_exams | Hacer dialecto-aware (la tabla no tiene modelo propio: es tabla de asociación) |
| `app/routes/study_contents.py:2696` `ensure_student_progress_tables()` | CREATE TABLE student_content_progress / student_topic_progress | Hacer dialecto-aware o delegar a create_all (hay modelos en student_progress.py) |
| `app/routes/study_contents.py:154, 2768` | Funciones `_disabled_*` | Código muerto — eliminar |
| `app/routes/study_contents.py:2944` `migrate_progress_tables()` | CREATE TABLE | Revisar si sigue siendo invocable; si es legacy, eliminar |
| `app/routes/init.py:465` | CREATE TABLE group_exam_members (ruta manual de setup) | Dialecto-aware o eliminar (auto_migrate ya crea esta tabla con ramas) |
| `app/routes/debug.py` (21 sentencias) | Rutas de debug/diagnóstico | Prioridad baja; corregir las que se usen, el resto marcar como mssql-only |

También: `debug.py:708` contiene el único `sp_executesql` (ruta de debug). Marcar
mssql-only o eliminar.

## Inventario 4 — `SELECT TOP n` y residuales T-SQL

| Ubicación | Query | Corrección |
|---|---|---|
| ~~`app/services/curp_queue_worker.py:177`~~ | `SELECT TOP (:lim)` | **FALSO POSITIVO**: ya es dialecto-aware (`if _is_mssql() else` con LIMIT) |
| `app/routes/partners.py:19335` | `SELECT TOP 1` dentro de `OUTER APPLY` | ✅ Corregido: rama por dialecto (ver abajo) |
| `app/routes/debug.py:319, 602, 863` | `SELECT TOP 10/5` | ✅ Corregido: `OFFSET 0 ROWS FETCH FIRST n ROWS ONLY` |

### Hallazgos ADICIONALES detectados durante la ejecución (Fase 1)

La ejecución del barrido encontró 4 patrones T-SQL que la auditoría inicial no inventarió
(todos corregidos en el commit de Fase 1):

| Patrón | Ubicaciones | Corrección aplicada |
|---|---|---|
| `COALESCE(col_booleana, 0)` — en PG truena por tipos | 24 líneas en partners.py (16161-16164, 16200-16203, 16770-16773, 16800-16803, 17344-17347, 17374-17377) | `COALESCE(col, :bool_false)` con param `False` |
| `OUTER APPLY (SELECT TOP 1 ...)` — T-SQL puro | partners.py export RENAPO (~19340) | Rama dialecto: `LEFT JOIN LATERAL ... LIMIT 1 ... ON TRUE` en PG |
| `TRY_CAST(x AS INT)` | partners.py:19327 | Rama dialecto: `CASE WHEN x ~ '^[0-9]+$' THEN CAST(...) END` en PG |
| `LEN(x)` | partners.py:19086 | f-string `{len_fn}`: `LEN` en mssql, `LENGTH` en PG |
| `ROUND(<float>, n)` — PG no tiene round(double, int) | partners.py 15954-15955, 16304, 16908 | `ROUND(CAST(x AS DECIMAL(18,6)), n)` portable |

### Hallazgo CRÍTICO detectado en la Fase 4 (suite de integración)

`_table_has_identity()` usaba `COLUMNPROPERTY(OBJECT_ID(...), 'id', 'IsIdentity')`
— **introspección exclusiva de T-SQL**. En PG lanzaba excepción → `except` →
`False` para TODAS las tablas → `_make_record()` creía que ninguna tabla
auto-genera id y hacía `INSERT` con id explícito y columnas crudas, **saltándose
los defaults de Python del modelo** → `IntegrityError` 409 en CADA creación de
partner, campus, grupo, vm_session y chat (causa de los ~480 ERROR de la suite).

| Ubicación | Corrección |
|---|---|
| `app/routes/partners.py:148` | Dialecto-aware: en PG `pg_get_serial_sequence(t,'id') IS NOT NULL` |
| `app/services/support_service.py:24` (copia duplicada) | Misma corrección |

Por qué se escapó al inventario inicial: el grep de DDL/booleanos no cubría
funciones de introspección de catálogo. **Lección**: las rutas de creación de
entidades (`_make_record`) son tan críticas como las queries de lectura, y el
patrón "detectar capacidad del motor con función nativa" debe revisarse aparte.

Lección para la Fase 4 (validación): el muestreo de queries durante el soak debe
vigilar especialmente partners.py — concentra todo el SQL crudo no trivial. Y la
suite de integración es indispensable: este bug NO aparecía en el smoke de lectura.

No existen en el código: `ISNULL`, `IIF`, `MERGE`, `DATEADD`, `DATEDIFF`, `CONVERT`,
`NOLOCK`, `#temp`, `@@IDENTITY`, `SCOPE_IDENTITY`, `OUTPUT INSERTED`, hints de tabla,
ni transacciones con sintaxis T-SQL. `OFFSET ... ROWS FETCH NEXT ... ROWS ONLY`
(4 usos en partners.py) es SQL estándar soportado por PG — no se traduce.

## Inventario 5 — Secuencias (setval post-ETL)

- **~66 PKs `Integer` autoincrement en 26 archivos de modelos** (partner.py concentra 20;
  también exam, topic, category, question_number no, balance, badge, support_chat,
  study_content con 8, etc.). Tras el ETL, ejecutar por cada tabla:
  `SELECT setval(pg_get_serial_sequence('<tabla>','id'), COALESCE(MAX(id),1)) FROM <tabla>;`
  El script ETL debe generar esta lista dinámicamente desde la metadata de SQLAlchemy
  (no hardcodear las 66).
- **14 PKs `String(36)`** (users, questions, exercises, results, etc.) — sin secuencia,
  sin cambio.

## Inventario 6 — Fechas

- 63 archivos usan `datetime.utcnow` (naive UTC); MSSQL `DATETIME` también es naive.
- Única excepción: `study_export.py` usa `datetime.now(timezone.utc)` (aware).
- **Recomendación: `timestamp` (sin time zone) en PG** — paridad exacta de
  comportamiento, cero cambios de serialización. Es además lo que `db.create_all()`
  genera por defecto para `db.DateTime`. Documentar que la app es naive-UTC por
  convención. NO usar `timestamptz` en esta migración (sería mejora aparte).

## Inventario 7 — Azure Function pdf-generator (HALLAZGO ESPECIAL)

`azure-functions/pdf-generator/database.py` define modelos duplicados donde **TODOS
los ids son `UNIQUEIDENTIFIER`, incluido `exams.id` — pero en el esquema V2 real
`exams.id` es `INT`**. Además usa ODBC Driver 18 (el backend usa pymssql) y vars
propias (`DB_SERVER/DB_NAME/DB_USER/DB_PASSWORD`).

Esto indica que el Function apunta al **esquema legacy (V1/ACEMS)** o está
desactualizado/sin uso real contra V2. **Acción requerida ANTES de migrarlo:
confirmar con el equipo si este Function está activo y contra qué BD.** Si está
muerto o es legacy-only, queda FUERA del alcance y se ahorra trabajo. Si está vivo
contra V2, sus modelos están rotos hoy y hay que reescribir `database.py` completo
(no solo el connection string). El flujo principal de PDFs del backend
(`pdf_generator.py` en utils + request-pdf) no depende de esos modelos.

## Inventario 8 — Orden sin ORDER BY

- 30 usos de `.paginate(` en rutas — verificación pendiente caso por caso de que la
  query tenga `order_by` (ítem de la fase de ejecución; los que no lo tengan pueden
  cambiar de orden entre motores, no fallar).
- Los 4 `OFFSET/FETCH NEXT` crudos tienen ORDER BY obligatorio por sintaxis MSSQL — OK.

## Inventario 9 — Transacciones / locks / aislamiento

Sin hallazgos: no hay `NOLOCK`, niveles de aislamiento explícitos, `sp_getapplock`
ni transacciones T-SQL. Todo pasa por SQLAlchemy session estándar.

## Extra para el ETL — columnas JSON

4 columnas `db.JSON` que en MSSQL viven como NVARCHAR(MAX) con texto JSON:
`conocer_certificates.metadata_json`, `exam_progress.data`, `results.answers_data`,
`results.questions_order`. El ETL debe leerlas como JSON (no como string) para que
PG las almacene como tipo `json` válido; `results` es la tabla más delicada (datos
de candidatos reales).

## Riesgos Top 5 (probabilidad de romper DEV)

1. **Booleanos en SQL crudo no inventariados** — el grep cubre las 56 columnas
   Boolean conocidas; si un alias de columna en un subquery renombra un booleano, se
   escapa. Mitigación: la suite de integración + soak, y grep adicional sobre alias.
2. **auto_migrate contra PG limpio** — las ramas PG existen pero probablemente nunca
   corrieron contra un PG real de cero (compose pudo fallar silenciosamente).
   Mitigación: arrancar el backend contra PG 16 vacío en local y revisar el log de
   auto_migrate línea por línea ANTES del ETL.
3. **Secuencias sin setval** — rompería inserciones nuevas post-corte con PK duplicada.
   Mitigación: setval automático en el ETL + prueba de inserción en validación.
4. **JSON como string en ETL ingenuo** — `results.answers_data` quedaría doble-codificado
   y rompería la revisión de resultados. Mitigación: validación campo a campo en el
   muestreo aleatorio del script de validación.
5. **Azure Function pdf-generator** — estado real desconocido (modelos no coinciden
   con V2). Mitigación: resolver el hallazgo del Inventario 7 antes del corte.

## Estimación (días-persona efectivos)

| Bloque | Días |
|---|---|
| Código (Inv. 1-4: booleanos, concat, TOP, LIKE badge_service) + pruebas unitarias | 2 |
| DDL/auto_migrate (Inv. 3) + arranque contra PG limpio y depuración | 1.5 |
| ETL + setval + script de validación PASS/FAIL | 2.5 |
| Corte DEV + suite integración + smoke | 1 |
| Azure Function (si resulta vivo contra V2) | 0.5–2 |
| **Total** | **7.5–9** |

**Luz verde para ejecutar el Prompt 2.** El único bloqueante externo es confirmar el
estado del Azure Function (Inventario 7).
