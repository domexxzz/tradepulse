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

## 4) ต่อกับ TradingView Alert (วิธีที่ถูกต้อง)

ในหน้าตั้ง Alert ของอินดิเคเตอร์:

1. **Condition** = ชื่ออินดิเคเตอร์ → เลือก **"alert() function calls only"**
2. เปิดสวิตช์ **"ส่ง JSON ดิบไป webhook ระบบอื่น"** (`alJsonRaw`) ใน settings กลุ่ม Alert
   และใส่ **Webhook Secret** ให้ตรงกับ `TELEGRAM_SIGNAL_SECRET` ของเว็บ
3. **Notifications → Webhook URL** ใส่:
   ```
   https://โดเมนจริง/api/signals
   ```
4. ตารางการแจ้งเตือน = 24/7 · การหมดอายุ = ไม่หมดอายุ

อินดิเคเตอร์จะส่ง JSON หน้าตาแบบนี้มาเอง:

```json
{"secret":"...","symbol":"XAUUSD","side":"BUY","price":4300,"tf":"15","sl":4285,"tp1":4340,"tp2":4380}
```

API รับให้แล้วทั้งชื่อฟิลด์แบบนี้ (`tf`/`price`/`tp1`/`tp2`) และแบบของเราเอง
(`timeframe`/`entry`/`tp`) รวมถึงแปลง `tf` ที่เป็นตัวเลขนาที ("5","15","30","60")
เป็น M5/M15/M30/1H ให้อัตโนมัติ — **ไม่ต้องแก้ Pine**

### ⚠️ อย่าใส่ Webhook URL เป็น api.telegram.org โดยตรง

การตั้ง Webhook URL เป็น `https://api.telegram.org/bot<TOKEN>/sendMessage`
แปลว่า **โทเคนบอทถูกเก็บไว้ในหน้าตั้งค่า Alert ของ TradingView เป็นข้อความธรรมดา**
ใครเห็นหน้าจอหรือเข้าถึงบัญชี TradingView ได้ ก็คุมบอทได้ทันที —
โพสต์สัญญาณปลอมเข้าห้องลูกค้าที่จ่ายเงินได้เลย

ยิงผ่าน `/api/signals` แทน ได้เพิ่มอีกสามอย่าง:

- โทเคนบอทอยู่ฝั่งเซิร์ฟเวอร์อย่างเดียว TradingView เห็นแค่ secret ที่เพิกถอนได้
- สัญญาณถูกบันทึกลงฐานข้อมูล → ขึ้น Live Feed บนหน้าเว็บด้วย
- เปลี่ยนกลุ่ม/ห้องปลายทางได้จาก env ไม่ต้องไปแก้ Alert ทีละ 12 ตัว

## หมายเหตุความปลอดภัย
### ลบสัญญาณ

```bash
# ลบทีละรายการ — ใช้ TELEGRAM_SIGNAL_SECRET ได้
curl -X DELETE "https://โดเมนจริง/api/signals?id=<id>" -H "x-signal-secret: <TELEGRAM_SIGNAL_SECRET>"

# ล้างทั้งตาราง — ต้องใช้ CRON_SECRET และระบุ all=true
curl -X DELETE "https://โดเมนจริง/api/signals?all=true" -H "x-signal-secret: <CRON_SECRET>"
```

ที่ล้างทั้งตารางต้องใช้คนละ secret เพราะ `TELEGRAM_SIGNAL_SECRET` ถูกวางไว้ในหน้าตั้ง
Alert บน TradingView ใครเห็นหน้านั้นก็ได้ค่านี้ไป — สิทธิ์ "ส่งสัญญาณ" จึงไม่ควรเท่ากับ
สิทธิ์ "ลบประวัติทิ้งทั้งหมด" ส่วน `CRON_SECRET` อยู่แค่บน Vercel กับ GitHub Actions

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

---

# ส่ง DM หาสมาชิกรายคน (31 ส.ค. 2569)

ใช้ส่งภาพหลักฐานสิทธิ์ TradingView, เตือนใกล้หมดอายุ, ชวนต่ออายุ

## กติกาข้อเดียวที่ต้องรู้

**Telegram ห้ามบอททักคนก่อนเด็ดขาด** สมาชิกต้องเปิดแชทกับบอทเองอย่างน้อยครั้งเดียว
ไม่งั้น `sendPhoto` / `sendMessage` ตอบ `403: bot can't initiate conversation with a user`

ข้อยกเว้นเดียวคือช่วง **5 นาที** หลังสมาชิกส่งคำขอเข้ากลุ่ม แต่ webhook ของเรา
`approveJoinRequest` ทันทีซึ่งปิดหน้าต่างนั้นไปเลย และภาพหลักฐานจากบอท TradingView
มาถึงช้ากว่านั้น (Selenium ใช้ 60-120 วินาที) จึงพึ่งหน้าต่างนี้ไม่ได้

## ทางแก้ — deep link `?start=`

`/api/telegram/webhook` รับ `/start <รหัสคิว Telegram>` จากแชทส่วนตัวแล้ว
พอสมาชิกกด Start บอทได้สิทธิ์ DM **ถาวร** และระบบผูก `telegramUserId`
กับบัญชีสมาชิกให้เอง แล้วตอบลิงก์เข้ากลุ่มกลับไป

ลิงก์ที่ต้องส่งให้สมาชิก:

```
https://t.me/<ชื่อบอท>?start=<TelegramGrant.id>
```

หน้า `/account` แถว "กลุ่มสัญญาณ Telegram" ชี้มาที่ลิงก์นี้ให้แล้ว
โดยอ่านชื่อบอทจาก **`TELEGRAM_BOT_USERNAME`** (ไม่ต้องใส่ `@`)

| สถานะสมาชิก | ปุ่มที่เห็น | ไปไหน |
|---|---|---|
| ยังไม่เข้ากลุ่ม | เริ่มใช้งาน | ทักบอท → บอทตอบลิงก์เข้ากลุ่มให้ |
| อยู่ในกลุ่มแล้ว | เชื่อมต่อบอท | ทักบอท เพื่อเปิดสิทธิ์รับ DM |

แถวที่สองสำคัญ: คนที่เข้ากลุ่มด้วยลิงก์เชิญตรง ๆ ตั้งแต่ก่อนมีระบบนี้
ยังไม่เคยกด Start จึงยังรับ DM ไม่ได้ ต้องมีทางให้เขากดด้วย

> ⚠️ **ไม่ตั้ง `TELEGRAM_BOT_USERNAME` = หน้าบัญชีกลับไปใช้ลิงก์เชิญตรง ๆ แบบเดิม**
> เว็บทำงานปกติทุกอย่าง แค่ส่ง DM ไม่ได้ — callback ของ TradingView
> จะตอบ `proof: "needs-start"` แล้วเด้งหาแอดมินให้ส่งภาพเองแทน

## ต้องรันใหม่หลังอัปเดต

`allowed_updates` เพิ่ม `"message"` เข้าไปแล้ว ต้องลงทะเบียน webhook ใหม่
ไม่งั้น Telegram ไม่ส่ง `/start` มาเลย:

```bash
node scripts/telegram-webhook.mjs set
node scripts/telegram-webhook.mjs info   # ต้องเห็น chat_join_request, message
```

webhook กรองเองแล้วว่ารับเฉพาะ `/start` จากแชทส่วนตัว ข้อความในกลุ่มถูกทิ้ง
