import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
import asyncio
from telegram.ext import Application, CommandHandler
from telegram import Update
from datetime import datetime, timedelta
from telegram.ext import ContextTypes
from selenium.webdriver.common.keys import Keys
import os
import shutil
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import aiohttp
import json

# ---------------------------------------------------------------------------
# ตั้งค่าจาก environment (เดิมค่าพวกนี้ฝังอยู่ในโค้ด ทำให้เปลี่ยนบัญชีทีต้องไล่แก้หลายจุด)
# ---------------------------------------------------------------------------

# บัญชี TradingView ที่เป็นเจ้าของสคริปต์ invite-only
TV_PROFILE_USERNAME = os.getenv("TV_PROFILE_USERNAME", "")
if not TV_PROFILE_USERNAME:
    raise SystemExit("❌ ยังไม่ได้ตั้ง TV_PROFILE_USERNAME (บัญชี TradingView เจ้าของสคริปต์) ใน .env")
TV_PROFILE_URL = f"https://www.tradingview.com/u/{TV_PROFILE_USERNAME}/#published-scripts"

# โฟลเดอร์โปรไฟล์ Chrome ที่ล็อกอิน TradingView ค้างไว้
# ค่าเริ่มต้นเป็นพาธของ Windows — บน macOS/Linux ต้องตั้ง CHROME_USER_DATA_DIR เอง
CHROME_USER_DATA_DIR = os.getenv(
    "CHROME_USER_DATA_DIR",
    os.path.expanduser("~") + "/AppData/Local/Google/Chrome/User Data",
)
CHROME_PROFILE_DIR = os.getenv("CHROME_PROFILE_DIR", "Default")

# --remote-debugging-port=9222 ที่โค้ดเดิมใส่ไว้ ทำให้ Chrome 151 crash ทันทีที่เปิด
# (ทดสอบแล้ว: ตัดออก = เปิดได้ปกติ · ใส่ไว้ = session not created ทุกครั้ง)
# เปิดใช้ได้ด้วย CHROME_DEBUG_PORT ถ้าจำเป็นต้อง attach debugger จริง ๆ
CHROME_DEBUG_PORT = os.getenv("CHROME_DEBUG_PORT", "")

# ไม่ต้องเด้งหน้าต่างขึ้นมาบนเครื่องที่มีคนใช้อยู่ (ทดสอบแล้วว่าล็อกอินติดเหมือนกัน)
CHROME_HEADLESS = os.getenv("CHROME_HEADLESS", "").lower() in ("1", "true", "yes")

