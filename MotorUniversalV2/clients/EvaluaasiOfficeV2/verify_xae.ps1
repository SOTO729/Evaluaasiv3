$ErrorActionPreference = "Stop"
$bin = "C:\Users\Diego\Desktop\Evaluaasiv3\MotorUniversalV2\clients\EvaluaasiOfficeV2\src\bin\Release"
[Reflection.Assembly]::LoadFrom("$bin\EvaluaasiOfficeV2.exe") | Out-Null

$cipher = [System.IO.File]::ReadAllText("C:\Users\Diego\Desktop\Evaluaasiv3\MotorUniversalV2\clients\EvaluaasiOfficeV2\test_210.xae", [System.Text.Encoding]::UTF8)
$dec = New-Object CulturaDigital.Models.Encripcion(13, $cipher)
$xml = $dec.TextoNormal2
$bytes = [System.Text.Encoding]::UTF8.GetBytes($xml)
$stream = New-Object System.IO.MemoryStream(,$bytes)
$ser = New-Object System.Xml.Serialization.XmlSerializer([CulturaDigital.Models.Evaluacion], "Evaluacion")
$ev = $ser.Deserialize($stream)
Write-Host ("OK id=" + $ev.EvaluacionId + " name=" + $ev.Nombre + " preguntas=" + $ev.Preguntas.Count)
