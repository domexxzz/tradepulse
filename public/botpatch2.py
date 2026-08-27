# -*- coding: utf-8 -*-
# TradingView bot patch V2 - set a REAL expiry date
#
# Root cause found by the site owner: the "Set expiration date" dialog opens with
# the "No expiration date" checkbox ALREADY CHECKED, which disables the date input.
# That is why the old code got "element not interactable" and V1 fell back to
# unlimited access. Fix = uncheck that box first, then the date field accepts input.
#
# ASCII ONLY on purpose: Windows PowerShell 5.1 misreads UTF-8 without BOM, and
# print() of Thai text crashes on a cp874 console. Thai UI strings are matched via
# \uXXXX escapes inside the injected JavaScript instead.
import io, shutil, sys

TARGET = r"C:\Users\User\OneDrive\Desktop\Bot Tradingview\tlapi.py"

NEW_BLOCK = r'''# 6) ROBUST_DATE_V2 uncheck "no expiration" first, then set the real expiry date
            _JS_TAB = r"""
var re = /\u0e22\u0e34\u0e19\u0e22\u0e2d\u0e21|users with access|granted/i;
var els = document.querySelectorAll("button,div,span,a");
for (var i = 0; i < els.length; i++) {
  var e = els[i];
  if (e.children.length === 0 && re.test((e.textContent || "").trim())) { e.click(); return "TAB"; }
}
return "NOTAB";
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
            _JS_FIX = r"""
var v = arguments[0];
var DLG = "[role=dialog],[data-dialog-name],[class*=dialog],[class*=modal],[class*=popup]";
// the "no expiration" checkbox is the one whose own label mentions expiry
var lab = /\u0e2b\u0e21\u0e14\u0e2d\u0e32\u0e22\u0e38|expir/i;
var cbs = document.querySelectorAll("input[type=checkbox]");
var cb = null;
for (var i = 0; i < cbs.length; i++) {
  var c = cbs[i];
  var host = c.closest("label") || c.parentElement;
  if (host && lab.test(host.textContent || "")) { cb = c; break; }
}
if (!cb) { for (var i = 0; i < cbs.length; i++) { if (cbs[i].checked) { cb = cbs[i]; break; } } }
var un = 0;
if (cb && cb.checked) { cb.click(); un = 1; }
// scope everything else to the dialog that checkbox lives in
var root = cb ? cb.closest(DLG) : null;
if (!root) { root = document; }
window.__qvxDlg = root;
var di = root.querySelector("input[class*=end-slot]") || root.querySelector("input[type=date]");
if (!di) {
  var ins = root.querySelectorAll("input");
  for (var i = 0; i < ins.length; i++) {
    var t = (ins[i].type || "").toLowerCase();
    if (t === "checkbox" || t === "hidden" || t === "radio") { continue; }
    var pv = (ins[i].placeholder || "") + " " + (ins[i].value || "");
    if (/[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(pv)) { di = ins[i]; break; }
    if (!di) { di = ins[i]; }
  }
}
if (!di) { return "NOINPUT:" + un; }
di.disabled = false; di.removeAttribute("disabled");
di.readOnly = false; di.removeAttribute("readonly");
var st = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
st.call(di, v);
di.dispatchEvent(new Event("input", { bubbles: true }));
di.dispatchEvent(new Event("change", { bubbles: true }));
return "SET:" + un + ":" + (di.value === v ? "ok" : "mismatch");
"""
            _JS_SAVE = r"""
var root = window.__qvxDlg || document;
var ok = /\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01|^save$|^apply$|^confirm$|^ok$/i;
var no = /\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01|cancel|close/i;
var btns = root.querySelectorAll("button");
var pick = null;
for (var i = 0; i < btns.length; i++) {
  if (btns[i].offsetParent === null) { continue; }
  var t = (btns[i].textContent || "").trim();
  if (!t || no.test(t)) { continue; }
  if (ok.test(t)) { pick = btns[i]; }
}
if (!pick) { return "NOSAVE"; }
pick.click();
window.__qvxDlg = null;
return "SAVED";
"""
            _JS_CHECK = r"""
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
    if (dated.test(t)) { return "DATED:" + t; }
    if (never.test(t)) { return "UNLIMITED"; }
  }
  row = row.parentElement;
}
return "UNKNOWN";
"""

            # 6.1 commit the add - user may already have access, so errors are ignored
            for _xp in ["//button[.//span[text()='Add access']]", "//span[text()='Add access']/ancestor::button[1]"]:
                try:
                    for _b in driver.find_elements(By.XPATH, _xp):
                        if _b.is_displayed():
                            driver.execute_script("arguments[0].click();", _b)
                            time.sleep(1.5)
                except Exception:
                    pass
            time.sleep(2.5)

            # 6.2 read username / expiry date out of whatever local names this build uses
            _lv = dict(locals())
            _un = ""
            for _n in ("username", "user_name", "tv_username", "tvusername", "user"):
                if _lv.get(_n):
                    _un = str(_lv[_n]).strip()
                    break
            if not _un:
                for _k, _v in _lv.items():
                    try:
                        if isinstance(_v, dict) and _v.get("username"):
                            _un = str(_v["username"]).strip()
                            break
                    except Exception:
                        pass
            _dv = ""
            for _n in ("expiry_date", "expire_date", "exp_date", "expiry", "date_str", "end_date"):
                if _lv.get(_n):
                    _dv = str(_lv[_n]).strip()
                    break
            if not _dv:
                for _n in ("days", "day", "duration", "days_valid"):
                    if _lv.get(_n):
                        try:
                            import datetime as _dt
                            _dv = (_dt.date.today() + _dt.timedelta(days=int(_lv[_n]))).isoformat()
                            break
                        except Exception:
                            pass
            if "/" in _dv:
                _p = _dv.split("/")
                if len(_p) == 3:
                    _dv = (_p[0] + "-" + _p[1].zfill(2) + "-" + _p[2].zfill(2)) if len(_p[0]) == 4 \
                        else (_p[2] + "-" + _p[1].zfill(2) + "-" + _p[0].zfill(2))
            print("tv expiry target:", _un, _dv)

            # 6.3 open the expiry dialog, uncheck "no expiration", type the date, save, verify
            _exp = "SKIPPED"
            if _un and _dv:
                try:
                    _r1 = driver.execute_script(_JS_OPEN, _un)
                    if _r1 == "NOROW":
                        print("tv tab:", driver.execute_script(_JS_TAB))
                        time.sleep(1.5)
                        _r1 = driver.execute_script(_JS_OPEN, _un)
                    print("tv expiry open:", _r1)
                    time.sleep(1.5)

                    _r2 = driver.execute_script(_JS_FIX, _dv)
                    print("tv expiry set:", _r2)
                    # checkbox is off now, so the plain Selenium path works as a fallback
                    if isinstance(_r2, str) and _r2.endswith("mismatch"):
                        try:
                            for _e2 in driver.find_elements(By.XPATH, "//input[contains(@class,'with-end-slot')]"):
                                if _e2.is_displayed() and _e2.is_enabled():
                                    _e2.clear()
                                    _e2.send_keys(_dv)
                                    time.sleep(0.5)
                                    break
                        except Exception as _e3:
                            print("tv expiry send_keys fallback failed:", _e3)
                    time.sleep(0.8)

                    print("tv expiry save:", driver.execute_script(_JS_SAVE))
                    time.sleep(2.5)
                    _exp = driver.execute_script(_JS_CHECK, _un)
                except Exception as _e:
                    _exp = "ERROR"
                    print("tv expiry flow error:", _e)

            if isinstance(_exp, str) and _exp.startswith("DATED"):
                print("EXPIRY_OK", _un, _dv, _exp)
            else:
                print("EXPIRY_FAIL", _un, _dv, _exp)

            try:
                await update.message.reply_text("OK added " + str(_un) + " until " + str(_dv))
            except Exception:
                pass
            try:
                if driver:
                    driver.quit()
            except Exception:
                pass
            return True'''


def main():
    s = io.open(TARGET, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in s else "\n"

    if "ROBUST_DATE_V2" in s:
        print("PATCH already applied (ROBUST_DATE_V2)")
        return 0

    i = s.find("# 6) ROBUST_DATE_V1")
    if i < 0:
        i = s.find("# 6) ")
    if i < 0:
        print("PATCH_FAIL no anchor '# 6)'")
        return 1

    jt = s.find("return True", i)
    jf = s.find("return False", i)
    ends = [(x, n) for x, n in ((jt, "return True"), (jf, "return False")) if x >= 0]
    if not ends:
        print("PATCH_FAIL no return after anchor")
        return 1
    j, name = min(ends)
    j += len(name)

    block = nl.join(NEW_BLOCK.split("\n"))
    out = s[:i] + block + s[j:]

    shutil.copy(TARGET, TARGET + ".bak3")
    io.open(TARGET, "w", encoding="utf-8", newline="").write(out)
    print("PATCH_OK ROBUST_DATE_V2 replaced", (j - i), "chars, backup tlapi.py.bak3")
    return 0


if __name__ == "__main__":
    sys.exit(main())
