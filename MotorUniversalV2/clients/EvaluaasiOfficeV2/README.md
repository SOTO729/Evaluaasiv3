# EvaluaasiOfficeV2 — Cliente Office para MotorV2

Cliente Windows Forms (.NET Framework 4.5.2) que ejecuta evaluaciones de Office contra el backend MotorV2.

Sustituye al binario legacy `ExamenV1.0.0.39.exe` (consumía SOAP/WCF en `srvcsvls7-1.azurewebsites.net`).

## Origen del código

El código en `src/CulturaDigital*` proviene de la **decompilación con `ilspycmd`** del binario legacy `ExamenV1.0.0.39.exe` recuperado de Azure Blob (`acemsstorage/conocer/MotorUniversal/Examen/`).

Los **únicos archivos reescritos** vs. la decompilación son:

| Archivo | Cambio |
|---|---|
| `src/CulturaDigital/ApiClient.cs` | **Nuevo**. Wrapper HTTP+JSON compartido. |
| `src/CulturaDigital.xmn/UsuarioSoap.cs` | Reescrito. Interfaz plana sin atributos WCF. |
| `src/CulturaDigital.xmn/UsuarioSoapClient.cs` | Reescrito. Implementa REST contra MotorV2 conservando la firma `DataTable`. |
| `src/CulturaDigital.motor/MotorUniversalSoap.cs` | Reescrito. Interfaz plana. |
| `src/CulturaDigital.motor/MotorUniversalSoapClient.cs` | Reescrito. REST contra MotorV2. |
| `src/Properties/AssemblyInfo.cs` | Versión bumpeada a 2.0.0. |
| `src/App.config` | Eliminado `<system.serviceModel>`, agregado `<appSettings>` con `MotorV2.BaseUrl`. |
| `src/packages.config` | **Nuevo**. NuGet refs para iTextSharp y Gma.QrCodeNet. |
| `src/EvaluaasiOfficeV2.csproj` | **Nuevo**. csproj legacy MSBuild reconstruido. |
| `EvaluaasiOfficeV2.sln` | **Nuevo**. |

Los archivos eliminados (`UsuarioSoapChannel.cs`, `MotorUniversalSoapChannel.cs`) eran auto-generados por WCF y dejaron de ser necesarios.

## Endpoints REST consumidos

`App.config → MotorV2.BaseUrl`:

| Llamada legacy | Endpoint REST nuevo |
|---|---|
| `Usuario.asmx/LoginV2` | `POST /api/vb6/login` |
| `Usuario.asmx/Inicio` | `POST /api/vb6/start` |
| `Usuario.asmx/Fin` | `POST /api/vb6/finish` |
| `Usuario.asmx/Fecha` | `GET /api/health/server-time` |
| `Usuario.asmx/Examenes` | `GET /api/exams?campus_id&group_id&type=office` |
| `MotorUniversal.asmx/Licencias` | `GET /api/standards?type=office_license&partner=…` |
| `MotorUniversal.asmx/ExamenesDisponibles` | `GET /api/standards/available?username=…` |
| `MotorUniversal.asmx/DescargarExamen` | `GET /api/exams/{id}/download-xae` |
| `MotorUniversal.asmx/VersionExamen` | `GET /api/downloads/office-apps/exam-version?app_id=…` |
| `MotorUniversal.asmx/VersionAplicacion` | `GET /api/downloads/office-apps/version-check?app_name=…` |

> ⚠️ Algunos endpoints (`/api/health/server-time`, `/api/exams/{id}/download-xae`, `/api/standards/available`, `/api/downloads/office-apps/exam-version`) **aún no existen** en el backend. Si el cliente los llama y el backend retorna 404, se aplican fallbacks (date local, versión "2.0.0", etc.). Esos endpoints son **TODOs en backend** rastreados aparte.

## Build

### Requisitos

- Windows 10/11
- Visual Studio 2022 Build Tools (workload `.NET desktop development` con .NET Framework 4.5.2 targeting pack)
- NuGet CLI 5.x+ o `msbuild /restore`

### Pasos

```powershell
cd MotorUniversalV2/clients/EvaluaasiOfficeV2

# Restaurar paquetes (NuGet 5+)
nuget restore EvaluaasiOfficeV2.sln

# Build Release
msbuild EvaluaasiOfficeV2.sln /p:Configuration=Release /p:Platform="Any CPU"

# Output:
# src\bin\Release\EvaluaasiOfficeV2.exe
# src\bin\Release\EvaluaasiOfficeV2.exe.config
# src\bin\Release\itextsharp.dll
# src\bin\Release\Gma.QrCodeNet.Encoding.Net35.dll
```

### Fuentes y assets faltantes en la decompilación

ilspycmd recupera el código `.cs` y los `.resx`, **pero no** los binarios:

- `app.ico` — heredado de la decompilación.
- `DS-DIGI.TTF` — copiar manualmente desde `acemsstorage/conocer/MotorUniversal/Examen/ExamenV1.0.0.39_HASH.zip` antes del build (debe quedar como `Content` o ser cargada en runtime desde `appPath`).
- `apv1.apxaem` — archivo de definición de aplicación; debe estar junto al exe.

Coloca esos 3 archivos en `src/` antes del build y agrégalos al `.csproj` como `<Content Include="…"><CopyToOutputDirectory>Always</CopyToOutputDirectory></Content>` si aplica.

## Configuración runtime

`EvaluaasiOfficeV2.exe.config` (ya generado por el build):

```xml
<appSettings>
  <add key="MotorV2.BaseUrl" value="https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api" />
  <add key="MotorV2.TimeoutSeconds" value="60" />
  <add key="MotorV2.AppName" value="EvaluaasiOfficeV2" />
</appSettings>
```

Para apuntar a DEV cambiar `MotorV2.BaseUrl` a `https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api`.

## Distribución

Una vez compilado y firmado:

1. Empaquetar `EvaluaasiOfficeV2.exe` + `*.dll` + `*.config` + `app.ico` + `DS-DIGI.TTF` + `apv1.apxaem` en un ZIP.
2. Calcular SHA-256 del ZIP.
3. Subir al backend vía `POST /api/downloads/office-apps/upload`:
   ```
   app_name=EvaluaasiOfficeV2
   version=2.0.0
   download_url=<URL del ZIP en Blob>
   ```
4. El catálogo `OfficeAppVersion` ya tiene la fila pre-creada (`min_version=2.0.0`); solo falta poblar `download_url`.

A partir de ahí, cualquier `EvaluaasiOfficeV2.exe < 2.0.0` que arranque consultará `version-check`, recibirá `update_required:true` y se auto-actualizará.

## Coexistencia con el legacy

⚠️ **Esta build NO toca el binario legacy** `ExamenV1.0.0.34..39.exe`. El legacy sigue apuntando a `srvcsvls7-1.azurewebsites.net` y debe seguir operando hasta que todos los planteles migren.

El nuevo `EvaluaasiOfficeV2.exe` se distribuirá únicamente a planteles piloto que tengan `enable_office_exams=1`.
