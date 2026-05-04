# Recompilación VB6 — EXE Office v2 (MotorV2)

**Fecha**: 29 abr 2026
**Estrategia**: A.3 — EXE v2 apunta directo al FQDN del Container App MotorV2.
**Coexistencia legacy**: 100% aditiva. Los EXEs legacy (apuntando a `srvcsvls7-1.azurewebsites.net`, `xmnvls5-1.evaluaasi.com`, `evaluaasi.azurewebsites.net`) **no se modifican ni desinstalan**.

---

## 1. URLs base

| Entorno | FQDN Container App | URL base API REST | URL base SOAP |
|---|---|---|---|
| **PROD** | `evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io` | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api` | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api` |
| **DEV** | `evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io` | `https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api` | `https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api` |

> Nota: la capa SOAP de MotorV2 está expuesta bajo `/api/<servicio>.asmx`, no en la raíz como el legacy. Este es el **único cambio de path** que requiere el EXE v2.

---

## 2. Mapeo de endpoints legacy → MotorV2

### Servicios SOAP (compatibles con cliente VB6 actual, sólo cambia host y prefijo `/api/`)

| Legacy | MotorV2 (PROD) |
|---|---|
| `https://srvcsvls7-1.azurewebsites.net/Usuario.asmx` | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/Usuario.asmx` |
| `https://srvcsvls7-1.azurewebsites.net/Fecha` | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/Fecha` |
| `https://evaluaasi.azurewebsites.net/Licencias.asmx` | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/Licencias.asmx` |
| `https://xmnvls5-1.evaluaasi.com/Usuario.asmx` | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/Usuario.asmx` |
| `https://xmnvls5-1.evaluaasi.com/Fecha` | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/Fecha` |
| `*/Storage.asmx` (UpXML2016) | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/Storage.asmx` |
| `*/SimuladorWebService.asmx` | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/SimuladorWebService.asmx` |
| `*/ParcialesWebService.asmx` | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/ParcialesWebService.asmx` |
| `*/AdminTools.asmx` | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/AdminTools.asmx` |
| `*/webservice.asmx` (ObtenerPaisPorIP) | `https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/webservice.asmx` |

### SOAPAction headers
**No cambian.** El cliente VB6 sigue enviando `http://tempuri.org/<MetodoSOAP>` igual que el legacy.

### Contratos SOAP
**No cambian.** XML envelopes idénticos. La capa `soap_compat.py` reproduce exactamente la firma del WebService VB.NET legacy.

---

## 3. Cambios mínimos en el código VB6

### Opción 3.A — Recompilar con constante embebida (recomendada)

Buscar en el proyecto VB6 (`.vbp`/`.frm`/`.bas`) la constante de URL base. Patrones típicos:

```vb
' Antes:
Public Const URL_USUARIO As String = "https://srvcsvls7-1.azurewebsites.net/Usuario.asmx"
Public Const URL_LICENCIAS As String = "https://evaluaasi.azurewebsites.net/Licencias.asmx"
Public Const URL_FECHA As String = "https://srvcsvls7-1.azurewebsites.net/Fecha"
Public Const URL_STORAGE As String = "https://srvcsvls7-1.azurewebsites.net/Storage.asmx"
' (etc.)

' Después (PROD):
Public Const URL_BASE As String = "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
Public Const URL_USUARIO As String = URL_BASE & "/Usuario.asmx"
Public Const URL_LICENCIAS As String = URL_BASE & "/Licencias.asmx"
Public Const URL_FECHA As String = URL_BASE & "/Fecha"
Public Const URL_STORAGE As String = URL_BASE & "/Storage.asmx"
```

### Opción 3.B — INI externo (si quieres rollback sin recompilar)

```vb
' En Module1.bas o similar
Private Function LeerURL(ByVal clave As String, ByVal porDefecto As String) As String
    Dim ruta As String
    ruta = App.Path & "\config.ini"
    Dim buffer As String * 256
    Dim n As Long
    n = GetPrivateProfileString("API", clave, porDefecto, buffer, 256, ruta)
    LeerURL = Left$(buffer, n)
End Function

Public Function URL_BASE() As String
    URL_BASE = LeerURL("BaseUrl", "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api")
End Function
```

`config.ini` distribuido junto al EXE:

```ini
[API]
BaseUrl=https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api
```

Ventaja: si MotorV2 cambia de FQDN o quieres apuntar un plantel a DEV, sólo editas el INI sin recompilar.

---

## 4. Nombre del binario y versionado

Para evitar colisiones con la instalación legacy:

| Concepto | Legacy (no tocar) | v2 nuevo |
|---|---|---|
| Nombre EXE | `Evaluaasi.exe` (o equivalente) | `EvaluaasiV2.exe` |
| Carpeta install | `C:\Evaluaasi\` | `C:\EvaluaasiV2\` |
| Acceso directo | "Evaluaasi" | "Evaluaasi V2" |
| Project version (VB6) | 1.x | **2.0.0** |
| `app_name` en catálogo | n/a | **`EvaluaasiOfficeV2`** |

En el VB6 IDE: **Project → Properties → Make → Version → 2.0.0**, marcar "Auto Increment" en builds posteriores.

---

## 5. Auto-update con `version-check`

El EXE v2 al arrancar consulta:

```
GET https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/downloads/office-apps/version-check
    ?app_name=EvaluaasiOfficeV2
    &current_version=<versión del EXE actual>
