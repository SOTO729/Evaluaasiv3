# Plan de Migración Evaluaasi V2: Azure SQL (MSSQL) → PostgreSQL — TODO EN AZURE

> Reestructurado con contexto completo del repositorio (junio 2026).
> Decisiones ya tomadas: la migración es **dentro de Azure** (no hay mudanza a otra nube),
> el destino es **Azure Database for PostgreSQL Flexible Server**, y **DEV migra primero**;
> PROD solo después de un periodo de soak en DEV.

---

## Hechos verificados del repositorio (NO redescubrir, NO contradecir)

Estos puntos ya fueron auditados contra el código real. Cualquier agente que ejecute
los prompts debe partir de ellos:

1. **La app ya corre contra PostgreSQL en desarrollo local.** `docker-compose.yml` usa
   `postgres:15-alpine`, `psycopg2-binary==2.9.9` ya está en `backend/requirements.txt`,
   y la conexión es un único `DATABASE_URL` (`backend/config.py`). No hay capa de
   conexión que migrar: es cambiar la URL.
2. **Las llaves primarias NO son UNIQUEIDENTIFIER.** Son `db.String(36)` con UUIDs
   generados en Python (`str(uuid.uuid4())`) — varchar en ambos motores. **Se quedan
   como varchar(36).** NO convertir a tipo `uuid` nativo ni usar `gen_random_uuid()`:
   eso sería un proyecto aparte sin beneficio inmediato. Otras PKs son `Integer`
   autoincrement (p. ej. `exams.id`, `topics.id`) → en PG son secuencias y **requieren
   `setval()` después del ETL**.
3. **`auto_migrate.py` (~3,400 líneas) ya detecta dialecto** con `get_db_type()`
   (postgresql / mssql / sqlite) y tiene ramas PG en varias secciones. El patrón para
   código dialecto-aware ya existe en el repo; hay que extenderlo, no inventarlo.
4. **El login ya es case-insensitive a nivel aplicación**: `auth.py` usa `func.lower()`
   en login, registro, reset de contraseña y búsqueda por username/email. Ese riesgo
   está mitigado; el pendiente real son las búsquedas con `LIKE` en otros módulos.
5. **No hay stored procedures, triggers ni vistas** (solo un `sp_executesql` en una
   ruta de `debug.py`, no crítica). El escenario "migración pesada" no existe.
6. **`OFFSET ... ROWS FETCH NEXT ... ROWS ONLY` es SQL estándar** y PostgreSQL lo
   soporta. NO traducirlo. Lo que sí hay que traducir: `SELECT TOP n` (solo en
   `debug.py` y `partners.py:~19335`).
7. **Los scripts one-off** (`backend/migrate_*.py`, `backend/add_*.py`, ~30 archivos
   con pymssql hardcodeado) son migraciones históricas ya aplicadas. **Fuera de
   alcance: no migrarlos, no contarlos en la estimación.**
8. **El worker de PDFs es un Azure Function** (`azure-functions/pdf-generator/`,
   disparado por Storage Queue) con capa de datos PROPIA y duplicada: connection
   string ODBC Driver 18 en `database.py`, modelos propios, e importa
   `sqlalchemy.dialects.mssql.UNIQUEIDENTIFIER`. **Sí está en alcance** y se queda en
   Azure; solo necesita conexión PG y limpiar el import del dialecto mssql.
9. **La suite de pytest del backend es de integración contra el API de DEV** (no
   contra la BD). "Validar con tests" = levantar el API apuntando a PG y correr la
   suite contra él. Los tests de frontend (Vitest) no tocan BD.
10. **Tamaños de datos chicos**: PROD ~1 partner con datos reales; DEV ~16 partners de
    prueba. El ETL no necesita streaming ni paralelismo; un script Python secuencial
    alcanza de sobra.

## Los 3 focos reales de trabajo de código

(En orden de riesgo; el grueso del esfuerzo está aquí, no en la conexión ni el esquema.)

1. **Booleanos en SQL crudo.** Hay ~250 llamadas `text()` (62 solo en `partners.py`).
   En MSSQL `Boolean` es BIT y `is_active = 1` funciona; en PG `boolean = integer`
   lanza error de operador. Casos confirmados: `gsm.is_active = 1`,
   `sc.is_published = 1`. Barrer TODOS los `text()` y corregir a `= TRUE/FALSE` o
   parámetro booleano (auto_migrate ya usa el patrón
   `True if db_type != 'mssql' else 1` — replicarlo o, mejor, usar literales
   portables).
2. **DDL crudo con T-SQL fuera de ramas de dialecto.** `CREATE TABLE ... DATETIME
   DEFAULT GETDATE()` en `auto_migrate.py`, `study_contents.py`, `init.py`,
   `debug.py`. Algunos corren sin importar el dialecto (hoy fallan silenciosamente en
   compose por try/except). Hacerlos dialecto-aware o eliminarlos si
   `db.create_all()` ya cubre la tabla.