async def send_to_api(action, indicator_name, username, expiry_date=None, telegram_user=None):
    """
    ส่งข้อมูลไปยัง API
    action: 'add', 'renew', หรือ 'delete'
    """
    api_url = "http://your-api-url.com/api/indicator-access"  # แก้ไข URL ตามที่คุณใช้
    
    # สร้าง payload
    payload = {
        "action": action,
        "indicator_name": indicator_name,
        "username": username,
        "timestamp": datetime.now().isoformat()
    }
    
    # เพิ่มวันหมดอายุถ้ามี
    if expiry_date:
        payload["expiry_date"] = expiry_date
    
    # เพิ่มข้อมูลผู้ใช้ Telegram ถ้ามี
    if telegram_user:
        payload["telegram_user"] = {
            "id": telegram_user.id,
            "username": telegram_user.username,
            "first_name": telegram_user.first_name,
            "last_name": telegram_user.last_name
        }
    
    try:
        # เพิ่ม header สำหรับ authentication ถ้าจำเป็น
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer YOUR_API_KEY"  # แก้ไข API key ตามที่คุณใช้
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(api_url, json=payload, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    print(f"✅ ส่งข้อมูลไป API สำเร็จ: {result}")
                    return True, result
                else:
                    error_text = await response.text()
                    print(f"❌ ส่งข้อมูลไป API ไม่สำเร็จ: {response.status} - {error_text}")
                    return False, error_text
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาดในการส่งข้อมูลไป API: {e}")
        return False, str(e)

async def add_indicator_access(indicator_name: str, username: str, expiry_date: str, update: Update) -> bool:
    driver = None
    try:
        # ตั้งค่า Chrome options
        options = webdriver.ChromeOptions()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-software-rasterizer")
        options.add_argument("--ignore-certificate-errors")
        if CHROME_DEBUG_PORT:
            options.add_argument(f"--remote-debugging-port={CHROME_DEBUG_PORT}")
        if CHROME_HEADLESS:
            options.add_argument("--headless=new")
        options.add_experimental_option("excludeSwitches", ["enable-logging"])

        # ใช้ Profile ที่ล็อกอินไว้
        options.add_argument(f"user-data-dir={CHROME_USER_DATA_DIR}")
        options.add_argument(f"--profile-directory={CHROME_PROFILE_DIR}")

        # เปิด Chrome พร้อม Profile
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)

        # ✅ รอให้ Chrome เปิดขึ้นมา
        driver.implicitly_wait(10)
        time.sleep(5)
        
        # 1) เข้าหน้า Published Scripts
        try:
            driver.get(TV_PROFILE_URL)
            # รอให้หน้าเว็บโหลดสมบูรณ์
            time.sleep(10)  # เพิ่มเวลารอเป็น 10 วินาที
            
            # ตรวจสอบว่าเข้าสู่ระบบแล้วหรือยัง
            if "Sign in" in driver.page_source:
                print("❌ กรุณาเข้าสู่ระบบ TradingView ก่อน")
                return False
                
            print("✅ เข้าหน้า Published Scripts สำเร็จ!")
        except Exception as e:
            print(f"❌ ไม่สามารถเข้าถึงเว็บไซต์: {e}")
            return False

        # 2) หา Script ชื่อที่ระบุแล้วคลิก
        try:
            # แปลงชื่ออินดิเคเตอร์เป็น case-insensitive XPath
            indicator_xpath = ' and '.join([
                f"contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{word.lower()}')"
                for word in indicator_name.split()
            ])
            
            bm_element = driver.find_element(
                By.XPATH,
                f'//a[contains(@href, "/script/") and {indicator_xpath}]'
            )
            bm_element.click()
            print(f"✅ พบ {indicator_name} และคลิกแล้ว!")
            time.sleep(5)
        except Exception as e:
            print(f"❌ ไม่พบ Script ชื่อ '{indicator_name}': {e}")
            await update.message.reply_text(f"❌ ไม่พบ Script ชื่อ '{indicator_name}' กรุณาตรวจสอบชื่อให้ถูกต้อง")
            return False

        # 3) คลิกปุ่ม "Manage access"
        try:
            # รอให้หน้าเว็บโหลดสมบูรณ์
            time.sleep(10)  # เพิ่มเวลารอเป็น 10 วินาที
            
            # ลองหาปุ่มด้วย XPath หลายๆ แบบ
            manage_access = None
            possible_xpaths = [
                "//span[text()='Manage access']/parent::button",
                "//button[contains(., 'Manage access')]",
                "//button[contains(@class, 'button-') and contains(@class, 'color-gray')]"
            ]
            
            for xpath in possible_xpaths:
                try:
                    manage_access = driver.find_element(By.XPATH, xpath)
                    if manage_access:
                        break
                except Exception:
                    continue
            
            if manage_access:
                driver.execute_script("arguments[0].click();", manage_access)
                print("✅ คลิกปุ่ม 'Manage access' สำเร็จ!")
                time.sleep(3)
            else:
                print("❌ ไม่พบปุ่ม 'Manage access'")
                return False

            # 4) คลิกปุ่ม "Add new users"
            add_new_users_btn = driver.find_element(
                By.XPATH,
                "//button[@id='Add new users' and @role='tab']"
            )
            driver.execute_script("arguments[0].click();", add_new_users_btn)
            print("✅ คลิกปุ่ม 'Add new users' สำเร็จ!")
            time.sleep(2)

            # ค้นหาและพิมพ์ username
            search_input = driver.find_element(
                By.XPATH,
                "//input[@role='searchbox']"
            )
            search_input.clear()
            time.sleep(2)

            # แปลง username เป็นตัวพิมพ์ใหญ่ตัวแรก
            formatted_username = username.capitalize()
            search_input.send_keys(formatted_username)
            print(f"🔍 กำลังค้นหา username: {formatted_username}")
            time.sleep(10)

            # หาทุก username ที่แสดงในผลการค้นหา
            time.sleep(5)  # รอให้ผลการค้นหาแสดง
            rows = driver.find_elements(
                By.CSS_SELECTOR, 
                "[data-username]"
            )
            
            exact_match = None
            formatted_username_length = len(formatted_username)  # เก็บความยาวของ username ที่ต้องการ
            
            print(f"กำลังค้นหา username ที่มีความยาว {formatted_username_length} ตัวอักษร")
            
            for row in rows:
                try:
                    # ดึงข้อความ username จาก data-username attribute
                    user_text = row.get_attribute('data-username').strip()
                    print(f"ตรวจสอบ username: {user_text} (ความยาว: {len(user_text)})")
                    
                    # เช็คทั้งความยาวและตัวอักษรต้องตรงกันพอดี
                    if (len(user_text) == formatted_username_length and 
                        user_text.lower() == formatted_username.lower()):
                        exact_match = row  # เก็บแถวที่เจอไว้
                        print(f"✅ พบ username ที่ตรงกันพอดี: {user_text}")
                        break
                    else:
                        print(f"❌ ไม่ตรงกัน: ความยาวไม่เท่ากันหรือตัวอักษรไม่ตรงกัน")
                except Exception as e:
                    print(f"⚠️ ข้อผิดพลาดในการอ่านข้อมูล element: {e}")
                    continue

            if exact_match:
                try:
                    # หาปุ่ม Add access ในแถวที่เจอ username ตรงกัน
                    add_btn = exact_match.find_element(
                        By.XPATH,
                        "../..//span[text()='Add access']"
                    )
                    driver.execute_script("arguments[0].click();", add_btn)
                    print(f"✅ คลิก Add access สำหรับ {formatted_username} สำเร็จ!")
                    time.sleep(3)
                except Exception as e:
                    print(f"❌ ไม่สามารถคลิก Add access: {e}")
                    await update.message.reply_text(f"❌ ไม่สามารถคลิก Add access สำหรับ {formatted_username}")
                    return False
            else:
                print(f"❌ ไม่พบ username ที่ตรงกันพอดี: {formatted_username}")
                await update.message.reply_text(f"❌ ไม่พบ username: {formatted_username} ที่มีความยาว {formatted_username_length} ตัวอักษรในระบบ TradingView")
                return False

            # 6) ROBUST_DATE_V18 uncheck "no expiration" first, then the date field accepts input
            _JS_FIX = r"""
var v = arguments[0];
// Anchor on the date field itself - the class TradingView gives it - rather than
// on label text. Matching text picks up whichever big container happens to hold
// the word "expiry", which is how the date once landed in the search box.
// The expiry dialog is the only place a with-end-slot input sits next to exactly
// one checkbox; the user search boxes carry role=searchbox and no checkbox.
var cands = document.querySelectorAll("input[class*=end-slot], input[type=date]");
var di = null, cb = null, node = null;
for (var i = 0; i < cands.length; i++) {
  var e = cands[i];
  if ((e.getAttribute("role") || "") === "searchbox") { continue; }
  if (e.getClientRects().length === 0) { continue; }
  var n = e.parentElement;
  for (var d = 0; d < 8 && n; d++) {
    var cs = n.querySelectorAll("input[type=checkbox]");
    if (cs.length === 1) { di = e; cb = cs[0]; node = n; break; }
    n = n.parentElement;
  }
  if (di) { break; }
}
if (!di) { return "NODLG"; }
var un = 0;
if (cb.checked) { cb.click(); un = 1; }
window.__qvxNode = node;
di.disabled = false; di.removeAttribute("disabled");
di.readOnly = false; di.removeAttribute("readonly");
var st = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
st.call(di, v);
di.dispatchEvent(new Event("input", { bubbles: true }));
di.dispatchEvent(new Event("change", { bubbles: true }));
return "SET:" + un + ":" + (di.value === v ? "ok" : "mismatch");
"""
            _JS_TAB = r"""
function asc(s) { return (s || "").replace(/[^\x20-\x7e]/g, "."); }
// anchor on the tab we already know by id, then take its sibling tab.
// searching all [role=tab] blindly hits the profile page's Ideas/Minds/Scripts
// tabs and navigates away from the dialog.
var tabs = document.querySelectorAll("[role=tab]");
var anchor = null;
for (var i = 0; i < tabs.length; i++) {
  if ((tabs[i].id || "") === "Add new users") { anchor = tabs[i]; break; }
}
if (!anchor) { return "NOANCHOR"; }
var bar = anchor.parentElement;
for (var d = 0; d < 4 && bar; d++) {
  var sib = bar.querySelectorAll("[role=tab]");
  for (var i = 0; i < sib.length; i++) {
    if ((sib[i].id || "") !== "Add new users") { sib[i].click(); return "TAB:" + asc(sib[i].id || "?"); }
  }
  bar = bar.parentElement;
}
return "NOTAB";
"""
            _JS_OPEN = r"""
function asc(s) { return (s || "").replace(/[^\x20-\x7e]/g, "."); }
var u = (arguments[0] || "").trim().toLowerCase();
if (!u) { return "NOUSER"; }
var old = document.querySelectorAll("[data-qvx-open]");
for (var i = 0; i < old.length; i++) { old[i].removeAttribute("data-qvx-open"); }
// same row rule as the delete marker: smallest visible box holding both the
// username and an expiry cell
var expiry = /ไม่หมดอายุ|never|no expir|20[0-9]{2}/i;
var boxes = document.querySelectorAll("div,li,tr,section");
var row = null;
for (var i = 0; i < boxes.length; i++) {
  var e = boxes[i];
  if (e.getClientRects().length === 0) { continue; }
  var txt = e.textContent || "";
  if (txt.toLowerCase().indexOf(u) < 0) { continue; }
  if (!expiry.test(txt)) { continue; }
  if (!row || txt.length < (row.textContent || "").length) { row = e; }
}
if (!row) { return "NOROW"; }
// tag only. a synthetic .click() does not open this editor, so Selenium clicks
// the tagged element for real afterwards.
var kids = row.querySelectorAll("*");
for (var j = 0; j < kids.length; j++) {
  var k = kids[j];
  if (k.children.length !== 0) { continue; }
  var t = (k.textContent || "").trim();
  if (!t || t.toLowerCase() === u) { continue; }
  if (!expiry.test(t)) { continue; }
  var target = k.closest("button,a,[role=button],[tabindex]") || k;
  target.setAttribute("data-qvx-open", "1");
  return "MARK:" + asc(t);
}
return "NOEXP|row=" + asc((row.textContent || "").trim().slice(0, 48));
"""
            _JS_SAVE = r"""
var ok = /บันทึก|^save$|^apply$|^confirm$|^ok$|^add access$/i;
var no = /ยกเลิก|cancel|close/i;
var node = window.__qvxNode || document.body;
for (var d = 0; d < 8 && node; d++) {
  var btns = node.querySelectorAll("button");
  var pick = null, seen = 0;
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].offsetParent === null) { continue; }
    var t = (btns[i].textContent || "").trim();
    if (!t || no.test(t)) { continue; }
    if (ok.test(t)) { pick = btns[i]; seen++; }
  }
  if (seen > 1) { return "AMBIG:" + seen; }
  if (pick) { pick.click(); window.__qvxNode = null; return "SAVED"; }
  node = node.parentElement;
}
return "NOSAVE";
"""
            _JS_CHECK = r"""
function asc(s) { return (s || "").replace(/[^\x20-\x7e]/g, "."); }
var u = (arguments[0] || "").trim().toLowerCase();
var hit = null;
// the access list marks rows with data-username, which beats matching on text
var tagged = document.querySelectorAll("[data-username]");
for (var i = 0; i < tagged.length; i++) {
  if ((tagged[i].getAttribute("data-username") || "").trim().toLowerCase() === u) { hit = tagged[i]; break; }
}
if (!hit) {
  var all = document.querySelectorAll("*");
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    if (e.children.length === 0 && (e.textContent || "").trim().toLowerCase() === u) { hit = e; break; }
  }
}
if (!hit) { return "NOROW"; }
var never = /ไม่หมดอายุ|never|no expir/i;
var row = hit.parentElement;
for (var d = 0; d < 7 && row; d++) {
  var kids = row.querySelectorAll("*");
  for (var j = 0; j < kids.length; j++) {
    var k = kids[j];
    if (k === hit || k.children.length !== 0) { continue; }
    var t = (k.textContent || "").trim();
    if (!t) { continue; }
    if (never.test(t)) { return "UNLIMITED"; }
    // any year works - the cell may be localised, so do not insist on ISO
    if (/20[0-9]{2}/.test(t)) { return "DATED:" + asc(t); }
  }
  row = row.parentElement;
}
return "UNKNOWN";
"""

            # Step 5 already clicked "Add access" on the matched row, so the add is
            # committed and TradingView pops the expiry dialog by itself. Do NOT click
            # any other "Add access" button here - the search results are still on
            # screen and a blanket click would grant access to the wrong people.
            time.sleep(2)

            _JS_ROWHTML = r"""
function asc(s) { return (s || "").replace(/[^\x20-\x7e]/g, "."); }
var u = (arguments[0] || "").trim().toLowerCase();
var hit = null;
var tagged = document.querySelectorAll("[data-username]");
for (var i = 0; i < tagged.length; i++) {
  if ((tagged[i].getAttribute("data-username") || "").trim().toLowerCase() === u) { hit = tagged[i]; break; }
}
if (!hit) { return "NOROW"; }
var row = hit;
for (var d = 0; d < 4 && row.parentElement; d++) { row = row.parentElement; }
return asc(row.outerHTML).slice(0, 1800);
"""
            _JS_DUMP = r"""
function asc(s) { return (s || "").replace(/[^\x20-\x7e]/g, "."); }
var out = [];
var ins = document.querySelectorAll("input");
for (var i = 0; i < ins.length; i++) {
  var e = ins[i];
  if (e.getClientRects().length === 0) { continue; }
  out.push("IN[type=" + asc(e.type) + ",role=" + asc(e.getAttribute("role") || "-") +
           ",cls=" + asc((e.className || "-").slice(0, 40)) +
           ",checked=" + e.checked + ",disabled=" + e.disabled +
           ",val=" + asc((e.value || "-").slice(0, 16)) + "]");
}
var bs = document.querySelectorAll("button");
for (var i = 0; i < bs.length; i++) {
  var b = bs[i];
  if (b.getClientRects().length === 0) { continue; }
  var t = (b.textContent || "").trim().slice(0, 24);
  if (t) { out.push("BTN[" + asc(t) + "]"); }
}
var ck = document.querySelectorAll("[aria-checked],[role=checkbox],[role=switch]");
for (var i = 0; i < ck.length; i++) {
  var c = ck[i];
  if (c.getClientRects().length === 0) { continue; }
  out.push("ARIA[" + asc(c.tagName) + ",checked=" + asc(c.getAttribute("aria-checked") || "-") +
           ",txt=" + asc((c.textContent || "-").trim().slice(0, 24)) + "]");
}
return out.join(" ");
"""
            # first shot: the expiry dialog TradingView pops right after "Add access"
            _fix = driver.execute_script(_JS_FIX, expiry_date)
            print("tv expiry set:", _fix)
            if _fix != "NODLG":
                time.sleep(0.8)
                print("tv expiry save:", driver.execute_script(_JS_SAVE))
                time.sleep(3)

            # Then verify, and fix it from the list if it did not take. This matters:
            # for a user who already has access TradingView answers the add-flow with
            # "This user has already been granted access" and changes nothing, so
            # every renewal has to be edited from the "Access granted" list instead.
            # แปลงวันที่ที่หน้าเว็บโชว์ ("Sep 27, 2026") ให้เป็น ISO เพื่อเทียบกับที่สั่งไป
            # ถ้าเทียบแค่ว่า "มีวันที่ไหม" จะพลาด: คนที่มีสิทธิ์อยู่แล้วมีวันเดิมติดอยู่
            # ระบบจะนึกว่าสำเร็จทั้งที่ยังไม่ได้เปลี่ยนวัน
            def _iso(_t):
                import re as _re
                _m = _re.search(r"([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s*(\d{4})", str(_t))
                if _m:
                    _mons = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                             "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
                    _mo = _mons.get(_m.group(1).lower())
                    if _mo:
                        return "%s-%02d-%02d" % (_m.group(3), _mo, int(_m.group(2)))
                _m2 = _re.search(r"(\d{4})-(\d{2})-(\d{2})", str(_t))
                return _m2.group(0) if _m2 else ""

            _want = str(expiry_date).strip()
            _seen = "NOROW"
            for _round in range(3):
                print("tv tab:", driver.execute_script(_JS_TAB))
                time.sleep(2.5)
                _seen = driver.execute_script(_JS_CHECK, username)
                print("tv verify:", _seen, "| iso:", _iso(_seen), "| want:", _want)
                if isinstance(_seen, str) and _seen.startswith("DATED") and _iso(_seen) == _want:
                    break
                if _seen == "NOROW":
                    continue
                # The user already has access, so the add-flow above was rejected with
                # "This user has already been granted access". The expiry cell in the
                # list is not an editor either - clicking it opens nothing and only
                # disturbs the dialog - so remove the user and add them back cleanly.
                # A fresh add is the one flow TradingView accepts a date on.
                # Use the remove control this bot already knows (delete_indicator_access
                # uses the same XPaths). Clicking it removes the row outright - there is
                # no confirmation popup, so never go hunting for a "Delete" button:
                # the script page toolbar has one that deletes the whole indicator.
                _x = None
                for _sp in driver.find_elements(
                    By.XPATH,
                    "//span[@data-name='manage-access-dialog-item-remove-button']"
                    " | //span[contains(@class,'removeButton')]",
                ):
                    try:
                        _row = _sp.find_element(By.XPATH, "./ancestor::*[@data-username]")
                        if (_row.get_attribute("data-username") or "").strip().lower() == username.strip().lower():
                            _x = _sp
                            break
                    except Exception:
                        continue
                if _x is None:
                    print("tv del: remove button not found for", username)
                    break
                try:
                    driver.execute_script("arguments[0].click();", _x)
                    print("tv del: clicked")
                    time.sleep(3)
                except Exception as _e:
                    print("tv del click failed:", _e)
                    break

                # Only add back once the removal is confirmed gone from the list.
                # Re-adding while the old access is still there just gets rejected,
                # and adding blindly after a failed delete could strand the customer.
                _gone = False
                for _t in range(5):
                    time.sleep(2)
                    if driver.execute_script(_JS_CHECK, username) == "NOROW":
                        _gone = True
                        break
                print("tv after del gone:", _gone)
                if not _gone:
                    break

                try:
                    _addtab = driver.find_element(By.XPATH, "//button[@id='Add new users' and @role='tab']")
                    driver.execute_script("arguments[0].click();", _addtab)
                    time.sleep(2)
                    _sb = driver.find_element(By.XPATH, "//input[@role='searchbox']")
                    _sb.clear()
                    time.sleep(1)
                    _sb.send_keys(username.capitalize())
                    time.sleep(8)
                    _readded = False
                    for _r in driver.find_elements(By.CSS_SELECTOR, "[data-username]"):
                        if (_r.get_attribute("data-username") or "").strip().lower() == username.strip().lower():
                            driver.execute_script(
                                "arguments[0].click();",
                                _r.find_element(By.XPATH, "../..//span[text()='Add access']"),
                            )
                            _readded = True
                            break
                    print("tv re-add:", _readded)
                    time.sleep(3)
                except Exception as _e:
                    print("tv re-add failed:", _e)
                    break

                print("tv expiry set2:", driver.execute_script(_JS_FIX, expiry_date))
                time.sleep(0.8)
                print("tv expiry save2:", driver.execute_script(_JS_SAVE))
                time.sleep(3)

            if isinstance(_seen, str) and _seen.startswith("DATED") and _iso(_seen) == _want:
                print("EXPIRY_OK", username, expiry_date, _seen)
            else:
                print("EXPIRY_FAIL", username, expiry_date, _seen, "| iso:", _iso(_seen))
                print("tv dom:", driver.execute_script(_JS_DUMP))

            # a screenshot beats a log line when something looks off
            try:
                driver.save_screenshot(r"C:\Users\User\last_grant.png")
            except Exception:
                pass

            try:
                await update.message.reply_text(
                    "OK added " + str(username) + " until " + str(expiry_date) + " [" + str(_seen) + "]"
                )
            except Exception:
                pass
            try:
                if driver:
                    driver.quit()
            except Exception:
                pass
            return True

        except Exception as e:
            print(f"❌ เกิดข้อผิดพลาดในการลบสิทธิ์เดิม: {e}")
            if driver:
                driver.quit()
            return False

    except Exception as ex:
        print(f"❌ เกิดข้อผิดพลาด: {ex}")
        if driver:
            driver.quit()
        return False

