import os, sys, json, warnings, subprocess, re, unicodedata
from pathlib import Path
import gdown

warnings.filterwarnings("ignore")
os.environ["PYTHONIOENCODING"] = "utf-8"

BASE = Path(r"C:\Users\abdoh\Downloads\testScript")
CFG  = BASE / "config" / "temp-title.json"
BAT  = BASE / "batch" / "watch_clean.bat"

# ---------- Helpers ----------
BIDI_RE = re.compile(r'[\u200e\u200f\u202a-\u202e\u200b\u200c\u200d\ufeff]')

def strip_bidi(s: str) -> str:
    return BIDI_RE.sub('', s or '')

def safe_title(raw: str, max_len: int = 25) -> str:
    """Clean + shorten a folder-friendly title."""
    s = strip_bidi(raw)
    s = unicodedata.normalize('NFKC', s)
    # إزالة محارف ويندوز الممنوعة + أسكي كنترول
    s = re.sub(r'[<>:"/\\|?*\x00-\x1F]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    if len(s) <= max_len:
        return s
    # حاول نحافظ على رقم/كود نهائي إن وُجد
    m = re.search(r'([ _\-]?\d{4,})\)?$', s)
    suffix = (m.group(0).strip() if m else '')
    reserve = max_len - (len(suffix) + (1 if suffix else 0))
    core = s[:max(0, reserve-1)].rstrip()
    return (f"{core}… {suffix}" if suffix else core + "…")

def ensure_unique(path: Path) -> Path:
    """Avoid clashing with existing folder."""
    if not path.exists():
        return path
    i = 2
    while True:
        cand = path.with_name(f"{path.name} ({i})")
        if not cand.exists():
            return cand
        i += 1

def log(msg, tag="INFO"):
    print(f"[{tag}] {msg}")

# ---------- Main ----------
if not CFG.exists():
    sys.exit("[ERROR] Config file not found!")

cfg   = json.load(open(CFG, encoding="utf-8"))
raw_title = cfg.get("title", "Untitled")
url   = (cfg.get("folder_url", "") or "").strip()

title = safe_title(raw_title, max_len=25)
downloads = Path(r"C:\Users\abdoh\Downloads")

log("Starting Manga Automation")

if not url:
    log("No folder URL provided in config.", "ERR")
    sys.exit(1)

# حدّد مجلد العمل
if os.path.exists(url):
    folder = Path(url)
    log(f"Using local folder: {folder}")
else:
    folder = ensure_unique(downloads / title)
    folder.mkdir(parents=True, exist_ok=True)
    log(f"Downloading to: {folder}")
    try:
        gdown.download_folder(url, output=str(folder), quiet=False, use_cookies=False)
        log("Download complete.", "OK")
    except Exception as e:
        log(f"Download failed: {e}", "ERR")
        sys.exit(1)

# اكتب القيم النظيفة في الـ JSON
cfg["title"]  = title
cfg["folder"] = str(folder)
with open(CFG, "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)

# شغّل ملف الـBAT مع تمرير الوسائط
if not BAT.exists():
    log(f"Batch file not found: {BAT}", "ERR")
    sys.exit(1)

log("Launching watch_clean.bat...")
try:
    subprocess.run(["cmd", "/c", str(BAT), title, str(folder)], check=True)
    log("watch_clean.bat finished successfully.", "OK")
except subprocess.CalledProcessError as e:
    log(f"watch_clean.bat exited with an error: {e}", "ERR")
except Exception as e:
    log(f"Failed to launch batch file: {e}", "ERR")

log("All finished ✅")
