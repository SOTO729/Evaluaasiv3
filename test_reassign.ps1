$api = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
$login = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username='admin';password='admin123'}|ConvertTo-Json) -ContentType 'application/json'
$tk = $login.access_token
$h = @{Authorization="Bearer $tk"; 'Content-Type'='application/json'}

$m = Invoke-RestMethod -Uri "$api/partners/groups/184/members?per_page=300" -Headers $h
$memberIds = @($m.members | ForEach-Object { $_.user_id })
Write-Host "Group 184 has $($memberIds.Count) members"

$candList = Invoke-RestMethod -Uri "$api/user-management/users?role=candidato&per_page=100" -Headers $h
$nonMember = $candList.users | Where-Object { $memberIds -notcontains $_.id -and $_.email } | Select-Object -First 1
if (-not $nonMember) { Write-Host "No non-member candidate with email"; exit 1 }
Write-Host "Non-member: $($nonMember.email) id=$($nonMember.id) campus_before=$($nonMember.campus_id)"

$ts = [int][double]::Parse((Get-Date -UFormat %s))
$body = @{username="reassign$ts"; email=$nonMember.email; password="Test123!"; name="Re"; first_surname="Assign"; second_surname="E2E"; gender="M"; role="candidato"; group_id=184} | ConvertTo-Json

try {
  $r = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $h -Body $body
  Write-Host "T4: existing_assigned=$($r.existing_user_assigned) dupfield=$($r.duplicate_field) already=$($r.already_member) gid=$($r.group_id) gname=$($r.group_name)"
  Write-Host "    msg=$($r.message)"
} catch {
  Write-Host "T4 ERR: $($_.ErrorDetails.Message)"
}

$m2 = Invoke-RestMethod -Uri "$api/partners/groups/184/members?per_page=300" -Headers $h
$found = $m2.members | Where-Object { $_.user_id -eq $nonMember.id }
Write-Host "Now in 184: $($null -ne $found) status=$($found.status)"
