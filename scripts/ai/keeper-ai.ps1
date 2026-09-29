# คอมเบส = เครื่อง AI ของ QVX (RTX 4080 + Ollama gemma3)
# ใช้ botkeeper ตัวเดียวกับบอท: ดูแล gateway (พอร์ต 8790) + quick tunnel + รายงาน URL เข้าเว็บเป็น role "ai"
# -EnvKey ตั้งเป็นชื่อที่ไม่มีบน Vercel โดยเจตนา — ต่อให้มีคนวาง vercel_token.txt ไว้ในโฟลเดอร์นี้
#   keeper ก็จะไม่ไปแก้ TV_BOT_URL ของบอททับ
& "C:\QVXAI\botkeeper.ps1" -Dir C:\QVXAI -Port 8790 -Role ai -EnvKey QVX_AI_NOT_A_VERCEL_ENV `
  -Cloudflared "C:\Program Files (x86)\cloudflared\cloudflared.exe" -BridgeTask QVXAIGateway `
  -BotEnv "C:\Users\User\OneDrive\Desktop\Bot Tradingview\.env"
