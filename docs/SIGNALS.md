# ระบบสัญญาณสด (TradingView → เว็บ)

อินดิเคเตอร์บน TradingView ยิงสัญญาณเข้าเว็บผ่าน webhook แล้วเว็บแสดงในหน้า `#signals`
ไม่ต้องพอร์ต Pine Script มาเป็น TypeScript และตัวเลขที่ลูกค้าเห็นตรงกับบนกราฟเป๊ะ

## 1. ตั้ง secret

สร้างค่าสุ่มยาว ๆ (อย่าใช้ `secret123`) แล้วใส่ให้ตรงกันทั้ง 2 ที่:

| ที่ | ค่า |
|---|---|
| Vercel → Settings → Environment Variables | `TRADINGVIEW_WEBHOOK_SECRET` |
| อินดิเคเตอร์ → กลุ่ม `⑫ แจ้งเตือน` → ช่อง `Webhook Secret` | ค่าเดียวกัน |

ถ้าไม่ตั้ง `TRADINGVIEW_WEBHOOK_SECRET` endpoint จะตอบ 503 และปิดรับทั้งหมด
(ตั้งใจให้ปิดไว้ก่อน ดีกว่าเปิดรับโดยไม่ตรวจสอบ)

## 2. ตั้ง Alert บน TradingView

1. เปิดกราฟที่ลงอินดิเคเตอร์ไว้ → กด **Alert** (นาฬิกาปลุก)
2. Condition เลือกอินดิเคเตอร์ TradePulse
3. **Webhook URL:** `https://<โดเมนของคุณ>/api/webhooks/tradingview`
4. Message ปล่อยตามที่สคริปต์ยิงออกมา (เป็น JSON อยู่แล้ว)

## 3. Payload ที่ endpoint รับ

```json
{
  "secret": "<ตรงกับ env>",
  "symbol": "XAUUSD",
  "side": "BUY",
  "price": 4603.14,
  "tf": "30",
  "sl": 4590.1,
  "tp1": 4620.5,
  "tp2": 4640.2
}
```

`sl` / `tp1` / `tp2` ใส่หรือไม่ใส่ก็ได้ ที่เหลือบังคับ

## 4. การป้องกันที่ใส่ไว้

| กรณี | ผลลัพธ์ |
|---|---|
| secret ผิด / ไม่มี / schema ไม่ตรง | `401` (ตอบเหมือนกันหมด ไม่บอกใบ้ว่าผิดตรงไหน) |
| เทียบ secret | constant-time กัน timing attack |
| body เกิน 2 KB | `413` |
| ยิงเกิน 60 ครั้ง/นาที ต่อ IP | `429` |
| JSON พัง | `400` |
| แผนขัดแย้ง เช่น BUY แต่ SL สูงกว่าราคา | `422` |
| เปิดด้วย GET | `405` |
| DB ล้ม | `500` (ไม่ส่งรายละเอียด error ออกไป) |

## 5. การแบ่งสิทธิ์ดูสัญญาณ

`GET /api/signals` แยกข้อมูลตามสถานะสมาชิก **ที่ระดับ query** ไม่ใช่ซ่อนด้วย CSS:

- ยังไม่ได้เป็นสมาชิก → ได้แค่ `symbol` / `side` / `tf` / `createdAt`
- สมาชิกที่ subscription เป็น ACTIVE หรือ TRIALING → ได้ `price` / `sl` / `tp1` / `tp2` ด้วย

ตัวเลขจึงไม่เคยถูกส่งออกไปหาคนที่ไม่มีสิทธิ์เลย เปิด DevTools ดูก็ไม่เจอ

## 6. ทดสอบ

```bash
curl -X POST https://<โดเมน>/api/webhooks/tradingview \
  -H 'Content-Type: application/json' \
  -d '{"secret":"<secret>","symbol":"XAUUSD","side":"BUY","price":4603.14,"tf":"30","sl":4590.1,"tp1":4620.5,"tp2":4640.2}'
```

ได้ `{"ok":true,...}` = ผ่าน แล้วดูผลที่หน้าแรกส่วน "สัญญาณล่าสุด"