async def renew_indicator_access(indicator_name: str, username: str, expiry_date: str, update: Update) -> bool:
    driver = None
    try:
        # ตั้งค่า Chrome options
        options = webdriver.ChromeOptions()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-software-rasterizer")
        options.add_argument("--ignore-certificate-errors")
        if CHROME_DEBUG_PORT:
            options.add_argument(f"--remote-debugging-port={CHROME_DEBUG_PORT}")
        if CHROME_HEADLESS:
            options.add_argument("--headless=new")
        options.add_experimental_option("excludeSwitches", ["enable-logging"])

        # ใช้ Profile ที่ล็อกอินไว้
        options.add_argument(f"user-data-dir={CHROME_USER_DATA_DIR}")
        options.add_argument(f"--profile-directory={CHROME_PROFILE_DIR}")

        # เปิด Chrome พร้อม Profile
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)

        # ✅ รอให้ Chrome เปิดขึ้นมา
        driver.implicitly_wait(10)
        time.sleep(5)
        
        # 1) เข้าหน้า Published Scripts
        try:
            driver.get(TV_PROFILE_URL)
            # รอให้หน้าเว็บโหลดสมบูรณ์
            time.sleep(10)  # เพิ่มเวลารอเป็น 10 วินาที
            
            # ตรวจสอบว่าเข้าสู่ระบบแล้วหรือยัง
            if "Sign in" in driver.page_source:
                print("❌ กรุณาเข้าสู่ระบบ TradingView ก่อน")
                return False
                
            print("✅ เข้าหน้า Published Scripts สำเร็จ!")
        except Exception as e:
            print(f"❌ ไม่สามารถเข้าถึงเว็บไซต์: {e}")
            return False

        # 2) หา Script ชื่อที่ระบุแล้วคลิก
        try:
            # แปลงชื่ออินดิเคเตอร์เป็น case-insensitive XPath
            indicator_xpath = ' and '.join([
                f"contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{word.lower()}')"
                for word in indicator_name.split()
            ])
            
            bm_element = driver.find_element(
                By.XPATH,
                f'//a[contains(@href, "/script/") and {indicator_xpath}]'
            )
            bm_element.click()
            print(f"✅ พบ {indicator_name} และคลิกแล้ว!")
            time.sleep(5)
        except Exception as e:
            print(f"❌ ไม่พบ Script ชื่อ '{indicator_name}': {e}")
            await update.message.reply_text(f"❌ ไม่พบ Script ชื่อ '{indicator_name}' กรุณาตรวจสอบชื่อให้ถูกต้อง")
            return False

        # 3) คลิกปุ่ม "Manage access"
        try:
            # รอให้หน้าเว็บโหลดสมบูรณ์
            time.sleep(10)  # เพิ่มเวลารอเป็น 10 วินาที
            
            # ลองหาปุ่มด้วย XPath หลายๆ แบบ
            manage_access = None
            possible_xpaths = [
                "//span[text()='Manage access']/parent::button",
                "//button[contains(., 'Manage access')]",
                "//button[contains(@class, 'button-') and contains(@class, 'color-gray')]"
            ]
            
            for xpath in possible_xpaths:
                try:
                    manage_access = driver.find_element(By.XPATH, xpath)
                    if manage_access:
                        break
                except Exception:
                    continue
            
            if manage_access:
                driver.execute_script("arguments[0].click();", manage_access)
                print("✅ คลิกปุ่ม 'Manage access' สำเร็จ!")
                time.sleep(3)
            else:
                print("❌ ไม่พบปุ่ม 'Manage access'")
                return False

            # คลิกที่ "Access granted" tab
            access_granted_btn = driver.find_element(
                By.XPATH,
                "//button[@id='Access granted' and @role='tab']"
            )
            driver.execute_script("arguments[0].click();", access_granted_btn)
            print("✅ คลิกแท็บ 'Access granted' สำเร็จ!")
            time.sleep(3)

            # ค้นหา username ที่ต้องการลบ
            search_input = driver.find_element(
                By.XPATH,
                "//input[@role='searchbox']"
            )
            search_input.clear()
            formatted_username = username.capitalize()
            search_input.send_keys(formatted_username)
            print(f"🔍 กำลังค้นหา username เพื่อลบ: {formatted_username}")
            time.sleep(5)

            # เพิ่มเวลารอก่อนค้นหาปุ่มลบ
            time.sleep(10)  # เพิ่มเป็น 10 วินาที

            # และเพิ่ม wait condition
            wait = WebDriverWait(driver, 20)
            try:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div[role='dialog']")))
            except:
                print("⚠️ รอ dialog นานเกินไป แต่จะดำเนินการต่อ")

            # หาและคลิกปุ่มลบ
            try:
                delete_btn = None
                possible_delete_xpaths = [
                    # XPath ใหม่ที่เพิ่มเข้ามา
                    "//span[contains(@class, 'removeButton')]",
                    "//span[@data-name='manage-access-dialog-item-remove-button']",
                    # XPath เดิม
                    "/html/body/div[7]/div[2]/div/div[2]/div[2]/div/div[1]/div/div[5]/div[2]/div/div[1]/div/span/svg/..",
                    "//span[.//svg[.//path[@d='M9.707 9l4.647-4.646-.707-.708L9 8.293 4.354 3.646l-.708.708L8.293 9l-4.647 4.646.708.708L9 9.707l4.646 4.647.708-.707L9.707 9z']]]",
                    "//span[.//svg[@width='18' and @height='18' and .//path[contains(@d, 'M9.707 9l4.647-4.646')]]]",
                    f"//div[contains(., '{formatted_username}')]//span[.//svg[@width='18' and @height='18']]"
                ]
                
                time.sleep(5)  # รอให้รายการโหลดสมบูรณ์
                
                print(f"🔍 กำลังค้นหาปุ่มลบด้วย {len(possible_delete_xpaths)} รูปแบบ XPath")
                
                for xpath in possible_delete_xpaths:
                    try:
                        elements = driver.find_elements(By.XPATH, xpath)
                        print(f"📍 ตรวจสอบ XPath: {xpath}")
                        print(f"📊 พบปุ่ม: {len(elements)} ปุ่ม")
                        
                        if elements:
                            for element in elements:
                                try:
                                    # ปรับการค้นหา parent element โดยใช้ XPath ที่ยืดหยุ่นมากขึ้น
                                    parent = element.find_element(
                                        By.XPATH, 
                                        "./ancestor::div[contains(@class, 'row') or contains(@class, 'item') or contains(@class, 'user')]"
                                    )
                                    row_text = parent.text.lower()
                                    print(f"🔍 ข้อความในแถว: {row_text}")
                                    
                                    if formatted_username.lower() in row_text:
                                        delete_btn = element
                                        print(f"✅ พบปุ่มลบสำหรับ {formatted_username}")
                                        break
                                except Exception as row_error:
                                    # ถ้าหา parent ไม่เจอ ให้ลองใช้ตัว element นั้นเลย
                                    try:
                                        row_text = element.get_attribute('innerHTML').lower()
                                        parent_text = element.find_element(By.XPATH, "..").text.lower()
                                        combined_text = row_text + " " + parent_text
                                        print(f"🔍 ข้อความที่พบ: {combined_text}")
                                        
                                        if formatted_username.lower() in combined_text:
                                            delete_btn = element
                                            print(f"✅ พบปุ่มลบสำหรับ {formatted_username}")
                                            break
                                    except Exception as direct_error:
                                        print(f"⚠️ ข้อผิดพลาดในการตรวจสอบโดยตรง: {direct_error}")
                                        continue
                            
                            if delete_btn:
                                break
                    except Exception as e:
                        print(f"⚠️ ข้อผิดพลาดในการค้นหาปุ่มลบ: {e}")
                        continue

                if delete_btn:
                    try:
                        driver.execute_script("arguments[0].click();", delete_btn)
                        print("✅ คลิกปุ่มลบสิทธิ์เดิมสำเร็จ!")
                        time.sleep(3)
                        
                        # เพิ่มสิทธิ์ใหม่
                        print("🔄 กำลังเพิ่มสิทธิ์ใหม่...")
                        
                        # คลิกปุ่ม "Add new users"
                        add_new_users_btn = driver.find_element(
                            By.XPATH,
                            "//button[@id='Add new users' and @role='tab']"
                        )
                        driver.execute_script("arguments[0].click();", add_new_users_btn)
                        print("✅ คลิกปุ่ม 'Add new users' สำเร็จ!")
                        time.sleep(2)

                        # ค้นหาและพิมพ์ username
                        search_input = driver.find_element(
                            By.XPATH,
                            "//input[@role='searchbox']"
                        )
                        search_input.clear()
                        time.sleep(2)

                        # แปลง username เป็นตัวพิมพ์ใหญ่ตัวแรก
                        formatted_username = username.capitalize()
                        search_input.send_keys(formatted_username)
                        print(f"🔍 กำลังค้นหา username: {formatted_username}")
                        time.sleep(10)

                        # หาทุก username ที่แสดงในผลการค้นหา
                        rows = driver.find_elements(
                            By.CSS_SELECTOR, 
                            "[data-username]"
                        )
                        
                        exact_match = None
                        formatted_username_length = len(formatted_username)
                        
                        for row in rows:
                            try:
                                user_text = row.get_attribute('data-username').strip()
                                if (len(user_text) == formatted_username_length and 
                                    user_text.lower() == formatted_username.lower()):
                                    exact_match = row
                                    print(f"✅ พบ username ที่ตรงกันพอดี: {user_text}")
                                    break
                            except Exception as e:
                                continue

                        if exact_match:
                            try:
                                add_btn = exact_match.find_element(
                                    By.XPATH,
                                    "../..//span[text()='Add access']"
                                )
                                driver.execute_script("arguments[0].click();", add_btn)
                                print(f"✅ คลิก Add access สำหรับ {formatted_username} สำเร็จ!")
                                time.sleep(3)

                                # ตั้งค่าวันหมดอายุ
                                date_input = driver.find_element(
                                    By.XPATH,
                                    "//input[contains(@class, 'with-end-slot')]"
                                )
                                
                                date_input.click()
                                time.sleep(0.5)
                                date_input.send_keys(Keys.END)
                                time.sleep(0.5)
                                
                                for _ in range(15):
                                    date_input.send_keys(Keys.BACKSPACE)
                                    time.sleep(0.1)
                                
                                if date_input.get_attribute('value'):
                                    date_input.clear()
                                
                                time.sleep(0.5)
                                
                                for char in expiry_date:
                                    date_input.send_keys(char)
                                    time.sleep(0.1)
                                
                                print(f"✅ กำหนดวันหมดอายุเป็น {expiry_date} สำเร็จ!")
                                time.sleep(1)

                                date_input.send_keys(Keys.ENTER)
                                time.sleep(3)

                                # ถ่ายภาพและส่งกลับ
                                screenshot_path = "screenshot.png"
                                driver.set_window_size(1920, 1080)
                                time.sleep(2)
                                
                                manage_access_dialog = driver.find_element(
                                    By.XPATH, 
                                    "//div[contains(@class, 'dialog-')]"
                                )
                                manage_access_dialog.screenshot(screenshot_path)
                                
                                with open(screenshot_path, 'rb') as photo_file:
                                    await update.message.reply_photo(
                                        photo=photo_file,
                                        caption=f"✅ ต่ออายุสิทธิ์การใช้งานสำเร็จ!\n"
                                                f"📊 อินดิเคเตอร์: {indicator_name}\n"
                                                f"👤 Username: {username}\n"
                                                f"📅 วันหมดอายุใหม่: {expiry_date}"
                                    )
                                
                                if os.path.exists(screenshot_path):
                                    try:
                                        os.remove(screenshot_path)
                                    except Exception as e:
                                        print(f"⚠️ ไม่สามารถลบไฟล์ภาพหน้าจอ: {e}")
                                
                                return True

                            except Exception as e:
                                print(f"❌ เกิดข้อผิดพลาดในการเพิ่มสิทธิ์ใหม่: {e}")
                                return False
                        else:
                            print(f"❌ ไม่พบ username: {formatted_username}")
                            return False
                            
                    except Exception as click_error:
                        print(f"❌ ไม่สามารถคลิกปุ่มลบ: {click_error}")
                        return False
            except Exception as e:
                print(f"❌ เกิดข้อผิดพลาดในการลบสิทธิ์: {e}")
                return False

        except Exception as e:
            print(f"❌ เกิดข้อผิดพลาด: {e}")
            return False

    except Exception as ex:
        print(f"❌ เกิดข้อผิดพลาด: {ex}")
        return False
    finally:
        if driver:
            print("⏳ รอ 5 วินาทีก่อนปิด Chrome...")
            time.sleep(5)
            driver.quit()
            print("✅ ปิด Chrome เรียบร้อย")

