$ErrorActionPreference = "Continue"
$bot = "C:\Users\User\OneDrive\Desktop\Bot Tradingview"
Set-Location $bot
Write-Output "step1 download patch"
curl.exe -s https://quantvisionx.com/botpatch.py -o botpatch.py
Write-Output "step2 apply patch"
python botpatch.py
Write-Output "step3 check syntax"
python -m py_compile tlapi.py
if ($LASTEXITCODE -ne 0) { Write-Output "SYNTAX_FAIL restore tlapi.py.bak2"; return }
Write-Output "step4 restart bridge"
$c = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if ($c) { Stop-Process -Id ($c.OwningProcess | Select-Object -First 1) -Force; Write-Output "killed 8787" }
schtasks /end /tn TradePulseTVBridge 2>$null | Out-Null
Start-Sleep 2
schtasks /run /tn TradePulseTVBridge | Out-Null
Write-Output "DONE patch and restart complete"
