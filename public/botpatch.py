# -*- coding: utf-8 -*-
"""
botpatch.py - แก้ tlapi.py + tv_bridge.py ให้ส่งภาพหลักฐานสิทธิ์กลับเว็บ

ปลอดภัยสามชั้น:
  1. สำรองไฟล์เดิมก่อนเสมอ (.bak-proof) ไม่ทับของเก่าถ้ามีอยู่แล้ว
  2. ตรวจ ast.parse ก่อนเขียนทับ ถ้า python อ่านไม่ออกจะไม่แตะไฟล์เลย
  3. รันซ้ำได้ ถ้าเจอ marker PROOF_V1 แล้วจะข้าม ไม่แทรกซ้ำ

ยึดจุดแทรกด้วย "ข้อความในโค้ด" ไม่ใช่เลขบรรทัด และบังคับว่าต้องเจอครั้งเดียว
เท่านั้น เจอศูนย์หรือหลายครั้ง = ไม่แตะไฟล์นั้นเลย

print ทั้งหมดเป็น ASCII ล้วน คอนโซลเครื่องนี้เป็น cp874 พิมพ์ไทยแล้วเคยตาย
"""

import ast
import os
import re
import shutil

BOT_DIR = r"C:\BotTV"
MARK = "PROOF_V1"

# ---------------------------------------------------------------- tlapi.py

# import แบบกันพัง: ถ้า tvshot.py หาย บอทต้องยังทำงานได้เหมือนเดิม
# ไม่ใช่ import ตรง ๆ แล้วทำให้ทั้งโมดูลโหลดไม่ขึ้น = บอทตายทั้งตัว
TLAPI_IMPORT = '''
# PROOF_V1 - screenshot proof of granted access
try:
    from tvshot import capture_access_proof_b64
except Exception as _tvshot_err:  # missing tvshot must not kill the bot
    capture_access_proof_b64 = None
    print("tvshot: import failed:", _tvshot_err)

# Proof of the latest grant, read and cleared by tv_bridge.
# Keyed by username on purpose: a stale image can then never be handed
# to the wrong customer, no matter how the calling code is ordered.
LAST_PROOF = {"username": None, "b64": None}
'''

TLAPI_ANCHOR = 'print("EXPIRY_OK"'

TLAPI_BODY = '''{i}# PROOF_V1
{i}if capture_access_proof_b64:
{i}    try:
{i}        LAST_PROOF["username"] = username
{i}        LAST_PROOF["b64"] = capture_access_proof_b64(driver, username)
{i}    except Exception as _proof_err:
{i}        LAST_PROOF["username"] = username
{i}        LAST_PROOF["b64"] = None
{i}        print("tvshot: capture failed:", _proof_err)'''

# ------------------------------------------------------------ tv_bridge.py

TVB_ANCHOR = '"error": error,'

TVB_BODY = '''{i}# PROOF_V1 - one shot, and only if captured for this very username
{i}"proof": (getattr(tlapi, "LAST_PROOF", {{}}).pop("b64", None)
{i}          if getattr(tlapi, "LAST_PROOF", {{}}).get("username") == username
{i}          else None),'''


def indent_of(line):
    return line[: len(line) - len(line.lstrip())]


def load(name):
    path = os.path.join(BOT_DIR, name)
    if not os.path.exists(path):
        print("  !! NOT FOUND:", path)
        return None, None
    return path, open(path, encoding="utf-8").read()


def save(path, text):
    """ตรวจว่ายัง parse ได้ก่อนเขียน ไม่ผ่าน = ไม่แตะไฟล์"""
    try:
        ast.parse(text)
    except SyntaxError as e:
        print("  !! result would not parse -> file left untouched:", e)
        return False
    bak = path + ".bak-proof"
    if not os.path.exists(bak):
        shutil.copy2(path, bak)
        print("  backup:", bak)
    else:
        print("  backup already exists, kept:", bak)
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("  WRITTEN:", path)
    return True


def find_one(lines, needle):
    """ต้องเจอครั้งเดียวเท่านั้น ไม่งั้นถือว่าไม่ปลอดภัยพอจะแก้อัตโนมัติ"""
    hits = [i for i, l in enumerate(lines) if needle in l]
    if len(hits) != 1:
        print("  !! anchor %r found %d times (need exactly 1) -> skip"
              % (needle, len(hits)))
        return None
    return hits[0]


def patch_tlapi():
    print("")
    print("=== tlapi.py ===")
    path, text = load("tlapi.py")
    if text is None:
        return False
    if MARK in text:
        print("  already patched, nothing to do")
        return True

    lines = text.split("\n")
    anchor = find_one(lines, TLAPI_ANCHOR)
    if anchor is None:
        return False

    # จุดจบของบล็อก import ด้านบนไฟล์ - แทรกต่อท้ายบรรทัด import สุดท้าย
    imports = [i for i in range(min(60, len(lines)))
               if re.match(r"^(import |from )", lines[i])]
    if not imports:
        print("  !! no import block found -> skip")
        return False
    last_import = imports[-1]

    ind = indent_of(lines[anchor])
    print("  anchor line %d, indent %d spaces" % (anchor + 1, len(ind)))

    # แทรกจากล่างขึ้นบน เลขบรรทัดด้านบนจะได้ไม่เลื่อน
    lines[anchor + 1:anchor + 1] = TLAPI_BODY.format(i=ind).split("\n")
    lines[last_import + 1:last_import + 1] = TLAPI_IMPORT.split("\n")
    return save(path, "\n".join(lines))


def patch_bridge():
    print("")
    print("=== tv_bridge.py ===")
    path, text = load("tv_bridge.py")
    if text is None:
        return False
    if MARK in text:
        print("  already patched, nothing to do")
        return True

    lines = text.split("\n")
    anchor = find_one(lines, TVB_ANCHOR)
    if anchor is None:
        return False

    # ต้องมีชื่อโมดูล tlapi ผูกไว้ ไฟล์นี้ import แค่ชื่อฟังก์ชันมา
    has_module = any(re.match(r"^import tlapi\b", l) for l in lines)
    from_line = next((i for i, l in enumerate(lines)
                      if re.match(r"^from tlapi import", l)), None)
    if not has_module and from_line is None:
        print("  !! no 'import tlapi' and no 'from tlapi import' -> skip")
        return False

    ind = indent_of(lines[anchor])
    print("  anchor line %d, indent %d spaces" % (anchor + 1, len(ind)))
    print("  module name bound already:", has_module)

    lines[anchor + 1:anchor + 1] = TVB_BODY.format(i=ind).split("\n")
    if not has_module:
        lines[from_line:from_line] = ["import tlapi  # PROOF_V1"]
    return save(path, "\n".join(lines))


print("botpatch - backs up, verifies, and can be re-run safely")
ok_a = patch_tlapi()
ok_b = patch_bridge()

print("")
print("=" * 60)
if ok_a and ok_b:
    print("RESULT: both files ready")
    print("Next: restart the bot bridge, then run one test grant")
else:
    print("RESULT: NOT complete - see the !! lines above")
    print("Nothing is half written: each file is fully patched or untouched")
print("Rollback: copy the .bak-proof file back over the original")
