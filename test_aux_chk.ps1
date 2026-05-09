$api = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
$login = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body (@{username='admin';password='admin123'}|ConvertTo-Json) -ContentType 'application/json'
$h = @{Authorization="Bearer $($login.access_token)"; 'Content-Type'='application/json'}
$ts = [int][double]::Parse((Get-Date -UFormat %s))
$body = @{username="auxchk$ts"; email="auxchk$ts@test.local"; name="AuxChk"; first_surname="Now"; second_surname="X"; gender="M"; role="auxiliar"; coordinator_id="9dfe98dd-13c3-46de-82d2-d16f03c2e1de"} | ConvertTo-Json
try {
  $r = Invoke-RestMethod -Uri "$api/user-management/users" -Method Post -Headers $h -Body $body
  Write-Host "Created: $($r.user.username) id=$($r.user.id) coord_in_resp=$($r.user.coordinator_id)"
  $g = Invoke-RestMethod -Uri "$api/user-management/users/$($r.user.id)" -Headers $h
  Write-Host "GET coord_id=$($g.user.coordinator_id) campus=$($g.user.campus_id) role=$($g.user.role)"
} catch {
  Write-Host "ERR: $($_.ErrorDetails.Message)"
}
