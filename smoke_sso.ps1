$base = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
$login = Invoke-RestMethod "$base/auth/login" -Method POST -ContentType "application/json" -Body (@{ username="admin"; password="admin123" } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.access_token)" }
$pid_partner = 181
$campResp = Invoke-RestMethod "$base/partners/$pid_partner/campuses" -Headers $h
$cid = $campResp.campuses[0].id
Write-Host "CAMPUS=$cid name=$($campResp.campuses[0].name)"
Write-Host "--- INFO BEFORE ---"
(Invoke-RestMethod "$base/sso/campuses/$cid/api-key" -Headers $h | ConvertTo-Json -Compress)
Write-Host "--- GENERATE ---"
$gen = Invoke-RestMethod "$base/sso/campuses/$cid/api-key" -Method POST -Headers $h
$apikey = $gen.api_key
Write-Host "key prefix: $($apikey.Substring(0,16))..."
Write-Host "--- GENERAR_TOKEN 1 ---"
$bodyStr = "apikey=$apikey&matricula=SSO-TEST-001&nombre=Juan&primer_apellido=Perez&segundo_apellido=Lopez&email=juansso%40test.local"
(Invoke-RestMethod "$base/sso/generar_token" -Method POST -ContentType 'application/x-www-form-urlencoded' -Body $bodyStr | ConvertTo-Json -Compress)
Write-Host "--- GENERAR_TOKEN 2 (reuse) ---"
(Invoke-RestMethod "$base/sso/generar_token" -Method POST -ContentType 'application/x-www-form-urlencoded' -Body $bodyStr | ConvertTo-Json -Compress)
Write-Host "--- REVEAL ---"
$reveal = Invoke-RestMethod "$base/sso/campuses/$cid/api-key/reveal" -Method POST -Headers $h
Write-Host "reveal_match=$($reveal.api_key -eq $apikey)"
Write-Host "--- SHARE ON ---"
(Invoke-RestMethod "$base/sso/campuses/$cid/share-api-key" -Method PATCH -Headers $h -ContentType "application/json" -Body (@{share=$true}|ConvertTo-Json) | ConvertTo-Json -Compress)
Write-Host "--- REVOKE ---"
(Invoke-RestMethod "$base/sso/campuses/$cid/api-key" -Method DELETE -Headers $h | ConvertTo-Json -Compress)
Write-Host "--- INFO AFTER ---"
(Invoke-RestMethod "$base/sso/campuses/$cid/api-key" -Headers $h | ConvertTo-Json -Compress)
