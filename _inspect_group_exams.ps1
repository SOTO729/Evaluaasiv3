$ErrorActionPreference = 'Stop'
$base = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"

$adminLogin = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
$AH = @{Authorization="Bearer $($adminLogin.access_token)"}
$gid = 187
$gex = Invoke-RestMethod -Uri "$base/partners/groups/$gid/exams" -Headers $AH
$exams = if ($gex.exams) { $gex.exams } else { $gex }
Write-Host ("group $gid -> {0} exams" -f $exams.Count)
Write-Host "RAW JSON:"
$gex | ConvertTo-Json -Depth 6 | Write-Host