```

Respuesta:

```json
{
  "found": true,
  "latest_version": "2.0.1",
  "min_version": "2.0.0",
  "download_url": "https://...blob.../office-apps/EvaluaasiV2-2.0.1.exe",
  "is_active": true,
  "update_required": false,
  "update_available": true
}
```

Comportamiento esperado del EXE v2:
- Si `update_required=true` → bloquear ejecución, mostrar mensaje "Actualización obligatoria", abrir `download_url` en navegador o lanzar instalador automático.
- Si `update_available=true` → notificación no bloqueante "Hay una nueva versión disponible".
- Si `is_active=false` → bloquear (app retirada del catálogo).

Ejemplo de llamada en VB6 con `MSXML2.ServerXMLHTTP`:

```vb
Public Function CheckVersion(ByVal currentVersion As String) As Boolean
    Dim http As Object
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    Dim url As String
    url = URL_BASE & "/downloads/office-apps/version-check?app_name=EvaluaasiOfficeV2&current_version=" & currentVersion
    http.Open "GET", url, False
    http.send
    If http.Status <> 200 Then Exit Function
    ' Parsear JSON con un módulo o regex sencillo (VB6 no tiene parser nativo)
    Dim body As String
    body = http.responseText
    If InStr(body, """update_required"":true") > 0 Then
        MsgBox "Esta versión ya no es compatible. Se requiere actualizar.", vbCritical
        ' Abrir download_url en navegador
        End
    End If
    CheckVersion = True
End Function
```

---

## 6. Pruebas locales antes de distribuir

1. **Backend**: ya desplegado en DEV+PROD (rev-1777498407).
2. **Smoke test** desde PowerShell:

```powershell
# Licencias.asmx (debe responder true si catálogo vacío)
$soap = @"
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <VerificarLicencia xmlns="http://tempuri.org/">
      <NombrePC>TEST-PC</NombrePC>
      <SubSistema>Excel</SubSistema>
      <Version>2.0.0</Version>
    </VerificarLicencia>
  </soap:Body>
</soap:Envelope>
"@
Invoke-WebRequest `
  -Uri "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/Licencias.asmx" `
  -Method POST `
  -ContentType "text/xml; charset=utf-8" `
  -Headers @{ SOAPAction='http://tempuri.org/VerificarLicencia' } `
  -Body $soap
```

3. **EXE local**: compilar v2 contra **DEV** primero (`-dev` FQDN). Validar:
   - Login en SOAP `Usuario.asmx`.
   - Verificación de licencia.
   - Carga de examen.
   - Subida de XML (UpXML2016 → Azure Blob `office-xml/{result_id}/{ts}.xml`).
   - Finalización → ver en `/admin/office-results` que aparece el resultado.

4. **Repetir** apuntando a PROD una vez validado en DEV.

---

## 7. Distribución

### Plan recomendado por plantel:

1. Plantel piloto recibe **EvaluaasiV2.exe + config.ini (PROD)** vía instalador o ZIP.
2. Se instala en `C:\EvaluaasiV2\` **sin tocar** la instalación legacy en `C:\Evaluaasi\`.
3. El usuario tiene ambos accesos directos. Durante 1-2 semanas usa V2 para nuevos exámenes; si V2 falla, sigue disponible el legacy.
4. Después de validación, el responsable del plantel desinstala el legacy a su ritmo.

### Backend prerequisitos (ya cumplidos):
- ✅ Capa SOAP `/api/*.asmx` (MotorV2 rev-1777415450)
- ✅ Endpoint `version-check` público (rev-1777498407)
- ✅ Catálogo `OfficeAppVersion` admin UI (rev-1777411749)
- ✅ Storage UpXML2016 → Blob (rev-1777415450)
- ✅ Validación licencias real (rev-1777415450)
- ✅ Cleanup automático de tokens (rev-1777414804)
- ✅ Badge OB3 al finalizar examen (rev-1777498407)

---

## 8. Checklist final antes de publicar v2

- [ ] Recompilar VB6 con `URL_BASE` apuntando a PROD MotorV2.
- [ ] Cambiar nombre del proyecto/EXE a `EvaluaasiV2.exe`.
- [ ] Versionar como `2.0.0`.
- [ ] Implementar `CheckVersion()` al startup.
- [ ] Generar instalador (Inno Setup o MSI) que instale en `C:\EvaluaasiV2\` sin colisión con legacy.
- [ ] Subir el binario al catálogo `OfficeAppVersion` (admin UI: `/admin/office-app-versions`).
- [ ] Registrar `app_name="EvaluaasiOfficeV2"`, `min_version="2.0.0"`, `latest_version="2.0.0"`.
- [ ] Distribuir a 1-2 planteles piloto.
- [ ] Monitorear en `/admin/office-results` y `/api/maintenance/cleanup/status` durante 1 semana.
- [ ] Distribución masiva tras validación.

---

## 9. Rollback

Si v2 falla en un plantel:
1. El usuario abre el acceso directo "Evaluaasi" (legacy) en lugar de "Evaluaasi V2".
2. Los datos legacy permanecen intactos en `C:\Evaluaasi\`.
3. No hay sincronización entre legacy y v2 — son universos paralelos hasta migración completa.

Si MotorV2 falla globalmente:
1. Marcar `is_active=false` en el catálogo `OfficeAppVersion` para `EvaluaasiOfficeV2`.
2. v2 al arrancar verá `is_active=false` → bloquea y pide reinstalar.
3. Plantel vuelve al legacy.
