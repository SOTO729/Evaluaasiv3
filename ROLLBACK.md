# ROLLBACK — Migración PostgreSQL

## DEV (vigente desde el flip de junio 2026)

**Revertir DEV a MSSQL = re-apuntar una variable de entorno** (≈1 minuto de reinicio):

```bash
az containerapp update \
  --name evaluaasi-motorv2-api-dev \
  --resource-group evaluaasi-motorv2-rg \
  --set-env-vars 'DATABASE_URL=mssql+pymssql://evaluaasi_admin:EvalAasi2024_newpwd!@evaluaasi-motorv2-sql.database.windows.net/evaluaasi_dev' \
  -o none
```

Notas:
- NUNCA usar `--yaml` (borra el resto de las env vars). `--set-env-vars` solo
  modifica la variable indicada.
- La imagen con SQL portable (rama `migracion-postgres`) funciona idéntica contra
  MSSQL — NO hace falta revertir la imagen, solo la URL.
- Lo escrito en PostgreSQL durante la ventana PG se pierde al revertir (aceptable
  en DEV; documentar qué se probó). El MSSQL de DEV queda intacto: el ETL solo LEE.

## Datos de conexión

| | MSSQL (origen, intacto) | PostgreSQL (destino) |
|---|---|---|
| Server | evaluaasi-motorv2-sql.database.windows.net | evaluaasi-motorv2-pg.postgres.database.azure.com |
| BD DEV | evaluaasi_dev | evaluaasi_dev |
| Usuario | evaluaasi_admin | evaluaasi_admin |
| Password | (la de siempre, ver CLAUDE.md) | en Key Vault / gestor del equipo (generada en el aprovisionamiento) |
| Extra | — | requiere `?sslmode=require`; servidor en **Central US** (B1ms) |

## PROD (cuando llegue el corte)

PROD NO se ha tocado. El corte de PROD requerirá:
1. Ventana de mantenimiento (congelar escrituras).
2. `evaluaasi` (PROD) → nueva BD `evaluaasi` en el mismo Flexible Server
   (o servidor dedicado, decidir SKU según observación de DEV).
3. ETL `--truncate` + validación 100% PASS (mismos scripts de `migration_pg/`).
4. Flip de `DATABASE_URL` en `evaluaasi-motorv2-api` (+ imagen ya portable).
5. Smoke. Reversa simétrica a la de DEV.
