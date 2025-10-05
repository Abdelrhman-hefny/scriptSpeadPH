import sys, os, json, subprocess, requests, datetime
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QComboBox, QRadioButton, QPushButton,
    QTextEdit, QFileDialog, QCheckBox, QProgressBar, QSpinBox, QButtonGroup, QMessageBox
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QTimer
from urllib.parse import urlparse

# ----- المسارات -----
CFG_PATH = r"C:\Users\abdoh\Downloads\testScript\config\temp-title.json"
TXT_PATH = r"C:\Users\abdoh\Downloads\testScript\temp-title.txt"
DEFAULT_PSPATH = r"C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"
LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

# ======================== Worker ========================
class WorkerThread(QThread):
    status = pyqtSignal(str)
    finished = pyqtSignal(bool, str)

    def __init__(self, folder_url, team, pspath, manga_type, mode, font_size,
                 stop_after_first, continue_no_dialog, auto_next, enable_log=False):
        super().__init__()
        self.folder_url = folder_url.strip()
        self.team = team
        self.pspath = pspath
        self.manga_type = manga_type
        self.mode = mode
        self.font_size = font_size
        self.stop_after_first = stop_after_first
        self.continue_no_dialog = continue_no_dialog
        self.auto_next = auto_next
        self.enable_log = enable_log

        if enable_log:
            today = datetime.datetime.now().strftime("%Y-%m-%d")
            self.log_path = os.path.join(LOG_DIR, f"manga_log_{today}.log")
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

        if os.path.exists(self.folder_url):
            title = os.path.basename(self.folder_url) or self.folder_url
            self.log(f"Local folder detected: {title}")
        else:
            self.log("Google Drive URL detected — extracting title...")
            try:
                parsed_url = urlparse(self.folder_url)
                if not parsed_url.scheme or not parsed_url.netloc:
                    raise ValueError("Invalid URL format")
                html = requests.get(self.folder_url, timeout=10).text
                title = html.split("<title>")[1].split("</title>")[0].replace(" - Google Drive", "").strip()
                if not title:
                    title = "Untitled_Manga"
            except Exception as e:
                self.log(f"Error extracting title: {e}")
                self.finished.emit(False, "Failed to extract title from URL")
                return

        title = title.replace("?", "").replace(":", "_")
        self.log(f"Title: {title}")

        try:
            os.makedirs(os.path.dirname(CFG_PATH), exist_ok=True)
            with open(TXT_PATH, "w", encoding="utf-8") as f:
                f.write(f"{title}\n{self.folder_url}\n{self.team}\n{self.pspath}\n{self.manga_type}\n")

            cfg_obj = {
                "title": title,
                "folder_url": self.folder_url,
                "team": self.team,
                "pspath": self.pspath,
                "mangaType": self.manga_type,
                "mode": self.mode,
                "fontSize": int(self.font_size),
                "stopAfterFirstPage": bool(self.stop_after_first),
                "continueWithoutDialog": bool(self.continue_no_dialog),
                "autoNext": bool(self.auto_next)
            }

            with open(CFG_PATH, "w", encoding="utf-8") as f:
                json.dump(cfg_obj, f, indent=2, ensure_ascii=False)

            self.log(f"✅ Saved config to {CFG_PATH}")
        except Exception as e:
            self.log(f"❌ Error saving files: {e}")
            self.finished.emit(False, "Failed to save configuration")
            return

        try:
            self.log("🚀 Running download_and_unzip.py ...")
            subprocess.run(
                ["python", r"C:\Users\abdoh\Downloads\testScript\python\download_and_unzip.py"],
                check=True,
                timeout=300
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
    TEAMS = ["rezo", "violet", "ez", "seren", "magus", "nyx", "arura", "ken", "mei", "quantom"]

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Manga Downloader (مبسط)")
        self.setGeometry(300, 180, 520, 680)  # زيادة طفيفة في الارتفاع لاستيعاب زر Force Stop

        w = QWidget()
        layout = QVBoxLayout(w)
        self.setCentralWidget(w)

        # URL + Browse
        h = QHBoxLayout()
        self.url = QLineEdit()
        self.url.setPlaceholderText("Enter folder path or Google Drive URL")
        h.addWidget(self.url)
        btn_browse = QPushButton("Browse")
        btn_browse.clicked.connect(self.browse)
        h.addWidget(btn_browse)
        layout.addWidget(QLabel("Folder or Google Drive URL:"))
        layout.addLayout(h)

        # اختيار مسار Photoshop
        h_ps = QHBoxLayout()
        self.ps_path = QLineEdit(DEFAULT_PSPATH)
        self.ps_path.setPlaceholderText("Path to Photoshop executable")
        h_ps.addWidget(self.ps_path)
        btn_browse_ps = QPushButton("Browse")
        btn_browse_ps.clicked.connect(self.browse_photoshop)
        h_ps.addWidget(btn_browse_ps)
        layout.addWidget(QLabel("Photoshop Path:"))
        layout.addLayout(h_ps)

        # Team
        layout.addWidget(QLabel("Team:"))
        self.team = QComboBox()
        self.team.addItems(self.TEAMS)
        layout.addWidget(self.team)

        # نوع المانجا
        layout.addWidget(QLabel("Manga Type:"))
        self.rb_korian = QRadioButton("Korian")
        self.rb_japan = QRadioButton("Japanese")
        self.rb_korian.setChecked(True)
        grp_type = QButtonGroup(self)
        grp_type.addButton(self.rb_korian)
        grp_type.addButton(self.rb_japan)
        ht = QHBoxLayout()
        ht.addWidget(self.rb_korian)
        ht.addWidget(self.rb_japan)
        layout.addLayout(ht)

        # Mode
        layout.addWidget(QLabel("Mode:"))
        self.rb_normal = QRadioButton("Normal")
        self.rb_fast = QRadioButton("Fast")
        self.rb_ultra = QRadioButton("Ultra")
        self.rb_normal.setChecked(True)
        gm = QButtonGroup(self)
        gm.addButton(self.rb_normal)
        gm.addButton(self.rb_fast)
        gm.addButton(self.rb_ultra)
        hm = QHBoxLayout()
        hm.addWidget(self.rb_normal)
        hm.addWidget(self.rb_fast)
        hm.addWidget(self.rb_ultra)
        layout.addLayout(hm)

        # Font size
        hf = QHBoxLayout()
        hf.addWidget(QLabel("Font size:"))
        self.font_spin = QSpinBox()
        self.font_spin.setRange(6, 72)
        self.font_spin.setValue(10)
        hf.addWidget(self.font_spin)
        layout.addLayout(hf)

        # إعدادات
        self.stop_chk = QCheckBox("Stop after first page")
        layout.addWidget(self.stop_chk)
        self.continue_chk = QCheckBox("Continue without Photoshop dialog")
        layout.addWidget(self.continue_chk)
        self.auto_next_chk = QCheckBox("Auto Next (loop to next folder automatically)")
        layout.addWidget(self.auto_next_chk)
        self.enable_log_chk = QCheckBox("Enable log file")
        layout.addWidget(self.enable_log_chk)

        # زر لفتح مجلد اللوج
        btn_open_log = QPushButton("Open Log Folder")
        btn_open_log.clicked.connect(self.open_log_folder)
        layout.addWidget(btn_open_log)

        # Buttons
        h2 = QHBoxLayout()
        self.start_btn = QPushButton("Start")
        self.start_btn.clicked.connect(self.start_process)
        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.clicked.connect(self.cancel_process)
        self.force_stop_btn = QPushButton("Force Stop")  # زر جديد
        self.force_stop_btn.clicked.connect(self.force_stop)
        self.force_stop_btn.setEnabled(False)  # معطل افتراضيًا حتى يبدأ التشغيل
        h2.addWidget(self.start_btn)
        h2.addWidget(self.cancel_btn)
        h2.addWidget(self.force_stop_btn)
        layout.addLayout(h2)

        # Log viewer
        self.log = QTextEdit()
        self.log.setReadOnly(True)
        layout.addWidget(self.log)

        # Progress
        self.bar = QProgressBar()
        self.bar.setRange(0, 0)
        self.bar.hide()
        layout.addWidget(self.bar)

        self.worker = None
        self.load_config_if_exists()

    def browse(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Folder")
        if folder:
            self.url.setText(folder)

    def browse_photoshop(self):
        file, _ = QFileDialog.getOpenFileName(self, "Select Photoshop Executable", "", "Executable Files (*.exe)")
        if file:
            self.ps_path.setText(file)

    def open_log_folder(self):
        try:
            os.startfile(LOG_DIR)
        except Exception as e:
            self.append_log(f"❌ Error opening log folder: {e}")

    def append_log(self, text):
        self.log.append(text)
        print(text)

    def load_config_if_exists(self):
        if os.path.exists(CFG_PATH):
            try:
                with open(CFG_PATH, encoding="utf-8") as f:
                    cfg = json.load(f)
                self.url.setText(cfg.get("folder_url", ""))
                self.ps_path.setText(cfg.get("pspath", DEFAULT_PSPATH))
                if cfg.get("team") in self.TEAMS:
                    self.team.setCurrentText(cfg["team"])
                if cfg.get("mangaType", "korian").lower().startswith("j"):
                    self.rb_japan.setChecked(True)
                else:
                    self.rb_korian.setChecked(True)
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
            except Exception as e:
                self.append_log(f"⚠ Error loading config: {e}")

    def start_process(self):
        url = self.url.text().strip()
        if not url:
            QMessageBox.warning(self, "Error", "Please enter a URL or folder path.")
            return

        pspath = self.ps_path.text().strip()
        if not os.path.exists(pspath):
            QMessageBox.warning(self, "Error", "Photoshop executable path is invalid.")
            return

        self.start_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.force_stop_btn.setEnabled(True)  # تفعيل زر Force Stop عند بدء العملية
        self.bar.show()

        manga_type = "korian" if self.rb_korian.isChecked() else "japanese"
        mode = "fast" if self.rb_fast.isChecked() else "ultra" if self.rb_ultra.isChecked() else "normal"
        enable_log = self.enable_log_chk.isChecked()

        self.worker = WorkerThread(
            url,
            self.team.currentText(),
            pspath,
            manga_type,
            mode,
            self.font_spin.value(),
            self.stop_chk.isChecked(),
            self.continue_chk.isChecked(),
            self.auto_next_chk.isChecked(),
            enable_log
        )
        self.worker.status.connect(self.append_log)
        self.worker.finished.connect(self.done)
        self.worker.start()

    def cancel_process(self):
        if self.worker and self.worker.isRunning():
            self.worker.terminate()
            self.append_log("⛔ Process cancelled.")
            self.done(False, "Cancelled")

    def force_stop(self):
        try:
            # إنهاء عمليات Python وPhotoshop وcmd وpowershell
            subprocess.Popen('taskkill /F /IM python.exe /T', shell=True)
            subprocess.Popen('taskkill /F /IM Photoshop.exe /T', shell=True)
            subprocess.Popen('taskkill /F /IM cmd.exe /T', shell=True)
            subprocess.Popen('taskkill /F /IM powershell.exe /T', shell=True)
            self.append_log("🛑 Force stopped all processes (Python, Photoshop, cmd, powershell).")
            
            # إيقاف الخيط إذا كان قيد التشغيل
            if self.worker and self.worker.isRunning():
                self.worker.terminate()
            
            # إعادة تعيين الواجهة
            self.done(False, "Force stopped all processes")
        except Exception as e:
            self.append_log(f"❌ Error during force stop: {e}")
            QMessageBox.critical(self, "Error", f"Failed to force stop processes: {e}")

    def done(self, ok, msg):
        self.start_btn.setEnabled(True)
        self.cancel_btn.setEnabled(True)
        self.force_stop_btn.setEnabled(False)  # تعطيل زر Force Stop بعد الإنهاء
        self.bar.hide()
        if ok:
            self.append_log("✅ Done. Closing application...")
            # QTimer.singleShot(700, QApplication.instance().quit)
        else:
            self.append_log(f"❌ {msg}")
            QMessageBox.critical(self, "Error", msg)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MangaApp()
    app.setStyleSheet("""
        QWidget { background: #222; color: #fff; font: 10pt Arial; }
        QPushButton { background: #007bff; color: #fff; padding: 6px; border-radius: 4px; }
        QPushButton:disabled { background: #555; }
        QLineEdit, QComboBox, QTextEdit { background: #333; border: 1px solid #555; }
        QProgressBar { background: #333; border: 1px solid #555; }
        QProgressBar::chunk { background: #007bff; }
    """)
    window.show()
    sys.exit(app.exec_())