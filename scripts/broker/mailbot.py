"""
บอทอ่านอีเมลแจ้งเตือนจากโบรก แล้วส่งเข้าเว็บ (POST /api/broker/email)

ทำไมต้องอ่านอีเมล: Wisdom ไม่มี API ให้เชื่อม (ถามแล้ว 27 ก.ย. 2569)
ช่องทางเดียวที่ได้คืออีเมลแจ้งเตือนที่เข้ากล่องของ QVX

หลักการ: บอทตัวนี้ "ไม่ตัดสินอะไรเลย" แค่ส่งอีเมลดิบให้เว็บอ่าน
ตรรกะการอ่านอยู่ฝั่งเว็บ (src/lib/broker-events.ts) ที่มีเทสต์คุม — แก้ที่เดียว ไม่ต้องขึ้นเครื่องใหม่

เปิดกล่องแบบอ่านอย่างเดียว — ไม่มาร์คว่าอ่านแล้ว ไม่ติดป้าย ไม่ย้ายอะไร
แล้วจำไว้ว่าส่งถึงอีเมลฉบับไหนแล้วด้วย UID (ไฟล์ mailbot.state.json ข้าง mail.env)

ทำไมเลิกใช้ "อีเมลที่ยังไม่อ่าน" แบบเดิม (เปลี่ยน 30 ก.ย. 2569):
กล่อง QVXofficial09 มีคนเปิดอ่านด้วย ใครเปิดอีเมลจาก Wisdom ก่อนบอทวนมาถึง
หรือเปิดตอนเครื่องบอทปิดอยู่ ฉบับนั้นหายถาวร และการที่บอทมาร์คว่าอ่านแล้ว
ทำให้ทีมไม่เห็นว่ามีอีเมลใหม่เข้ามา

ส่งไม่สำเร็จแล้วทำยังไง — แยกตามสาเหตุ เพราะข้ามผิดจังหวะ = อีเมลหาย:
- เน็ตหลุด / เว็บปฏิเสธที่การตั้งค่า (secret ไม่ตรง 401 · เว็บยังไม่เปิดรับ 503) = รอ ไม่นับ ไม่ข้าม
  อีเมลทุกฉบับจะโดนเหมือนกัน แก้ค่าเสร็จเมื่อไหร่ก็ส่งต่อได้ครบ
- เว็บบอกว่าอีเมลฉบับนี้ใช้ไม่ได้ (400 / 413 / 422) = ส่งซ้ำก็ไม่ผ่าน ข้ามเลย
- อ่านฉบับนี้ไม่ได้ / เว็บล่ม 5xx = ลองใหม่รอบหน้า เกิน MAX_ATTEMPTS รอบค่อยข้าม
  ไม่งั้นอีเมลเสียฉบับเดียวขวางทุกฉบับที่ตามมา
- เว็บกันข้อมูลซ้ำด้วย Message-ID อยู่แล้ว ส่งซ้ำไม่เกิดแถวซ้ำ

อ่าน mail.env ใหม่ทุกรอบ — เปลี่ยนรหัสแอปแล้วมีผลรอบถัดไป ไม่ต้องรีสตาร์ต
รอบแรก (ยังไม่มีไฟล์ state) ย้อนอ่าน --since-days วัน · Python มาตรฐานล้วน ไม่ต้อง pip install

ตั้งค่าใน mail.env (บอกตำแหน่งไฟล์ด้วย --env) — SENDER_FILTER ไม่ว่าง = ส่งเฉพาะอีเมลที่ช่องผู้ส่งมีคำนี้
    IMAP_HOST=imap.gmail.com
    IMAP_USER=QVXofficial09@gmail.com
    IMAP_PASSWORD=<app password ของ Gmail ไม่ใช่รหัสผ่านจริง>
    IMAP_FOLDER=INBOX
    BROKER_MAIL_SECRET=<ค่าเดียวกับบน Vercel>
    SITE=https://quantvisionx.com
    SENDER_FILTER=wisdom

ใช้งานจริงบนคอมเฟิร์สผ่านงานตั้งเวลา QVXMailbot — ดู docs/WISDOM.md
ลองอ่านโดยไม่ส่งอะไรเข้าเว็บ: python mailbot.py --env <ไฟล์> --interval 0 --dry-run
"""
from __future__ import annotations

