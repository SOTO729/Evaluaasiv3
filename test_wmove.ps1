$base = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
Write-Host "===== Test W-MOVE (Base=$base) ====="

$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
$H = @{Authorization = "Bearer $($login.access_token)"; "Content-Type" = "application/json"}
Write-Host "Login OK"

# Buscar dos grupos para mover entre ellos
$groups = Invoke-RestMethod -Uri "$base/partners/groups/list-all" -Headers $H
$gs = if ($groups.groups) { $groups.groups } else { $groups }
$SOURCE = 188
$TARGET = ($gs | Where-Object { $_.id -ne $SOURCE -and $_.campus_id } | Select-Object -First 1).id
if (-not $TARGET) { $TARGET = ($gs | Where-Object { $_.id -ne $SOURCE } | Select-Object -First 1).id }
Write-Host "SOURCE=$SOURCE TARGET=$TARGET"

# Tomar un miembro del source y forzar status='curp_required' previamente
$members = Invoke-RestMethod -Uri "$base/partners/groups/$SOURCE/members?per_page=5" -Headers $H
$test = $members.members | Where-Object { $_.user -ne $null } | Select-Object -First 1
if (-not $test) { Write-Host "No member to test"; exit 1 }
$mid = $test.id
$uid = $test.user_id
$origStatus = $test.status
Write-Host "Test member: id=$mid user_id=$uid orig_status=$origStatus"

# Forzar status='curp_required' y nota original
Write-Host "`n--- Setup: PUT status='curp_required' + notes='ORIGINAL'"
$setupBody = '{"status":"curp_required","notes":"NOTA ORIGINAL"}'
Invoke-RestMethod -Uri "$base/partners/groups/$SOURCE/members/$mid" -Method PUT -Headers $H -Body $setupBody | Out-Null

# Ejecutar move
Write-Host "`n--- Move user ${uid}: $SOURCE -> $TARGET"
$moveBody = "{`"target_group_id`":$TARGET,`"user_ids`":[`"$uid`"]}"
$result = Invoke-RestMethod -Uri "$base/partners/groups/$SOURCE/members/move" -Method POST -Headers $H -Body $moveBody
Write-Host "  moved=$($result.moved.Count) errors=$($result.errors.Count)"
if ($result.errors.Count -gt 0) {
    Write-Host "  ERROR DETAIL: $($result.errors | ConvertTo-Json -Compress)"
}
if ($result.moved.Count -gt 0) {
    Write-Host "  preserved_status=$($result.moved[0].preserved_status)"
}

# Verificar estado preservado en target
Write-Host "`n--- Verify destination state"
$targetMembers = Invoke-RestMethod -Uri "$base/partners/groups/$TARGET/members?per_page=500" -Headers $H
$moved = $targetMembers.members | Where-Object { $_.user_id -eq $uid }
if ($moved) {
    Write-Host "  Encontrado en target: status=$($moved.status) notes='$($moved.notes)'"
    if ($moved.status -eq 'curp_required') {
        Write-Host "  T1 PASS: status preservado"
    } else {
        Write-Host "  T1 FAIL: status='$($moved.status)' (esperaba 'curp_required')"
    }
    if ($moved.notes -like "*NOTA ORIGINAL*" -and $moved.notes -like "*Movido desde*") {
        Write-Host "  T2 PASS: notes concatenadas"
    } else {
        Write-Host "  T2 FAIL: notes='$($moved.notes)'"
    }
} else {
    Write-Host "  T1/T2 FAIL: no se encontró el miembro en target"
}

# Restaurar: mover de vuelta y limpiar
Write-Host "`n--- Restore: move back $TARGET -> $SOURCE"
$backBody = "{`"target_group_id`":$SOURCE,`"user_ids`":[`"$uid`"]}"
try {
    Invoke-RestMethod -Uri "$base/partners/groups/$TARGET/members/move" -Method POST -Headers $H -Body $backBody | Out-Null
    Write-Host "  Moved back"
    # Restaurar status
    $sourceMembers = Invoke-RestMethod -Uri "$base/partners/groups/$SOURCE/members?per_page=500" -Headers $H
    $back = $sourceMembers.members | Where-Object { $_.user_id -eq $uid }
    if ($back) {
        $restoreBody = '{"status":"' + $origStatus + '","notes":""}'
        Invoke-RestMethod -Uri "$base/partners/groups/$SOURCE/members/$($back.id)" -Method PUT -Headers $H -Body $restoreBody | Out-Null
        Write-Host "  Status restored to $origStatus"
    }
} catch { Write-Host "  Restore error: $_" }

Write-Host "`n===== Done ====="