async def delete_indicator_access(indicator_name: str, username: str, update: Update) -> bool:
    driver = None
    try:
        # ตั้งค่า Chrome options
        options = webdriver.ChromeOptions()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-software-rasterizer")
        options.add_argument("--ignore-certificate-errors")
        if CHROME_DEBUG_PORT:
            options.add_argument(f"--remote-debugging-port={CHROME_DEBUG_PORT}")
        if CHROME_HEADLESS:
            options.add_argument("--headless=new")
        options.add_experimental_option("excludeSwitches", ["enable-logging"])

        # ใช้ Profile ที่ล็อกอินไว้
        options.add_argument(f"user-data-dir={CHROME_USER_DATA_DIR}")
        options.add_argument(f"--profile-directory={CHROME_PROFILE_DIR}")

        # เปิด Chrome พร้อม Profile
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)

        # ✅ รอให้ Chrome เปิดขึ้นมา
        driver.implicitly_wait(10)
        time.sleep(5)
        
        # 1) เข้าหน้า Published Scripts
        try:
            driver.get(TV_PROFILE_URL)
            time.sleep(10)
            
            if "Sign in" in driver.page_source:
                print("❌ กรุณาเข้าสู่ระบบ TradingView ก่อน")
                return False
                
            print("✅ เข้าหน้า Published Scripts สำเร็จ!")
        except Exception as e:
            print(f"❌ ไม่สามารถเข้าถึงเว็บไซต์: {e}")
            return False

        # 2) หา Script และคลิก
        try:
            indicator_xpath = ' and '.join([
                f"contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{word.lower()}')"
                for word in indicator_name.split()
            ])
            
            bm_element = driver.find_element(
                By.XPATH,
                f'//a[contains(@href, "/script/") and {indicator_xpath}]'
            )
            bm_element.click()
            print(f"✅ พบ {indicator_name} และคลิกแล้ว!")
            time.sleep(5)
        except Exception as e:
            print(f"❌ ไม่พบ Script ชื่อ '{indicator_name}': {e}")
            await update.message.reply_text(f"❌ ไม่พบ Script ชื่อ '{indicator_name}' กรุณาตรวจสอบชื่อให้ถูกต้อง")
            return False

        # 3) คลิกปุ่ม Manage access
        try:
            time.sleep(10)
            manage_access = None
            possible_xpaths = [
                "//span[text()='Manage access']/parent::button",
                "//button[contains(., 'Manage access')]",
                "//button[contains(@class, 'button-') and contains(@class, 'color-gray')]"
            ]
            
            for xpath in possible_xpaths:
                try:
                    manage_access = driver.find_element(By.XPATH, xpath)
                    if manage_access:
                        break
                except:
                    continue
            
            if manage_access:
                driver.execute_script("arguments[0].click();", manage_access)
                print("✅ คลิกปุ่ม 'Manage access' สำเร็จ!")
                time.sleep(3)
            else:
                print("❌ ไม่พบปุ่ม 'Manage access'")
                return False

            # คลิกที่ "Access granted" tab
            access_granted_btn = driver.find_element(
                By.XPATH,
                "//button[@id='Access granted' and @role='tab']"
            )
            driver.execute_script("arguments[0].click();", access_granted_btn)
            print("✅ คลิกแท็บ 'Access granted' สำเร็จ!")
            time.sleep(3)

            # ค้นหา username ที่ต้องการลบ
            search_input = driver.find_element(
                By.XPATH,
                "//input[@role='searchbox']"
            )
            search_input.clear()
            formatted_username = username.capitalize()
            search_input.send_keys(formatted_username)
            print(f"🔍 กำลังค้นหา username เพื่อลบ: {formatted_username}")
            time.sleep(5)

            # เพิ่มเวลารอก่อนค้นหาปุ่มลบ
            time.sleep(10)  # เพิ่มเป็น 10 วินาที

            # และเพิ่ม wait condition
            wait = WebDriverWait(driver, 20)
            try:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div[role='dialog']")))
            except:
                print("⚠️ รอ dialog นานเกินไป แต่จะดำเนินการต่อ")

            # หาและคลิกปุ่มลบ
            try:
                delete_btn = None
                possible_delete_xpaths = [
                    # XPath ใหม่ที่เพิ่มเข้ามา
                    "//span[contains(@class, 'removeButton')]",
                    "//span[@data-name='manage-access-dialog-item-remove-button']",
                    # XPath เดิม
                    "/html/body/div[7]/div[2]/div/div[2]/div[2]/div/div[1]/div/div[5]/div[2]/div/div[1]/div/span/svg/..",
                    "//span[.//svg[.//path[@d='M9.707 9l4.647-4.646-.707-.708L9 8.293 4.354 3.646l-.708.708L8.293 9l-4.647 4.646.708.708L9 9.707l4.646 4.647.708-.707L9.707 9z']]]",
                    "//span[.//svg[@width='18' and @height='18' and .//path[contains(@d, 'M9.707 9l4.647-4.646')]]]",
                    f"//div[contains(., '{formatted_username}')]//span[.//svg[@width='18' and @height='18']]"
                ]
                
                time.sleep(5)  # รอให้รายการโหลดสมบูรณ์
                
                print(f"🔍 กำลังค้นหาปุ่มลบด้วย {len(possible_delete_xpaths)} รูปแบบ XPath")
                
                for xpath in possible_delete_xpaths:
                    try:
                        elements = driver.find_elements(By.XPATH, xpath)
                        print(f"📍 ตรวจสอบ XPath: {xpath}")
                        print(f"📊 พบปุ่ม: {len(elements)} ปุ่ม")
                        
                        if elements:
                            for element in elements:
                                try:
                                    # ปรับการค้นหา parent element โดยใช้ XPath ที่ยืดหยุ่นมากขึ้น
                                    parent = element.find_element(
                                        By.XPATH, 
                                        "./ancestor::div[contains(@class, 'row') or contains(@class, 'item') or contains(@class, 'user')]"
                                    )
                                    row_text = parent.text.lower()
                                    print(f"🔍 ข้อความในแถว: {row_text}")
                                    
                                    if formatted_username.lower() in row_text:
                                        delete_btn = element
                                        print(f"✅ พบปุ่มลบสำหรับ {formatted_username}")
                                        break
                                except Exception as row_error:
                                    # ถ้าหา parent ไม่เจอ ให้ลองใช้ตัว element นั้นเลย
                                    try:
                                        row_text = element.get_attribute('innerHTML').lower()
                                        parent_text = element.find_element(By.XPATH, "..").text.lower()
                                        combined_text = row_text + " " + parent_text
                                        print(f"🔍 ข้อความที่พบ: {combined_text}")
                                        
                                        if formatted_username.lower() in combined_text:
                                            delete_btn = element
                                            print(f"✅ พบปุ่มลบสำหรับ {formatted_username}")
                                            break
                                    except Exception as direct_error:
                                        print(f"⚠️ ข้อผิดพลาดในการตรวจสอบโดยตรง: {direct_error}")
                                        continue
                            
                            if delete_btn:
                                break
                    except Exception as e:
                        print(f"⚠️ ข้อผิดพลาดในการค้นหาปุ่มลบ: {e}")
                        continue

                if delete_btn:
                    try:
                        driver.execute_script("arguments[0].click();", delete_btn)
                        print("✅ คลิกปุ่มลบสิทธิ์เดิมสำเร็จ!")
                        time.sleep(3)
                        
                        # ถ่ายภาพหน้าจอเพื่อยืนยัน
                        try:
                            screenshot_path = "delete_confirmation.png"
                            driver.set_window_size(1920, 1080)
                            time.sleep(2)
                            
                            manage_access_dialog = driver.find_element(
                                By.XPATH, 
                                "//div[contains(@class, 'dialog-')]"
                            )
                            manage_access_dialog.screenshot(screenshot_path)
                            
                            with open(screenshot_path, 'rb') as photo_file:
                                await update.message.reply_photo(
                                    photo=photo_file,
                                    caption=f"✅ ลบสิทธิ์การใช้งานสำเร็จ!\n"
                                            f"📊 อินดิเคเตอร์: {indicator_name}\n"
                                            f"👤 Username: {username}"
                                )
                            
                            if os.path.exists(screenshot_path):
                                try:
                                    os.remove(screenshot_path)
                                except Exception as e:
                                    print(f"⚠️ ไม่สามารถลบไฟล์ภาพหน้าจอ: {e}")
                            
                            return True
                            
                        except Exception as screenshot_error:
                            print(f"⚠️ ไม่สามารถถ่ายหรือส่งภาพได้: {screenshot_error}")
                            await update.message.reply_text(
                                f"✅ ลบสิทธิ์การใช้งานสำเร็จ!\n"
                                f"📊 อินดิเคเตอร์: {indicator_name}\n"
                                f"👤 Username: {username}"
                            )
                            return True
                            
                    except Exception as click_error:
                        print(f"❌ ไม่สามารถคลิกปุ่มลบ: {click_error}")
                        return False
                else:
                    print("❌ ไม่พบปุ่มลบสิทธิ์การใช้งาน")
                    return False

            except Exception as e:
                print(f"❌ เกิดข้อผิดพลาดในการลบสิทธิ์: {e}")
                return False

        except Exception as e:
            print(f"❌ เกิดข้อผิดพลาด: {e}")
            return False

    except Exception as ex:
        print(f"❌ เกิดข้อผิดพลาด: {ex}")
        return False
    finally:
        if driver:
            print("⏳ รอ 5 วินาทีก่อนปิด Chrome...")
            time.sleep(5)
            driver.quit()
            print("✅ ปิด Chrome เรียบร้อย")

