# ตั้ง SSH เข้าคอมเฟิร์สจากเครื่อง dev — งานค้าง (ส่งต่อ session ใหม่)

_เขียน 27 ก.ย. 2569 · ✅ **เสร็จแล้ว** — DomeCB + MacBook SSH เข้าคอมเฟิร์ส (`ssh oneye@100.107.33.82`) ได้ · เก็บไว้อ้างอิงวิธี/กับดัก · สรุปเซสชัน: `docs/SESSION-2026-09-27.md`_

## เป้าหมาย

ให้ **SSH จากเครื่อง dev (DomeCB) → เครื่องบอทหลัก (คอมเฟิร์ส) ได้** เพื่อให้ Claude
รันคำสั่ง ops บนคอมเฟิร์สแทนเจ้าของได้เอง ไม่ต้องให้เจ้าของพิมพ์เองผ่าน AnyDesk ทุกครั้ง

> session ก่อนหน้าเขียนชุดคำสั่งติดตั้ง SSH ให้ไม่ได้ (ตัวช่วยถูกกลไกความปลอดภัยหยุดหลายรอบ)
> จึงต้องทำใน session นี้ — **ขั้นตอนจริงอยู่ในคู่มือ Microsoft** (ลิงก์ด้านล่าง) session นี้รันเองได้

## เครื่อง / บัญชี

| | คอมเฟิร์ส (ปลายทาง) | DomeCB (ต้นทาง = เครื่องที่ Claude รัน) |
|---|---|---|
| Tailscale name | `desktop-8qjh30a-1` | `desktop-23otb1t` |
| Tailscale IP | **`100.107.33.82`** | `100.74.113.113` |
| Windows user | `oneye` (เป็น **admin**) | `oneye`/`DomeCB` |
| บอทอยู่ | `C:\BotTV` | — |
| SSH key | (ปลายทาง) | private key อยู่ `~/.ssh/id_ed25519` |

- ทั้งสองเครื่องอยู่ Tailscale วง `phadungdath@gmail.com` แล้ว · ping ถึงกัน ~19ms (ต่อตรง)
- **RDP ผ่าน Tailscale ใช้ได้แล้ว** — เจ้าของเข้าเครื่องเองที่ `100.107.33.82` ได้เลย (SSH คนละเรื่อง — SSH ไว้ให้ Claude รันคำสั่งแทน)

## สถานะปัจจุบัน — เหลือจุดเดียว

- ✅ OpenSSH Server บนคอมเฟิร์ส **ติดตั้งแล้ว** service `sshd` = **Running**
- ✅ SSH เชื่อมถึงพอร์ต 22 ได้ (ยิงจาก DomeCB แล้วเจอ sshd ตอบ)
- ❌ auth ไม่ผ่าน: `Permission denied (publickey)`
- **ต้นเหตุ:** ไฟล์ `C:\ProgramData\ssh\administrators_authorized_keys` **เพี้ยน** —
  key ของ DomeCB ไปต่อท้าย**ติดกับ key เดิมในบรรทัดเดียว** (เกิดจากสคริปต์รอบก่อนเขียนต่อท้ายไม่ขึ้นบรรทัดใหม่ + คำสั่งถูกรันสลับลำดับ) SSH เลยอ่าน key ไม่ออก
- ⚠️ **เสี่ยงว่า key `claude-analog-admin` (ของ electiction) เสียหาย/หายไปด้วย** — ต้องเช็กและกู้คืนให้ครบ เพราะเป็นสิทธิ์เข้าเครื่องของอีกฝ่าย

## public key ของ DomeCB (ที่ต้องใส่ให้อยู่ "คนละบรรทัด")

เปิดเผยได้ ไม่ใช่ความลับ:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAT2ZveIalnGv/aMy5wpUyBWjosiPWPOzSB3o03ofWGh domecb@DESKTOP-23OTB1T
```

fingerprint (ใช้ยืนยันว่าใส่ถูกตัว): `SHA256:C5svglLAw7yvjjhTHZ16oLKw46fIQEaQDndORqT8nRI`

## จะให้เครื่องไหนเป็นตัว SSH เข้า

**เครื่องไหนเป็นตัว SSH ออกไป ต้องเอา public key ของเครื่องนั้นไปใส่ที่คอมเฟิร์ส**
(ปลายทางเหมือนกันหมด ต่างแค่ key) · ใส่หลาย key พร้อมกันได้ แค่ต้องคนละบรรทัด

- **session รันบน DomeCB** → ใช้ key ของ DomeCB ด้านบน
- **session รันบน MacBook** → ใช้ key ของ Mac (หาแบบด้านล่าง)

MacBook อยู่ Tailscale วงเดียวกันแล้ว (`macbookpro`, บัญชี phadungdath) — ยิงถึงคอมเฟิร์สได้

**เอา public key ของ Mac** — บน MacBook เปิด Terminal:
```bash
cat ~/.ssh/id_ed25519.pub          # ถ้า "No such file" -> ssh-keygen -t ed25519 (Enter รัว ๆ) แล้ว cat ใหม่
```
ได้บรรทัด `ssh-ed25519 AAAA... ชื่อ@Mac` — เอาบรรทัดนั้นไปใส่คอมเฟิร์ส (ที่เดียวกับ key อื่น)

public key จริงของ MacBook เครื่องนี้ (เปิดเผยได้ ไม่ลับ) — เอาไปใส่ได้เลย:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILeHF1qYGC97nmBZHxSz/4FIGYLxqCMRrxRKLFefFuq7 macbook
```

