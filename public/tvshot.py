# -*- coding: utf-8 -*-
"""
tvshot.py - แคปกล่อง "Manage access" ของ TradingView เป็นหลักฐานยืนยันสิทธิ์

ใช้คู่กับ tlapi.py: เรียกตอนที่ driver ยืนอยู่บนกล่อง Manage access แล้ว
(คือจุดเดียวกับที่ add_indicator_access พิมพ์ EXPIRY_OK ออกมา)

ทำไมต้องมีไฟล์นี้ ทั้งที่ renew_indicator_access ก็แคปได้อยู่แล้ว:
  1. โค้ดเดิมหากล่องด้วย //div[contains(@class,'dialog-')] - TradingView ใช้ CSS
     module ชื่อ hash (เช็คของจริงวันนี้: menuWrap-lBIxIwtz, button-XNUivTou)
     XPath นั้นแมตช์หลายกล่องและ find_element คืนตัวแรกในเอกสาร ซึ่งอาจเป็น
     กล่องที่ซ่อนอยู่ -> ได้ภาพเปล่า. ที่นี่ยึด role='dialog' + data-name แทน
  2. โค้ดเดิมแคปทั้งรายการ = ลูกค้าทุกคนเห็น username + วันหมดอายุของกันและกัน
     ที่นี่กรองให้เหลือคนเดียวก่อนแคป
  3. element.screenshot() ตัดตามที่เห็นใน viewport ถ้ากล่องสูงกว่าจอจะได้ภาพแหว่ง
     ที่นี่ใช้ CDP + captureBeyondViewport + scale 2 (ภาพคมกว่าเดิมเท่าตัว)
"""

import base64
import time

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# ปุ่มกากบาทท้ายแถวในรายการผู้มีสิทธิ์ - data-name ของ TradingView อยู่ทน
# กว่าชื่อคลาส (tlapi.py เดิมก็พึ่ง attribute ตัวนี้อยู่แล้วและยังใช้ได้)
ROW_REMOVE_BTN = "span[data-name='manage-access-dialog-item-remove-button']"


def _dialog(driver, timeout=15):
    """กล่อง Manage access ตัวที่มองเห็นจริง ไม่ใช่ตัวแรกใน DOM"""
    wait = WebDriverWait(driver, timeout)
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "div[role='dialog']")))
    for d in driver.find_elements(By.CSS_SELECTOR, "div[role='dialog']"):
        if d.is_displayed() and d.size["height"] > 200:
            return d
    return driver.find_element(By.CSS_SELECTOR, "div[role='dialog']")


def _filter_to_user(driver, username):
    """พิมพ์ username ในช่องค้นหาของกล่อง ให้เหลือแถวเดียว

    คืน True ถ้ากรองแล้วเหลือแถวที่ตรงกับ username จริง
    """
    dlg = _dialog(driver)
    boxes = [b for b in dlg.find_elements(By.CSS_SELECTOR, "input[role='searchbox']")
             if b.is_displayed()]
    if not boxes:
        return False
    box = boxes[-1]  # แท็บ "ผู้ใช้ที่มีสิทธิ์" ใช้ช่องล่าง ไม่ใช่ช่องเพิ่มผู้ใช้ใหม่
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", box)
    box.clear()
    box.send_keys(username)
    time.sleep(2.5)

    rows = [r.get_attribute("data-username") or ""
            for r in dlg.find_elements(By.CSS_SELECTOR, "[data-username]")]
    rows = [r.strip().lower() for r in rows if r.strip()]
    return rows == [username.strip().lower()]


def capture_access_proof(driver, username, path="access_proof.png", filter_user=True):
    """แคปกล่อง Manage access -> เขียนไฟล์ PNG -> คืน bytes

    filter_user=True  : กรองให้เหลือลูกค้าคนเดียวก่อนแคป (ปลอดภัยเวลาส่งเข้ากลุ่ม)
    filter_user=False : แคปทั้งรายการ (ใช้ดูเองตอนดีบักเท่านั้น อย่าส่งให้ลูกค้า)
    """
    driver.set_window_size(1400, 1000)
    time.sleep(1.2)  # ให้กล่อง reflow หลังเปลี่ยนขนาดหน้าต่าง

    filtered = False
    if filter_user:
        try:
            filtered = _filter_to_user(driver, username)
        except Exception as e:
            print("tvshot: filter failed:", e)
        if not filtered:
            # กรองไม่สำเร็จ = ภาพจะมี username ของลูกค้าคนอื่นติดไปด้วย
            # ยอมไม่ได้ถ้าจะส่งเข้ากลุ่ม จึงหยุดตรงนี้แทนที่จะส่งภาพที่หลุดข้อมูล
            print("tvshot: SKIP - filter did not narrow to one row; not capturing (would leak other customers)")
            return None

    dlg = _dialog(driver)
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", dlg)
    time.sleep(0.4)

    png = None
    try:
        rect = driver.execute_script(
            "const r = arguments[0].getBoundingClientRect();"
            "return {x: r.x + scrollX, y: r.y + scrollY,"
            " width: r.width, height: r.height};",
            dlg,
        )
        shot = driver.execute_cdp_cmd(
            "Page.captureScreenshot",
            {
                "format": "png",
                "captureBeyondViewport": True,
                "clip": {
                    "x": rect["x"], "y": rect["y"],
                    "width": rect["width"], "height": rect["height"],
                    "scale": 2,  # 2 เท่า -> อ่านวันหมดอายุออกชัดบนมือถือ
                },
            },
        )
        png = base64.b64decode(shot["data"])
    except Exception as e:
        print("tvshot: CDP failed, fallback element.screenshot:", e)
        dlg.screenshot(path)
        with open(path, "rb") as f:
            png = f.read()

    if png:
        with open(path, "wb") as f:
            f.write(png)
        print("tvshot: OK", username, len(png), "bytes ->", path)
    return png


def capture_access_proof_b64(driver, username, **kw):
    """เวอร์ชันที่คืน base64 - เอาไปยัดใส่ callback ของ tv_bridge ได้เลย"""
    png = capture_access_proof(driver, username, **kw)
    return base64.b64encode(png).decode("ascii") if png else None
