# ui_manga.py
from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QGroupBox, QLabel, QLineEdit,
    QPushButton, QCheckBox, QComboBox, QRadioButton, QButtonGroup, QSpinBox,
    QTextEdit, QProgressBar
)
from PyQt5.QtCore import Qt

def build_ui(window):
    """
    يبني واجهة نافذة MangaApp ويربط كل العناصر كخصائص على كائن النافذة:
    window.url, window.chapter_edit, window.team, window.rb_fast, ... إلخ
    """

    window.setGeometry(300, 180, 550, 780)

    # الويدجت الرئيسي والتخطيط
    w = QWidget()
    window.setCentralWidget(w)
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
    window.url = QLineEdit()
    window.url.setPlaceholderText("Enter folder path or Google Drive URL")
    url_layout.addWidget(window.url, stretch=3)
    window.btn_browse = QPushButton("Browse")
    window.btn_browse.clicked.connect(window.browse)
    url_layout.addWidget(window.btn_browse, stretch=1)
    path_layout.addWidget(QLabel("Folder or Google Drive URL:"))
    path_layout.addLayout(url_layout)

    # صندوق اسم الفصل يظهر فقط عند روابط Drive
    window.chapter_label = QLabel("Chapter Title (for Drive URL):")
    window.chapter_edit  = QLineEdit()
    window.chapter_edit.setPlaceholderText("Type chapter name if the link is Google Drive")
    window.chapter_label.hide()
    window.chapter_edit.hide()
    path_layout.addWidget(window.chapter_label)
    path_layout.addWidget(window.chapter_edit)

    main_layout.addWidget(path_group)

    # --- مجموعة إعدادات إضافية ---
    options_group = QGroupBox("Additional Options")
    options_layout = QGridLayout()
    options_layout.setSpacing(8)
    options_group.setLayout(options_layout)

    window.stop_chk = QCheckBox("Stop After First")
    window.continue_chk = QCheckBox("Skip PS Dialog")
    window.auto_next_chk = QCheckBox("Auto Next")
    window.enable_log_chk = QCheckBox("Enable Log")
    window.dont_Open_After_Clean = QCheckBox("don't Open After Clean")
    window.ai_clean_chk = QCheckBox("AI Clean")  # متروكة كما هي حسب منطقك

    options_layout.addWidget(window.stop_chk, 0, 0)
    options_layout.addWidget(window.continue_chk, 0, 1)
    options_layout.addWidget(window.auto_next_chk, 1, 0)
    options_layout.addWidget(window.enable_log_chk, 1, 1)
    options_layout.addWidget(window.dont_Open_After_Clean, 2, 0)
    options_layout.addWidget(window.ai_clean_chk, 2, 1)

    main_layout.addWidget(options_group)

    # --- مجموعة إعدادات المانجا ---
    manga_group = QGroupBox("Manga Settings")
    manga_layout = QVBoxLayout()
    manga_layout.setSpacing(8)
    manga_group.setLayout(manga_layout)

    # Team
    manga_layout.addWidget(QLabel("Team:"))
    window.team = QComboBox()
    window.team.setObjectName("teamCombo")  # لتطبيق QSS #teamCombo
    window.team.addItems([
        "rezo", "violet", "ez", "seren", "magus",
        "nyx", "arura", "ken", "mei", "quantom",
    ])
    manga_layout.addWidget(window.team)

    # Mode
    manga_layout.addWidget(QLabel("Mode:"))
    mode_layout = QHBoxLayout()
    window.rb_normal = QRadioButton("Normal")
    window.rb_fast   = QRadioButton("Fast")
    window.rb_ultra  = QRadioButton("Ultra")
    window.rb_normal.setChecked(True)
    gm = QButtonGroup(window)
    gm.addButton(window.rb_normal)
    gm.addButton(window.rb_fast)
    gm.addButton(window.rb_ultra)
    mode_layout.addWidget(window.rb_normal)
    mode_layout.addWidget(window.rb_fast)
    mode_layout.addWidget(window.rb_ultra)
    mode_layout.addStretch()
    manga_layout.addLayout(mode_layout)

    # Font size
    font_layout = QHBoxLayout()
    font_layout.addWidget(QLabel("Font Size:"))
    window.font_spin = QSpinBox()
    window.font_spin.setRange(6, 72)
    window.font_spin.setValue(10)
    font_layout.addWidget(window.font_spin)
    font_layout.addStretch()
    manga_layout.addLayout(font_layout)

    main_layout.addWidget(manga_group)

    # --- أزرار الإجراءات ---
    actions_layout = QHBoxLayout()
    actions_layout.setSpacing(10)
    window.btn_save_settings = QPushButton("Save Settings")
    window.btn_save_settings.clicked.connect(window.save_settings)
    actions_layout.addWidget(window.btn_save_settings, stretch=1)

    window.btn_open_manga_text = QPushButton("Open Manga Text")
    window.btn_open_manga_text.clicked.connect(window.open_manga_text)
    actions_layout.addWidget(window.btn_open_manga_text, stretch=1)

    window.btn_clear_win = QPushButton("Clear Windows Terminal")
    window.btn_clear_win.setToolTip("يمسح شاشة CMD/PowerShell المرتبطة (Ctrl+Shift+L)")
    window.btn_clear_win.setShortcut("Ctrl+Shift+L")
    window.btn_clear_win.clicked.connect(window.clear_win_terminal)
    actions_layout.addWidget(window.btn_clear_win, stretch=1)

    main_layout.addLayout(actions_layout)

    # --- أزرار التحكم ---
    control_layout = QHBoxLayout()
    control_layout.setSpacing(10)
    window.start_btn = QPushButton("Start")
    window.start_btn.clicked.connect(window.start_process)
    control_layout.addWidget(window.start_btn, stretch=1)
    window.cancel_btn = QPushButton("Cancel")
    window.cancel_btn.clicked.connect(window.cancel_process)
    control_layout.addWidget(window.cancel_btn, stretch=1)
    window.force_stop_btn = QPushButton("Force Stop")
    window.force_stop_btn.clicked.connect(window.force_stop)
    control_layout.addWidget(window.force_stop_btn, stretch=1)
    main_layout.addLayout(control_layout)

    # --- Log viewer ---
    main_layout.addWidget(QLabel("Log:"))
    window.log = QTextEdit()
    window.log.setReadOnly(True)
    window.log.setMinimumHeight(150)
    main_layout.addWidget(window.log, stretch=2)

    # --- Progress bar ---
    window.bar = QProgressBar()
    window.bar.setRange(0, 0)
    window.bar.hide()
    main_layout.addWidget(window.bar)

    # دفع العناصر للأعلى
    main_layout.addStretch()
