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

## PROD — CORTADO (vigente desde el corte)

PROD ya corre en **PostgreSQL (Central US)**. La app vieja en South Central US
(`evaluaasi-motorv2-api`, MSSQL) quedó **congelada con el ingress deshabilitado**
como red de seguridad.

**Revertir PROD a MSSQL** (si algo falla en el soak):
```bash
# 1. Reactivar el ingress del API viejo (sigue apuntando a MSSQL, intacto)
az containerapp ingress enable --name evaluaasi-motorv2-api \
  --resource-group evaluaasi-motorv2-rg --type external --target-port 8000 --transport auto

# 2. Revertir el frontend PROD a la URL vieja del API y redeployar
#    .env.production → VITE_API_URL=https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api
cd MotorUniversalV2/frontend && npx vite build --mode production --emptyOutDir
npx @azure/static-web-apps-cli deploy dist --deployment-token <TOKEN_PROD> --env production
```
Las escrituras hechas en PG durante la ventana PG se perderían al revertir (el MSSQL
quedó congelado en el momento del corte). El ETL solo LEYÓ del MSSQL.

**Infra PROD nueva:**
- API: `evaluaasi-motorv2-api-cus` (Central US, environment `evaluaasi-api-env-cus`)
- URL: `evaluaasi-motorv2-api-cus.victoriouscliff-108125b9.centralus.azurecontainerapps.io`
- BD: PG `evaluaasi-motorv2-pg` / base `evaluaasi` (Central US)
- Frontend: SWA `thankful-stone` (app.evaluaasi.com), apunta a la URL nueva.

## Limpieza pendiente (tras soak de PROD)
- Borrar apps viejos de South Central US: `evaluaasi-motorv2-api` y `evaluaasi-motorv2-api-dev`.
- Quitar reglas de firewall temporales del PG: `dev-machine`, `dev-machine-2`.
- Deprecar el SQL Server MSSQL cuando DEV y PROD estén validados en PG.
