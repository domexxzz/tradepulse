@echo off
rem QVX AI gateway บนคอมเบส - task QVXAIGateway เรียกผ่าน run-hidden.vbs (ไม่มีหน้าต่างโผล่)
rem ใช้ python path เต็ม: scheduled task ไม่เห็น PATH ของผู้ใช้ (กับดักเดียวกับบริดจ์ ดู docs/TRADINGVIEW.md)
cd /d C:\QVXAI
"C:\Users\User\AppData\Local\Programs\Python\Python313\python.exe" -u qvx_ai_gateway.py --port 8790 --secret-env "C:\Users\User\OneDrive\Desktop\Bot Tradingview\.env" >> C:\QVXAI\gateway.log 2>&1
