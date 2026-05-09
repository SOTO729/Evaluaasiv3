$api = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
$adminLogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username='admin';password='admin123'}|ConvertTo-Json) -ContentType 'application/json'
$h = @{Authorization="Bearer $($adminLogin.access_token)"; 'Content-Type'='application/json'}

# Use coord 01ca5e5d (G9C6KGXKSF) - login as them and create a group
$coordId = '01ca5e5d-a0eb-4d58-bbc2-6df8ada34345'
$rp = Invoke-RestMethod -Uri "$api/user-management/users/$coordId/generate-password" -Method Post -Headers $h
$pwd = $rp.password
$cl = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username='G9C6KGXKSF';password=$pwd}|ConvertTo-Json) -ContentType 'application/json'
$ch = @{Authorization="Bearer $($cl.access_token)"; 'Content-Type'='application/json'}

# get coord's campuses to create a group
$campuses = Invoke-RestMethod -Uri "$api/partners/campuses?per_page=20" -Headers $ch
Write-Host "Coord campuses: $($campuses.campuses.Count)"
if ($campuses.campuses.Count -eq 0) { Write-Host "no campuses for coord"; exit 1 }
$camp = $campuses.campuses[0]
Write-Host "Using campus: $($camp.id) $($camp.name)"

# get school cycle
$cycles = Invoke-RestMethod -Uri "$api/partners/school-cycles?per_page=10" -Headers $ch
$cycle = $cycles.cycles | Select-Object -First 1
Write-Host "Cycle: $($cycle.id) $($cycle.name)"

# create a group as coord
$ts = [int][double]::Parse((Get-Date -UFormat %s))
$bodyG = @{name="Grupo E2E Aux $ts"; school_cycle_id=$cycle.id; description="test"; max_candidates=50} | ConvertTo-Json
$rg = Invoke-RestMethod -Uri "$api/partners/campuses/$($camp.id)/groups" -Method Post -Headers $ch -Body $bodyG
$grp = $rg.group
Write-Host "Created group $($grp.id) coord=$($grp.coordinator_id) campus=$($grp.campus_id)"
if ($grp.coordinator_id -ne $coordId) { Write-Host "WARN: coord not set in group"; }

# Now create aux bound to coord
$bodyAux = @{username="auxpos$ts"; email="auxpos$ts@test.local"; name="AuxPos"; first_surname="Test"; second_surname="X"; gender="M"; role="auxiliar"; coordinator_id=$coordId} | ConvertTo-Json
$rAux = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $h -Body $bodyAux
$aux = $rAux.user
Write-Host "Aux: $($aux.username) coord=$($aux.coordinator_id)"
$auxLogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username=$aux.username;password=$rAux.temporary_password}|ConvertTo-Json) -ContentType 'application/json'
$auxH = @{Authorization="Bearer $($auxLogin.access_token)"; 'Content-Type'='application/json'}

# T-POS: aux can assign candidate to OWN coord's group
$body2 = @{username="auxgpos$ts"; email="auxgpos$ts@test.local"; name="AuxGPos"; first_surname="Two"; second_surname="X"; gender="M"; role="candidato"; group_id=$grp.id} | ConvertTo-Json
try {
  $r2 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $auxH -Body $body2
  Write-Host "T-POS (own group=$($grp.id)): coord=$($r2.user.coordinator_id) campus=$($r2.user.campus_id) assigned=$($r2.assigned_to_group)"
  if ($r2.user.coordinator_id -eq $grp.coordinator_id -and $r2.user.campus_id -eq $grp.campus_id -and $r2.assigned_to_group) {
    Write-Host "  PASS positive case" -ForegroundColor Green
  } else { Write-Host "  FAIL" -ForegroundColor Red }
} catch { Write-Host "T-POS ERR: $($_.ErrorDetails.Message)" }