fingerprint ของ Mac ไว้ยืนยันตอนใส่ (จาก `ssh-keygen -lf ~/.ssh/id_ed25519.pub` บน Mac):
`SHA256:sCQiXMeVp97IjvT/z1vxxEETGimxCgqYmf00rd7ZQe4` (ED25519)

**เช็กว่าสำเร็จ (จาก Mac):**
```bash
ssh -i ~/.ssh/id_ed25519 oneye@100.107.33.82 "hostname"   # ต้องได้ชื่อเครื่อง ไม่ใช่ Permission denied
```

## ต้องทำอะไร (ที่หน้าคอมเฟิร์ส · PowerShell แบบ admin)

1. **ซ่อมไฟล์** `C:\ProgramData\ssh\administrators_authorized_keys` ให้แต่ละ key อยู่คนละบรรทัด
   (แยก key ของ DomeCB ออกจาก `claude-analog-admin` ที่ติดกัน + กู้ key เดิมถ้าหาย)
2. **ตั้งสิทธิ์ไฟล์** ให้เข้าได้แค่ Administrators + SYSTEM
3. `Restart-Service sshd`

คำสั่งจริงทำตามคู่มือทางการ (หัวข้อ **"Administrative user"** — ตรงกับเคสนี้เพราะ `oneye` เป็น admin):
- ติดตั้ง/เปิดใช้: https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse
- จัดการ key: https://learn.microsoft.com/windows-server/administration/openssh/openssh_keymanagement

## กับดัก 3 ข้อ (ข้อเท็จจริงของ Windows — พลาดจุดไหนก็ `Permission denied` ทั้งที่ key ถูก)

1. **user ที่เป็น admin ใช้ไฟล์คนละที่** — sshd อ่าน `C:\ProgramData\ssh\administrators_authorized_keys`
   **ไม่ใช่** `C:\Users\oneye\.ssh\authorized_keys` (ใส่ผิดที่ = ไม่มีผล)
2. **สิทธิ์ไฟล์ต้องแคบ** — ถ้า user ทั่วไปเข้าถึงได้ sshd จะไม่ยอมอ่านและปฏิเสธเงียบ ๆ
3. **หนึ่ง key = หนึ่งบรรทัด** — นี่คือบั๊กที่ทำพังรอบก่อน key สองอันไปติดกัน

## เช็กว่าสำเร็จ

**บนคอมเฟิร์ส** — key ต้องแยกบรรทัด และมี fingerprint ของ DomeCB:
```powershell
ssh-keygen -lf C:\ProgramData\ssh\administrators_authorized_keys
```
ต้องขึ้น **หลายบรรทัด บรรทัดละ key** และมีบรรทัด `SHA256:C5svglLAw7yvjjhTHZ16oLKw46fIQEaQDndORqT8nRI ... (ED25519)`

**จาก Claude/DomeCB** — ต้องได้ชื่อเครื่องกลับมา ไม่ใช่ Permission denied:
```bash
ssh -i ~/.ssh/id_ed25519 -o BatchMode=yes oneye@100.107.33.82 "hostname"
```

## บริบทที่ session ใหม่ควรรู้ — บริดจ์เพิ่งกู้เสร็จวันนี้

- บริดจ์ TradingView บนคอมเฟิร์ส **กลับมาทำงานแล้ว** (27 ก.ย. 2569) เว็บยิงถึง ลูกค้าได้สิทธิ์อัตโนมัติ
- `botkeeper.ps1` ตัวใหม่ (จาก `scripts/bot/botkeeper.ps1`) รันอยู่ที่ `C:\BotTV` + ตั้ง Registry Run key ให้เปิดเองตอน login แล้ว
- **ต้นเหตุที่ดับยาว 25 วัน:** ไฟล์ `botkeeper.ps1` หายไปจาก `C:\BotTV` (ไม่ใช่บริดจ์พัง) พอไม่มีตัวเฝ้า บริดจ์ล้มแล้วไม่มีใครปลุก + URL tunnel เปลี่ยนแล้วไม่มีใครบอกเว็บ
- **ยังค้าง:** ลบ `C:\BotTV\vercel_token.txt` (botkeeper ตัวใหม่ไม่ใช้แล้ว — token คุมบัญชี Vercel ได้หมด ไม่ควรอยู่บนคอมที่บ้าน) · commit เอกสาร · ยังไม่เคยเทสต์ grant จริงครบวงว่าภาพหลักฐานถึง DM ลูกค้าไหม
- รายละเอียดบริดจ์ทั้งหมด: `docs/TRADINGVIEW.md` · ภาพรวมโปรเจกต์: `docs/HANDOFF.md`