async def add_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        text = update.message.text.strip()
        
        if not text.startswith('/add '):
            await update.message.reply_text("❌ กรุณาใช้คำสั่งในรูปแบบ: /add ชื่ออินดิเคเตอร์ username จำนวนวัน\nตัวอย่าง: /add Trend Map woot2517 14")
            return
            
        text = text[5:].strip()
        parts = text.split()
        
        if len(parts) < 3:
            await update.message.reply_text("❌ กรุณาใช้คำสั่งในรูปแบบ: /add ชื่ออินดิเคเตอร์ username จำนวนวัน\nตัวอย่าง: /add Trend Map woot2517 14")
            return

        days = parts[-1]  # จำนวนวันคือค่าสุดท้าย
        username = parts[-2]  # username คือค่ารองสุดท้าย
        indicator_name = ' '.join(parts[:-2])  # ส่วนที่เหลือทั้งหมดคือชื่ออินดิเคเตอร์

        try:
            days = int(days)
            expiry_date = (datetime.now() + timedelta(days=days)).strftime('%Y-%m-%d')
        except ValueError:
            await update.message.reply_text("❌ จำนวนวันต้องเป็นตัวเลขเท่านั้น")
            return

        await update.message.reply_text(f"🔄 กำลังเพิ่มสิทธิ์การใช้งาน...\n"
                                      f"📊 อินดิเคเตอร์: {indicator_name}\n"
                                      f"👤 Username: {username}\n"
                                      f"📅 วันหมดอายุ: {expiry_date}")

        success = await add_indicator_access(indicator_name, username, expiry_date, update)
        
        if success:
            # ส่งข้อมูลไปยัง API
            api_success, api_result = await send_to_api(
                "add", 
                indicator_name, 
                username, 
                expiry_date, 
                update.effective_user
            )
            
            if not api_success:
                await update.message.reply_text("⚠️ เพิ่มสิทธิ์ใน TradingView สำเร็จ แต่ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้")
        else:
            await update.message.reply_text("❌ เกิดข้อผิดพลาดในการเพิ่มสิทธิ์การใช้งาน")

    except Exception as e:
        await update.message.reply_text(f"❌ เกิดข้อผิดพลาด: {str(e)}")

