# -*- coding: utf-8 -*-
import io, shutil, sys

p = r"C:\Users\User\OneDrive\Desktop\Bot Tradingview\tlapi.py"
s = io.open(p, encoding="utf-8", newline="").read()
nl = "\r\n" if "\r\n" in s else "\n"

if "ROBUST_DATE_V1" in s:
    print("PATCH already applied (ROBUST_DATE_V1)"); sys.exit(0)

i = s.find("# 6) ")
if i < 0: print("PATCH_FAIL no anchor '# 6)'"); sys.exit(1)
k = s.find("with-end-slot", i)
if k < 0: k = i
j = s.find("return False", k)
if j < 0: print("PATCH_FAIL no return False"); sys.exit(1)
j += len("return False")

lines = [
 "# 6) ROBUST_DATE_V1 set expiry robust; if it fails, add unlimited and let web cron revoke",
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
 "                print('set date robust', expiry_date)",
 "            except Exception as _e:",
 "                print('date set failed, add unlimited (cron controls expiry)', _e)",
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
print("PATCH_OK robust date + commit-unlimited, backup tlapi.py.bak2")
