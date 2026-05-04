$ErrorActionPreference = "Stop"
$bin = "C:\Users\Diego\Desktop\Evaluaasiv3\MotorUniversalV2\clients\EvaluaasiOfficeV2\src\bin\Release"

# Use the actual exe.config (already points to PROD); patch to DEV temporarily
$cfgPath = "$bin\EvaluaasiOfficeV2.exe.config"
$xml = [xml](Get-Content $cfgPath)
$xml.configuration.appSettings.add | Where-Object { $_.key -eq "MotorV2.BaseUrl" } | ForEach-Object {
    $_.value = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
}
$xml.Save($cfgPath)

# Load assembly with its config
[AppDomain]::CurrentDomain.SetData("APP_CONFIG_FILE", $cfgPath)
Add-Type -AssemblyName System.Configuration
[Reflection.Assembly]::LoadFrom("$bin\EvaluaasiOfficeV2.exe") | Out-Null
[Reflection.Assembly]::LoadFrom("$bin\itextsharp.dll") | Out-Null
[Reflection.Assembly]::LoadFrom("$bin\Gma.QrCodeNet.Encoding.Net35.dll") | Out-Null

$base = [System.Configuration.ConfigurationManager]::AppSettings["MotorV2.BaseUrl"]
if ([string]::IsNullOrEmpty($base)) {
    # PS host ignored APP_CONFIG_FILE — override via reflection on ApiClient
    $asm = [Reflection.Assembly]::GetAssembly([CulturaDigital.xmn.UsuarioSoapClient])
    $apiType = $asm.GetType("CulturaDigital.ApiClient")
    $f = $apiType.GetField("_baseUrl","NonPublic,Static")
    $f.SetValue($null, "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api")
    $base = $apiType.GetProperty("BaseUrl").GetValue($null)
}
Write-Host "BaseUrl seen by EXE = $base" -ForegroundColor Cyan

$client = New-Object CulturaDigital.xmn.UsuarioSoapClient
Write-Host "`n--- LoginV2(admin/admin123) ---" -ForegroundColor Yellow
$dt = $client.LoginV2("admin","admin123",1,"2019","2.0.0")
Write-Host "Rows=$($dt.Rows.Count)  Cols=$($dt.Columns.Count)"
$row = $dt.Rows[0]
for ($i=0; $i -lt $dt.Columns.Count; $i++) {
    $val = $row[$i]
    Write-Host ("  [{0,2}] {1} = {2}" -f $i, $dt.Columns[$i].ColumnName, $val)
}
Write-Host "`nbLogin (col 8) = $($row[8])  -> success=$($row[8] -eq $true)" -ForegroundColor Green

# Test Fecha (server-time). Should fall back to local OADate if 404.
Write-Host "`n--- Fecha() ---" -ForegroundColor Yellow
$fecha = $client.Fecha()
Write-Host "OLE date returned = $fecha  (DateTime = $([DateTime]::FromOADate($fecha)))"

# Test Examenes catalog
Write-Host "`n--- Examenes(0,0) ---" -ForegroundColor Yellow
try {
    $ex = $client.Examenes(0,0)
    Write-Host "Returned $($ex.Count) examenes"
} catch { Write-Host "Examenes failed: $_" -ForegroundColor Red }

Write-Host "`n--- MotorUniversal.Licencias(false) ---" -ForegroundColor Yellow
try {
    $motor = New-Object CulturaDigital.motor.MotorUniversalSoapClient
    $lic = $motor.Licencias($false)
    Write-Host "Returned $($lic.Count) licencias"
} catch { Write-Host "Licencias failed: $_" -ForegroundColor Red }

Write-Host "`n--- VersionAplicacion(2,$true) ---" -ForegroundColor Yellow
try {
    $v = $motor.VersionAplicacion(2,$true)
    Write-Host "Version = $v"
} catch { Write-Host "VersionAplicacion failed: $_" -ForegroundColor Red }

Write-Host "`nDone." -ForegroundColor Green