async def re_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        text = update.message.text.strip()
        
        if not text.startswith('/re '):
            await update.message.reply_text("❌ กรุณาใช้คำสั่งในรูปแบบ: /re ชื่ออินดิเคเตอร์ username จำนวนวัน\nตัวอย่าง: /re Trend Map woot2517 14")
            return
            
        text = text[4:].strip()
        parts = text.split()
        
        if len(parts) < 3:
            await update.message.reply_text("❌ กรุณาใช้คำสั่งในรูปแบบ: /re ชื่ออินดิเคเตอร์ username จำนวนวัน\nตัวอย่าง: /re Trend Map woot2517 14")
            return

        days = parts[-1]  # จำนวนวันคือค่าสุดท้าย
        username = parts[-2]  # username คือค่ารองสุดท้าย
        indicator_name = ' '.join(parts[:-2])  # ส่วนที่เหลือทั้งหมดคือชื่ออินดิเคเตอร์

        try:
            days = int(days)
            expiry_date = (datetime.now() + timedelta(days=days)).strftime('%Y-%m-%d')
        except ValueError:
            await update.message.reply_text("❌ จำนวนวันต้องเป็นตัวเลขเท่านั้น")
            return

        await update.message.reply_text(f"🔄 กำลังต่ออายุสิทธิ์การใช้งาน...\n"
                                      f"📊 อินดิเคเตอร์: {indicator_name}\n"
                                      f"👤 Username: {username}\n"
                                      f"📅 วันหมดอายุใหม่: {expiry_date}")

        success = await renew_indicator_access(indicator_name, username, expiry_date, update)
        
        if success:
            # ส่งข้อมูลไปยัง API
            api_success, api_result = await send_to_api(
                "renew", 
                indicator_name, 
                username, 
                expiry_date, 
                update.effective_user
            )
            
            if not api_success:
                await update.message.reply_text("⚠️ ต่ออายุสิทธิ์ใน TradingView สำเร็จ แต่ไม่สามารถอัพเดทข้อมูลในฐานข้อมูลได้")
        else:
            await update.message.reply_text("❌ เกิดข้อผิดพลาดในการต่ออายุสิทธิ์การใช้งาน")

    except Exception as e:
        await update.message.reply_text(f"❌ เกิดข้อผิดพลาด: {str(e)}")