import argparse
import email
import imaplib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta, timezone
from email.header import decode_header, make_header
from email.message import Message
from email.utils import parsedate_to_datetime
from typing import Callable

MAX_BODY = 100_000
# ความยาวสูงสุดที่ /api/broker/email รับ — ยาวกว่านี้เว็บตอบ 400 แล้วอีเมลฉบับนั้นถูกข้าม
MAX_SUBJECT = 998
MAX_FROM = 320
# ฉบับเดิมพังซ้ำเกินนี้ = ข้ามไป ไม่ให้ฉบับเดียวขวางฉบับหลังทั้งหมด (ทุก 2 นาที x 180 = 6 ชม.)
MAX_ATTEMPTS = 180
# ไม่มี timeout = การเชื่อมต่อค้างครึ่งทางทำบอทแข็งตลอดไป process ยังอยู่ ตัวเฝ้าเลยไม่ปลุก
IMAP_TIMEOUT = 60
MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
# ดึงแค่ช่องผู้ส่งก่อน — กล่องนี้มีอีเมลอื่นเยอะ ไม่ต้องโหลดเนื้อหาทุกฉบับ
FROM_ONLY = "BODY.PEEK[HEADER.FIELDS (FROM)]"
REQUIRED = ("IMAP_HOST", "IMAP_USER", "IMAP_PASSWORD", "BROKER_MAIL_SECRET", "SITE")

# ผลของอีเมลหนึ่งฉบับ
OTHER = "other"        # ไม่ใช่อีเมลจากโบรก
LISTED = "listed"      # โหมดลองอ่าน — แสดงเฉย ๆ
SENT = "sent"          # เว็บรับแล้ว
REJECTED = "rejected"  # เว็บบอกว่าฉบับนี้ใช้ไม่ได้ ส่งซ้ำก็ไม่ผ่าน — ข้าม
RETRY = "retry"        # พังเฉพาะฉบับนี้หรือเว็บล่ม — ลองใหม่ นับครั้ง
BLOCKED = "blocked"    # พังที่การตั้งค่า/เน็ต ไม่ใช่ที่อีเมล — รอ ห้ามข้าม

_ATTEMPTS: dict[int, int] = {}


def log(msg: str) -> None:
    print(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}", flush=True)


def use_utf8_output() -> None:
    """
    เขียน log เป็น UTF-8 เสมอ

    Windows ภาษาไทยเข้ารหัส stdout เป็น cp874 ตอนถูก redirect ลงไฟล์ (รันจาก Task Scheduler)
    ซึ่งไม่มีตัว "·" และอีโมจิในหัวข้ออีเมล — print แล้วโยน UnicodeEncodeError บอทล้มทันที
    รันในหน้าต่างปกติจะไม่เห็นปัญหานี้ เลยหลุดไปโผล่ตอนตั้งให้รันเอง
    """
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


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
            # ตัดคอมเมนต์ท้ายบรรทัด — "SENDER_FILTER=wisdom  # ..." ไม่ตัด = ไม่มีอีเมลไหนตรงเลย
            v = re.split(r"\s+#", v, maxsplit=1)[0]
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def read_config(env_path: str) -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if k.startswith(("IMAP_", "BROKER_MAIL_", "SITE", "SENDER_"))}
    return {**load_env(env_path), **env}


def header(msg: Message, name: str) -> str:
    raw = msg.get(name)
    if not raw:
        return ""
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        return str(raw)


