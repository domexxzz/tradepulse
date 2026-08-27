# Runs on combase (ASUS). Downloads botpatch2.py, applies it to tlapi.py,
# verifies the file still compiles, restores the backup if it does not,
# then restarts the TradingView bridge so the new code is loaded.
# ASCII only - Windows PowerShell 5.1 misreads UTF-8 without BOM.
$ErrorActionPreference = "Continue"
$bot = "C:\Users\User\OneDrive\Desktop\Bot Tradingview"
Set-Location $bot

Write-Output "step1 download patch"
curl.exe -s https://quantvisionx.com/botpatch2.py -o botpatch2.py

Write-Output "step2 apply patch"
python botpatch2.py "$bot\tlapi.py"

Write-Output "step3 check syntax"
python -m py_compile tlapi.py
if ($LASTEXITCODE -ne 0) {
  Write-Output "SYNTAX_FAIL restoring tlapi.py.bak_v3"
  if (Test-Path "tlapi.py.bak_v3") { Copy-Item "tlapi.py.bak_v3" "tlapi.py" -Force; Write-Output "restored" }
  return
}
$s = [IO.File]::ReadAllText("$bot\tlapi.py", [Text.Encoding]::UTF8)
Write-Output ("verify has_V3=" + $s.Contains("ROBUST_DATE_V3"))

Write-Output "step4 restart bridge"
$c = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if ($c) { Stop-Process -Id ($c.OwningProcess | Select-Object -First 1) -Force; Write-Output "killed 8787" }
schtasks /end /tn TradePulseTVBridge 2>$null | Out-Null
Start-Sleep 2
schtasks /run /tn TradePulseTVBridge | Out-Null

Write-Output "DONE patch v2 applied and bridge restarted"
