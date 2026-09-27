"""
บอทอ่านอีเมลแจ้งเตือนจากโบรก แล้วส่งเข้าเว็บ (POST /api/broker/email)

ทำไมต้องอ่านอีเมล: Wisdom ไม่มี API ให้เชื่อม (ถามแล้ว 27 ก.ย. 2569)
ช่องทางเดียวที่ได้คืออีเมลแจ้งเตือนที่พาร์ตเนอร์ส่งต่อมา

หลักการ: บอทตัวนี้ "ไม่ตัดสินอะไรเลย" แค่ส่งอีเมลดิบให้เว็บอ่าน
ตรรกะการอ่านอยู่ฝั่งเว็บ (src/lib/broker-events.ts) ที่มีเทสต์คุม — แก้ที่เดียว ไม่ต้องขึ้นเครื่องใหม่

- อ่านเฉพาะอีเมลที่ยังไม่อ่าน (UNSEEN) แล้วมาร์คว่าอ่านแล้วเมื่อส่งเข้าเว็บสำเร็จ
  ส่งไม่สำเร็จจะไม่มาร์ค รอบหน้าลองใหม่ ไม่มีอีเมลหาย
- เว็บกันข้อมูลซ้ำด้วย Message-ID อยู่แล้ว อ่านซ้ำจึงไม่เกิดแถวซ้ำ
- Python มาตรฐานล้วน ไม่ต้อง pip install

ตั้งค่าใน C:\\QVXAI\\mail.env (หรือส่งผ่าน --env):
    IMAP_HOST=imap.gmail.com
    IMAP_USER=you@gmail.com
    IMAP_PASSWORD=<app password ของ Gmail ไม่ใช่รหัสผ่านจริง>
    IMAP_FOLDER=INBOX
    BROKER_MAIL_SECRET=<ค่าเดียวกับบน Vercel>
    SITE=https://quantvisionx.com
    SENDER_FILTER=wisdom            # ไม่ว่าง = อ่านเฉพาะอีเมลที่ผู้ส่งมีคำนี้
"""
from __future__ import annotations

import argparse
import email
import imaplib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime

MAX_BODY = 100_000


def log(msg: str) -> None:
    print(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}", flush=True)


def load_env(path: str) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path or not os.path.exists(path):
        return out
    with open(path, "r", encoding="utf-8-sig") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def header(msg: email.message.Message, name: str) -> str:
    raw = msg.get(name)
    if not raw:
        return ""
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        return str(raw)


