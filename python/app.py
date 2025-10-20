# app.py
import sys, os, json, subprocess, requests, datetime, re, unicodedata, tempfile
from pathlib import Path
from glob import glob

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QFileDialog, QMessageBox, QTextEdit,
    QProgressBar, QSpinBox, QCheckBox, QRadioButton, QComboBox, QLineEdit, QLabel, QPushButton
)
from PyQt5.QtCore import QThread, pyqtSignal, QTimer
from urllib.parse import urlparse

from ui_manga import build_ui  # الواجهة مفصولة هنا

# لا تكتب __pycache__/pyc
sys.dont_write_bytecode = True

# ----- المسارات الثابتة -----
CFG_PATH        = r"C:\Users\abdoh\Downloads\testScript\config\temp-title.json"
MANGA_TEXT_PATH = r"C:\Users\abdoh\Downloads\testScript\manga_text.txt"
DEFAULT_PSPATH  = r"C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"
DOWNLOADS_DIR   = r"C:\Users\abdoh\Downloads"  # قاعدة أي تحميلات للرابط

# ===== Utilities =====
BIDI_RE = re.compile(r'[\u200e\u200f\u202a-\u202e\u200b\u200c\u200d\ufeff]')

def clean_title(s: str) -> str:
    s = BIDI_RE.sub('', s or '')
    s = unicodedata.normalize('NFKC', s)
    s = re.sub(r'[<>:"/\\|?*\x00-\x1F]', ' ', s)  # disallow Windows reserved chars
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def looks_like_url(s: str) -> bool:
    p = urlparse((s or '').strip())
    return p.scheme in ('http', 'https') and bool(p.netloc)

def is_drive_url(s: str) -> bool:
    p = urlparse((s or '').strip())
    host = (p.netloc or '').lower()
    return p.scheme in ('http', 'https') and any(
        h in host for h in ('drive.google.com', 'docs.google.com', 'googleusercontent.com')
    )

# ======================== Worker ========================
class WorkerThread(QThread):
    status = pyqtSignal(str)
    finished = pyqtSignal(bool, str)

    def __init__(
        self,
        folder_url,
        team,
        mode,
        font_size,
        stop_after_first,
        continue_no_dialog,
        auto_next,
        enable_log=False,
        ocr_model="easy",          # ثابت على EasyOCR
        dont_Open_After_Clean=False,
        ai_clean=False,
        manual_title=None,         # اسم الفصل اليدوي عند روابط Drive
    ):
        super().__init__()
        self.folder_url = folder_url.strip()
        self.team = team
        self.pspath = DEFAULT_PSPATH
        self.mode = mode
        self.font_size = font_size
        self.stop_after_first = stop_after_first
        self.continue_no_dialog = continue_no_dialog
        self.auto_next = auto_next
        self.enable_log = enable_log
        self.ocr_model = "easy"    # تأكيد التثبيت على easy
        self.dont_Open_After_Clean = dont_Open_After_Clean
        self.ai_clean = ai_clean
        self.manual_title = (manual_title or "").strip()

        # ملف لوج مؤقت فقط لو مفعّل
        if enable_log:
            log_dir = os.path.join(tempfile.gettempdir(), "manga_logs")
            os.makedirs(log_dir, exist_ok=True)
            today = datetime.datetime.now().strftime("%Y-%m-%d")
            self.log_path = os.path.join(log_dir, f"manga_log_{today}.log")
        else:
            self.log_path = None

    def log(self, msg):
        self.status.emit(msg)
        print(msg)
        if self.enable_log and self.log_path:
            try:
                with open(self.log_path, "a", encoding="utf-8") as f:
                    f.write(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}\n")
            except Exception as e:
                print(f"⚠ Error writing to log file: {e}")

    def run(self):
        if not os.path.exists(self.pspath):
            self.log(f"Photoshop not found: {self.pspath}")
            self.finished.emit(False, "Photoshop executable not found")
            return

        if not self.folder_url:
            self.log("No folder URL or path provided")
            self.finished.emit(False, "No folder URL or path provided")
            return

        # --- تحديد العنوان ---
        if os.path.exists(self.folder_url):
            title = os.path.basename(self.folder_url) or self.folder_url
            self.log(f"Local folder detected: {title}")
            self.log(f"Team detected: {self.team}")
        else:
            if is_drive_url(self.folder_url) and self.manual_title:
                title = self.manual_title
                self.log("Google Drive URL detected — using manual chapter title.")
            else:
                self.log("Google Drive/URL detected — extracting title...")
                try:
                    parsed_url = urlparse(self.folder_url)
                    if not parsed_url.scheme or not parsed_url.netloc:
                        raise ValueError("Invalid URL format")
                    html = requests.get(self.folder_url, timeout=10).text
                    title = (
                        html.split("<title>")[1]
                        .split("</title>")[0]
                        .replace(" - Google Drive", "")
                        .strip()
                    )
                    if not title:
                        title = "Untitled_Manga"
                except Exception as e:
                    self.log(f"Error extracting title: {e}")
                    self.finished.emit(False, "Failed to extract title from URL")
                    return

        title = clean_title(title)

        # 👇 حدّد المسار المحلي النهائي (لو رابط → Downloads\title)
        if os.path.exists(self.folder_url):
            folder_local = self.folder_url
        else:
            folder_local = os.path.join(DOWNLOADS_DIR, title)

        # --- اكتب JSON فقط ---
        try:
            os.makedirs(os.path.dirname(CFG_PATH), exist_ok=True)

            cfg_obj = {
                "title": title,
                "folder_url": self.folder_url,  # ممكن تكون رابط
                "folder": folder_local,         # 👈 المسار المحلي الفعلي للعمل
                "team": self.team,
                "pspath": self.pspath,
                "mode": self.mode,
                "fontSize": int(self.font_size),
                "stopAfterFirstPage": bool(self.stop_after_first),
                "continueWithoutDialog": bool(self.continue_no_dialog),
                "autoNext": bool(self.auto_next),
                "ocr_model": "easy",  # ثابت
                "dont_Open_After_Clean": bool(self.dont_Open_After_Clean),
                "ai_clean": bool(self.ai_clean),
            }

            with open(CFG_PATH, "w", encoding="utf-8") as f:
                json.dump(cfg_obj, f, indent=2, ensure_ascii=False)

            self.log(f"✅ Saved config to {CFG_PATH}")
        except Exception as e:
            self.log(f"❌ Error saving configuration: {e}")
            self.finished.emit(False, "Failed to save configuration")
            return

        # --- تشغيل سكربت التحميل والمعالجة ---
        try:
            self.log("🚀 Running download_and_unzip.py ...")
            subprocess.run(
                [
                    "python", "-B",
                    r"C:\Users\abdoh\Downloads\testScript\python\download_and_unzip.py",
                ],
                check=True,
                timeout=1000,
            )
            self.log("✅ Processing completed.")
            self.finished.emit(True, "Success")
        except subprocess.TimeoutExpired:
            self.log("❌ Script execution timed out")
            self.finished.emit(False, "Script execution timed out")
        except subprocess.CalledProcessError as e:
            self.log(f"❌ Error running script: {e}")
            self.finished.emit(False, "Script execution failed")
        except Exception as e:
            self.log(f"❌ Unexpected error: {e}")
            self.finished.emit(False, "Unexpected error during script execution")

