# เปลี่ยนบัญชี TradingView / เปลี่ยนบอท Telegram

รวมขั้นตอนย้ายไปบัญชีใหม่ ทั้งสองอย่างแก้คนละที่กัน อ่านหัวข้อที่ต้องใช้พอ

---

## เปลี่ยนบัญชี TradingView

### แก้ที่ `.env` ของบอทบนคอมเบส

```
TV_PROFILE_USERNAME=<ชื่อผู้ใช้ TradingView ที่เป็นเจ้าของสคริปต์>
TV_INDICATOR_NAME=<ชื่อสคริปต์ ตามที่แสดงในหน้า Published Scripts เป๊ะ ๆ>
```

`TV_PROFILE_USERNAME` คือชื่อที่อยู่ใน URL โปรไฟล์ — บอทเปิด
`https://www.tradingview.com/u/<ชื่อนี้>/#published-scripts` เพื่อหาสคริปต์

`TV_INDICATOR_NAME` ต้องตรงกับชื่อที่แสดงจริง ผิดตัวอักษรเดียวบอทหาไม่เจอ
เช็คได้จาก `/health` — มันสะท้อนค่าที่อ่านได้กลับมาให้

### สิ่งที่คนมักลืม — Chrome profile ต้องล็อกอินเป็นบัญชีใหม่

บอท **ไม่ได้ล็อกอินด้วยรหัสผ่าน** มันใช้ session ที่ค้างอยู่ใน Chrome profile ที่
`CHROME_USER_DATA_DIR` เพราะฉะนั้นเปลี่ยนแค่ `TV_PROFILE_USERNAME` ไม่พอ

**ก๊อปโปรไฟล์จากเครื่องอื่นมาไม่ได้** Chrome 127+ ใช้ App-Bound Encryption
คุกกี้ผูกกับเครื่องกับบัญชีผู้ใช้ Windows ที่สร้างมัน ย้ายมาแล้วจะกลายเป็นสถานะไม่ได้ล็อกอิน

