$ErrorActionPreference = "Continue"
$bot = "C:\Users\User\OneDrive\Desktop\Bot Tradingview"
Set-Location $bot
Write-Output "== ดาวน์โหลด patch =="
curl.exe -s https://quantvisionx.com/botpatch.py -o botpatch.py
Write-Output "== แก้ tlapi.py =="
python botpatch.py
Write-Output "== ตรวจ syntax =="
python -m py_compile tlapi.py
if ($LASTEXITCODE -ne 0) { Write-Output "SYNTAX_FAIL - กู้คืนด้วย tlapi.py.bak2"; return }
Write-Output "== restart bridge =="
$c = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if ($c) { Stop-Process -Id ($c.OwningProcess | Select-Object -First 1) -Force; Write-Output "killed 8787" }
schtasks /end /tn TradePulseTVBridge 2>$null | Out-Null
Start-Sleep 2
schtasks /run /tn TradePulseTVBridge | Out-Null
Write-Output "DONE - patch + restart เสร็จ"
