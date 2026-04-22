<#
.SYNOPSIS
    Hex-edit VB6 EXEs to replace legacy domain strings with new Azure proxy domains.
    All replacements are SAME LENGTH (critical for VB6 binary patching).

.DESCRIPTION
    Replaces domain references in compiled VB6 EXE files:
      srvcsvls7-1.azurewebsites.net  →  evaluasoap1.azurewebsites.net  (29 chars)
      srvcsvls5-1.evaluaasi.com      →  evalua-soap.evaluaasi.com      (25 chars)
      xmnvls5-1.evaluaasi.com        →  evasoap-1.evaluaasi.com        (23 chars)
      dmntls.evaluaasi.com           →  evsoa1.evaluaasi.com           (20 chars)
      servicelicevaluaasi.azurewebsites.net → evaborrelicencias01.azurewebsites.net (37 chars)

.PARAMETER ExeFolder
    Path to folder containing the EXE files to patch.

.PARAMETER OutputFolder
    Path to folder for patched EXE files. Defaults to ExeFolder\patched.

.PARAMETER DryRun
    If set, only reports what would be changed without modifying files.

.EXAMPLE
    .\hex-edit-exes.ps1 -ExeFolder "C:\EXEs" -DryRun
    .\hex-edit-exes.ps1 -ExeFolder "C:\EXEs" -OutputFolder "C:\EXEs\patched"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ExeFolder,

    [string]$OutputFolder,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ── Domain replacement pairs (old → new), all verified same-length ──
$replacements = @(
    @{ Old = "srvcsvls7-1.azurewebsites.net";            New = "evaluasoap1.azurewebsites.net" },
    @{ Old = "srvcsvls5-1.evaluaasi.com";                New = "evalua-soap.evaluaasi.com" },
    @{ Old = "xmnvls5-1.evaluaasi.com";                  New = "evasoap-1.evaluaasi.com" },
    @{ Old = "dmntls.evaluaasi.com";                     New = "evsoa1.evaluaasi.com" },
    @{ Old = "servicelicevaluaasi.azurewebsites.net";    New = "evaborrelicencias01.azurewebsites.net" }
)

# Validate lengths match
foreach ($r in $replacements) {
    if ($r.Old.Length -ne $r.New.Length) {
        Write-Error "LENGTH MISMATCH: '$($r.Old)' ($($r.Old.Length)) vs '$($r.New)' ($($r.New.Length))"
        exit 1
    }
}

# Setup output folder
if (-not $OutputFolder) {
    $OutputFolder = Join-Path $ExeFolder "patched"
}
if (-not $DryRun -and -not (Test-Path $OutputFolder)) {
    New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
}

# Get EXE files
$exeFiles = Get-ChildItem -Path $ExeFolder -Filter "*.exe" -File
if ($exeFiles.Count -eq 0) {
    Write-Warning "No .exe files found in $ExeFolder"
    exit 0
}

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  VB6 EXE Domain Hex-Edit Tool" -ForegroundColor Cyan
Write-Host "  Found $($exeFiles.Count) EXE file(s)" -ForegroundColor Cyan
if ($DryRun) { Write-Host "  MODE: DRY RUN (no files modified)" -ForegroundColor Yellow }
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# VB6 stores strings as Unicode (UTF-16LE)
# We need to search for both ASCII and Unicode encoded versions

function Find-And-Replace {
    param(
        [byte[]]$FileBytes,
        [string]$OldStr,
        [string]$NewStr,
        [string]$Encoding  # "ASCII" or "Unicode"
    )

    if ($Encoding -eq "ASCII") {
        $oldBytes = [System.Text.Encoding]::ASCII.GetBytes($OldStr)
        $newBytes = [System.Text.Encoding]::ASCII.GetBytes($NewStr)
    } else {
        $oldBytes = [System.Text.Encoding]::Unicode.GetBytes($OldStr)
        $newBytes = [System.Text.Encoding]::Unicode.GetBytes($NewStr)
    }

    $count = 0
    $searchLen = $oldBytes.Length

    for ($i = 0; $i -le ($FileBytes.Length - $searchLen); $i++) {
        $match = $true
        for ($j = 0; $j -lt $searchLen; $j++) {
            if ($FileBytes[$i + $j] -ne $oldBytes[$j]) {
                $match = $false
                break
            }
        }
        if ($match) {
            $count++
            if (-not $DryRun) {
                for ($j = 0; $j -lt $searchLen; $j++) {
                    $FileBytes[$i + $j] = $newBytes[$j]
                }
            }
            # Skip past this match
            $i += $searchLen - 1
        }
    }

    return $count
}

$totalPatched = 0

foreach ($exe in $exeFiles) {
    Write-Host "Processing: $($exe.Name)" -ForegroundColor White
    Write-Host ("─" * 50)

    $bytes = [System.IO.File]::ReadAllBytes($exe.FullName)
    $fileModified = $false

    foreach ($r in $replacements) {
        # Search ASCII encoding
        $asciiCount = Find-And-Replace -FileBytes $bytes -OldStr $r.Old -NewStr $r.New -Encoding "ASCII"
        # Search Unicode (UTF-16LE) encoding
        $unicodeCount = Find-And-Replace -FileBytes $bytes -OldStr $r.Old -NewStr $r.New -Encoding "Unicode"

        $total = $asciiCount + $unicodeCount
        if ($total -gt 0) {
            $fileModified = $true
            $color = "Green"
            $label = if ($DryRun) { "FOUND" } else { "PATCHED" }
            Write-Host "  [$label] $($r.Old) → $($r.New)" -ForegroundColor $color
            Write-Host "          ASCII: $asciiCount, Unicode: $unicodeCount" -ForegroundColor DarkGray
        } else {
            Write-Host "  [SKIP]  $($r.Old) (not found)" -ForegroundColor DarkGray
        }
    }

    if ($fileModified -and -not $DryRun) {
        $outPath = Join-Path $OutputFolder $exe.Name
        [System.IO.File]::WriteAllBytes($outPath, $bytes)
        Write-Host "  → Saved: $outPath" -ForegroundColor Green
        $totalPatched++
    } elseif ($fileModified -and $DryRun) {
        Write-Host "  → Would be patched (dry run)" -ForegroundColor Yellow
        $totalPatched++
    } else {
        Write-Host "  → No matches found, skipping" -ForegroundColor DarkYellow
    }

    Write-Host ""
}

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Done. $totalPatched of $($exeFiles.Count) file(s) would be/were patched." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan

if (-not $DryRun -and $totalPatched -gt 0) {
    Write-Host ""
    Write-Host "  Patched files saved to: $OutputFolder" -ForegroundColor Green
    Write-Host "  IMPORTANT: Test patched EXEs before deploying!" -ForegroundColor Yellow
}
