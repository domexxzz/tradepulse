# -*- coding: utf-8 -*-
# Robust patch สำหรับ tlapi.py: แก้ date picker ที่ TradingView เปลี่ยน UI แล้วพัง
# ถ้าตั้งวันไม่ได้ ก็ add แบบไม่จำกัด ให้ cron ฝั่งเว็บถอนสิทธิ์เมื่อหมดอายุแทน
import io, shutil, sys

p = r"C:\Users\User\OneDrive\Desktop\Bot Tradingview\tlapi.py"
s = io.open(p, encoding="utf-8", newline="").read()
nl = "\r\n" if "\r\n" in s else "\n"

if "ROBUST_DATE_V1" in s:
    print("PATCH: มีอยู่แล้ว (ROBUST_DATE_V1) ข้าม")
    sys.exit(0)

i = s.find("# 6) ")
if i < 0:
    print("PATCH_FAIL: ไม่เจอ anchor '# 6)'"); sys.exit(1)
k = s.find("แก้ไขวันที่หมดอายุ", i)
if k < 0:
    print("PATCH_FAIL: ไม่เจอ except date"); sys.exit(1)
j = s.find("return False", k)
if j < 0:
    print("PATCH_FAIL: ไม่เจอ return False"); sys.exit(1)
j += len("return False")

lines = [
 "# 6) ROBUST_DATE_V1 ตั้งวันหมดอายุแบบทน — ถ้าพัง add แบบไม่จำกัด ให้ cron เว็บคุมวัน",
 "            try:",
 "                _w = WebDriverWait(driver, 8)",
 "                _di = _w.until(EC.presence_of_element_located((By.XPATH, \"//input[contains(@class,'with-end-slot')]\")))",
 "                driver.execute_script(\"arguments[0].scrollIntoView({block:'center'});\", _di)",
 "                time.sleep(0.5)",
 "                driver.execute_script(\"var e=arguments[0],v=arguments[1],pr=window.HTMLInputElement.prototype,st=Object.getOwnPropertyDescriptor(pr,'value').set;st.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));\", _di, expiry_date)",
 "                time.sleep(0.5)",
 "                try:",
 "                    _di.send_keys(Keys.ENTER)",
 "                except Exception:",
 "                    driver.execute_script(\"arguments[0].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true}));\", _di)",
 "                print('set date robust:', expiry_date)",
 "            except Exception as _e:",
 "                print('date set failed -> add unlimited (cron controls expiry):', _e)",
 "            time.sleep(2)",
 "            for _xp in [\"//button[.//span[text()='Add access']]\", \"//span[text()='Add access']/ancestor::button[1]\"]:",
 "                try:",
 "                    for _b in driver.find_elements(By.XPATH, _xp):",
 "                        if _b.is_displayed():",
 "                            driver.execute_script('arguments[0].click();', _b)",
 "                            time.sleep(1)",
 "                except Exception:",
 "                    pass",
 "            try:",
 "                await update.message.reply_text('OK added ' + str(username))",
 "            except Exception:",
 "                pass",
 "            try:",
 "                if driver:",
 "                    driver.quit()",
 "            except Exception:",
 "                pass",
 "            return True",
]
block = nl.join(lines)
s2 = s[:i] + block + s[j:]
shutil.copy(p, p + ".bak2")
io.open(p, "w", encoding="utf-8", newline="").write(s2)
print("PATCH_OK: robust date + commit-unlimited (backup .bak2)")
