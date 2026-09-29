"""
เทสต์บอทอ่านเมล — รัน: python -m unittest scripts/broker/test_mailbot.py

ใช้กล่องจดหมายจำลอง ไม่ต่อ Gmail จริง ไม่ยิงเว็บจริง
"""
from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import unittest
from datetime import date, datetime, timezone
from email.message import EmailMessage
from email.utils import format_datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mailbot  # noqa: E402

TODAY = date(2026, 9, 30)
CFG = {
    "IMAP_HOST": "imap.example.com",
    "IMAP_USER": "bot@example.com",
    "IMAP_PASSWORD": "x",
    "SENDER_FILTER": "wisdom",
    "SITE": "https://example.com",
    "BROKER_MAIL_SECRET": "s",
}
MAILBOX = "bot@example.com/INBOX"


def make_mail(sender: str, subject: str, when: datetime, body: str = "Account: 123456") -> bytes:
    m = EmailMessage()
    m["From"] = sender
    m["Subject"] = subject
    m["Date"] = format_datetime(when)
    m["Message-ID"] = f"<{abs(hash((sender, subject, when)))}@example.com>"
    m.set_content(body)
    return bytes(m)


class FakeImap:
    """พอให้ run_once ทำงานได้ — จำลองนิสัยของ Gmail ที่ "N:*" คืนฉบับล่าสุดเสมอ"""

    def __init__(self, mails, validity="1", uidnext=None, broken=()):
        self.mails = mails
        self.validity = validity
        self.uidnext = uidnext if uidnext is not None else (max(mails) + 1 if mails else 1)
        self.broken = set(broken)  # UID ที่เซิร์ฟเวอร์ตอบ NO ตอน FETCH
        self.readonly = None
        self.commands: list[tuple] = []

    def __call__(self, host):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def login(self, user, pwd):
        return "OK", [b"logged in"]

    def select(self, folder, readonly=False):
        self.readonly = readonly
        return "OK", [str(len(self.mails)).encode()]

    def response(self, code):
        value = {"UIDVALIDITY": self.validity, "UIDNEXT": str(self.uidnext)}.get(code)
        return code, [value.encode() if value else None]

    def uid(self, command, *args):
        self.commands.append((command, *args))
        if command == "SEARCH":
            kind, value = args[1], args[2]
            if kind == "UID":
                low = int(value.split(":")[0])
                found = [u for u in self.mails if u >= low] or ([max(self.mails)] if self.mails else [])
            else:  # SINCE
                since = datetime.strptime(value, "%d-%b-%Y").date()
                found = [u for u, (d, _) in self.mails.items() if d >= since]
            return "OK", [" ".join(str(u) for u in sorted(found)).encode()]
        if command == "FETCH":
            uid = int(args[0])
            if uid in self.broken:
                return "NO", [b"Some messages could not be FETCHed"]
            raw = self.mails[uid][1]
            if "HEADER.FIELDS" in args[1]:
                raw = raw.split(b"\n\n", 1)[0] + b"\n\n"
            return "OK", [(f"{uid} (BODY[] {{{len(raw)}}}".encode(), raw), b")"]
        raise AssertionError(f"ไม่ควรมีคำสั่ง {command} — บอทต้องไม่แก้อะไรในกล่อง")


class Poster:
    def __init__(self, outcomes=None):
        self.sent: list[dict] = []
        self.outcomes = outcomes or {}  # หัวข้อ -> ผลที่จะตอบ

    def __call__(self, cfg, payload):
        outcome = self.outcomes.get(payload["subject"], mailbot.SENT)
        if outcome == mailbot.SENT:
            self.sent.append(payload)
        return outcome


def at(day: int, hour: int) -> datetime:
    return datetime(2026, 9, day, hour, 0, tzinfo=timezone.utc)


def mailbox():
    return {
        10: (date(2026, 9, 1), make_mail("Old <old@wisdomtrade.com>", "old", at(1, 3))),
        11: (date(2026, 9, 28), make_mail("Wisdom <noreply@wisdomtrade.com>", "New client", at(28, 3))),
        12: (date(2026, 9, 28), make_mail("Shop <ads@shop.com>", "Sale", at(28, 4))),
        13: (date(2026, 9, 29), make_mail("Wisdom <noreply@wisdomtrade.com>", "Deposit", at(29, 5))),
    }


class RunOnceTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.state = os.path.join(self.dir.name, "mailbot.state.json")

    def tearDown(self):
        self.dir.cleanup()

    def run_bot(self, imap, poster, **kw):
        mailbot.run_once(CFG, self.state, connect=imap, post=poster, attempts=kw.pop("attempts", {}), today=TODAY, **kw)

    def saved(self):
        with open(self.state, encoding="utf-8") as f:
            return json.load(f)

    def test_first_run_reads_window_and_sends_only_broker_mail(self):
        poster = Poster()
        self.run_bot(FakeImap(mailbox()), poster, since_days=7)
        self.assertEqual([p["subject"] for p in poster.sent], ["New client", "Deposit"])
        self.assertEqual(self.saved(), {"mailbox": MAILBOX, "uidvalidity": "1", "last_uid": 13})

    def test_mailbox_opened_readonly_and_never_modified(self):
        imap = FakeImap(mailbox())
        self.run_bot(imap, Poster())
        self.assertTrue(imap.readonly)
        self.assertTrue(all(c[0] in ("SEARCH", "FETCH") for c in imap.commands))
        self.assertTrue(all("PEEK" in c[2] for c in imap.commands if c[0] == "FETCH"))

    def test_next_run_sends_only_new_mail(self):
        mails = mailbox()
        self.run_bot(FakeImap(mails), Poster())
        mails[14] = (date(2026, 9, 30), make_mail("Wisdom <noreply@wisdomtrade.com>", "Withdraw", at(30, 1)))
        poster = Poster()
        self.run_bot(FakeImap(mails), poster)
        self.assertEqual([p["subject"] for p in poster.sent], ["Withdraw"])

    def test_gmail_returns_latest_mail_even_when_nothing_new(self):
        self.run_bot(FakeImap(mailbox()), Poster())
        poster = Poster()
        self.run_bot(FakeImap(mailbox()), poster)
        self.assertEqual(poster.sent, [])

    def test_retry_keeps_position_and_sends_next_round(self):
        mails = mailbox()
        self.run_bot(FakeImap(mails), Poster({"Deposit": mailbot.RETRY}))
        self.assertEqual(self.saved()["last_uid"], 12)
        poster = Poster()
        self.run_bot(FakeImap(mails), poster)
        self.assertEqual([p["subject"] for p in poster.sent], ["Deposit"])
        self.assertEqual(self.saved()["last_uid"], 13)

    def test_retry_that_never_succeeds_is_skipped_eventually(self):
        attempts = {13: mailbot.MAX_ATTEMPTS - 1}
        self.run_bot(FakeImap(mailbox()), Poster({"Deposit": mailbot.RETRY}), attempts=attempts)
        self.assertEqual(self.saved()["last_uid"], 13)
        self.assertNotIn(13, attempts)

    def test_blocked_never_skips_mail_no_matter_how_long(self):
        # secret ไม่ตรง / เว็บยังไม่เปิดรับ — อีเมลทุกฉบับโดนเหมือนกัน ข้ามไป = หายหมด
        attempts = {13: mailbot.MAX_ATTEMPTS + 50}
        self.run_bot(FakeImap(mailbox()), Poster({"Deposit": mailbot.BLOCKED}), attempts=attempts)
        self.assertEqual(self.saved()["last_uid"], 12)
        self.assertEqual(attempts[13], mailbot.MAX_ATTEMPTS + 50)

    def test_rejected_mail_is_skipped_at_once(self):
        poster = Poster({"New client": mailbot.REJECTED})
        self.run_bot(FakeImap(mailbox()), poster)
        self.assertEqual([p["subject"] for p in poster.sent], ["Deposit"])
        self.assertEqual(self.saved()["last_uid"], 13)

    def test_unreadable_mail_is_retried_then_skipped(self):
        imap = FakeImap(mailbox(), broken={11})
        self.run_bot(imap, Poster())
        self.assertEqual(self.saved()["last_uid"], 10)
        poster = Poster()
        self.run_bot(FakeImap(mailbox(), broken={11}), poster, attempts={11: mailbot.MAX_ATTEMPTS - 1})
        self.assertEqual([p["subject"] for p in poster.sent], ["Deposit"])

    def test_odd_header_bytes_do_not_stop_the_round(self):
        mails = mailbox()
        raw = mails[11][1].replace(b"Message-ID: <", b"Message-ID: <\xe0\xb8\x81")
        mails[11] = (mails[11][0], raw)
        poster = Poster()
        self.run_bot(FakeImap(mails), poster)
        self.assertEqual([p["subject"] for p in poster.sent], ["New client", "Deposit"])

    def test_dry_run_sends_nothing_and_remembers_nothing(self):
        poster = Poster()
        self.run_bot(FakeImap(mailbox()), poster, dry_run=True)
        self.assertEqual(poster.sent, [])
        self.assertFalse(os.path.exists(self.state))

    def test_uidvalidity_change_starts_over_from_window(self):
        mailbot.save_state(self.state, MAILBOX, "old", 11)
        poster = Poster()
        self.run_bot(FakeImap(mailbox(), validity="2"), poster)
        self.assertEqual([p["subject"] for p in poster.sent], ["New client", "Deposit"])
        self.assertEqual(self.saved()["uidvalidity"], "2")

    def test_state_from_another_mailbox_is_not_trusted(self):
        # Gmail ให้ UIDVALIDITY = 1 แทบทุกกล่อง — ไฟล์ state จากบัญชีอื่นที่ UID สูง ๆ จะกรองอีเมลจริงทิ้งหมด
        mailbot.save_state(self.state, "other@example.com/INBOX", "1", 5000)
        poster = Poster()
        self.run_bot(FakeImap(mailbox()), poster)
        self.assertEqual([p["subject"] for p in poster.sent], ["New client", "Deposit"])

    def test_position_beyond_mailbox_end_is_not_trusted(self):
        mailbot.save_state(self.state, MAILBOX, "1", 5000)
        poster = Poster()
        self.run_bot(FakeImap(mailbox()), poster)
        self.assertEqual([p["subject"] for p in poster.sent], ["New client", "Deposit"])

    def test_empty_window_remembers_current_position(self):
        self.run_bot(FakeImap({10: mailbox()[10]}, uidnext=500), Poster())
        self.assertEqual(self.saved(), {"mailbox": MAILBOX, "uidvalidity": "1", "last_uid": 499})