3. **Búsquedas `LIKE` case-sensitive.** En PG, `LIKE` es case-sensitive (MSSQL no, por
   collation). Pasar a `ILIKE` o `LOWER()` las búsquedas de usuarios/candidatos/etc.
   Superficie: ~20 archivos de rutas con pocos usos cada uno (activity, balance,
   conocer, office_results, partners, user_management…).

---

## PROMPT 1 — Auditoría dirigida (solo lectura)

```
Actúa como ingeniero senior de bases de datos. Audita este repositorio
(MotorUniversalV2/backend y MotorUniversalV2/azure-functions) para una migración de
Azure SQL (MSSQL) a Azure Database for PostgreSQL Flexible Server (PostgreSQL 16).
NO modifiques archivos: el entregable es un reporte.

PARTE DE ESTOS HECHOS YA VERIFICADOS (no los redescubras, no los contradigas):
- ORM Flask-SQLAlchemy con DATABASE_URL único; psycopg2-binary ya en requirements;
  docker-compose local ya usa postgres:15.
- PKs: String(36) con UUID generado en Python (se quedan varchar) e Integer
  autoincrement (requieren setval post-ETL).
- auto_migrate.py ya tiene get_db_type() y ramas postgresql parciales.
- Login ya usa func.lower(); no hay stored procedures/triggers/vistas;
  OFFSET/FETCH NEXT es portable, no se traduce.
- Scripts one-off migrate_*.py / add_*.py: FUERA DE ALCANCE.
- El Azure Function pdf-generator tiene capa de datos propia con ODBC/mssql: EN ALCANCE.

TU TRABAJO ES PRODUCIR LOS INVENTARIOS EXHAUSTIVOS (archivo:línea + corrección
propuesta) de:
1. BOOLEANOS EN SQL CRUDO: cada text() que compare columnas Boolean con 0/1
   (= 1, = 0, IN (0,1), CASE WHEN x = 1, etc.). Es el foco #1: sé exhaustivo.
   Revisa también ORDER BY / agregaciones sobre booleanos (SUM(CASE...)).
2. DDL CRUDO NO PORTABLE: CREATE TABLE/ALTER con DATETIME, GETDATE(), BIT, NVARCHAR,
   IDENTITY, índices filtrados (WHERE en CREATE INDEX de MSSQL), y si cada uno corre
   en rama mssql-only o sin guardia de dialecto. Indica cuáles son redundantes con
   db.create_all().
3. LIKE CASE-SENSITIVE: cada .like( / LIKE en raw SQL que busque texto ingresado por
   usuario; propuesta ILIKE o LOWER() por caso.
4. SELECT TOP n y cualquier otra sintaxis T-SQL residual (ISNULL, CONVERT, DATEADD,
   DATEDIFF, IIF, MERGE, NOLOCK, #temp, @@IDENTITY, SCOPE_IDENTITY, OUTPUT INSERTED).
5. SECUENCIAS: lista de TODAS las tablas con PK Integer autoincrement (para el
   setval post-ETL) y de las tablas con PK varchar(36).
6. FECHAS: columnas DateTime y si el código las maneja naive (utcnow) o aware;
   recomendación timestamp vs timestamptz POR TABLA, priorizando cero cambio de
   comportamiento (si todo es naive-UTC hoy, quedarse en timestamp sin tz y
   documentarlo es válido).
7. AZURE FUNCTION pdf-generator: inventario de su database.py, modelos duplicados,
   queries, y qué hay que tocar para que hable con PG.
8. ORDEN SIN ORDER BY: queries que pagina/listan sin ORDER BY explícito (el orden
   implícito de MSSQL no se conserva en PG).
9. Cualquier uso de transacciones/aislamiento/locks específicos de MSSQL.

ENTREGABLE — AUDITORIA_MIGRACION.md en la raíz del repo con:
- Inventarios 1-9 en tablas archivo:línea → corrección propuesta.
- Conteo total de cambios por categoría y estimación en días-persona separando:
  código backend, auto_migrate/DDL, azure function, ETL+validación, pruebas.
- Top 5 riesgos reales ordenados por probabilidad de romper DEV.
No hagas cambios. Al terminar el reporte, detente.
```

---

## PROMPT 2 — Ejecución (tras revisar la auditoría)

