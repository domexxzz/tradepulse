# -*- coding: utf-8 -*-
import os, glob, subprocess
def safe(fn):
    try: return fn()
    except Exception as e: return "ERR " + str(e)

print("=== dirs hermes/sentiara ===")
for base in [r"C:\\", r"C:\Users\User", r"C:\Users\User\OneDrive\Desktop", r"C:\Users\User\Documents"]:
    try:
        for d in os.listdir(base):
            low = d.lower()
            if "ermes" in low or "sentiara" in low:
                full = os.path.join(base, d)
                print(full, "(DIR)" if os.path.isdir(full) else "(FILE)")
    except Exception: pass

print("=== listen ports ===")
def ports():
    out = subprocess.check_output("netstat -ano -p tcp", shell=True, text=True, errors="ignore")
    s = set()
    for line in out.splitlines():
        if "LISTENING" in line:
            parts = line.split()
            if len(parts) >= 2 and ":" in parts[1]:
                p = parts[1].rsplit(":", 1)[1]
                if p.isdigit() and 1024 < int(p) < 60000:
                    s.add(int(p))
    return sorted(s)
print(safe(ports))

print("=== hermes files (config/readme/db) ===")
for root in [r"C:\Users\User", r"C:\Users\User\OneDrive\Desktop"]:
    for pat in ["*ermes*", "*ermes*/*.md", "*ermes*/*.json", "*ermes*/*.py", "*ermes*/*.db", "*ermes*/*.env", "*ermes*/*.txt"]:
        for f in glob.glob(os.path.join(root, pat))[:8]:
            print(f)

print("=== hermes process cmdline ===")
def proc():
    out = subprocess.check_output(
        'wmic process where "name=\'python.exe\' or name=\'node.exe\'" get commandline',
        shell=True, text=True, errors="ignore")
    return "\n".join([l.strip() for l in out.splitlines() if "ermes" in l.lower()][:6]) or "(none matched hermes)"
print(safe(proc))