class PayloadTest(unittest.TestCase):
    def parse(self, raw: bytes):
        return mailbot.email.message_from_bytes(raw)

    def test_received_at_is_utc_with_z(self):
        # เว็บตรวจด้วย z.string().datetime() ซึ่งไม่รับ +07:00 — ส่งผิดรูปแบบ = 400 = อีเมลถูกข้าม
        raw = make_mail("Wisdom <a@wisdomtrade.com>", "x", datetime(2026, 9, 29, 17, 30, tzinfo=timezone.utc))
        self.assertEqual(mailbot.received_at(self.parse(raw)), "2026-09-29T17:30:00Z")

    def test_minus_zero_zone_means_utc_not_local_time(self):
        msg = self.parse(b"Date: Tue, 29 Sep 2026 10:00:00 -0000\nSubject: x\n\nhi")
        self.assertEqual(mailbot.received_at(msg), "2026-09-29T10:00:00Z")

    def test_missing_or_broken_date_is_none(self):
        self.assertIsNone(mailbot.received_at(self.parse(b"Subject: x\n\nhi")))
        self.assertIsNone(mailbot.received_at(self.parse(b"Date: not a date\nSubject: x\n\nhi")))

    def test_long_headers_are_cut_to_what_the_site_accepts(self):
        raw = make_mail("Wisdom <a@wisdomtrade.com>", "ก" * 2000, datetime(2026, 9, 29, tzinfo=timezone.utc))
        payload = mailbot.build_payload(self.parse(raw))
        self.assertLessEqual(len(payload["subject"]), mailbot.MAX_SUBJECT)
        self.assertLessEqual(len(payload["from"]), mailbot.MAX_FROM)

    def test_imap_date_uses_english_month(self):
        self.assertEqual(mailbot.imap_date(date(2026, 9, 1)), "01-Sep-2026")


class ConfigTest(unittest.TestCase):
    def test_inline_comment_is_not_part_of_the_value(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "mail.env")
            with open(path, "w", encoding="utf-8") as f:
                f.write("SENDER_FILTER=wisdom   # ส่งเฉพาะอีเมลจาก Wisdom\nIMAP_USER=a@b.com\n# คอมเมนต์ทั้งบรรทัด\n")
            env = mailbot.load_env(path)
        self.assertEqual(env, {"SENDER_FILTER": "wisdom", "IMAP_USER": "a@b.com"})


class OutputTest(unittest.TestCase):
    def test_log_survives_thai_windows_codepage(self):
        raw = io.BytesIO()
        fake = io.TextIOWrapper(raw, encoding="cp874")
        old = sys.stdout
        sys.stdout = fake
        try:
            mailbot.use_utf8_output()
            mailbot.log("mailbot เริ่มทำงาน · 🎉")
            sys.stdout.flush()
        finally:
            sys.stdout = old
        self.assertIn("· 🎉".encode("utf-8"), raw.getvalue())


if __name__ == "__main__":
    unittest.main()
