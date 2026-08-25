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

---

# เชิญเข้ากลุ่มอัตโนมัติ (เฉพาะสมาชิกที่จ่ายเงินจริง)

## ปัญหาของลิงก์กลุ่มแบบเดิม

`TELEGRAM_INVITE_URL` คือลิงก์เดียวที่ส่งให้ทุกคน — สมาชิกส่งต่อให้เพื่อนได้ไม่จำกัด
คนที่ไม่ได้จ่ายเงินก็เข้ากลุ่มได้ และเราไม่รู้ว่าใครในกลุ่มคือสมาชิกคนไหน
พอหมดอายุจึงเตะออกไม่ได้ ต้องไล่เช็คเอง

## วิธีใหม่

สมาชิกที่จ่ายเงินแล้วจะได้ **ลิงก์เชิญของตัวเอง** ในหน้าบัญชี — ลิงก์ตั้งให้ต้องขออนุมัติก่อนเข้า
พอกดเข้ากลุ่ม Telegram จะยิงคำขอมาที่ `/api/telegram/webhook` พร้อมบอกว่าใช้ลิงก์ใบไหน
ระบบจึงเช็คได้ก่อนอนุมัติว่า:

- เจ้าของลิงก์ยังมีแพ็กเกจใช้งานอยู่จริงไหม
- ลิงก์ใบนี้ถูกใช้ไปแล้วหรือยัง (ส่งต่อให้คนอื่น = ปฏิเสธ)
- บัญชี Telegram นี้ถูกผูกกับสมาชิกรายอื่นอยู่แล้วหรือเปล่า

อนุมัติแล้วระบบจะเก็บ Telegram user id ไว้ **ซึ่งทำให้นำออกอัตโนมัติตอนหมดอายุได้**
(cron รายวันจะ ban แล้ว unban ทันที = เตะออกแต่ยังกลับมาเข้าใหม่ได้เมื่อต่ออายุ)

ทุกกรณีที่ปฏิเสธจะเด้งแจ้งเตือนเข้า Telegram แอดมิน

## ตั้งค่า

1. บอทต้องเป็น **แอดมินของกลุ่ม** และมีสิทธิ์ **Invite users via link** กับ **Ban users**
2. ตั้ง env:
   ```
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_CHAT_ID=-100xxxxxxxxxx
   TELEGRAM_WEBHOOK_SECRET=<สุ่มยาว ๆ>
   NEXT_PUBLIC_SITE_URL=https://โดเมนจริง
   ```
3. ลงทะเบียน webhook:
   ```bash
   node scripts/telegram-webhook.mjs set
   node scripts/telegram-webhook.mjs info    # ตรวจว่าตั้งสำเร็จ
   ```

> ⚠️ **บอทหนึ่งตัวมี webhook ได้ทางเดียว และใช้พร้อม polling ไม่ได้**
> ถ้าโทเคนนี้ถูกใช้กับบอท Python ที่รัน `run_polling()` อยู่ ให้แยกโทเคนคนละตัว
> ไม่งั้นสองระบบจะแย่ง update กันเอง

## ตรวจว่าทำงานไหม

| อาการ | สาเหตุที่พบบ่อย |
|---|---|
| หน้าบัญชีไม่มีปุ่มเข้ากลุ่ม | ยังไม่ได้ตั้ง `TELEGRAM_CHAT_ID` หรือบอทสร้างลิงก์ไม่ได้ (ไม่ได้เป็นแอดมินกลุ่ม) |
| กดแล้วค้างที่ "รออนุมัติ" | ยังไม่ได้ตั้ง webhook — รัน `node scripts/telegram-webhook.mjs info` ดู |
| ถูกปฏิเสธทั้งที่จ่ายเงินแล้ว | แพ็กเกจหมดอายุ หรือบัญชี Telegram นี้ผูกกับสมาชิกคนอื่นอยู่ (ดูเหตุผลในแจ้งเตือนแอดมิน) |
| หมดอายุแล้วไม่ถูกนำออก | ระบบไม่รู้ Telegram user id (สมาชิกเข้ากลุ่มด้วยลิงก์เก่า) — รายการจะขึ้นคิว "รอนำออก" ให้ทำมือ |

## ถ้ายังไม่เปิดระบบนี้

ทุกอย่างทำงานแบบเดิม: สมาชิกเห็นลิงก์จาก `TELEGRAM_INVITE_URL`
และคิวใน `/admin/telegram` ให้แอดมินเพิ่ม/นำออกเอง