ต้องเปิด Chrome ด้วยโปรไฟล์นั้นแล้วล็อกอินเองบนเครื่องคอมเบส:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --user-data-dir="C:\tv-bot-chrome" --profile-directory="Default"
```

หน้าต่างที่เปิดมา → ออกจากบัญชีเก่า → ล็อกอินบัญชีใหม่ → ปิดหน้าต่าง
(ต้องปิดให้หมดจริง ๆ ไม่งั้น Selenium เปิดโปรไฟล์ซ้ำไม่ได้ Chrome ล็อกโฟลเดอร์ไว้)

### ลบทิ้งได้เลย

```
TRADINGVIEW_USERNAME=...
TRADINGVIEW_PASSWORD=...
```

สองตัวนี้เป็นของค้างจากสคริปต์รุ่นก่อน — `tlapi.py` กับ `tv_bridge.py`
ไม่ได้อ่านทั้งคู่ (ตรวจแล้ว) เก็บไว้มีแต่ความเสี่ยงรหัสผ่านหลุดเปล่า ๆ

### เสร็จแล้วรีสตาร์ทบริดจ์ + ตรวจ

ดูวิธีรีสตาร์ทใน [TRADINGVIEW.md](./TRADINGVIEW.md) แล้วเช็ค:

```bash
curl https://<โดเมนบริดจ์>/health
```

`indicator` ต้องขึ้นชื่อสคริปต์ใหม่ จากนั้นลองสั่งจริงหนึ่งครั้งด้วยบัญชีทดสอบ
อย่าเชื่อแค่ `/health` เพราะมันบอกแค่ว่าอ่าน env ได้ ไม่ได้แปลว่าล็อกอิน TradingView ผ่าน

---

## เปลี่ยนบอท Telegram

### ตัดสินใจก่อน — ต้องใช้กี่ตัว

**บอทหนึ่งตัวมี webhook ได้ทางเดียว และใช้พร้อม polling ไม่ได้**
Telegram ยอมให้มี `getUpdates` consumer เดียวต่อโทเคน

ตอนนี้มีสามคนอยากใช้โทเคน:

| ใคร | ใช้แบบไหน | ทำอะไร |
|---|---|---|
| เว็บ | **webhook** | อนุมัติคำขอเข้ากลุ่ม · ส่งสัญญาณ · แจ้งเตือนแอดมิน |
| บอท Python บนคอมเบส | polling | `/add` `/re` `/del` สั่งสิทธิ์ด้วยมือ |
| กล่อง x96 (Sentiara) | polling | `/wol` `/status` ตอนคอมเบสดับ |

**แยกเป็นสองตัว:**

- **บอทลูกค้า (ตัวใหม่)** — ใช้ webhook อย่างเดียว ให้เว็บใช้ ห้ามมีอะไร polling โทเคนนี้
- **บอทในบ้าน (ตัวเดิม)** — polling ตามเดิม ไม่ต้องแตะ ทั้ง `/wol` และ `/add` อยู่ตัวนี้

`/add` `/re` `/del` ตอนนี้มีปุ่ม **"สั่งบอท"** ใน `/admin/access-queue` ทำแทนได้แล้ว
ถ้าไม่ได้ใช้ก็ไม่ต้องย้ายไปไหน

### 1. สร้างบอทใหม่กับ BotFather

`/newbot` → เก็บโทเคน → เพิ่มเข้ากลุ่ม → **ตั้งเป็นแอดมิน**
ต้องมีสิทธิ์อย่างน้อย `can_invite_users` และ `can_restrict_members`
(ไม่งั้นสร้างลิงก์เชิญกับเตะคนหมดอายุออกไม่ได้)

### 2. หา chat_id และ topic id

ถ้ากลุ่มเป็น forum (มี topics) ต้องได้ id ของแต่ละ topic ด้วย ไม่งั้นสัญญาณยิงผิดห้อง

```bash
# พิมพ์ข้อความอะไรก็ได้ในแต่ละ topic (M5, M15, M30, 1H) อย่างละครั้ง
node scripts/telegram-ids.mjs
```

### 3. ตั้ง env ฝั่งเว็บ (Vercel) — ครบทุกตัวที่เกี่ยวกับกลุ่ม

```
TELEGRAM_BOT_TOKEN         โทเคนบอทใหม่
TELEGRAM_CHAT_ID           chat_id กลุ่มใหม่
TELEGRAM_TOPIC_M5          จาก telegram-ids.mjs
TELEGRAM_TOPIC_M15
TELEGRAM_TOPIC_M30
TELEGRAM_TOPIC_1H
TELEGRAM_ADMIN_CHAT_ID     ห้องที่แจ้งเตือนแอดมิน
TELEGRAM_ADMIN_TOPIC_ID
TELEGRAM_WEBHOOK_SECRET    สุ่มใหม่
TELEGRAM_SIGNAL_SECRET     สุ่มใหม่
TELEGRAM_INVITE_URL        ลิงก์กลุ่มสำหรับคนที่ยังไม่ได้เชิญส่วนตัว
NEXT_PUBLIC_TELEGRAM_COMMUNITY_URL
```

> ย้ายกลุ่มแล้วอย่าลืม `TELEGRAM_CHAT_ID` — ค่าเดิมชี้ห้องเก่า
> Vercel ไม่ทับค่าที่มีอยู่ ต้องลบตัวเดิมก่อนแล้วเพิ่มใหม่ แล้ว redeploy

### 4. ตั้ง webhook

```bash
node scripts/telegram-webhook.mjs set
node scripts/telegram-webhook.mjs info    # ยืนยัน
```

**ไม่มี webhook = ลิงก์เชิญส่วนตัวจะไม่มีใครอนุมัติ** สมาชิกค้างอยู่หน้ารออนุมัติตลอด

### 5. ตรวจทั้งเส้น

เปิดสิทธิ์ให้บัญชีทดสอบ → ต้องได้ลิงก์เชิญส่วนตัว → กดเข้ากลุ่ม →
ต้องถูกอนุมัติเองภายในไม่กี่วินาที → ดูใน `/admin/telegram` ว่าสถานะตรง

---

## ถ้าค่าลับหลุด — ต้องเปลี่ยนอะไรบ้าง

| ค่า | เปลี่ยนยังไง | ไม่เปลี่ยนแล้วเกิดอะไร |
|---|---|---|
| `TV_BOT_SECRET` | สุ่มใหม่ ใส่ให้ตรงกันทั้ง `.env` บอทและ Vercel | บริดจ์เปิดออกเน็ตผ่าน Funnel — ใครมี secret สั่งแจก/ถอนสิทธิ์ได้หมด |
| `TELEGRAM_BOT_TOKEN` | `/revoke` ใน BotFather | คุมบอทได้เต็มที่ อ่านข้อความในกลุ่ม เตะสมาชิก |
| `TELEGRAM_WEBHOOK_SECRET` | สุ่มใหม่ แล้ว `telegram-webhook.mjs set` ใหม่ | ปลอมคำขอเข้ากลุ่มได้ |
| `DATABASE_URL` | Neon Console → reset password | ข้อมูลลูกค้าทั้งฐาน |
| รหัส TradingView | เปลี่ยนบนเว็บ TradingView + เปิด 2FA | ยึดบัญชีเจ้าของสคริปต์ |

สุ่มค่าใหม่:

```bash
openssl rand -hex 32
```

> ค่าลับหลุดบ่อยสุดตอน `cat .env` / `type .env` ลงเทอร์มินัลแล้วแคปหน้าจอส่งต่อ
> อยากดูว่าตั้งครบไหมให้ดูแค่ชื่อตัวแปร: `grep -o '^[A-Z_]*=' .env`
