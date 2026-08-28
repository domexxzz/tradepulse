# botkeeper - ดูแลบอท TradingView บนคอมเฟิร์สให้ทำงานตลอด
#
# ทำ 3 อย่างวนลูป:
#   1. บริดจ์ (python tv_bridge.py) ตาย -> เปิดใหม่
#   2. cloudflared ตาย -> เปิดใหม่ (quick tunnel ได้ URL สุ่มใหม่ทุกครั้ง)
#   3. URL เปลี่ยน -> อัป TV_BOT_URL บน Vercel + redeploy ให้อัตโนมัติ
#
# ข้อ 3 คือหัวใจ: quick tunnel ของ Cloudflare ไม่มี URL คงที่ ถ้าไม่อัปเดตเอง
# เว็บจะเรียกบอทไม่เจอหลังรีบูตทุกครั้ง

$ErrorActionPreference = "Continue"
$dir       = "C:\BotTV"
$cfLog     = "$dir\cf.log"
$stateFile = "$dir\last_url.txt"
$log       = "$dir\keeper.log"
$token     = (Get-Content "$dir\vercel_token.txt" -Raw).Trim()
$proj      = "prj_Ei4cxqF4VNBrA7wu61N4XPghFfah"
$team      = "team_hQP3M2RvqWdYY8W8652RbJUe"
$envId     = "5xOgw7IAORW9Ov29"   # TV_BOT_URL (production)

function Note($m) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m" | Out-File $log -Append -Encoding utf8
}

function Ensure-Bridge {
  if (Get-NetTCPConnection -LocalPort 8787 -State Listen -EA SilentlyContinue) { return }
  Note "bridge down -> starting"
  # เก็บทั้งสองสาย: print() ของบอทไป stdout ส่วน logging ของ aiohttp ไป stderr
  # ถ้าเก็บแค่ stderr จะไม่เห็นบรรทัด tv expiry / EXPIRY_OK ซึ่งเป็นตัวบอกผลจริง
  Start-Process "python" -ArgumentList "-u", "tv_bridge.py" `
    -WorkingDirectory $dir -WindowStyle Hidden `
    -RedirectStandardError "$dir\bot.log" -RedirectStandardOutput "$dir\bot_out.log"
  Start-Sleep 12
}

function Ensure-Tunnel {
  if (Get-Process cloudflared -EA SilentlyContinue) { return }
  Note "cloudflared down -> starting"
  Remove-Item $cfLog -Force -EA SilentlyContinue
  Start-Process "$dir\cloudflared.exe" `
    -ArgumentList "tunnel", "--url", "http://127.0.0.1:8787" `
    -RedirectStandardError $cfLog -WindowStyle Hidden
  Start-Sleep 18
}

function Get-TunnelUrl {
  if (-not (Test-Path $cfLog)) { return $null }
  $m = Select-String -Path $cfLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -EA SilentlyContinue |
       Select-Object -Last 1
  if (-not $m) { return $null }
  return $m.Matches[0].Value
}

function Update-Vercel($url) {
  $h = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
  # แก้ค่า env เดิมในที่เดิม (ไม่ลบ-สร้างใหม่ จะได้ id ไม่เปลี่ยน)
  $body = @{ value = $url } | ConvertTo-Json
  try {
    Invoke-RestMethod -Method Patch -Headers $h `
      -Uri "https://api.vercel.com/v9/projects/$proj/env/$envId`?teamId=$team" `
      -Body $body -EA Stop | Out-Null
    Note "vercel env updated -> $url"
  } catch {
    Note ("vercel env FAILED: " + $_.Exception.Message)
    return $false
  }
  # env ใหม่มีผลต่อเมื่อ deploy ใหม่ - สั่ง redeploy จาก production ล่าสุด
  try {
    $latest = Invoke-RestMethod -Headers $h -EA Stop `
      -Uri "https://api.vercel.com/v6/deployments?projectId=$proj&teamId=$team&target=production&limit=1"
    $src = $latest.deployments[0]
    $dep = @{ name = "tradepulse"; deploymentId = $src.uid; target = "production" } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Headers $h `
      -Uri "https://api.vercel.com/v13/deployments?teamId=$team&forceNew=1" -Body $dep -EA Stop | Out-Null
    Note "redeploy triggered"
    return $true
  } catch {
    Note ("redeploy FAILED: " + $_.Exception.Message)
    return $false
  }
}

Note "botkeeper started"
while ($true) {
  try {
    Ensure-Bridge
    Ensure-Tunnel

    $url = Get-TunnelUrl
    if ($url) {
      $last = if (Test-Path $stateFile) { (Get-Content $stateFile -Raw).Trim() } else { "" }
      if ($url -ne $last) {
        Note "tunnel url changed: $last -> $url"
        if (Update-Vercel $url) { $url | Out-File $stateFile -Encoding ascii -NoNewline }
      }
    }
  } catch {
    Note ("loop error: " + $_.Exception.Message)
  }
  Start-Sleep 60
}