# ======================== الواجهة ========================
class MangaApp(QMainWindow):
    TEAMS = [
        "rezo", "violet", "ez", "seren", "magus",
        "nyx", "arura", "ken", "mei", "quantom",
    ]

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Manga Downloader (مبسط)")
        self.setMinimumSize(400, 620)

        # يبني الواجهة بالكامل ويربط العناصر بالنافذة (attributes)
        build_ui(self)

        # تشيك لايف عند لصق/كتابة الرابط
        self.url.textChanged.connect(self.on_url_changed)

        self.worker = None
        self.load_config_if_exists()

    # ===== UI helpers =====
    def on_url_changed(self, text: str):
        t = (text or '').strip()
        # يظهر فقط إن كان الرابط Google Drive/Docs (وليس مسار محلي)
        show = (looks_like_url(t) and not os.path.exists(t)) and is_drive_url(t)
        self.chapter_label.setVisible(show)
        self.chapter_edit.setVisible(show)

    def browse(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Folder")
        if folder:
            self.url.setText(folder)

    def open_manga_text(self):
        try:
            if os.path.exists(MANGA_TEXT_PATH):
                subprocess.run(["notepad.exe", MANGA_TEXT_PATH], check=True)
                self.append_log(f"✅ Opened {MANGA_TEXT_PATH} in Notepad.")
            else:
                self.append_log(f"❌ File {MANGA_TEXT_PATH} does not exist.")
                QMessageBox.critical(self, "Error", f"File {MANGA_TEXT_PATH} does not exist.")
        except Exception as e:
            self.append_log(f"❌ Error opening manga text file: {e}")
            QMessageBox.critical(self, "Error", f"Failed to open manga text file: {e}")

    def is_image_open(self):
        try:
            result = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq Photoshop.exe"],
                capture_output=True,
                text=True,
            )
            return "Photoshop.exe" in result.stdout
        except Exception as e:
            self.append_log(f"⚠ Error checking for open images: {e}")
            return False

    def append_log(self, text):
        self.log.append(text)
        print(text)
        self.log.ensureCursorVisible()

    def clear_win_terminal(self):
        """يمسح شاشة ترمنال ويندوز (CMD/PowerShell) المرتبطة بهذه العملية فقط."""
        try:
            import ctypes
            has_console = bool(ctypes.windll.kernel32.GetConsoleWindow())
            if has_console:
                os.system("cls")
                self.append_log("🧹 Cleared Windows terminal (CMD/PowerShell).")
                self.log.clear()
            else:
                self.append_log("ℹ️ No attached console to clear (app probably started without a console).")
        except Exception as e:
            self.append_log(f"❌ Failed to clear Windows terminal: {e}")

    def load_config_if_exists(self):
        if os.path.exists(CFG_PATH):
            try:
                with open(CFG_PATH, encoding="utf-8") as f:
                    cfg = json.load(f)
                self.url.setText(cfg.get("folder_url", ""))
                if cfg.get("team") in self.TEAMS:
                    self.team.setCurrentText(cfg["team"])
                mode = cfg.get("mode", "normal")
                if mode == "fast":
                    self.rb_fast.setChecked(True)
                elif mode == "ultra":
                    self.rb_ultra.setChecked(True)
                else:
                    self.rb_normal.setChecked(True)
                self.font_spin.setValue(int(cfg.get("fontSize", 10)))
                self.stop_chk.setChecked(cfg.get("stopAfterFirstPage", False))
                self.continue_chk.setChecked(cfg.get("continueWithoutDialog", False))
                self.auto_next_chk.setChecked(cfg.get("autoNext", False))
                self.dont_Open_After_Clean.setChecked(cfg.get("dont_Open_After_Clean", False))
            except Exception as e:
                self.append_log(f"⚠ Error loading config: {e}")

    def save_settings(self):
        folder_url = self.url.text().strip()
        if not folder_url:
            self.append_log("No folder URL or path provided for saving settings")
            QMessageBox.warning(self, "Error", "Please enter a URL or folder path.")
            return

        # تحديد العنوان بناءً على نوع الرابط/المسار
        if os.path.exists(folder_url):
            title = os.path.basename(folder_url) or folder_url
        else:
            if is_drive_url(folder_url):
                manual = self.chapter_edit.text().strip()
                title = manual if manual else "Untitled_Manga"
            else:
                try:
                    parsed_url = urlparse(folder_url)
                    if not parsed_url.scheme or not parsed_url.netloc:
                        raise ValueError("Invalid URL format")
                    html = requests.get(folder_url, timeout=10).text
                    title = (
                        html.split("<title>")[1]
                        .split("</title>")[0]
                        .replace(" - Google Drive", "")
                        .strip()
                    ) or "Untitled_Manga"
                except Exception:
                    title = "Untitled_Manga"

        title = clean_title(title)

        # 👇 حدّد المسار المحلي النهائي (لو رابط → Downloads\title)
        if os.path.isdir(folder_url):
            folder_local = folder_url
        else:
            folder_local = os.path.join(DOWNLOADS_DIR, title)

        try:
            os.makedirs(os.path.dirname(CFG_PATH), exist_ok=True)

            mode = (
                "fast"
                if self.rb_fast.isChecked()
                else "ultra" if self.rb_ultra.isChecked() else "normal"
            )

            cfg_obj = {
                "title": title,
                "folder_url": folder_url,    # قد يكون رابط
                "folder": folder_local,      # 👈 المسار المحلي النهائي للعمل
                "team": self.team.currentText(),
                "pspath": DEFAULT_PSPATH,
                "mode": mode,
                "fontSize": int(self.font_spin.value()),
                "stopAfterFirstPage": bool(self.stop_chk.isChecked()),
                "continueWithoutDialog": bool(self.continue_chk.isChecked()),
                "autoNext": bool(self.auto_next_chk.isChecked()),
                "ocr_model": "easy",  # ثابت — EasyOCR فقط
                "dont_Open_After_Clean": bool(self.dont_Open_After_Clean.isChecked()),
                "ai_clean": bool(self.ai_clean_chk.isChecked()),
            }

            with open(CFG_PATH, "w", encoding="utf-8") as f:
                json.dump(cfg_obj, f, indent=2, ensure_ascii=False)

            self.append_log(f"✅ Saved settings to {CFG_PATH}")
        except Exception as e:
            self.append_log(f"❌ Error saving settings: {e}")
            QMessageBox.critical(self, "Error", "Failed to save settings")

    def start_process(self):
        url = self.url.text().strip()
        if not url:
            QMessageBox.warning(self, "Error", "Please enter a URL or folder path.")
            return

        if not os.path.exists(DEFAULT_PSPATH):
            QMessageBox.warning(self, "Error", "Photoshop executable path is invalid.")
            return

        self.start_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.bar.show()

        mode = (
            "fast" if self.rb_fast.isChecked()
            else "ultra" if self.rb_ultra.isChecked() else "normal"
        )
        enable_log = self.enable_log_chk.isChecked()

        self.worker = WorkerThread(
            url,
            self.team.currentText(),
            mode,
            self.font_spin.value(),
            self.stop_chk.isChecked(),
            self.continue_chk.isChecked(),
            self.auto_next_chk.isChecked(),
            enable_log,
            "easy",  # ثابت
            self.dont_Open_After_Clean.isChecked(),
            self.ai_clean_chk.isChecked(),
            manual_title=self.chapter_edit.text().strip(),  # تمرير الاسم اليدوي
        )
        self.worker.status.connect(self.append_log)
        self.worker.finished.connect(self.done)
        self.worker.start()

    def cancel_process(self):
        if self.worker and self.worker.isRunning():
            self.worker.terminate()
            self.append_log("⛔ Process cancelled.")
            self.done(False, "Cancelled")

    # إعادة تشغيل Photoshop وفتح ملفات PSD (تستخدم المسار المحلي من JSON)
    def restart_ps_and_open_psds(self):
        try:
            try:
                with open(CFG_PATH, "r", encoding="utf-8") as f:
                    cfg = json.load(f)

                folder_url = (cfg.get("folder_url", "") or "").strip()
                title      = (cfg.get("title", "") or "").strip()

                # أولويّة: folder من الـJSON → لو مش موجود: تحقّق من folder_url → وإلا Downloads\title
                folder_path = (cfg.get("folder", "") or "").strip()
                if not folder_path:
                    if os.path.isdir(folder_url):
                        folder_path = folder_url
                    else:
                        folder_path = os.path.join(DOWNLOADS_DIR, title)

            except Exception as e:
                self.append_log(f"❌ لم يتم العثور على مسار المجلد في الإعدادات: {e}")
                return

            if not os.path.isdir(folder_path):
                self.append_log(f"❌ المسار المحدد ({folder_path}) ليس مجلدًا صالحًا.")
                return

            psd_files = sorted(glob(os.path.join(folder_path, "*.psd")))
            if not psd_files:
                self.append_log(f"⚠ لم يتم العثور على ملفات PSD في المجلد: {folder_path}")
                return

            self.append_log(f"⏱️ إعادة تشغيل Photoshop وفتح {len(psd_files)} ملف PSD...")
            if not os.path.exists(DEFAULT_PSPATH):
                self.append_log("❌ فشل: مسار Photoshop غير صالح لإعادة التشغيل.")
                return

            command = [DEFAULT_PSPATH] + psd_files
            subprocess.Popen(command, shell=False)
            self.append_log(f"✅ تم بدء تشغيل Photoshop وفتح {len(psd_files)} ملف. (في عملية جديدة)")

        except Exception as e:
            self.append_log(f"❌ فشل في إعادة تشغيل Photoshop وفتح الملفات: {e}")
            QMessageBox.critical(self, "Error", f"Failed to restart Photoshop: {e}")

    def force_stop(self):
        try:
            self.append_log("🛑 إغلاق إجباري لـ Photoshop...")
            if self.worker and self.worker.isRunning():
                self.worker.terminate()
                self.append_log("تم إنهاء عملية العامل (Worker) بنجاح.")

            subprocess.Popen('taskkill /F /IM Photoshop.exe /T', shell=True)
            self.done(False, "Force stopped Photoshop")

            self.append_log("⏳ الانتظار 5 ثوانٍ قبل إعادة تشغيل Photoshop...")
            QTimer.singleShot(5000, self.restart_ps_and_open_psds)

        except Exception as e:
            self.append_log(f"❌ خطأ غير متوقع أثناء الإيقاف الإجباري: {e}")
            QMessageBox.critical(self, "Error", f"Failed to force stop processes: {e}")

    def done(self, ok, msg):
        self.start_btn.setEnabled(True)
        self.cancel_btn.setEnabled(True)
        self.bar.hide()
        if ok:
            self.append_log("✅ Done. Closing application...")
        else:
            self.append_log(f"❌ {msg}")

if __name__ == "__main__":
    app = QApplication(sys.argv)

    # حمّل الـQSS من ملف خارجي
    qss_path = Path(__file__).with_name("styles.qss")
    if qss_path.exists():
        try:
            app.setStyleSheet(qss_path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"⚠ Failed to load stylesheet: {e}")

    window = MangaApp()
    window.show()
    sys.exit(app.exec_())
