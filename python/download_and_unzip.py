import os, sys, time, json, warnings, subprocess, gdown
from pathlib import Path

warnings.filterwarnings("ignore")
os.environ["PYTHONIOENCODING"] = "utf-8"

# === إعداد ===
BASE = Path(r"C:\Users\abdoh\Downloads\testScript")
CFG = BASE / "config" / "temp-title.json"
BAT = BASE / "batch" / "watch_clean.bat"
MAIN = BASE / "pcleaner" / "main.py"

if not CFG.exists():
    sys.exit("[ERROR] Config file not found!")

cfg = json.load(open(CFG, encoding="utf-8"))
title, url = cfg.get("title", "Untitled"), cfg.get("folder_url", "")


# === طباعة أنيقة ===
def log(msg, tag="INFO"):
    print(f"[{tag}] {msg}")


# === تنظيف ===
def clean(folder):
    folder = Path(folder)
    if not folder.exists():
        return log("Folder not found!", "ERR")
    if not MAIN.exists():
        return log("main.py missing!", "ERR")

    log(f"Cleaning: {folder}")
    t0 = time.time()
    proc = subprocess.Popen(
        [sys.executable, MAIN, "clean", folder],
        cwd=MAIN.parent,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    for line in proc.stdout:
        if not any(w in line for w in ("UserWarning", "pkg_resources")):
            print(line.strip())
    proc.wait()
    log(f"Done in {time.time()-t0:.1f}s", "OK" if proc.returncode == 0 else "WARN")


# === MAIN ===
log("Starting Manga Cleaner Automation")
if os.path.exists(url):
    f = Path(url)
    log(f"Using local folder: {f}")
    if not (f / "cleaned").exists():
        clean(f)
    else:
        log("Already cleaned.")
else:
    out = Path(r"C:\Users\abdoh\Downloads") / title
    if out.exists():
        out = out.parent / f"{title}_{time.strftime('%Y%m%d_%H%M%S')}"
    out.mkdir(parents=True, exist_ok=True)
    log(f"Downloading to: {out}")
    try:
        gdown.download_folder(url, output=str(out), quiet=False, use_cookies=False)
        log("Download complete.", "OK")
        clean(out)
    except Exception as e:
        log(f"Download failed: {e}", "ERR")

# === Photoshop batch ===
log("Launching Photoshop batch...")
try:
    subprocess.run([BAT], check=True, shell=True)
    log("Photoshop done.", "OK")
except Exception as e:
    log(f"Photoshop failed: {e}", "ERR")

log("All finished ✅")
