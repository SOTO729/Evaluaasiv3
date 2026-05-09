$api = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"

# Wait DEV
for ($i=0; $i -lt 12; $i++) {
  try { $r = Invoke-WebRequest -Uri "$api/ping" -TimeoutSec 15 -UseBasicParsing; if ($r.StatusCode -eq 200) { Write-Host "DEV ready"; break } } catch { Write-Host "wait $i" }
}

$adminLogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username='admin';password='admin123'}|ConvertTo-Json) -ContentType 'application/json'
$adminTk = $adminLogin.access_token
$adminH = @{Authorization="Bearer $adminTk"; 'Content-Type'='application/json'}

# Find a coordinator with a group (use group 184: coord 9dfe98dd-13c3-46de-82d2-d16f03c2e1de, campus 159)
$g184 = (Invoke-RestMethod -Uri "$api/partners/groups/184" -Headers $adminH).group
Write-Host "Group 184: campus=$($g184.campus_id) coord=$($g184.coordinator_id)"

# Find or create an auxiliar of that coordinator
$auxList = Invoke-RestMethod -Uri "$api/user-management/users?role=auxiliar&per_page=50" -Headers $adminH
$aux = $auxList.users | Where-Object { $_.coordinator_id -eq $g184.coordinator_id -and $_.is_active } | Select-Object -First 1

if (-not $aux) {
  Write-Host "Creating auxiliar..."
  $ts = [int][double]::Parse((Get-Date -UFormat %s))
  $body = @{username="auxe2e$ts"; email="auxe2e$ts@test.local"; password="Aux123!"; name="Aux"; first_surname="E2E"; second_surname="Test"; gender="M"; role="auxiliar"; coordinator_id=$g184.coordinator_id} | ConvertTo-Json
  try {
    $r = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $adminH -Body $body
    $aux = $r.user
    $auxPwd = $r.temporary_password
    Write-Host "Auxiliar created: $($aux.username) pwd=$auxPwd coord=$($aux.coordinator_id)"
  } catch {
    Write-Host "Create aux ERR: $($_.ErrorDetails.Message)"; exit 1
  }
} else {
  Write-Host "Reusing auxiliar: $($aux.username) coord=$($aux.coordinator_id)"
  # Reset password to known one
  $rp = Invoke-RestMethod -Uri "$api/user-management/users/$($aux.id)/generate-password" -Method Post -Headers $adminH
  $auxPwd = $rp.password
  Write-Host "  reset pwd=$auxPwd"
}

# Login as auxiliar
$auxLogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username=$aux.username;password=$auxPwd}|ConvertTo-Json) -ContentType 'application/json'
$auxTk = $auxLogin.access_token
$auxH = @{Authorization="Bearer $auxTk"; 'Content-Type'='application/json'}
Write-Host "Logged in as auxiliar $($aux.username)"

$ts = [int][double]::Parse((Get-Date -UFormat %s))

# T-AUX-1: aux creates candidate WITHOUT group_id -> coordinator_id should equal aux.coordinator_id
$body1 = @{username="auxcand$ts"; email="auxcand$ts@test.local"; name="AuxCand"; first_surname="One"; second_surname="X"; gender="M"; role="candidato"} | ConvertTo-Json
try {
  $r1 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $auxH -Body $body1
  $u1 = $r1.user
  Write-Host "T-AUX-1 (no group): coord=$($u1.coordinator_id) campus=$($u1.campus_id)"
  if ($u1.coordinator_id -eq $aux.coordinator_id) { Write-Host "  PASS coord propagated" -ForegroundColor Green } else { Write-Host "  FAIL: expected $($aux.coordinator_id)" -ForegroundColor Red }
} catch { Write-Host "T-AUX-1 ERR: $($_.ErrorDetails.Message)" }

# T-AUX-2: aux creates candidate WITH group_id=184 -> coord and campus from group
$body2 = @{username="auxcandg$ts"; email="auxcandg$ts@test.local"; name="AuxCand"; first_surname="Two"; second_surname="X"; gender="M"; role="candidato"; group_id=184} | ConvertTo-Json
try {
  $r2 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $auxH -Body $body2
  $u2 = $r2.user
  Write-Host "T-AUX-2 (group=184): coord=$($u2.coordinator_id) campus=$($u2.campus_id) assigned=$($r2.assigned_to_group)"
  if ($u2.coordinator_id -eq $g184.coordinator_id -and $u2.campus_id -eq $g184.campus_id) { Write-Host "  PASS coord+campus from group" -ForegroundColor Green } else { Write-Host "  FAIL" -ForegroundColor Red }
} catch { Write-Host "T-AUX-2 ERR: $($_.ErrorDetails.Message)" }

# T-AUX-3: aux tries group_id from another tenant (find a group not belonging to aux's coord)
$allGroups = Invoke-RestMethod -Uri "$api/partners/groups/list-all?per_page=200" -Headers $adminH
$otherGroup = $allGroups.groups | Where-Object { $_.coordinator_id -and $_.coordinator_id -ne $aux.coordinator_id -and $_.is_active } | Select-Object -First 1
if ($otherGroup) {
  Write-Host "Other-tenant group: $($otherGroup.id) coord=$($otherGroup.coordinator_id)"
  $body3 = @{username="auxcross$ts"; email="auxcross$ts@test.local"; name="AuxCross"; first_surname="Tenant"; second_surname="X"; gender="M"; role="candidato"; group_id=$otherGroup.id} | ConvertTo-Json
  try {
    $r3 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $auxH -Body $body3
    Write-Host "T-AUX-3 UNEXPECTED OK (should be 403): $($r3 | ConvertTo-Json -Compress)" -ForegroundColor Red
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 403) { Write-Host "T-AUX-3 PASS: 403 cross-tenant blocked" -ForegroundColor Green } else { Write-Host "T-AUX-3 unexpected $code : $($_.ErrorDetails.Message)" -ForegroundColor Red }
  }
} else {
  Write-Host "T-AUX-3 SKIP: no other-tenant group found"
}

# T-AUX-4: aux creates responsable -> should auto-assign coordinator_id
$body4 = @{username="auxresp$ts"; email="auxresp$ts@test.local"; name="AuxResp"; first_surname="Test"; second_surname="X"; gender="M"; role="responsable"; curp="HEGJ820506HDFRNS01"; date_of_birth="1982-05-06"; campus_id=$g184.campus_id; skip_renapo_validation=$true} | ConvertTo-Json
try {
  $r4 = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $auxH -Body $body4
  $u4 = $r4.user
  Write-Host "T-AUX-4 (responsable): coord=$($u4.coordinator_id)"
  if ($u4.coordinator_id -eq $aux.coordinator_id) { Write-Host "  PASS responsable coord propagated" -ForegroundColor Green } else { Write-Host "  FAIL" -ForegroundColor Red }
} catch { Write-Host "T-AUX-4 ERR: $($_.ErrorDetails.Message)" }