def body_text(msg: email.message.Message) -> str:
    """ข้อความล้วนก่อน ถ้าไม่มีค่อยถอดแท็กจาก HTML แบบหยาบ ๆ"""
    plain, html = "", ""
    for part in msg.walk() if msg.is_multipart() else [msg]:
        ctype = part.get_content_type()
        if ctype not in ("text/plain", "text/html"):
            continue
        try:
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
        except Exception:
            continue
        if ctype == "text/plain" and not plain:
            plain = text
        elif ctype == "text/html" and not html:
            html = text
    if plain.strip():
        return plain[:MAX_BODY]
    if html:
        import re

        stripped = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", html, flags=re.I)
        stripped = re.sub(r"<br\s*/?>|</p>|</tr>|</div>", "\n", stripped, flags=re.I)
        stripped = re.sub(r"<[^>]+>", " ", stripped)
        for a, b in (("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"')):
            stripped = stripped.replace(a, b)
        stripped = re.sub(r"[ \t]+", " ", stripped)
        return re.sub(r"\n\s*\n+", "\n", stripped).strip()[:MAX_BODY]
    return ""


def post_to_site(cfg: dict[str, str], payload: dict) -> bool:
    url = cfg["SITE"].rstrip("/") + "/api/broker/email"
    data = json.dumps({**payload, "secret": cfg["BROKER_MAIL_SECRET"]}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = json.loads(r.read().decode("utf-8"))
        log(f"  -> ส่งเข้าเว็บแล้ว type={body.get('type')} account={body.get('tradingAccount')} ใหม่={body.get('created')}")
        return True
    except urllib.error.HTTPError as e:
        # 4xx = เว็บปฏิเสธ (secret ผิด / payload ไม่ถูก) ส่งซ้ำก็ไม่ผ่าน อย่าค้างอีเมลไว้ตลอด
        detail = e.read().decode("utf-8", errors="replace")[:200]
        log(f"  -> เว็บตอบ {e.code}: {detail}")
        return 400 <= e.code < 500 and e.code != 429
    except Exception as e:  # noqa: BLE001
        log(f"  -> ส่งไม่สำเร็จ ({type(e).__name__}) จะลองใหม่รอบหน้า")
        return False


def run_once(cfg: dict[str, str]) -> None:
    host, user, pwd = cfg["IMAP_HOST"], cfg["IMAP_USER"], cfg["IMAP_PASSWORD"]
    folder = cfg.get("IMAP_FOLDER") or "INBOX"
    sender = (cfg.get("SENDER_FILTER") or "").strip()

    with imaplib.IMAP4_SSL(host) as im:
        im.login(user, pwd)
        im.select(folder)
        criteria = ["UNSEEN"]
        if sender:
            criteria += ["FROM", f'"{sender}"']
        typ, data = im.search(None, *criteria)
        ids = data[0].split() if typ == "OK" and data and data[0] else []
        if not ids:
            return
        log(f"เจออีเมลใหม่ {len(ids)} ฉบับ")
        for num in ids:
            # BODY.PEEK = อ่านโดยไม่มาร์คว่าอ่านแล้ว เรามาร์คเองเมื่อส่งเข้าเว็บสำเร็จ
            typ, raw = im.fetch(num, "(BODY.PEEK[])")
            if typ != "OK" or not raw or not isinstance(raw[0], tuple):
                continue
            msg = email.message_from_bytes(raw[0][1])
            subject = header(msg, "Subject")
            try:
                dt = parsedate_to_datetime(msg.get("Date"))
                received = dt.astimezone().isoformat()
            except Exception:
                received = None
            log(f"  {subject[:70]}")
            ok = post_to_site(
                cfg,
                {
                    "subject": subject,
                    "from": header(msg, "From"),
                    "body": body_text(msg),
                    "messageId": (msg.get("Message-ID") or "").strip() or None,
                    "receivedAt": received,
                },
            )
            if ok:
                im.store(num, "+FLAGS", "\\Seen")


def main() -> None:
    p = argparse.ArgumentParser(description="QVX broker mail bot")
    p.add_argument("--env", default=r"C:\QVXAI\mail.env")
    p.add_argument("--interval", type=int, default=120, help="วินาทีต่อรอบ (0 = รันรอบเดียวแล้วจบ)")
    args = p.parse_args()

    cfg = {**load_env(args.env), **{k: v for k, v in os.environ.items() if k.startswith(("IMAP_", "BROKER_MAIL_", "SITE", "SENDER_"))}}
    missing = [k for k in ("IMAP_HOST", "IMAP_USER", "IMAP_PASSWORD", "BROKER_MAIL_SECRET", "SITE") if not cfg.get(k)]
    if missing:
        log(f"FATAL: ยังไม่ได้ตั้ง {', '.join(missing)} ใน {args.env}")
        sys.exit(2)

    log(f"mailbot เริ่มทำงาน · {cfg['IMAP_USER']} · ทุก {args.interval} วินาที")
    while True:
        try:
            run_once(cfg)
        except Exception as e:  # noqa: BLE001
            # ล้มรอบเดียวไม่ควรทำให้บอทตาย เน็ตหลุด/IMAP งอแงเกิดได้
            log(f"รอบนี้ล้มเหลว: {type(e).__name__}: {e}")
        if args.interval <= 0:
            return
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
