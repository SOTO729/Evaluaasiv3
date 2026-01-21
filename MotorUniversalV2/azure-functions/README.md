# Azure Functions para Evaluaasi - Generador de PDFs

Este módulo contiene Azure Functions para procesamiento asíncrono de tareas costosas.

## Arquitectura

```
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│   Frontend   │───▶│  Container App  │───▶│ Azure Queue  │
└──────────────┘    │    (API)        │    │   Storage    │
                    └─────────────────┘    └──────┬───────┘
                                                  │
                    ┌─────────────────┐           │
                    │ Azure Function  │◀──────────┘
                    │  (PDF Worker)   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐    ┌─────────────────┐
                    │  Azure Blob     │───▶│    Azure SQL    │
                    │  (PDFs)         │    │   (Update URL)  │
                    └─────────────────┘    └─────────────────┘
```

## Estructura de Archivos

```
azure-functions/
├── host.json                   # Configuración del runtime
├── local.settings.json         # Variables para desarrollo local
├── requirements.txt            # Dependencias Python
├── README.md                   # Este archivo
└── pdf-generator/
    ├── function.json           # Configuración del trigger
    ├── __init__.py             # Lógica principal de la función
    └── database.py             # Conexión a Azure SQL
```

## Funciones

### 1. `pdf-generator` - Generador de PDFs de Evaluación
- **Trigger:** Azure Queue Storage (`pdf-generation-queue`)
- **Input:** Mensaje JSON con:
  ```json
  {
    "result_id": "uuid-del-resultado",
    "user_id": "uuid-del-usuario",
    "type": "evaluation_report" | "certificate"
  }
  ```
- **Output:** PDF en Azure Blob Storage
- **Side Effect:** Actualiza `report_url` o `certificate_url` en la tabla `results`

### 2. Flujo de trabajo

1. Usuario solicita PDF → `POST /api/exams/results/{id}/request-pdf`
2. API valida permisos y encola mensaje
3. Retorna `202 Accepted` con status `queued`
4. Azure Function se activa automáticamente
5. Genera PDF usando ReportLab
6. Sube a Azure Blob Storage (carpeta `pdfs/`)
7. Actualiza registro en BD con URL del PDF
8. Usuario consulta status → `GET /api/exams/results/{id}/pdf-status`

## Endpoints del Backend

### Solicitar PDF (Async)
```http
POST /api/exams/results/{result_id}/request-pdf
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "evaluation_report"  // o "certificate"
}
```

Respuestas:
- `202 Accepted` - PDF encolado para generación
- `200 OK` - PDF ya existe, retorna URL
- `404 Not Found` - Resultado no encontrado

### Consultar Estado
```http
GET /api/exams/results/{result_id}/pdf-status
Authorization: Bearer {token}
```

Respuesta:
```json
{
  "result_id": "uuid",
  "status": "completed",
  "report_url": "https://blob.../pdfs/report_uuid.pdf",
  "certificate_url": null
}
```

## Desarrollo Local

```bash
# Instalar Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Configurar variables locales
cp local.settings.json.example local.settings.json
# Editar con tus credenciales

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar localmente
func start
```

## Despliegue

### 1. Crear recursos en Azure

```bash
# Variables
RESOURCE_GROUP="evaluaasi-motorv2-rg"
STORAGE_ACCOUNT="evaluaasimotorv2storage"
FUNCTION_APP="evaluaasi-pdf-functions"
LOCATION="eastus"

# Crear Function App (Consumption Plan)
az functionapp create \
  --resource-group $RESOURCE_GROUP \
  --consumption-plan-location $LOCATION \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --name $FUNCTION_APP \
  --storage-account $STORAGE_ACCOUNT

# Configurar variables de entorno
az functionapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP \
  --settings \
    "DB_SERVER=your-server.database.windows.net" \
    "DB_NAME=evaluaasi-db" \
    "DB_USER=your-user" \
    "DB_PASSWORD=your-password" \
    "AZURE_STORAGE_CONNECTION_STRING=your-connection-string" \
    "AZURE_STORAGE_CONTAINER=evaluaasi-files"
```

### 2. Desplegar código

```bash
# Desde la carpeta azure-functions/
func azure functionapp publish evaluaasi-pdf-functions
```

### 3. Crear la cola

```bash
# La cola se crea automáticamente al enviar el primer mensaje
# O manualmente:
az storage queue create \
  --name pdf-generation-queue \
  --connection-string "your-storage-connection-string"
```

## Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DB_SERVER` | Servidor Azure SQL | `server.database.windows.net` |
| `DB_NAME` | Nombre de la BD | `evaluaasi-db` |
| `DB_USER` | Usuario de BD | `evaluaasi-admin` |
| `DB_PASSWORD` | Contraseña de BD | `***` |
| `AZURE_STORAGE_CONNECTION_STRING` | Storage Account | `DefaultEndpointsProtocol=https;...` |
| `AZURE_STORAGE_CONTAINER` | Container para PDFs | `evaluaasi-files` |
| `ENABLE_ASYNC_PDF` | Habilitar async (backend) | `true` |

## Costo Estimado

| Escenario | Ejecuciones/mes | Tiempo ejecución | Costo |
|-----------|-----------------|------------------|-------|
| Bajo | 1,000 | ~2 seg/PDF | **$0** (free tier) |
| Medio | 10,000 | ~2 seg/PDF | **$0** (free tier) |
| Alto | 100,000 | ~2 seg/PDF | **$0** (free tier) |
| Muy Alto | 1,000,000 | ~2 seg/PDF | **~$0.20** |

**Free tier incluye:**
- 1 millón de ejecuciones/mes
- 400,000 GB-s de tiempo de cálculo/mes

**Storage adicional:**
- Queue Storage: $0.00036/10,000 transacciones
- Blob Storage: ~$0.0184/GB/mes (Hot tier)

## Monitoreo

```bash
# Ver logs en tiempo real
func azure functionapp logstream evaluaasi-pdf-functions

# Ver métricas en Azure Portal
# Application Insights → Functions → pdf-generator
```

## Troubleshooting

### Error: "Queue not found"
La cola se crea automáticamente. Si persiste, créala manualmente.

### Error: "ODBC Driver not found"
El runtime de Azure Functions incluye ODBC Driver 18. Verificar connection string.

### PDFs no se generan
1. Verificar logs en Application Insights
2. Revisar que las variables de entorno estén configuradas
3. Verificar permisos de Storage Account
