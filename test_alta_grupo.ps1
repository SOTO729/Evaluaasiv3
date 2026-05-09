$api = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
$login = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username='admin';password='admin123'}|ConvertTo-Json) -ContentType 'application/json'
$tk = $login.access_token
$h = @{Authorization="Bearer $tk"; 'Content-Type'='application/json'}

$ts = [int][double]::Parse((Get-Date -UFormat %s))
$body1 = @{username="altagrp$ts"; email="altagrp$ts@test.local"; password="Test123!"; name="Alta"; first_surname="Grupo"; second_surname="E2E"; gender="M"; role="candidato"; group_id=184} | ConvertTo-Json
try {
  $r1 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $h -Body $body1
  Write-Host "T1 NEW OK: assigned=$($r1.assigned_to_group) gid=$($r1.group_id) gname=$($r1.group_name) campus=$($r1.user.campus_id) coord=$($r1.user.coordinator_id) uid=$($r1.user.id)"
} catch {
  Write-Host "T1 ERR: $($_.ErrorDetails.Message)"
}

$users = Invoke-RestMethod -Uri "$api/user-management/users?role=candidato&per_page=5" -Headers $h
$existing = $users.users | Select-Object -First 1
Write-Host "Existing candidate: $($existing.email) id=$($existing.id)"

$body2 = @{username="dup$ts"; email=$existing.email; password="Test123!"; name="Dup"; first_surname="Test"; second_surname="E2E"; gender="M"; role="candidato"; group_id=184} | ConvertTo-Json
try {
  $r2 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $h -Body $body2
  Write-Host "T2 DUP OK: existing_assigned=$($r2.existing_user_assigned) dupfield=$($r2.duplicate_field) already=$($r2.already_member) msg=$($r2.message)"
} catch {
  Write-Host "T2 ERR: $($_.ErrorDetails.Message)"
}

$body3 = @{username="dupnogroup$ts"; email=$existing.email; password="Test123!"; name="Dup"; first_surname="NoGrp"; second_surname="E2E"; gender="M"; role="candidato"} | ConvertTo-Json
try {
  $r3 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $h -Body $body3
  Write-Host "T3 DUP NOGROUP UNEXPECTED OK: $($r3 | ConvertTo-Json -Compress)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "T3 DUP NOGROUP -> $code (expected 409): $($_.ErrorDetails.Message)"
}
