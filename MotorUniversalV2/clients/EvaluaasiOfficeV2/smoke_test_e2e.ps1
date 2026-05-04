$ErrorActionPreference = "Stop"
$bin = "C:\Users\Diego\Desktop\Evaluaasiv3\MotorUniversalV2\clients\EvaluaasiOfficeV2\src\bin\Release"
$cfgPath = "$bin\EvaluaasiOfficeV2.exe.config"

[AppDomain]::CurrentDomain.SetData("APP_CONFIG_FILE", $cfgPath)
Add-Type -AssemblyName System.Configuration
[Reflection.Assembly]::LoadFrom("$bin\EvaluaasiOfficeV2.exe") | Out-Null
[Reflection.Assembly]::LoadFrom("$bin\itextsharp.dll") | Out-Null
[Reflection.Assembly]::LoadFrom("$bin\Gma.QrCodeNet.Encoding.Net35.dll") | Out-Null

$asm = [Reflection.Assembly]::GetAssembly([CulturaDigital.xmn.UsuarioSoapClient])
$apiType = $asm.GetType("CulturaDigital.ApiClient")
$apiType.GetField("_baseUrl","NonPublic,Static").SetValue($null,
    "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api")

function Step { param($t) Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Ok   { param($m) Write-Host "  [OK] $m" -ForegroundColor Green }
function Warn { param($m) Write-Host "  [WARN] $m" -ForegroundColor Yellow }
function Fail { param($m) Write-Host "  [FAIL] $m" -ForegroundColor Red }

$client = New-Object CulturaDigital.xmn.UsuarioSoapClient
$motor  = New-Object CulturaDigital.motor.MotorUniversalSoapClient

Step "1. LoginV2(admin/admin123)"
$dt = $client.LoginV2("admin","admin123",1,"2019","2.0.0")
$row = $dt.Rows[0]
$bLogin = [bool]$row[8]
$voucherCode = [string]$row[4]
if ($bLogin) { Ok "bLogin=True voucherCode=$voucherCode" }
else { Fail "Login failed: $($row[9])"; exit 1 }

Step "2. Fecha"
$ole = $client.Fecha()
Ok "ole_date=$ole"

Step "3. Examenes"
$exs = $client.Examenes(0,0)
Ok "Returned $($exs.Count) exams"
if ($exs.Count -eq 0) { Fail "No exams"; exit 1 }
$first = $exs[0]
Write-Host "  -> exam id=$($first.Id) name=$($first.Nombre)"

Step "4. VersionExamen"
$ve = $client.VersionExamen($first.Id)
Ok "version=$ve"

Step "5. DescargarExamen"
$dx = $client.DescargarExamen($first.Id)
$xae = [string]$dx.Rows[0][1]
if ([string]::IsNullOrEmpty($xae)) { Warn "xae vacio (blob no publicado)" }
else { Ok "xae len=$($xae.Length)" }

Step "6. Inicio"
try {
    $vint = 0
    [int]::TryParse(($voucherCode -replace '[^\d]',''), [ref]$vint) | Out-Null
    $ini = $client.Inicio($vint, $env:USERNAME, $env:COMPUTERNAME, "127.0.0.1", "00:00:00:00:00:00", "2019", "2.0.0", "0", 1)
    $code = [int]$ini.Rows[0][0]
    if ($code -eq 0) { Ok "Inicio code=0 result_id=$($ini.Rows[0][1])" }
    else { Warn "Inicio code=$code" }
} catch { Fail "Inicio threw: $($_.Exception.Message)" }

Step "7. Fin"
try {
    $fin = $client.Fin($vint, 850, 1, "0")
    $code = [int]$fin.Rows[0][0]
    if ($code -eq 0) { Ok "Fin code=0 cert=$($fin.Rows[0][1])" }
    else { Warn "Fin code=$code" }
} catch { Fail "Fin threw: $($_.Exception.Message)" }

Step "8. Licencias / VersionAplicacion"
Ok "Licencias=$($motor.Licencias($false).Count)"
Ok "VersionAplicacion=$($motor.VersionAplicacion(2,$true))"

Write-Host ""
Write-Host "=== E2E DONE ===" -ForegroundColor Magenta
