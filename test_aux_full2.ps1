$api = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
$login = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username='admin';password='admin123'}|ConvertTo-Json) -ContentType 'application/json'
$h = @{Authorization="Bearer $($login.access_token)"; 'Content-Type'='application/json'}

# Find a coord that owns at least one group (group.coordinator_id == coord.id)
$coords = (Invoke-RestMethod -Uri "$api/user-management/users?role=coordinator&per_page=50&active=true" -Headers $h).users
$pickedCoord = $null
$pickedGroup = $null
foreach ($c in $coords) {
  $rp = Invoke-RestMethod -Uri "$api/user-management/users/$($c.id)/generate-password" -Method Post -Headers $h
  try {
    $cl = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username=$c.username;password=$rp.password}|ConvertTo-Json) -ContentType 'application/json'
    $ch = @{Authorization="Bearer $($cl.access_token)"}
    $gs = Invoke-RestMethod -Uri "$api/partners/groups/list-all?per_page=10" -Headers $ch
    $owned = $gs.groups | Where-Object { $_.coordinator_id -eq $c.id -and $_.is_active } | Select-Object -First 1
    if ($owned) { $pickedCoord = $c; $pickedGroup = $owned; break }
  } catch {}
}
if (-not $pickedCoord) { Write-Host "No coord owns any group"; exit 1 }
Write-Host "Picked coord=$($pickedCoord.username) ($($pickedCoord.id)) group=$($pickedGroup.id) campus=$($pickedGroup.campus_id)"

$ts = [int][double]::Parse((Get-Date -UFormat %s))

# Create aux
$bodyAux = @{username="auxe2e$ts"; email="auxe2e$ts@test.local"; name="Aux"; first_surname="E2E"; second_surname="Test"; gender="M"; role="auxiliar"; coordinator_id=$pickedCoord.id} | ConvertTo-Json
$rAux = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $h -Body $bodyAux
$aux = $rAux.user
Write-Host "Aux: $($aux.username) coord=$($aux.coordinator_id) (PASS=$($aux.coordinator_id -eq $pickedCoord.id))"
$auxLogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username=$aux.username;password=$rAux.temporary_password}|ConvertTo-Json) -ContentType 'application/json'
$auxH = @{Authorization="Bearer $($auxLogin.access_token)"; 'Content-Type'='application/json'}

# T-AUX-2: aux + group_id (owned by their coord)
$body2 = @{username="auxg$ts"; email="auxg$ts@test.local"; name="AuxG"; first_surname="Two"; second_surname="X"; gender="M"; role="candidato"; group_id=$pickedGroup.id} | ConvertTo-Json
try {
  $r2 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $auxH -Body $body2
  Write-Host "T-AUX-2 (own group=$($pickedGroup.id)): coord=$($r2.user.coordinator_id) campus=$($r2.user.campus_id) assigned=$($r2.assigned_to_group)"
  if ($r2.user.coordinator_id -eq $pickedGroup.coordinator_id -and $r2.user.campus_id -eq $pickedGroup.campus_id -and $r2.assigned_to_group) {
    Write-Host "  PASS aux can assign to own coord's group" -ForegroundColor Green
  } else { Write-Host "  FAIL" -ForegroundColor Red }
} catch { Write-Host "T-AUX-2 ERR: $($_.ErrorDetails.Message)" }

# T-AUX-3: aux + cross-tenant group_id should be 403
$crossGroup = $null
foreach ($c in $coords) {
  if ($c.id -eq $pickedCoord.id) { continue }
  $rp = Invoke-RestMethod -Uri "$api/user-management/users/$($c.id)/generate-password" -Method Post -Headers $h
  try {
    $cl = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username=$c.username;password=$rp.password}|ConvertTo-Json) -ContentType 'application/json'
    $ch = @{Authorization="Bearer $($cl.access_token)"}
    $gs = Invoke-RestMethod -Uri "$api/partners/groups/list-all?per_page=10" -Headers $ch
    $owned = $gs.groups | Where-Object { $_.coordinator_id -eq $c.id -and $_.is_active } | Select-Object -First 1
    if ($owned) { $crossGroup = $owned; break }
  } catch {}
}
if ($crossGroup) {
  Write-Host "Cross group: $($crossGroup.id) (coord $($crossGroup.coordinator_id))"
  $body3 = @{username="auxx$ts"; email="auxx$ts@test.local"; name="AuxX"; first_surname="Cross"; second_surname="X"; gender="M"; role="candidato"; group_id=$crossGroup.id} | ConvertTo-Json
  try {
    $r3 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $auxH -Body $body3
    Write-Host "T-AUX-3 UNEXPECTED OK" -ForegroundColor Red
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 403) { Write-Host "T-AUX-3 PASS: 403 cross-tenant" -ForegroundColor Green } else { Write-Host "T-AUX-3 unexpected $code" -ForegroundColor Red }
  }
}
