$Base = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/partners"
$AuthBase = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
Write-Host "===== Test W4+W5 (Base=$Base) ====="

try {
    $login = Invoke-RestMethod -Uri "$AuthBase/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
    $token = $login.access_token
} catch {
    Write-Host "LOGIN FAIL: $_"; exit 1
}
Write-Host "Login OK"
$H = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$GROUP_ID = 188

# Test 1: POST status invalido => 400
Write-Host "`n--- T1: POST status='HACKER' (esperar 400)"
try {
    Invoke-RestMethod -Uri "$Base/groups/$GROUP_ID/members" -Method POST -Headers $H -Body '{"user_id":"x","status":"HACKER"}' -ErrorAction Stop | Out-Null
    Write-Host "  T1 FAIL: no error"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    $body = $_.ErrorDetails.Message
    Write-Host "  HTTP=$code body=$body"
    if ($code -eq 400) { Write-Host "  T1 PASS" } else { Write-Host "  T1 FAIL" }
}

Write-Host "`n--- T2 prep: list members"
$members = Invoke-RestMethod -Uri "$Base/groups/$GROUP_ID/members?per_page=1" -Headers $H
if (-not $members.members -or $members.members.Count -eq 0) {
    Write-Host "  No members"; exit 0
}
$mid = $members.members[0].id
$origStatus = $members.members[0].status
Write-Host "  member_id=$mid orig_status=$origStatus"

Write-Host "`n--- T2: PUT status='NOTAREAL' (esperar 400)"
try {
    Invoke-RestMethod -Uri "$Base/groups/$GROUP_ID/members/$mid" -Method PUT -Headers $H -Body '{"status":"NOTAREAL"}' -ErrorAction Stop | Out-Null
    Write-Host "  T2 FAIL"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "  HTTP=$code"
    if ($code -eq 400) { Write-Host "  T2 PASS" } else { Write-Host "  T2 FAIL" }
}

Write-Host "`n--- T3: PUT status='curp_required' (W5 fix, esperar 200)"
try {
    $r3 = Invoke-RestMethod -Uri "$Base/groups/$GROUP_ID/members/$mid" -Method PUT -Headers $H -Body '{"status":"curp_required"}'
    Write-Host "  OK status=$($r3.member.status)"
    if ($r3.member.status -eq 'curp_required') { Write-Host "  T3 PASS" } else { Write-Host "  T3 FAIL" }
} catch {
    Write-Host "  T3 FAIL: $($_.Exception.Response.StatusCode.value__)"
}

Write-Host "`n--- Restore: PUT status='$origStatus'"
$bodyR = '{"status":"' + $origStatus + '"}'
try {
    Invoke-RestMethod -Uri "$Base/groups/$GROUP_ID/members/$mid" -Method PUT -Headers $H -Body $bodyR | Out-Null
    Write-Host "  Restored"
} catch { Write-Host "  Restore FAIL: $_" }

Write-Host "`n===== Done ====="
