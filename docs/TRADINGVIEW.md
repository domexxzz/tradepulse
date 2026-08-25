# ให้สิทธิ์อินดิเคเตอร์บน TradingView อัตโนมัติ

TradingView ไม่มี public API สำหรับเพิ่ม/ลบ username ในสคริปต์ invite-only
วิธีที่ใช้จริงคือบอทที่เปิด Chrome ซึ่งล็อกอินบัญชีเจ้าของสคริปต์ค้างไว้ แล้วกดหน้าเว็บให้ (Selenium)

บอทตัวนั้นอยู่คนละที่กับเว็บนี้ — repo `electiction/Bot-Tradingview`
ไฟล์ `tv_bridge.py` ในนั้นคือส่วนที่เปิด HTTP ให้เว็บเราเรียก (อ่าน `BRIDGE_README.md` ประกอบ)

**ไม่ตั้งค่า = ทำงานแบบเดิม** แอดมินเพิ่ม username เองผ่านคิว `/admin/access-queue`

## ภาพรวม

```
ลูกค้าจ่ายเงิน / แอดมินอนุมัติสลิป / cron ปิดสิทธิ์
        │
        ▼
  เว็บ (Vercel)  ──POST /grant หรือ /revoke──►  tv_bridge.py (เครื่องที่มี Chrome)
        ▲                                              │
        │                                       เข้าคิว ทำทีละงาน
        │                                              │
        │                                    Selenium กดหน้า TradingView
        │                                              │
        └──POST /api/tradingview/callback ─────────────┘  (60-120 วินาทีต่อมา)
```

**เว็บไม่ยืนรอให้บอททำงานจบ** เพราะขั้นตอน Selenium ใช้เวลาเป็นนาที
และ Vercel จำกัดเวลาของแต่ละ request อยู่แล้ว จึงสั่งแล้วปล่อย
รายการยังค้างในคิวจนกว่าบอทจะรายงานผลกลับมา

## สัญญาการเรียก

เว็บ → บอท:

```
POST {TV_BOT_URL}/grant     {"secret":"...", "username":"someone", "days": 27}
POST {TV_BOT_URL}/revoke    {"secret":"...", "username":"someone"}
```

บอทตอบทันที (ยังไม่ได้ทำงานจริง):

```json
{"ok": true, "queued": true, "position": 1}
```

บอท → เว็บ เมื่อทำงานเสร็จ:

```
POST https://โดเมนเว็บ/api/tradingview/callback
{"secret":"...", "action":"grant", "username":"someone", "ok":true, "error":null}
```

> `days` คำนวณจากวันหมดอายุแพ็กเกจจริง เพื่อให้สิทธิ์บน TradingView หมดพร้อมกัน
> เผื่อ cron ฝั่งเราไม่ทำงานสักวันก็ยังไม่มีใครใช้ฟรีเกินกำหนด

## ตั้งค่า

ฝั่งเว็บ:

```bash
vercel env add TV_BOT_URL      # เช่น https://tv-bot.example.com (ไม่ต้องมี / ปิดท้าย)
vercel env add TV_BOT_SECRET   # สุ่มยาว ๆ ต้องตรงกับฝั่งบอท
```

ฝั่งบอท (ในเครื่องที่รัน Chrome) — ดู `.env.bridge.example` ใน repo บอท:

```
TV_BOT_SECRET=<ค่าเดียวกับข้างบน>
TV_INDICATOR_NAME=<ชื่อสคริปต์ตามที่แสดงในหน้า Published Scripts>
TV_PROFILE_USERNAME=<บัญชี TradingView เจ้าของสคริปต์>
TRADEPULSE_CALLBACK_URL=https://โดเมนเว็บ/api/tradingview/callback
CHROME_USER_DATA_DIR=<โฟลเดอร์โปรไฟล์ Chrome ที่ล็อกอินค้างไว้>
```

เครื่องที่รันบอทต้องเปิดตลอด และถ้าไม่มี public IP ให้ใช้ tunnel:

```bash
cloudflared tunnel --url http://localhost:8787
```

## ระบบเรียกบอทตอนไหน

| จังหวะ | เกิดอะไร |
|---|---|
| อนุมัติสลิป / จ่ายผ่าน Stripe สำเร็จ | `/grant` ถ้าสมาชิกกรอก username ไว้แล้ว |
| สมาชิกกรอก username ทีหลัง | `/grant` ทันทีถ้ามีแพ็กเกจใช้งานอยู่ |
| cron ปิดสิทธิ์เมื่อหมดอายุ | `/revoke` |
| แอดมินกดปิดสิทธิ์ทันที | `/revoke` |

## เมื่อบอทพัง

บอทจับปุ่มบนหน้า TradingView จาก class name (เช่น `button-qm7Rg5MB`)
ซึ่ง TradingView เปลี่ยนเมื่อไหร่ก็ได้ — วันที่พังต้องไปแก้ selector ในฝั่งบอท

ฝั่งเว็บออกแบบให้รองรับไว้แล้ว:

- บอทตอบไม่สำเร็จ / ติดต่อไม่ได้ → บันทึกเหตุผลลง note แล้วปล่อยรายการค้างในคิว
- บอทรายงานกลับว่าล้มเหลว → แจ้งเตือนเข้า Telegram แอดมินทันที
- **ไม่มีทางที่ออเดอร์หรือการอนุมัติสลิปจะล้มเพราะบอท**

## ความปลอดภัย

- `TV_BOT_SECRET` เป็นความลับ อยู่ใน env ทั้งสองฝั่ง
- callback เทียบ secret แบบ timing-safe และผูกผลกับสมาชิกผ่าน `tradingViewUsername`
- บริดจ์จะไม่ยอมสตาร์ทถ้าไม่ได้ตั้ง secret — endpoint ที่แจกสิทธิ์สคริปต์ห้ามเปิดโล่ง
