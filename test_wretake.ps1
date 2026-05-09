# Test W-RETAKE smoke: NO debe retornar 500 (tuple-unpack bug).
$ErrorActionPreference = "Continue"
$base = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
Write-Host "===== W-RETAKE smoke (Base=$base) ====="
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
$H = @{Authorization="Bearer $($login.access_token)"; "Content-Type"="application/json"}
Write-Host "Login OK"
$gid = 188
$members = Invoke-RestMethod -Uri "$base/partners/groups/$gid/members" -Headers $H
$uid = $members.members[0].user_id
$gexams = Invoke-RestMethod -Uri "$base/partners/groups/$gid/exams" -Headers $H
$eid = $gexams.exams[0].exam_id
Write-Host "uid=$uid eid=$eid gid=$gid"
try {
    $r = Invoke-RestMethod -Uri "$base/partners/groups/$gid/exams/$eid/members/$uid/retake" -Method POST -Headers $H -Body '{}'
    Write-Host "200 OK: $($r | ConvertTo-Json -Compress -Depth 4)"
    Write-Host "PASS"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    $msg = $_.ErrorDetails.Message
    Write-Host "HTTP=$code body=$msg"
    if ($code -eq 500) { Write-Host "FAIL 500" } else { Write-Host "PASS (no 500, error de negocio)" }
}