```
Actúa como ingeniero senior. Ejecuta la migración MSSQL → PostgreSQL 16 de este
backend Flask usando AUDITORIA_MIGRACION.md como insumo. Trabaja en la rama
migracion-postgres. Commits atómicos por fase.

PRINCIPIOS:
- Destino: Azure Database for PostgreSQL Flexible Server (region South Central US,
  la misma del resto de los recursos). Sin extensiones exóticas; pgcrypto/citext solo
  si la auditoría lo justifica (la app ya normaliza con lower(), probablemente no).
- DRIVER: psycopg2 (ya instalado). NO cambiar a psycopg v3.
- PKs varchar(36) SE QUEDAN varchar(36). PKs Integer siguen autoincrement
  (en PG: identity/serial que create_all genera solo).
- Cero cambios de comportamiento funcional: misma API, mismas respuestas.
- Todo cambio de query queda cubierto por una prueba (unitaria si es lógica pura,
  o anotado para la suite de integración de la Fase 5).

FASE 1 — Código portable (el grueso):
1. Barrido de booleanos en SQL crudo según inventario #1 de la auditoría:
   = 1 → = TRUE, = 0 → = FALSE, o parámetros tipados. Verificar que cada query
   corregida siga siendo válida en MSSQL si corre antes del corte (la rama puede
   convivir con MSSQL unos días): preferir sintaxis válida en ambos motores cuando
   exista; donde no, usar la rama por dialecto ya establecida en auto_migrate.
2. DDL crudo según inventario #2: eliminar lo redundante con create_all; lo
   necesario, dialecto-aware con get_db_type().
3. LIKE → ILIKE/LOWER() según inventario #3.
4. TOP n → LIMIT y residuales T-SQL según inventario #4.
5. ORDER BY explícito en las queries del inventario #8 que alimentan paginación.
6. Azure Function pdf-generator: database.py parametrizado para PG (mantener las
   mismas variables de entorno DB_SERVER/DB_NAME/DB_USER/DB_PASSWORD o migrar a
   DATABASE_URL — documenta la decisión), eliminar import de dialects.mssql,
   actualizar requirements del function.

FASE 2 — Infraestructura DEV:
7. Aprovisionar (o documentar comandos az para) un Azure Database for PostgreSQL
   Flexible Server con DB `evaluaasi_dev`, en el mismo resource group
   evaluaasi-motorv2-rg, acceso desde el Container App (firewall/VNet) y SSL.
8. Actualizar docker-compose local a postgres:16 para paridad con el destino.
9. Esquema: generarlo con db.create_all() + auto_migrate contra PG limpio (es la
   ruta que el código ya soporta). Comparar el esquema resultante contra los modelos
   y contra el esquema MSSQL real de evaluaasi_dev; reportar diferencias (columnas
   huérfanas en MSSQL que ningún modelo declara, etc.).

FASE 3 — ETL y validación:
10. Script ETL Python idempotente (SQLAlchemy con dos engines: mssql origen, pg
    destino), orden por dependencias de FK, re-ejecutable sobre BD limpia
    (TRUNCATE ... CASCADE + recarga). Al final: setval() de TODAS las secuencias
    de PKs Integer (inventario #5).
11. Script de validación post-carga: conteo de filas por tabla, sumas/min/max por
    columnas clave, conteo de NULLs, muestreo aleatorio de N filas comparadas campo
    a campo. Reporte PASS/FAIL por tabla. El corte no procede sin 100% PASS.

FASE 4 — Corte de DEV y soak:
12. Correr ETL desde evaluaasi_dev (MSSQL) → PG dev. Validación 100% PASS.
13. Apuntar el Container App evaluaasi-motorv2-api-dev al PG (cambiar DATABASE_URL;
    NUNCA usar --yaml en az containerapp update — borra las env vars).
14. Correr la suite de pytest de integración contra el API de DEV ya en PG.
    Smoke manual de flujos críticos: login, tomar examen y entregar, generación de
    PDF (valida el Azure Function), insignias, solicitudes de saldo, chat.
15. Soak: DEV queda en PG varios días con uso real. Monitorear logs del Container
    App por errores de SQL.

FASE 5 — Cierre y plan de PROD (documentos, sin ejecutar el corte):
16. MIGRACION_REPORTE.md: cambios por fase, decisiones y porqués, diferencias de
    comportamiento conocidas.
17. ROLLBACK.md: para DEV, revertir = re-apuntar DATABASE_URL a MSSQL (los datos
    escritos durante la ventana PG se pierden — aceptable en DEV; documentarlo).
    Para PROD: plan de corte con ventana de mantenimiento (congelar escrituras,
    ETL final, validación, switch de DATABASE_URL, smoke) y reversa simétrica.
    PROD NO se corta en esta fase; requiere luz verde explícita tras el soak.

Trabaja fase por fase; resume al cerrar cada una. Si encuentras algo que contradiga
la auditoría o los hechos verificados del encabezado, detente y repórtalo.
```

---

## Notas de uso

- Correr ambos prompts en Claude Code desde la raíz del repo, en rama
  `migracion-postgres`. El Prompt 1 es solo lectura.
- La estimación realista con estos hechos: el esfuerzo dominante es el barrido de
  `text()` (booleanos) + pruebas, no el esquema ni la conexión. Si la auditoría
  arroja algo muy distinto a los inventarios esperados, revisar antes de ejecutar
  el Prompt 2.
- El corte de PROD es un evento separado, posterior al soak de DEV, con su propia
  ventana y checklist (Fase 5 lo deja documentado, no ejecutado).
- Costos Azure: el Flexible Server más chico (Burstable B1ms) sobra para DEV;
  dimensionar PROD tras observar DEV.
