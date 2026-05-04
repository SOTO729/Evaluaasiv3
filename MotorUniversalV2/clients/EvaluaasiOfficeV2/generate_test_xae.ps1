$ErrorActionPreference = "Stop"
$bin = "C:\Users\Diego\Desktop\Evaluaasiv3\MotorUniversalV2\clients\EvaluaasiOfficeV2\src\bin\Release"
[Reflection.Assembly]::LoadFrom("$bin\EvaluaasiOfficeV2.exe") | Out-Null

# Construir Evaluacion mínima
$ev = New-Object CulturaDigital.Models.Evaluacion
$ev.EvaluacionId = 210
$ev.Nombre = "ECM00EX - Microsoft Excel Prueba 365"
$ev.NoPreguntas = 2
$ev.Minutos = 60
$ev.Version = "ECM00EX"
$ev.VersionApp = "2.0.0"
$ev.VersionSimulador = "2.0.0"

$preguntas = New-Object 'System.Collections.Generic.List[CulturaDigital.Models.Pregunta]'
1..2 | ForEach-Object {
    $p = New-Object CulturaDigital.Models.Pregunta
    $p.PreguntaId = $_
    $p.NoPregunta = $_
    $p.Texto = "Pregunta de prueba $_"
    $p.Mostrar = [CulturaDigital.Models.eMostrar]::Examen
    $p.TipoPregunta = 1
    $p.StatusPregunta = 1
    $p.Correcta = "A"
    $p.CategoriaId = 1
    $p.TemaId = 1
    $preguntas.Add($p)
}
$ev.Preguntas = $preguntas

# Serializar a XML (forzar UTF-8 para que el cliente pueda leer con Encoding.UTF8)
$ser = New-Object System.Xml.Serialization.XmlSerializer($ev.GetType(), "Evaluacion")
$ms = New-Object System.IO.MemoryStream
$settings = New-Object System.Xml.XmlWriterSettings
$settings.Encoding = [System.Text.UTF8Encoding]::new($false)
$settings.Indent = $true
$xw = [System.Xml.XmlWriter]::Create($ms, $settings)
$ser.Serialize($xw, $ev)
$xw.Flush()
$xml = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
Write-Host "Generated XML ($($xml.Length) chars):" -ForegroundColor Cyan
Write-Host $xml.Substring(0, [Math]::Min(400, $xml.Length))

# Encriptar con Encripcion(string, Meses) — Meses.Valor = 13
$mes = New-Object CulturaDigital.Models.Meses
$mes.Valor = 13
$enc = New-Object CulturaDigital.Models.Encripcion($xml, $mes)
# El archivo .xae en disco es el TextoInvertido (ReverseString del encriptado).
# Encripcion(13, file) hace file.ReverseString().Desencripta == xml
$cipher = $enc.TextoInvertido
Write-Host "`nEncrypted ($($cipher.Length) chars):" -ForegroundColor Yellow
Write-Host $cipher.Substring(0, [Math]::Min(200, $cipher.Length))

# Verificar round-trip
$dec = New-Object CulturaDigital.Models.Encripcion(13, $cipher)
$xmlBack = $dec.TextoNormal2
if ($xmlBack -eq $xml) { Write-Host "Round-trip OK" -ForegroundColor Green }
else {
    Write-Host "Round-trip MISMATCH" -ForegroundColor Red
    Write-Host "Original:" $xml.Substring(0, 200)
    Write-Host "Decoded:"  $xmlBack.Substring(0, 200)
}

# Guardar
$out = "C:\Users\Diego\Desktop\Evaluaasiv3\MotorUniversalV2\clients\EvaluaasiOfficeV2\test_210.xae"
[System.IO.File]::WriteAllText($out, $cipher, [System.Text.Encoding]::UTF8)
Write-Host "Saved to $out" -ForegroundColor Magenta
