$ErrorActionPreference = 'Stop'
$base = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"

$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"8SAWH17V3C","password":"Test_Resp_2026!"}'
$tok = $login.access_token
$H = @{Authorization="Bearer $tok"; "Content-Type"="application/json"}
Write-Host "RESP login OK"

# ============= TEST A: assignments/add (asignación adicional) =============
Write-Host "`n=== TEST A: assignments/add (ECM huawei 1503 / exam 1249) ==="
$bodyA = @{ user_ids = @('01091037-566d-4d11-8185-82221ed6f25d') } | ConvertTo-Json
try {
    $rA = Invoke-WebRequest -Uri "$base/partners/groups/187/exams/1249/assignments/add" -Method POST -Headers $H -Body $bodyA -UseBasicParsing
    Write-Host "Test A: HTTP $($rA.StatusCode)"
    Write-Host $rA.Content
} catch {
    $resp = $_.Exception.Response
    if ($resp) {
        $sc = [int]$resp.StatusCode
        $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $body = $sr.ReadToEnd()
        Write-Host "Test A: HTTP $sc"
        Write-Host $body
    } else {
        Write-Host "Test A failed: $($_.Exception.Message)"
    }
}

# ============= TEST B: reactivación de GroupExam =============
Write-Host "`n=== TEST B: reactivación (POST /groups/187/exams con exam_id=210 desactivado) ==="
# (Desactivación se hace fuera con SQL, antes de correr esto)
$bodyB = @{ exam_id = 210; assignment_type = 'all' } | ConvertTo-Json
try {
    $rB = Invoke-WebRequest -Uri "$base/partners/groups/187/exams" -Method POST -Headers $H -Body $bodyB -UseBasicParsing
    Write-Host "Test B: HTTP $($rB.StatusCode)"
    Write-Host $rB.Content
} catch {
    $resp = $_.Exception.Response
    if ($resp) {
        $sc = [int]$resp.StatusCode
        $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $body = $sr.ReadToEnd()
        Write-Host "Test B: HTTP $sc"
        Write-Host $body
    } else {
        Write-Host "Test B failed: $($_.Exception.Message)"
    }
}
