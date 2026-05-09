$ErrorActionPreference = 'Stop'
$base = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
$xlsx = 'C:\Users\Diego\Downloads\ActiveDirectoryUsers (1)\plantilla_asignacion_examenes_nacional 1.xlsx'

# 1. Login responsable
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"8SAWH17V3C","password":"Test_Resp_2026!"}'
$tok = $login.access_token
$H = @{Authorization="Bearer $tok"}
Write-Host ("RESP login OK role={0} campus_id={1} coord={2}" -f $login.user.role,$login.user.campus_id,$login.user.coordinator_id)

# 2. Listar grupos accesibles
try {
    $mp = Invoke-RestMethod -Uri "$base/partners/mi-plantel/groups" -Headers $H
    Write-Host "mi-plantel groups (top 10):"
    $mp.groups | Select-Object -First 10 id,name,campus_id | Format-Table | Out-String | Write-Host
    $script:groups = $mp.groups
} catch {
    Write-Host "mi-plantel FAIL: $($_.Exception.Message)"
    try { $errBody = $_.ErrorDetails.Message; Write-Host "body: $errBody" } catch {}
}

if (-not $script:groups -or $script:groups.Count -eq 0) {
    Write-Host "No hay grupos para el responsable; abortando."
    exit 1
}

# 3. Buscar el primer grupo que tenga al menos un examen ECM publicado
$gid = $null; $ecmCode = $null
foreach ($grp in $script:groups) {
    try {
        $gex = Invoke-RestMethod -Uri "$base/partners/groups/$($grp.id)/exams" -Headers $H
        $exams = if ($gex.exams) { $gex.exams } else { $gex }
        foreach ($e in $exams) {
            if ($e.ecm_code) { $gid = $grp.id; $ecmCode = $e.ecm_code; break }
        }
        if ($gid) { break }
    } catch {}
}
if (-not $gid) {
    # fallback: tomar el primer grupo y dejar que el endpoint busque ECM por código
    $gid = $script:groups[0].id
}
Write-Host ("Probando con group_id={0} ecm_code={1}" -f $gid,$ecmCode)

# 4. Subir Excel al endpoint bulk-assign con multipart/form-data via curl (más confiable que IRM)
$tmpOut = Join-Path $env:TEMP "bulk_resp.json"
if (-not $ecmCode) { $ecmCode = "ECM00EX" }
$curlArgs = @(
  '-s','-o',$tmpOut,'-w','%{http_code}',
  '-X','POST',
  '-H',"Authorization: Bearer $tok",
  '-F',"file=@$xlsx",
  '-F',"ecm_code=$ecmCode",
  '-F','dry_run=false',
  "$base/partners/groups/$gid/exams/bulk-assign"
)
$code = & curl.exe @curlArgs
Write-Host ("HTTP {0}" -f $code)
$body = Get-Content $tmpOut -Raw
Write-Host "RESPONSE BODY:"
Write-Host $body
