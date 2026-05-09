$api = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"

$adminLogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username='admin';password='admin123'}|ConvertTo-Json) -ContentType 'application/json'
$adminH = @{Authorization="Bearer $($adminLogin.access_token)"; 'Content-Type'='application/json'}

# Find coordinators and pick one with groups
$coords = (Invoke-RestMethod -Uri "$api/user-management/users?role=coordinator&per_page=50&active=true" -Headers $adminH).users
$coordWithGroup = $null
$coordGroup = $null
foreach ($c in $coords) {
  # Use admin to fetch groups owned by this coord (via search by coordinator_id is not available; use list-all and filter)
  # We already know group 184 has coord 9dfe98dd... but that was admin. Let me try /groups search
  try {
    $r = Invoke-RestMethod -Uri "$api/partners/groups/search?coordinator_id=$($c.id)" -Headers $adminH
    if ($r.groups -and $r.groups.Count -gt 0) {
      $coordWithGroup = $c
      $coordGroup = $r.groups[0]
      break
    }
  } catch {}
}

if (-not $coordWithGroup) {
  # Fallback: try each coord's "my groups" via partners/coordinator-groups or similar
  Write-Host "Could not find coord with groups via search, trying first coord with my-groups endpoint..."
  foreach ($c in $coords[0..4]) {
    Write-Host "Trying coord: $($c.username)"
    # generate password and login as coord
    $rp = Invoke-RestMethod -Uri "$api/user-management/users/$($c.id)/generate-password" -Method Post -Headers $adminH
    $pwd = $rp.password
    try {
      $cl = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username=$c.username;password=$pwd}|ConvertTo-Json) -ContentType 'application/json'
      $ch = @{Authorization="Bearer $($cl.access_token)"}
      $myGroups = Invoke-RestMethod -Uri "$api/partners/groups/list-all?per_page=20" -Headers $ch
      if ($myGroups.groups -and $myGroups.groups.Count -gt 0) {
        $coordWithGroup = $c; $coordGroup = $myGroups.groups[0]
        Write-Host "Found: coord=$($c.username) group=$($coordGroup.id)"
        break
      }
    } catch { Write-Host "  err: $($_.ErrorDetails.Message)" }
  }
}

if (-not $coordWithGroup) { Write-Host "ABORT: no coord+group found"; exit 1 }
Write-Host ("Using coord $($coordWithGroup.username) ($($coordWithGroup.id)) with group $($coordGroup.id) campus=$($coordGroup.campus_id)")

$ts = [int][double]::Parse((Get-Date -UFormat %s))

# Create auxiliar bound to that coordinator (admin)
$bodyAux = @{username="auxe2e$ts"; email="auxe2e$ts@test.local"; name="Aux"; first_surname="E2E"; second_surname="Test"; gender="M"; role="auxiliar"; coordinator_id=$coordWithGroup.id} | ConvertTo-Json
$rAux = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $adminH -Body $bodyAux
$aux = $rAux.user
$auxPwd = $rAux.temporary_password
Write-Host "Aux created: $($aux.username) coord=$($aux.coordinator_id) (expected $($coordWithGroup.id))"
if ($aux.coordinator_id -ne $coordWithGroup.id) { Write-Host "FAIL: aux.coordinator_id NOT propagated" -ForegroundColor Red; exit 1 } else { Write-Host "  PASS aux coord persisted" -ForegroundColor Green }

# Login as auxiliar
$auxLogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username=$aux.username;password=$auxPwd}|ConvertTo-Json) -ContentType 'application/json'
$auxH = @{Authorization="Bearer $($auxLogin.access_token)"; 'Content-Type'='application/json'}
Write-Host "Logged as aux"

# T-AUX-1: aux creates candidate without group_id
$body1 = @{username="auxnogr$ts"; email="auxnogr$ts@test.local"; name="AuxCandNoGr"; first_surname="One"; second_surname="X"; gender="M"; role="candidato"} | ConvertTo-Json
try {
  $r1 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $auxH -Body $body1
  Write-Host "T-AUX-1 (no group): coord=$($r1.user.coordinator_id) campus=$($r1.user.campus_id)"
  if ($r1.user.coordinator_id -eq $coordWithGroup.id) { Write-Host "  PASS aux propagates coord to candidate" -ForegroundColor Green } else { Write-Host "  FAIL" -ForegroundColor Red }
} catch { Write-Host "T-AUX-1 ERR: $($_.ErrorDetails.Message)" }

# T-AUX-2: aux creates candidate with valid group_id
$body2 = @{username="auxg$ts"; email="auxg$ts@test.local"; name="AuxCandG"; first_surname="Two"; second_surname="X"; gender="M"; role="candidato"; group_id=$coordGroup.id} | ConvertTo-Json
try {
  $r2 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $auxH -Body $body2
  Write-Host "T-AUX-2 (group=$($coordGroup.id)): coord=$($r2.user.coordinator_id) campus=$($r2.user.campus_id) assigned=$($r2.assigned_to_group)"
  if ($r2.user.coordinator_id -eq $coordGroup.coordinator_id -and $r2.user.campus_id -eq $coordGroup.campus_id) { Write-Host "  PASS coord+campus from group" -ForegroundColor Green } else { Write-Host "  FAIL" -ForegroundColor Red }
} catch { Write-Host "T-AUX-2 ERR: $($_.ErrorDetails.Message)" }

# T-AUX-3: aux tries cross-tenant group (use group 184 if its coord differs)
$g184 = (Invoke-RestMethod -Uri "$api/partners/groups/184" -Headers $adminH).group
if ($g184.coordinator_id -ne $coordWithGroup.id) {
  $body3 = @{username="auxx$ts"; email="auxx$ts@test.local"; name="AuxX"; first_surname="Cross"; second_surname="X"; gender="M"; role="candidato"; group_id=184} | ConvertTo-Json
  try {
    $r3 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $auxH -Body $body3
    Write-Host "T-AUX-3 UNEXPECTED OK (should be 403): $($r3 | ConvertTo-Json -Compress)" -ForegroundColor Red
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 403) { Write-Host "T-AUX-3 PASS: cross-tenant blocked 403" -ForegroundColor Green } else { Write-Host "T-AUX-3 unexpected $code : $($_.ErrorDetails.Message)" -ForegroundColor Red }
  }
} else { Write-Host "T-AUX-3 skipped (same coord)" }

# T-AUX-4: aux creates responsable -> auto-coord
$body4 = @{username="auxr$ts"; email="auxr$ts@test.local"; name="AuxResp"; first_surname="Test"; second_surname="X"; gender="M"; role="responsable"; curp="HEGJ820506HDFRNS01"; date_of_birth="1982-05-06"; campus_id=$coordGroup.campus_id; skip_renapo_validation=$true} | ConvertTo-Json
try {
  $r4 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $auxH -Body $body4
  Write-Host "T-AUX-4 (responsable): coord=$($r4.user.coordinator_id)"
  if ($r4.user.coordinator_id -eq $coordWithGroup.id) { Write-Host "  PASS responsable coord auto-assigned by aux" -ForegroundColor Green } else { Write-Host "  FAIL" -ForegroundColor Red }
} catch { Write-Host "T-AUX-4 ERR: $($_.ErrorDetails.Message)" }