def body_text(msg: Message) -> str:
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
        stripped = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", html, flags=re.I)
        stripped = re.sub(r"<br\s*/?>|</p>|</tr>|</div>", "\n", stripped, flags=re.I)
        stripped = re.sub(r"<[^>]+>", " ", stripped)
        for a, b in (("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"')):
            stripped = stripped.replace(a, b)
        stripped = re.sub(r"[ \t]+", " ", stripped)
        return re.sub(r"\n\s*\n+", "\n", stripped).strip()[:MAX_BODY]
    return ""


def received_at(msg: Message) -> str | None:
    """
    เวลาของอีเมลเป็น UTC ลงท้าย Z

    ห้ามส่งแบบ +07:00 — /api/broker/email ตรวจด้วย z.string().datetime() ซึ่งรับแค่ Z
    ของเดิมส่ง +07:00 เว็บตอบ 400 ทุกฉบับ แล้วบอทถือว่าจบ อีเมลหายหมดโดยไม่มีอะไรฟ้อง
    """
    raw = msg.get("Date")
    if not raw:
        return None
    try:
        dt = parsedate_to_datetime(str(raw))
    except (TypeError, ValueError, IndexError):
        return None
    if dt.tzinfo is None:
        # "-0000" = ตามมาตรฐานคือ UTC แต่ astimezone() จะเดาเป็นเวลาเครื่อง (+7) ผิดไป 7 ชม.
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_payload(msg: Message) -> dict:
    return {
        "subject": header(msg, "Subject")[:MAX_SUBJECT],
        "from": header(msg, "From")[:MAX_FROM],
        "body": body_text(msg),
        # str() ก่อนเสมอ — หัวอีเมลที่มีไบต์แปลก ๆ ได้ออกมาเป็น Header ไม่ใช่ str แล้ว .strip() พัง
        "messageId": str(msg.get("Message-ID") or "").strip() or None,
        "receivedAt": received_at(msg),
    }


def post_to_site(cfg: dict[str, str], payload: dict) -> str:
    url = cfg["SITE"].rstrip("/") + "/api/broker/email"
    data = json.dumps({**payload, "secret": cfg["BROKER_MAIL_SECRET"]}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = json.loads(r.read().decode("utf-8"))
        log(f"  -> ส่งเข้าเว็บแล้ว type={body.get('type')} account={body.get('tradingAccount')} ใหม่={body.get('created')}")
        return SENT
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:200]
        log(f"  -> เว็บตอบ {e.code}: {detail}")
        if e.code in (400, 413, 422):
            return REJECTED
        if e.code >= 500 and e.code != 503:
            return RETRY
        # 401 secret ไม่ตรง · 503 เว็บยังไม่ตั้ง secret · 404/408/429 — ไม่ใช่ความผิดของอีเมลฉบับนี้
        return BLOCKED
    except Exception as e:  # noqa: BLE001
        log(f"  -> ส่งไม่สำเร็จ ({type(e).__name__}) จะลองใหม่รอบหน้า")
        return BLOCKED


def load_state(path: str) -> dict | None:
    """ส่งถึงฉบับไหนแล้ว — ไฟล์หายหรือเสีย = ถือว่ายังไม่เคยรัน"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    if isinstance(data, dict) and isinstance(data.get("uidvalidity"), str) and isinstance(data.get("last_uid"), int):
        return data
    return None


def save_state(path: str, mailbox: str, uidvalidity: str, last_uid: int) -> None:
    # เขียนไฟล์ชั่วคราวแล้วค่อยสลับ — ไฟดับกลางทาง ไฟล์เดิมยังอยู่ครบ
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"mailbox": mailbox, "uidvalidity": uidvalidity, "last_uid": last_uid}, f)
    os.replace(tmp, path)


def imap_date(d: date) -> str:
    """วันที่แบบ IMAP (01-Sep-2026) — ไม่ใช้ strftime("%b") เพราะชื่อเดือนขึ้นกับภาษาของเครื่อง"""
    return f"{d.day:02d}-{MONTHS[d.month - 1]}-{d.year}"


def parse_uids(data) -> list[int]:
    if not data or not data[0]:
        return []
    return sorted(int(x) for x in data[0].split())


def response_value(im, code: str) -> str:
    """ค่าที่ได้ตอนเปิดโฟลเดอร์ เช่น UIDVALIDITY / UIDNEXT (ไม่มีคืนสตริงว่าง)"""
    _, data = im.response(code)
    value = data[0] if data else None
    return value.decode() if isinstance(value, bytes) else (value or "")


def fetch_part(im, uid: int, part: str) -> bytes | None:
    typ, data = im.uid("FETCH", str(uid), f"({part})")
    if typ != "OK" or not data:
        return None
    for item in data:
        if isinstance(item, tuple) and len(item) >= 2 and isinstance(item[1], bytes):
            return item[1]
    return None


def connect_imap(host: str) -> imaplib.IMAP4:
    return imaplib.IMAP4_SSL(host, timeout=IMAP_TIMEOUT)


def process_uid(im, uid: int, cfg: dict[str, str], sender: str, *, dry_run: bool, post) -> str:
    head = fetch_part(im, uid, FROM_ONLY)
    if head is None:
        log(f"  อ่านหัวอีเมล UID {uid} ไม่ได้")
        return RETRY
    sender_hdr = header(email.message_from_bytes(head), "From")
    if sender and sender not in sender_hdr.lower():
        return OTHER

    raw = fetch_part(im, uid, "BODY.PEEK[]")
    if raw is None:
        log(f"  อ่านอีเมล UID {uid} ไม่ได้")
        return RETRY
    payload = build_payload(email.message_from_bytes(raw))
    if dry_run:
        log(f"  [ลองอ่าน] {payload['receivedAt'] or '-'} | {sender_hdr[:60]} | {payload['subject'][:70]}")
        return LISTED
    log(f"  {payload['subject'][:70]}")
    return post(cfg, payload)


def run_once(
    cfg: dict[str, str],
    state_path: str,
    *,
    since_days: int = 7,
    dry_run: bool = False,
    connect: Callable[[str], imaplib.IMAP4] = connect_imap,
    post: Callable[[dict[str, str], dict], str] = post_to_site,
    attempts: dict[int, int] | None = None,
    today: date | None = None,
) -> None:
    attempts = _ATTEMPTS if attempts is None else attempts
    folder = cfg.get("IMAP_FOLDER") or "INBOX"
    sender = (cfg.get("SENDER_FILTER") or "").strip().lower()
    mailbox = f"{cfg['IMAP_USER'].strip().lower()}/{folder}"

    with connect(cfg["IMAP_HOST"]) as im:
        im.login(cfg["IMAP_USER"], cfg["IMAP_PASSWORD"])
        # readonly = ไม่มีทางเผลอเปลี่ยนสถานะอีเมลของคนที่ใช้กล่องนี้อยู่
        typ, _ = im.select(folder, readonly=True)
        if typ != "OK":
            raise RuntimeError(f"เปิดโฟลเดอร์ {folder} ไม่ได้")
        validity = response_value(im, "UIDVALIDITY")
        uidnext = response_value(im, "UIDNEXT")
        next_uid = int(uidnext) if uidnext.isdigit() else None
        state = load_state(state_path)

        # ตำแหน่งที่จำไว้ต้องมาจากกล่องเดียวกันเป๊ะ — Gmail ให้ UIDVALIDITY เป็น 1 แทบทุกกล่อง
        # เช็กแค่ตัวนั้นไม่พอ ถ้าไฟล์ state มาจากบัญชีอื่นที่ UID สูงกว่า อีเมลจริงจะถูกกรองทิ้งหมด
        usable = (
            state is not None
            and state.get("mailbox") == mailbox
            and state["uidvalidity"] == validity
            and (next_uid is None or state["last_uid"] < next_uid)
        )
        if usable:
            last = state["last_uid"]
            _, data = im.uid("SEARCH", None, "UID", f"{last + 1}:*")
            # "N:*" คืนฉบับล่าสุดมาด้วยเสมอแม้ UID น้อยกว่า N (ตอนไม่มีฉบับใหม่) ต้องกรองเอง
            uids = [u for u in parse_uids(data) if u > last]
        else:
            if state:
                log("ตำแหน่งที่จำไว้ใช้กับกล่องนี้ไม่ได้ (เปลี่ยนบัญชี/โฟลเดอร์ หรือกล่องถูกสร้างใหม่) — เริ่มนับใหม่")
            since = imap_date((today or date.today()) - timedelta(days=since_days))
            _, data = im.uid("SEARCH", None, "SINCE", since)
            uids = parse_uids(data)
            # ช่วงนั้นไม่มีอีเมลเลย = จำตำแหน่งปัจจุบันไว้ รอบหน้าจะได้ไม่ไล่ทั้งกล่อง
            last = uids[0] - 1 if uids else (next_uid - 1 if next_uid else 0)

        start = last
        listed = 0
        for uid in uids:
            try:
                outcome = process_uid(im, uid, cfg, sender, dry_run=dry_run, post=post)
            except (imaplib.IMAP4.abort, OSError):
                raise  # การเชื่อมต่อพัง ไม่ใช่ความผิดของอีเมลฉบับนี้ — จบรอบ รอบหน้าต่อที่เดิม
            except Exception as e:  # noqa: BLE001
                log(f"  UID {uid} ใช้ไม่ได้: {type(e).__name__}: {e}")
                outcome = RETRY

            if dry_run:
                listed += outcome == LISTED
                continue  # ลองอ่านไม่จำตำแหน่ง ไม่นับครั้ง — แสดงให้ครบทุกฉบับ
            if outcome == BLOCKED:
                log("  หยุดรอ — ติดที่การตั้งค่าหรือเน็ต ไม่ใช่ที่อีเมล ไม่ข้ามฉบับไหน แก้แล้วจะส่งต่อเอง")
                break
            if outcome == RETRY:
                attempts[uid] = attempts.get(uid, 0) + 1
                if attempts[uid] < MAX_ATTEMPTS:
                    break  # ไม่ขยับ — รอบหน้าเริ่มที่ฉบับนี้ใหม่
                log(f"  ข้าม UID {uid} หลังลองไม่ผ่าน {MAX_ATTEMPTS} รอบ — เปิดดูฉบับนี้เองใน Gmail")
            attempts.pop(uid, None)
            last = uid
            if outcome != OTHER:
                save_state(state_path, mailbox, validity, last)

        if dry_run:
            log(f"ลองอ่าน: อีเมลใหม่ {len(uids)} ฉบับ ตรงผู้ส่ง \"{sender or '*'}\" {listed} ฉบับ (ไม่ได้ส่งอะไรเข้าเว็บ)")
            return
        if last != start or not usable:
            save_state(state_path, mailbox, validity, last)


def main() -> None:
    use_utf8_output()
    p = argparse.ArgumentParser(description="QVX broker mail bot")
    p.add_argument("--env", default=r"C:\QVXMail\mail.env")
    p.add_argument("--interval", type=int, default=120, help="วินาทีต่อรอบ (0 = รันรอบเดียวแล้วจบ)")
    p.add_argument("--since-days", type=int, default=7, help="รอบแรกย้อนอ่านกี่วัน")
    p.add_argument("--dry-run", action="store_true", help="แค่แสดงว่าจะส่งอะไร ไม่ส่งเข้าเว็บ ไม่จำตำแหน่ง")
    args = p.parse_args()

    state_path = os.path.join(os.path.dirname(os.path.abspath(args.env)), "mailbot.state.json")
    started = False
    while True:
        # อ่านใหม่ทุกรอบ — เปลี่ยนรหัสแอปหรือค่าอื่นใน mail.env แล้วมีผลรอบถัดไป ไม่ต้องรีสตาร์ต
        cfg = read_config(args.env)
        missing = [k for k in REQUIRED if not cfg.get(k)]
        if missing:
            log(f"FATAL: ยังไม่ได้ตั้ง {', '.join(missing)} ใน {args.env}")
            sys.exit(2)
        if not started:
            log(
                f"mailbot เริ่มทำงาน · {cfg['IMAP_USER']} · ผู้ส่งที่มีคำว่า \"{cfg.get('SENDER_FILTER') or '*'}\""
                f" · ทุก {args.interval} วินาที{' · ลองอ่าน' if args.dry_run else ''}"
            )
            started = True
        try:
            run_once(cfg, state_path, since_days=args.since_days, dry_run=args.dry_run)
        except Exception as e:  # noqa: BLE001
            # ล้มรอบเดียวไม่ควรทำให้บอทตาย เน็ตหลุด/IMAP งอแงเกิดได้
            log(f"รอบนี้ล้มเหลว: {type(e).__name__}: {e}")
            if args.interval <= 0:
                sys.exit(1)
        if args.interval <= 0:
            return
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
