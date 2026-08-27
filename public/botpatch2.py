# -*- coding: utf-8 -*-
# TradingView bot patch V3 - actually set the expiry date.
#
# Root cause (spotted by the site owner): the expiry dialog opens with the
# "No expiration date" checkbox ALREADY CHECKED, which disables the date input.
# The original code went straight to date_input.click()/send_keys and got
# "element not interactable", so every user ended up with unlimited access.
#
# Facts confirmed by reading the live tlapi.py on combase:
#   - signature: add_indicator_access(indicator_name, username, expiry_date, update)
#   - expiry_date is already "YYYY-MM-DD" (datetime.now() + timedelta(days=days))
#   - the row's "Add access" button is clicked in step 5, BEFORE this block,
#     so the add is already committed and the expiry dialog is on screen
#   - TradingView dialogs carry a class like "dialog-xxxx"
#
# ASCII ONLY: PowerShell 5.1 misreads UTF-8 without BOM and print() of Thai
# crashes a cp874 console, so Thai UI strings are matched with \uXXXX escapes
# inside the injected JavaScript.
import io, shutil, sys

NEW_BLOCK = r'''# 6) ROBUST_DATE_V3 uncheck "no expiration" first, then the date field accepts input
            _JS_FIX = r"""
var v = arguments[0];
var lab = /\u0e2b\u0e21\u0e14\u0e2d\u0e32\u0e22\u0e38|expir/i;
var cbs = document.querySelectorAll("input[type=checkbox]");
var cb = null;
for (var i = 0; i < cbs.length; i++) {
  var c = cbs[i];
  var vis = c.offsetParent !== null || c.getClientRects().length > 0 ||
            (c.parentElement && c.parentElement.offsetParent !== null);
  if (!vis) { continue; }
  var host = c.closest("label") || c.parentElement;
  if (host && lab.test(host.textContent || "")) { cb = c; break; }
}
if (!cb) { return "NODLG"; }
var un = 0;
if (cb.checked) { cb.click(); un = 1; }
var di = null, node = cb.parentElement;
for (var d = 0; d < 8 && node && !di; d++) {
  var ins = node.querySelectorAll("input");
  for (var i = 0; i < ins.length; i++) {
    var t = (ins[i].type || "").toLowerCase();
    if (t === "checkbox" || t === "hidden" || t === "radio") { continue; }
    di = ins[i];
    break;
  }
  if (!di) { node = node.parentElement; }
}
if (!di) { return "NOINPUT:" + un; }
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
var tabs = document.querySelectorAll("[role=tab]");
var ids = [];
for (var i = 0; i < tabs.length; i++) {
  var id = tabs[i].id || "";
  ids.push(asc(id));
  if (id !== "Add new users") { tabs[i].click(); return "TAB:" + asc(id); }
}
return "NOTAB:" + ids.join("|");
"""
            _JS_OPEN = r"""
var u = (arguments[0] || "").trim().toLowerCase();
if (!u) { return "NOUSER"; }
var all = document.querySelectorAll("*");
var hit = null;
for (var i = 0; i < all.length; i++) {
  var e = all[i];
  if (e.children.length === 0 && (e.textContent || "").trim().toLowerCase() === u) { hit = e; break; }
}
if (!hit) { return "NOROW"; }
var re = /\u0e44\u0e21\u0e48\u0e2b\u0e21\u0e14\u0e2d\u0e32\u0e22\u0e38|never|no expir|[0-9]{4}-[0-9]{2}-[0-9]{2}/i;
var row = hit.parentElement;
for (var d = 0; d < 7 && row; d++) {
  var kids = row.querySelectorAll("*");
  for (var j = 0; j < kids.length; j++) {
    var k = kids[j];
    if (k !== hit && k.children.length === 0 && re.test((k.textContent || "").trim())) {
      k.click();
      return "CLICK";
    }
  }
  row = row.parentElement;
}
return "NOEXP";
"""
            _JS_SAVE = r"""
var ok = /\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01|^save$|^apply$|^confirm$|^ok$|^add access$/i;
var no = /\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01|cancel|close/i;
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
var all = document.querySelectorAll("*");
var hit = null;
for (var i = 0; i < all.length; i++) {
  var e = all[i];
  if (e.children.length === 0 && (e.textContent || "").trim().toLowerCase() === u) { hit = e; break; }
}
if (!hit) { return "NOROW"; }
var never = /\u0e44\u0e21\u0e48\u0e2b\u0e21\u0e14\u0e2d\u0e32\u0e22\u0e38|never|no expir/i;
var dated = /[0-9]{4}-[0-9]{2}-[0-9]{2}/;
var row = hit.parentElement;
for (var d = 0; d < 7 && row; d++) {
  var kids = row.querySelectorAll("*");
  for (var j = 0; j < kids.length; j++) {
    var k = kids[j];
    if (k === hit || k.children.length !== 0) { continue; }
    var t = (k.textContent || "").trim();
    if (dated.test(t)) { return "DATED:" + asc(t); }
    if (never.test(t)) { return "UNLIMITED"; }
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

            _fix = driver.execute_script(_JS_FIX, expiry_date)
            if _fix == "NODLG":
                # dialog did not pop up: go to the access list and open it from the row
                print("tv tab:", driver.execute_script(_JS_TAB))
                time.sleep(2)
                print("tv expiry open:", driver.execute_script(_JS_OPEN, username))
                time.sleep(1.5)
                _fix = driver.execute_script(_JS_FIX, expiry_date)
            print("tv expiry set:", _fix)

            # with the checkbox off the field is interactable again, so plain
            # Selenium typing works as a fallback if the JS value did not stick
            if isinstance(_fix, str) and _fix.endswith("mismatch"):
                try:
                    for _el in driver.find_elements(By.XPATH, "//input[contains(@class,'with-end-slot')]"):
                        if _el.is_displayed() and _el.is_enabled():
                            _el.clear()
                            _el.send_keys(expiry_date)
                            time.sleep(0.5)
                            break
                except Exception as _e:
                    print("tv expiry send_keys fallback failed:", _e)

            time.sleep(0.8)
            print("tv expiry save:", driver.execute_script(_JS_SAVE))
            time.sleep(3)

            _seen = driver.execute_script(_JS_CHECK, username)
            if _seen == "NOROW":
                driver.execute_script(_JS_TAB)
                time.sleep(2)
                _seen = driver.execute_script(_JS_CHECK, username)
            if isinstance(_seen, str) and _seen.startswith("DATED"):
                print("EXPIRY_OK", username, expiry_date, _seen)
            else:
                print("EXPIRY_FAIL", username, expiry_date, _seen)

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
            return True'''


def main(path):
    s = io.open(path, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in s else "\n"

    if "ROBUST_DATE_V3" in s:
        print("PATCH already applied (ROBUST_DATE_V3)")
        return 0

    i = s.find("# 6) ROBUST_DATE_V")
    if i < 0:
        i = s.find("# 6) ")
    if i < 0:
        print("PATCH_FAIL no anchor '# 6)'")
        return 1

    ends = [(x, n) for x, n in ((s.find("return True", i), "return True"),
                                (s.find("return False", i), "return False")) if x >= 0]
    if not ends:
        print("PATCH_FAIL no return after anchor")
        return 1
    j, name = min(ends)
    j += len(name)

    out = s[:i] + nl.join(NEW_BLOCK.split("\n")) + s[j:]
    shutil.copy(path, path + ".bak_v3")
    io.open(path, "w", encoding="utf-8", newline="").write(out)
    print("PATCH_OK ROBUST_DATE_V3 replaced %d chars at %d" % (j - i, i))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
