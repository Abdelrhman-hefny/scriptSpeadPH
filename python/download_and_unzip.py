import os, sys, time, json, warnings, subprocess, gdown
from pathlib import Path

warnings.filterwarnings("ignore")
os.environ["PYTHONIOENCODING"] = "utf-8"

BASE = Path(r"C:\Users\abdoh\Downloads\testScript")
CFG = BASE / "config" / "temp-title.json"
BAT = BASE / "batch" / "watch_clean.bat"

if not CFG.exists():
    sys.exit("[ERROR] Config file not found!")

cfg = json.load(open(CFG, encoding="utf-8"))
title, url = cfg.get("title", "Untitled"), cfg.get("folder_url", "").strip()

def log(msg, tag="INFO"):
    print(f"[{tag}] {msg}")

log("Starting Manga Automation")

if not url:
    log("No folder URL provided in config.", "ERR")
    sys.exit(1)

if os.path.exists(url):
    folder = Path(url)
    log(f"Using local folder: {folder}")
else:
    folder = Path(r"C:\Users\abdoh\Downloads") / title
    if not folder.exists():
        folder.mkdir(parents=True, exist_ok=True)
    log(f"Downloading to: {folder}")
    try:
        gdown.download_folder(url, output=str(folder), quiet=False, use_cookies=False)
        log("Download complete.", "OK")
    except Exception as e:
        log(f"Download failed: {e}", "ERR")
        sys.exit(1)

if not BAT.exists():
    log(f"Batch file not found: {BAT}", "ERR")
    sys.exit(1)

log("Launching watch_clean.bat...")
try:
    subprocess.run([str(BAT), str(title), str(folder)], check=True)
    log("watch_clean.bat finished successfully.", "OK")
except subprocess.CalledProcessError as e:
    log(f"watch_clean.bat exited with an error: {e}", "ERR")
except Exception as e:
    log(f"Failed to launch batch file: {e}", "ERR")

log("All finished ✅")
