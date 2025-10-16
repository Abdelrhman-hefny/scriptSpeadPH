import sys, os, json, subprocess, requests, datetime
from PyQt5.QtWidgets import (
    QApplication,
    QMainWindow,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QGridLayout,
    QLabel,
    QLineEdit,
    QComboBox,
    QRadioButton,
    QPushButton,
    QTextEdit,
    QFileDialog,
    QCheckBox,
    QProgressBar,
    QSpinBox,
    QButtonGroup,
    QMessageBox,
    QGroupBox,
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QTimer
from urllib.parse import urlparse

# ----- المسارات -----
CFG_PATH = r"C:\Users\abdoh\Downloads\testScript\config\temp-title.json"
TXT_PATH = r"C:\Users\abdoh\Downloads\testScript\temp-title.txt"
MANGA_TEXT_PATH = r"C:\Users\abdoh\Downloads\testScript\manga_text.txt"
DEFAULT_PSPATH = r"C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"
LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOG_DIR, exist_ok=True)


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
        ocr_model="manga",
        dont_Open_After_Clean=False,
        ai_clean=False,               # <<< NEW
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
        self.ocr_model = ocr_model
        self.dont_Open_After_Clean = dont_Open_After_Clean
        self.ai_clean = ai_clean     # <<< NEW

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
            self.log(f"Team detected: {self.team}")
        else:
            self.log("Google Drive URL detected — extracting title...")
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

        title = title.replace("?", "").replace(":", "_")

        # --- اكتب TXT + JSON بما فيهم ai_clean ---
        try:
            os.makedirs(os.path.dirname(CFG_PATH), exist_ok=True)
            with open(TXT_PATH, "w", encoding="utf-8") as f:
                f.write(f"{title}\n{self.folder_url}\n{self.team}\n{self.pspath}\n")

            cfg_obj = {
                "title": title,
                "folder_url": self.folder_url,
                "team": self.team,
                "pspath": self.pspath,
                "mode": self.mode,
                "fontSize": int(self.font_size),
                "stopAfterFirstPage": bool(self.stop_after_first),
                "continueWithoutDialog": bool(self.continue_no_dialog),
                "autoNext": bool(self.auto_next),
                "ocr_model": self.ocr_model,
                "dont_Open_After_Clean": bool(self.dont_Open_After_Clean),
                "ai_clean": bool(self.ai_clean),        # <<< NEW
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
                [
                    "python",
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
        "rezo",
        "violet",
        "ez",
        "seren",
        "magus",
        "nyx",
        "arura",
        "ken",
        "mei",
        "quantom",
    ]

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Manga Downloader (مبسط)")
        self.setGeometry(300, 180, 550, 780)
        self.setMinimumSize(400, 620)

        # الويدجت الرئيسي والتخطيط
        w = QWidget()
        self.setCentralWidget(w)
        main_layout = QVBoxLayout(w)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)

        # --- مجموعة إعدادات المسار ---
        path_group = QGroupBox("Path Settings")
        path_layout = QVBoxLayout()
        path_layout.setSpacing(8)
        path_group.setLayout(path_layout)

        # URL + Browse
        url_layout = QHBoxLayout()
        self.url = QLineEdit()
        self.url.setPlaceholderText("Enter folder path or Google Drive URL")
        url_layout.addWidget(self.url, stretch=3)
        btn_browse = QPushButton("Browse")
        btn_browse.clicked.connect(self.browse)
        url_layout.addWidget(btn_browse, stretch=1)
        path_layout.addWidget(QLabel("Folder or Google Drive URL:"))
        path_layout.addLayout(url_layout)

        main_layout.addWidget(path_group)

        # --- مجموعة إعدادات المانجا ---
        manga_group = QGroupBox("Manga Settings")
        manga_layout = QVBoxLayout()
        manga_layout.setSpacing(8)
        manga_group.setLayout(manga_layout)

        # Team
        manga_layout.addWidget(QLabel("Team:"))
        self.team = QComboBox()
        self.team.addItems(self.TEAMS)
        manga_layout.addWidget(self.team)

        # Mode
        manga_layout.addWidget(QLabel("Mode:"))
        mode_layout = QHBoxLayout()
        self.rb_normal = QRadioButton("Normal")
        self.rb_fast = QRadioButton("Fast")
        self.rb_ultra = QRadioButton("Ultra")
        self.rb_normal.setChecked(True)
        gm = QButtonGroup(self)
        gm.addButton(self.rb_normal)
        gm.addButton(self.rb_fast)
        gm.addButton(self.rb_ultra)
        mode_layout.addWidget(self.rb_normal)
        mode_layout.addWidget(self.rb_fast)
        mode_layout.addWidget(self.rb_ultra)
        mode_layout.addStretch()
        manga_layout.addLayout(mode_layout)

        # Font size
        font_layout = QHBoxLayout()
        font_layout.addWidget(QLabel("Font Size:"))
        self.font_spin = QSpinBox()
        self.font_spin.setRange(6, 72)
        self.font_spin.setValue(10)
        font_layout.addWidget(self.font_spin)
        font_layout.addStretch()
        manga_layout.addLayout(font_layout)

        main_layout.addWidget(manga_group)

        # --- مجموعة إعدادات إضافية ---
        options_group = QGroupBox("Additional Options")
        options_layout = QGridLayout()
        options_layout.setSpacing(8)
        options_group.setLayout(options_layout)

        self.stop_chk = QCheckBox("Stop After First")
        self.continue_chk = QCheckBox("Skip PS Dialog")
        self.auto_next_chk = QCheckBox("Auto Next")
        self.enable_log_chk = QCheckBox("Enable Log")
        self.dont_Open_After_Clean = QCheckBox("don't Open After Clean")
        self.ai_clean_chk = QCheckBox("AI Clean")     # <<< NEW

        # ترتيب العناصر في الجريد
        options_layout.addWidget(self.stop_chk,        0, 0)
        options_layout.addWidget(self.continue_chk,    0, 1)
        options_layout.addWidget(self.auto_next_chk,   1, 0)
        options_layout.addWidget(self.enable_log_chk,  1, 1)
        options_layout.addWidget(self.dont_Open_After_Clean,2, 0)
        options_layout.addWidget(self.ai_clean_chk,    2, 1)  # <<< NEW

        main_layout.addWidget(options_group)

        # --- مجموعة OCR ---
        ocr_group = QGroupBox("OCR Model")
        ocr_layout = QHBoxLayout()
        ocr_layout.setSpacing(10)
        ocr_group.setLayout(ocr_layout)
        self.rb_paddle = QRadioButton("PaddleOCR (ERROR)")
        self.rb_manga = QRadioButton("MangaOCR")
        self.rb_easy = QRadioButton("EasyOCR")
        self.rb_manga.setChecked(True)
        grp_ocr = QButtonGroup(self)
        grp_ocr.addButton(self.rb_paddle)
        grp_ocr.addButton(self.rb_manga)
        grp_ocr.addButton(self.rb_easy)
        ocr_layout.addWidget(self.rb_paddle)
        ocr_layout.addWidget(self.rb_manga)
        ocr_layout.addWidget(self.rb_easy)
        ocr_layout.addStretch()
        main_layout.addWidget(ocr_group)

        # --- أزرار الإجراءات ---
        actions_layout = QHBoxLayout()
        actions_layout.setSpacing(10)
        btn_save_settings = QPushButton("Save Settings")
        btn_save_settings.clicked.connect(self.save_settings)
        actions_layout.addWidget(btn_save_settings, stretch=1)

        btn_open_manga_text = QPushButton("Open Manga Text")
        btn_open_manga_text.clicked.connect(self.open_manga_text)
        actions_layout.addWidget(btn_open_manga_text, stretch=1)
        main_layout.addLayout(actions_layout)

        # --- أزرار التحكم ---
        control_layout = QHBoxLayout()
        control_layout.setSpacing(10)
        self.start_btn = QPushButton("Start")
        self.start_btn.clicked.connect(self.start_process)
        control_layout.addWidget(self.start_btn, stretch=1)
        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.clicked.connect(self.cancel_process)
        control_layout.addWidget(self.cancel_btn, stretch=1)
        self.force_stop_btn = QPushButton("Force Stop")
        self.force_stop_btn.clicked.connect(self.force_stop)
        self.force_stop_btn.setEnabled(False)
        control_layout.addWidget(self.force_stop_btn, stretch=1)
        main_layout.addLayout(control_layout)

        # --- Log viewer ---
        main_layout.addWidget(QLabel("Log:"))
        self.log = QTextEdit()
        self.log.setReadOnly(True)
        self.log.setMinimumHeight(150)
        main_layout.addWidget(self.log, stretch=2)

        # --- Progress bar ---
        self.bar = QProgressBar()
        self.bar.setRange(0, 0)
        self.bar.hide()
        main_layout.addWidget(self.bar)

        # إضافة تمدد لدفع العناصر إلى الأعلى
        main_layout.addStretch()

        self.worker = None
        self.load_config_if_exists()

    def browse(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Folder")
        if folder:
            self.url.setText(folder)

    def browse_photoshop(self):
        file, _ = QFileDialog.getOpenFileName(
            self, "Select Photoshop Executable", "", "Executable Files (*.exe)"
        )
        if file:
            self.ps_path.setText(file)

    def open_after_clean_action(self):
        try:
            if self.dont_Open_After_Clean.isChecked():
                if not self.is_image_open():
                    os.startfile(LOG_DIR)
                else:
                    self.append_log(
                        "⚠ Cannot open log folder while images are being processed."
                    )
            else:
                os.startfile(LOG_DIR)
        except Exception as e:
            self.append_log(f"❌ Error opening log folder: {e}")

    def open_manga_text(self):
        try:
            if os.path.exists(MANGA_TEXT_PATH):
                subprocess.run(["notepad.exe", MANGA_TEXT_PATH], check=True)
                self.append_log(f"✅ Opened {MANGA_TEXT_PATH} in Notepad.")
            else:
                self.append_log(f"❌ File {MANGA_TEXT_PATH} does not exist.")
                QMessageBox.critical(
                    self, "Error", f"File {MANGA_TEXT_PATH} does not exist."
                )
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
                self.ai_clean_chk.setChecked(cfg.get("ai_clean", False))   # <<< NEW
                ocr_model = cfg.get("ocr_model", "manga")
                if ocr_model == "paddle":
                    self.rb_paddle.setChecked(True)
                elif ocr_model == "easy":
                    self.rb_easy.setChecked(True)
                else:
                    self.rb_manga.setChecked(True)
            except Exception as e:
                self.append_log(f"⚠ Error loading config: {e}")

    def save_settings(self):
        folder_url = self.url.text().strip()
        if not folder_url:
            self.append_log("No folder URL or path provided for saving settings")
            QMessageBox.warning(self, "Error", "Please enter a URL or folder path.")
            return

        if os.path.exists(folder_url):
            title = os.path.basename(folder_url) or folder_url
        else:
            self.append_log("Google Drive URL detected — extracting title...")
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
                )
                if not title:
                    title = "Untitled_Manga"
            except Exception as e:
                self.append_log(f"Error extracting title: {e}")
                QMessageBox.critical(self, "Error", "Failed to extract title from URL")
                return

        title = title.replace("?", "").replace(":", "_")

        try:
            os.makedirs(os.path.dirname(CFG_PATH), exist_ok=True)

            mode = (
                "fast"
                if self.rb_fast.isChecked()
                else "ultra" if self.rb_ultra.isChecked() else "normal"
            )
            ocr_model = (
                "paddle"
                if self.rb_paddle.isChecked()
                else "easy" if self.rb_easy.isChecked() else "manga"
            )

            cfg_obj = {
                "title": title,
                "folder_url": folder_url,
                "team": self.team.currentText(),
                "pspath": DEFAULT_PSPATH,
                "mode": mode,
                "fontSize": int(self.font_spin.value()),
                "stopAfterFirstPage": bool(self.stop_chk.isChecked()),
                "continueWithoutDialog": bool(self.continue_chk.isChecked()),
                "autoNext": bool(self.auto_next_chk.isChecked()),
                "ocr_model": ocr_model,
                "dont_Open_After_Clean": bool(self.dont_Open_After_Clean.isChecked()),
                "ai_clean": bool(self.ai_clean_chk.isChecked()),   # <<< NEW
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
        self.force_stop_btn.setEnabled(True)
        self.bar.show()

        mode = (
            "fast"
            if self.rb_fast.isChecked()
            else "ultra" if self.rb_ultra.isChecked() else "normal"
        )
        enable_log = self.enable_log_chk.isChecked()
        if self.rb_paddle.isChecked():
            ocr_model = "paddle"
        elif self.rb_easy.isChecked():
            ocr_model = "easy"
        else:
            ocr_model = "manga"

        self.worker = WorkerThread(
            url,
            self.team.currentText(),
            mode,
            self.font_spin.value(),
            self.stop_chk.isChecked(),
            self.continue_chk.isChecked(),
            self.auto_next_chk.isChecked(),
            enable_log,
            ocr_model,
            self.dont_Open_After_Clean.isChecked(),
            self.ai_clean_chk.isChecked(),     # <<< NEW
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
            subprocess.Popen("taskkill /F /IM python.exe /T", shell=True)
            subprocess.Popen("taskkill /F /IM Photoshop.exe /T", shell=True)
            subprocess.Popen("taskkill /F /IM cmd.exe /T", shell=True)
            subprocess.Popen("taskkill /F /IM powershell.exe /T", shell=True)
            self.append_log(
                "🛑 Force stopped all processes (Python, Photoshop, cmd, powershell)."
            )

            if self.worker and self.worker.isRunning():
                self.worker.terminate()

            self.done(False, "Force stopped all processes")
        except Exception as e:
            self.append_log(f"❌ Error during force stop: {e}")
            QMessageBox.critical(self, "Error", f"Failed to force stop processes: {e}")

    def done(self, ok, msg):
        self.start_btn.setEnabled(True)
        self.cancel_btn.setEnabled(True)
        self.force_stop_btn.setEnabled(False)
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
    app.setStyleSheet(
        """
        QWidget { 
            background: #2C2F33; 
            color: #FFFFFF; 
            font: 10pt "Segoe UI"; 
        }
        QGroupBox { 
            border: 1px solid #555; 
            border-radius: 4px; 
            margin-top: 12px; 
            font-weight: bold; 
        }
        QGroupBox::title { 
            subcontrol-origin: margin; 
            subcontrol-position: top left; 
            padding: 2px 6px; 
            color: #FFFFFF; 
        }
        QPushButton { 
            background: #007BFF; 
            color: #FFFFFF; 
            padding: 3px; 
            border-radius: 4px; 
            border: none; 
            min-height: 20px; 
        }
        QPushButton:hover { 
            background: #0056b3; 
        }
        QPushButton:disabled { 
            background: #555; 
            color: #999; 
        }
        QLineEdit, QComboBox, QTextEdit { 
            background: #3A3F44; 
            border: 1px solid #555; 
            border-radius: 4px; 
            padding:3px; 
            color: #FFFFFF; 
            min-height: 10px; 
        }
        QSpinBox { 
            background: #3A3F44; 
            border: 1px solid #555; 
            border-radius: 4px; 
            padding: 5px; 
            color: #FFFFFF; 
            min-height: 7px; 
        }
        QProgressBar { 
            background: #3A3F44; 
            border: 1px solid #555; 
            border-radius: 4px; 
            text-align: center; 
            min-height: 20px; 
        }
        QProgressBar::chunk { 
            background: #007BFF; 
            border-radius: 4px; 
        }
        QCheckBox, QRadioButton { 
            color: #FFFFFF; 
            spacing: 5px; 
        }
        QComboBox::drop-down { 
            border: none; 
            width: 20px; 
            height:20px;
        }
        QComboBox::down-arrow { 
            image: none; 
            width: 5px; 
            height: 5px; 
        }
    """
    )
    window.show()
    sys.exit(app.exec_())
