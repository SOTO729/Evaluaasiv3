# Test smoke W-COBX: endpoints de cobro no rompen modulo
$ErrorActionPreference = "Continue"
$base = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
Write-Host "===== W-COBX smoke (Base=$base) ====="
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
$H = @{Authorization="Bearer $($login.access_token)"; "Content-Type"="application/json"}
Write-Host "Login OK"

$gid = 188
$members = Invoke-RestMethod -Uri "$base/partners/groups/$gid/members" -Headers $H
$uid = $members.members[0].user_id
$gexams = Invoke-RestMethod -Uri "$base/partners/groups/$gid/exams" -Headers $H
$eid = if ($gexams.exams) { $gexams.exams[0].exam_id } else { 0 }
Write-Host "uid=$uid eid=$eid"

# 1) GET retake/info (L8119) - admin bypassea pero verifica que no rompa
if ($eid -ne 0) {
    Write-Host "`n--- GET /groups/$gid/exams/$eid/members/$uid/retake/info"
    try {
        $r = Invoke-RestMethod -Uri "$base/partners/groups/$gid/exams/$eid/members/$uid/retake/info" -Headers $H
        Write-Host ("  current_balance=$($r.current_balance) sufficient_balance=$($r.sufficient_balance)")
        Write-Host "  PASS: endpoint responde"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "  HTTP=$code body=$($_.ErrorDetails.Message)"
        if ($code -eq 500) { Write-Host "  FAIL 500" } else { Write-Host "  PASS no-500" }
    }
}

# 2) Health
Write-Host "`n--- /health"
$h = Invoke-RestMethod -Uri "$base/health"
Write-Host "  $h"
Write-Host "===== Done ====="
