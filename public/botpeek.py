# -*- coding: utf-8 -*-
"""
botpeek.py - อ่านอย่างเดียว ไม่แก้ไฟล์ไหนเลย

พิมพ์โครงสร้างรอบ ๆ จุดที่ต้อง patch ออกมาดู เพื่อเขียน patch ให้ตรงของจริง
แทนที่จะเดาแล้วแก้ทับบอทที่กำลังใช้งานอยู่

กันพลาดสองอย่างที่เคยเจอมาแล้ว:
  1. ตัวหนังสือไทยถูกแปลงเป็น "." ก่อนพิมพ์ - คอนโซลเครื่องบอทเป็น cp874
     พิมพ์ไทยตรง ๆ เคยทำ python ตาย (โครงสร้างโค้ดเป็น ASCII อยู่แล้ว)
  2. สตริงยาว >= 20 ตัวถูกเซ็นเซอร์ - กัน secret/token ติดออกมาตอนก๊อปให้คนอื่นดู
"""

import ast
import os
import re

BOT_DIR = r"C:\BotTV"
TOKEN_RE = re.compile(r"[A-Za-z0-9_\-]{20,}")


def safe(line):
    """ASCII ล้วน + เซ็นเซอร์สตริงยาว"""
    line = TOKEN_RE.sub(lambda m: "<REDACTED:%d>" % len(m.group()), line)
    return "".join(c if 32 <= ord(c) < 127 else "." for c in line.rstrip("\n"))


def read(fname):
    path = os.path.join(BOT_DIR, fname)
    print("")
    print("=" * 68)
    print("FILE:", path)
    if not os.path.exists(path):
        print("  !! NOT FOUND")
        return None
    print("  bytes:", os.path.getsize(path))
    try:
        return open(path, encoding="utf-8", errors="replace").read().split("\n")
    except Exception as e:
        print("  !! read failed:", e)
        return None


def show(lines, pattern, before=4, after=10, limit=2):
    rx = re.compile(pattern)
    hits = [i for i, l in enumerate(lines) if rx.search(l)]
    print("")
    print("  --- %r : %d hit(s) ---" % (pattern, len(hits)))
    if not hits:
        print("      (none)")
        return
    for i in hits[:limit]:
        for n in range(max(0, i - before), min(len(lines), i + after + 1)):
            print("   %s %5d | %s" % (">>" if n == i else "  ", n + 1, safe(lines[n])))
        print("      ...")


print("botpeek - READ ONLY, nothing is modified")

# 1) tvshot.py มาถึงครบไหม และ python อ่านออกไหม
tv = os.path.join(BOT_DIR, "tvshot.py")
print("")
print("tvshot.py present :", os.path.exists(tv))
if os.path.exists(tv):
    print("tvshot.py bytes   :", os.path.getsize(tv), "(expected 7047)")
    try:
        ast.parse(open(tv, encoding="utf-8").read())
        print("tvshot.py syntax  : OK")
    except Exception as e:
        print("tvshot.py syntax  : FAILED ->", e)

# 2) tlapi.py - จุดแทรกการแคปภาพ (หลัง EXPIRY_OK) และ import ด้านบน
lines = read("tlapi.py")
if lines:
    show(lines, r"EXPIRY_OK", before=2, after=6, limit=2)
    show(lines, r"^(import |from )", before=0, after=0, limit=1)
    print("")
    print("  --- import block (first 25 lines) ---")
    for n in range(min(25, len(lines))):
        print("   %5d | %s" % (n + 1, safe(lines[n])))

# 3) tv_bridge.py - จุดประกอบ payload ส่ง callback กลับเว็บ (ไฟล์นี้ไม่มีใน repo)
lines = read("tv_bridge.py")
if lines:
    show(lines, r"callback", before=4, after=12, limit=2)
    show(lines, r"[\"']ok[\"']\s*:", before=6, after=8, limit=2)
    show(lines, r"^(import |from )", before=0, after=0, limit=1)

print("")
print("done - copy everything above and send it back")
