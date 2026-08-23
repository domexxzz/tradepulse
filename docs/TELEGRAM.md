# ส่งสัญญาณเข้ากลุ่ม Telegram (แยก topic ตาม timeframe)

กลุ่ม Testtool เป็น forum group มี topic: M5 / M15 / M30 / 1H
บอทจะส่งสัญญาณเข้า topic ที่ถูกต้องอัตโนมัติตาม timeframe

## 1) เตรียมบอท + กลุ่ม
1. **revoke token เดิม** (ที่หลุดในแชท) ที่ @BotFather → /revoke → เอา token ใหม่
2. เพิ่มบอท `@Pyro_bolt_bot` เข้ากลุ่ม Testtool แล้ว **ตั้งเป็นแอดมิน**
   (หรือปิด privacy: @BotFather → /setprivacy → เลือกบอท → Disable)

## 2) หา chat_id + topic ids
1. ใส่ token ใหม่ใน `.env`: `TELEGRAM_BOT_TOKEN="123:ABC..."`
2. พิมพ์ข้อความอะไรก็ได้ใน **แต่ละ topic** (M5, M15, M30, 1H) อย่างละครั้ง
3. รัน:
   ```bash
   node scripts/telegram-ids.mjs
   ```
4. เอาค่าที่ได้ไปวางใน `.env`:
   ```
   TELEGRAM_CHAT_ID="-100xxxxxxxxxx"
   TELEGRAM_TOPIC_M5="2"
   TELEGRAM_TOPIC_M15="4"
   TELEGRAM_TOPIC_M30="6"
   TELEGRAM_TOPIC_1H="8"
   TELEGRAM_SIGNAL_SECRET="ตั้งรหัสลับอะไรก็ได้ยาว ๆ"
   ```
   (thread id ของแต่ละ topic ดูจาก output แล้วจับคู่ตามชื่อ)

## 3) ส่งสัญญาณ
`POST /api/signals` (ต้องมี secret)

แบบมี field (ระบบจัดรูปข้อความให้):
```bash
curl -X POST http://localhost:3000/api/signals \
  -H "content-type: application/json" \
  -d '{"secret":"<TELEGRAM_SIGNAL_SECRET>","timeframe":"M15","side":"BUY","symbol":"XAUUSD","entry":"4300","tp":"4320","sl":"4290","note":"ตามเทรนด์ HTF"}'
```

แบบส่งข้อความเอง:
```bash
curl -X POST http://localhost:3000/api/signals \
  -H "content-type: application/json" \
  -d '{"secret":"<SECRET>","timeframe":"M5","text":"🟢 BUY XAUUSD M5 ..."}'
```

ผลลัพธ์: ข้อความจะไปโผล่ใน topic ตรงกับ timeframe

## 4) ต่อกับ TradingView Alert
ในหน้าตั้ง Alert ของ TradingView → Notifications → Webhook URL:
`https://โดเมนจริง/api/signals`
ช่อง Message ใส่ JSON (TradingView ตั้ง header ไม่ได้ จึงใส่ secret ใน body):
```json
{"secret":"<SECRET>","timeframe":"M15","side":"BUY","symbol":"XAUUSD","entry":"{{close}}"}
```

## หมายเหตุความปลอดภัย
- `TELEGRAM_BOT_TOKEN` และ `TELEGRAM_SIGNAL_SECRET` เป็นความลับ อยู่ใน `.env` (ไม่ขึ้น repo)
- `chat_id` / `thread_id` ไม่ใช่ความลับ
