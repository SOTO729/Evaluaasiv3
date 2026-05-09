# Test funcional politica de facturación responsable
$ErrorActionPreference = "Continue"
$base = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
Write-Host "===== Test billpolicy responsable (Base=$base) ====="

$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
$H = @{Authorization="Bearer $($login.access_token)"; "Content-Type"="application/json"}
Write-Host "Login admin OK"

# 1) Buscar responsable con campus_id (consultando detalle uno a uno)
$resp = Invoke-RestMethod -Uri "$base/users?role=responsable&per_page=20" -Headers $H
$candidate = $null
foreach ($u in $resp.users) {
    try {
        $detailWrap = Invoke-RestMethod -Uri "$base/user-management/users/$($u.id)" -Headers $H
        $detail = if ($detailWrap.user) { $detailWrap.user } else { $detailWrap }
        if ($detail.campus_id) { $candidate = $detail; break }
    } catch {}
}
if (-not $candidate) { Write-Host "no hay responsable con campus_id"; exit }
Write-Host "Responsable: id=$($candidate.id) username=$($candidate.username) campus_id=$($candidate.campus_id)"

# 2) Set password conocida
$pwBody = '{"new_password":"Test_Resp_2026!"}'
$null = Invoke-RestMethod -Uri "$base/user-management/users/$($candidate.id)/password" -Method PUT -Headers $H -Body $pwBody
Write-Host "Password set"

# 3) Login como responsable
$loginR = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType "application/json" -Body ('{"username":"' + $candidate.username + '","password":"Test_Resp_2026!"}')
$RH = @{Authorization="Bearer $($loginR.access_token)"; "Content-Type"="application/json"}
$campus_id = $loginR.user.campus_id
Write-Host "Login responsable OK role=$($loginR.user.role) campus_id=$campus_id"

# 4) Buscar un grupo del campus del responsable usando endpoint /campuses/<id>/groups
$g = Invoke-RestMethod -Uri "$base/partners/campuses/$campus_id/groups" -Headers $RH
$grouplist = if ($g.groups) { $g.groups } else { $g }
$mygroup = $grouplist | Select-Object -First 1
if (-not $mygroup) { Write-Host "responsable no tiene grupos en campus $campus_id"; exit }
Write-Host "Grupo: id=$($mygroup.id) name=$($mygroup.name)"

# 5) Buscar un examen ECM con costo
$exams = Invoke-RestMethod -Uri "$base/exams" -Headers $RH
$examlist = if ($exams.exams) { $exams.exams } else { $exams }
$myexam = $examlist | Where-Object { $_.competency_standard_id -ne $null } | Select-Object -First 1
if (-not $myexam) {
  Write-Host "no exam ECM, usando el primero"
  $myexam = $examlist[0]
}
Write-Host "Examen: id=$($myexam.id) name=$($myexam.name) ecm=$($myexam.competency_standard_id)"

# 6) Intentar asignar examen al grupo (debería bloquear con 403 responsable_must_request)
$assignBody = '{"exam_id":' + $myexam.id + ',"assignment_type":"all","max_attempts":1}'
Write-Host "`n--- POST /groups/$($mygroup.id)/exams (esperado: 403 responsable_must_request)"
try {
    $r = Invoke-RestMethod -Uri "$base/partners/groups/$($mygroup.id)/exams" -Method POST -Headers $RH -Body $assignBody
    Write-Host "  UNEXPECTED OK: $($r | ConvertTo-Json -Compress -Depth 3)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    $body = $_.ErrorDetails.Message
    Write-Host "  HTTP=$code body=$body"
    if ($code -eq 403 -and $body -match "responsable_must_request") {
        Write-Host "  T1 PASS: responsable bloqueado correctamente"
    } elseif ($code -eq 403) {
        Write-Host "  T1 PARTIAL: 403 pero error_type distinto"
    } else {
        Write-Host "  T1 FAIL: esperado 403 responsable_must_request"
    }
}

# 7) Intentar aplicar retoma (POST retake) — debe bloquear igual
$members = Invoke-RestMethod -Uri "$base/partners/groups/$($mygroup.id)/members" -Headers $RH
$muser = if ($members.members) { $members.members[0].user_id } else { $null }
$gexams = Invoke-RestMethod -Uri "$base/partners/groups/$($mygroup.id)/exams" -Headers $RH
$gex = if ($gexams.exams) { $gexams.exams[0] } else { $null }
if ($muser -and $gex) {
    Write-Host "`n--- POST /groups/$($mygroup.id)/exams/$($gex.exam_id)/members/$muser/retake"
    try {
        $r = Invoke-RestMethod -Uri "$base/partners/groups/$($mygroup.id)/exams/$($gex.exam_id)/members/$muser/retake" -Method POST -Headers $RH -Body '{}'
        Write-Host "  RESP: $($r | ConvertTo-Json -Compress -Depth 3)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $body = $_.ErrorDetails.Message
        Write-Host "  HTTP=$code body=$body"
        if ($code -eq 403 -and $body -match "responsable_must_request") {
            Write-Host "  T2 PASS: retoma bloqueada para responsable"
        } elseif ($code -eq 400 -or $code -eq 404) {
            Write-Host "  T2 N/A: error de negocio (sin contexto retake real). Bloqueo politica no llega a evaluarse."
        } else {
            Write-Host "  T2 FAIL"
        }
    }
}

# 8) Verificar que admin sigue funcionando con el mismo grupo (smoke regresión)
Write-Host "`n--- Admin GET retake/info (smoke)"
$gex = if ($gexams.exams) { $gexams.exams[0] } else { $null }
if ($gex -and $muser) {
    try {
        $r = Invoke-RestMethod -Uri "$base/partners/groups/$($mygroup.id)/exams/$($gex.exam_id)/members/$muser/retake/info" -Headers $H
        Write-Host "  admin retake/info OK current_balance=$($r.current_balance)"
        Write-Host "  T3 PASS"
    } catch {
        Write-Host "  HTTP=$($_.Exception.Response.StatusCode.value__) body=$($_.ErrorDetails.Message)"
        Write-Host "  T3 FAIL"
    }
}

Write-Host "`n===== Done ====="