async def del_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        text = update.message.text.strip()
        
        if not text.startswith('/del '):
            await update.message.reply_text("❌ กรุณาใช้คำสั่งในรูปแบบ: /del ชื่ออินดิเคเตอร์ username\nตัวอย่าง: /del Trend Map woot2517")
            return
            
        text = text[5:].strip()
        parts = text.split()
        
        if len(parts) < 2:
            await update.message.reply_text("❌ กรุณาใช้คำสั่งในรูปแบบ: /del ชื่ออินดิเคเตอร์ username\nตัวอย่าง: /del Trend Map woot2517")
            return

        username = parts[-1]  # username คือค่าสุดท้าย
        indicator_name = ' '.join(parts[:-1])  # ส่วนที่เหลือทั้งหมดคือชื่ออินดิเคเตอร์

        await update.message.reply_text(f"🔄 กำลังลบสิทธิ์การใช้งาน...\n"
                                      f"📊 อินดิเคเตอร์: {indicator_name}\n"
                                      f"👤 Username: {username}")

        success = await delete_indicator_access(indicator_name, username, update)
        
        if success:
            # ส่งข้อมูลไปยัง API
            api_success, api_result = await send_to_api(
                "delete", 
                indicator_name, 
                username, 
                None, 
                update.effective_user
            )
            
            if not api_success:
                await update.message.reply_text("⚠️ ลบสิทธิ์ใน TradingView สำเร็จ แต่ไม่สามารถลบข้อมูลในฐานข้อมูลได้")
        else:
            await update.message.reply_text("❌ เกิดข้อผิดพลาดในการลบสิทธิ์การใช้งาน")

    except Exception as e:
        await update.message.reply_text(f"❌ เกิดข้อผิดพลาด: {str(e)}")

