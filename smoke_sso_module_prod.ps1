$base='https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -ContentType 'application/json' -Body (@{username='admin';password='admin123'}|ConvertTo-Json)
$h = @{Authorization="Bearer $($login.access_token)"}
$partners = (Invoke-RestMethod -Uri "$base/partners" -Headers $h).partners
Write-Host "Found $($partners.Count) partners"
$cid = $null
foreach ($p in $partners) {
  if ($p.campus_count -lt 1) { continue }
  try {
    $cs = (Invoke-RestMethod -Uri "$base/partners/$($p.id)/campuses" -Headers $h).campuses
    if ($cs -and $cs.Count -gt 0) { $cid = $cs[0].id; Write-Host "Using partner=$($p.id) campus=$cid name=$($cs[0].name)"; break }
  } catch {}
}
if (-not $cid) { Write-Host "NO CAMPUS FOUND"; exit }
$info = Invoke-RestMethod -Uri "$base/sso/campuses/$cid/api-key" -Headers $h
Write-Host "BEFORE: enable_sso_api=$($info.enable_sso_api) has_key=$($info.has_key)"
$enableResp = Invoke-RestMethod -Uri "$base/sso/campuses/$cid/enable-sso-api" -Method PATCH -Headers $h -ContentType 'application/json' -Body (@{enabled=$true}|ConvertTo-Json)
Write-Host "ENABLE: enable=$($enableResp.enable_sso_api) has_key=$($enableResp.has_key) api_key_present=$([bool]$enableResp.api_key)"
$apikey = $enableResp.api_key
if (-not $apikey) { $rev = Invoke-RestMethod -Uri "$base/sso/campuses/$cid/api-key/reveal" -Method POST -Headers $h; $apikey = $rev.api_key }
Write-Host "API_KEY_PREFIX: $($apikey.Substring(0,12))..."
$body = @{apikey=$apikey;matricula='SMK-MOD-1';nombre='Test';apellido='Modulo'}|ConvertTo-Json
try { $r = Invoke-WebRequest -Uri "$base/sso/generar_token" -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 30; Write-Host "ENABLED-CALL: $([int]$r.StatusCode) $($r.Content.Substring(0,[Math]::Min(180,$r.Content.Length)))" } catch { $e=$_.Exception.Response; $sr=New-Object IO.StreamReader($e.GetResponseStream()); Write-Host "ENABLED-CALL: $([int]$e.StatusCode) $($sr.ReadToEnd())" }
$disableResp = Invoke-RestMethod -Uri "$base/sso/campuses/$cid/enable-sso-api" -Method PATCH -Headers $h -ContentType 'application/json' -Body (@{enabled=$false}|ConvertTo-Json)
Write-Host "DISABLE: enable=$($disableResp.enable_sso_api) has_key=$($disableResp.has_key)"
try { $r = Invoke-WebRequest -Uri "$base/sso/generar_token" -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 30; Write-Host "DISABLED-CALL: $([int]$r.StatusCode) $($r.Content)" } catch { $e=$_.Exception.Response; $sr=New-Object IO.StreamReader($e.GetResponseStream()); Write-Host "DISABLED-CALL: $([int]$e.StatusCode) $($sr.ReadToEnd())" }
$reEnable = Invoke-RestMethod -Uri "$base/sso/campuses/$cid/enable-sso-api" -Method PATCH -Headers $h -ContentType 'application/json' -Body (@{enabled=$true}|ConvertTo-Json)
Write-Host "RE-ENABLE: enable=$($reEnable.enable_sso_api) api_key_present=$([bool]$reEnable.api_key) (should be False)"