def main():
    # โทเคนต้องมาจาก .env เท่านั้น — ของเดิมฝังไว้ในไฟล์นี้และถูก commit ขึ้น git ไปแล้ว
    # ใครเห็น repo ก็คุมบอทได้ทันที ให้ revoke ที่ @BotFather แล้วใช้ตัวใหม่
    BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
    if not BOT_TOKEN:
        raise SystemExit("❌ ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN ใน .env")
    
    print("🤖 กำลังเริ่มต้น Telegram Bot...")
    application = Application.builder().token(BOT_TOKEN).build()
    
    # เพิ่ม handler สำหรับคำสั่ง /add
    application.add_handler(CommandHandler("add", add_command))
    
    # เพิ่ม handler สำหรับคำสั่ง /re
    application.add_handler(CommandHandler("re", re_command))
    
    # เพิ่ม handler สำหรับคำสั่ง /del
    application.add_handler(CommandHandler("del", del_command))
    
    print("✅ Bot พร้อมใช้งานแล้ว!")
    print("💡 ใช้คำสั่ง /add, /re, หรือ /del ใน Telegram")
    print("📝 ตัวอย่าง: /add Trend Map woot2517 14")
    print("📝 ตัวอย่าง: /re Trend Map woot2517 14")
    print("📝 ตัวอย่าง: /del Trend Map woot2517")
    
    # เริ่มต้น bot
    application.run_polling()

if __name__ == '__main__':
    main() 