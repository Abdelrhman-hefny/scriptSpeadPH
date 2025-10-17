@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo #################################################
echo #           Manga Automation Script             #
echo #################################################

:: ====== ثوابت المسارات ======
set "ROOT=C:\Users\abdoh\Downloads\testScript"
set "JSON=%ROOT%\config\temp-title.json"
set "DETECTOR_PY=%ROOT%\python\extract_bubbles_by_images_ai.py"
set "CLEAN_PY=%ROOT%\python\clean_text_regions_from_config.py"
set "PS_JSX=%ROOT%\scripts\script.jsx"

echo [SETUP] Attempting to load config file: %JSON%
if not exist "%JSON%" (
    echo [ERROR] Config file not found: %JSON%
    exit /b
)
echo [SETUP] Config file loaded successfully.

echo [SETUP] Checking for Python environment...
where python >nul 2>&1 || (
    echo [ERROR] Python not found. Please ensure Python is in your PATH.
    exit /b
)
echo [SETUP] Python found.

:: ====== قراءة قيم JSON بشكل آمن ======
setlocal DisableDelayedExpansion
for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%JSON%' -Raw | ConvertFrom-Json).title"`) do set "title=%%A"
for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%JSON%' -Raw | ConvertFrom-Json).team"`) do set "team=%%A"

:: اختياري: مفتاح folder (لو app.py كتبه)
for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%JSON%' -Raw | ConvertFrom-Json).folder"`) do set "folder=%%A"

:: fallback: folder_url
if not defined folder (
  for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%JSON%' -Raw | ConvertFrom-Json).folder_url"`) do set "folder=%%A"
)

:: مسار الفوتوشوب
for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%JSON%' -Raw | ConvertFrom-Json).pspath"`) do set "pspath=%%A"

:: Bool
for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%JSON%' -Raw | ConvertFrom-Json).'dont_Open_After_Clean'"`) do set "dont_open=%%A"
for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%JSON%' -Raw | ConvertFrom-Json).'ai_clean'"`) do set "ai_clean=%%A"
endlocal & set "title=%title%" & set "team=%team%" & set "folder=%folder%" & set "pspath=%pspath%" & set "dont_open=%dont_open%" & set "ai_clean=%ai_clean%"

:: وسيطات سطر أوامر (تتغلب على JSON)
if not "%~1"=="" set "title=%~1"
if not "%~2"=="" set "folder=%~2"

:: ط normalization للـ booleans
if /i "%dont_open%"=="True" set "dont_open=true"
if /i "%dont_open%"=="False" set "dont_open=false"
if /i "%ai_clean%"=="True" set "ai_clean=true"
if /i "%ai_clean%"=="False" set "ai_clean=false"

:: لو folder طلع URL حوّله لمسار محلي Downloads\title
set "proto4=%folder:~0,4%"
if /I "%proto4%"=="http" (
  set "folder=%USERPROFILE%\Downloads\%title%"
  echo [CONFIG] Detected URL in folder/folder_url; using local path: "%folder%"
)

echo [CONFIG] dont_Open_After_Clean: %dont_open%
echo [CONFIG] ai_clean: %ai_clean%
echo [CONFIG] Title: %title%
echo [CONFIG] Team: %team%
echo [CONFIG] Folder: %folder%

if "%team%"=="" (
    echo [ERROR] Team is empty.
    exit /b
)

if "%folder%"=="" (
    echo [ERROR] Folder path is empty.
    exit /b
)

if not exist "%folder%" (
    echo [ERROR] Folder not found: "%folder%"
    exit /b
)

:: ====== PanelCleaner ======
set "cleanFolder=%folder%\cleaned"
set "pcleaner=C:\Users\abdoh\AppData\Roaming\Python\Python313\site-packages\pcleaner\main.py"

echo -------------------------------------------------
echo [PROCESS] Checking for Clean Folder...
if exist "%cleanFolder%" (
    echo [INFO] Found clean folder: "%cleanFolder%". Skipping PanelCleaner.
) else (
    echo [INFO] Clean folder not found. Running PanelCleaner...
    python "%pcleaner%" clean "%folder%"
    if errorlevel 1 (
        echo [ERROR] PanelCleaner failed! Errorlevel: %errorlevel%
        pause
        exit /b
    )
    echo [SUCCESS] PanelCleaner executed successfully.
)

:: ====== AI Clean (بدون فتح فوتوشوب) ======
echo -------------------------------------------------
echo [PROCESS] Evaluating AI Background Clean Logic...

if /i "%ai_clean%"=="true" (
    echo [ACTION] ai_clean is TRUE. Running background clean script with SKIP_JSX=1: "%CLEAN_PY%"
    set "SKIP_JSX=1"
    python "%CLEAN_PY%"
    set "SKIP_JSX="
    if errorlevel 1 (
        echo [ERROR] clean_text_regions_from_config.py failed! Errorlevel: %errorlevel%
        pause
        goto :after_clean
    )
    echo [SUCCESS] clean_text_regions_from_config.py finished successfully.

) else if /i "%dont_open%"=="true" (
    echo [ACTION] ai_clean is FALSE, but dont_Open_After_Clean is TRUE. Running cleaner with SKIP_JSX=1: "%CLEAN_PY%"
    set "SKIP_JSX=1"
    python "%CLEAN_PY%"
    set "SKIP_JSX="
    if errorlevel 1 (
        echo [ERROR] clean_text_regions_from_config.py failed! Errorlevel: %errorlevel%
        pause
        goto :after_clean
    )
    echo [SUCCESS] clean_text_regions_from_config.py finished successfully.

) else (
    echo [INFO] ai_clean and dont_Open_After_Clean are both FALSE. Skipping background clean script.
)

:after_clean
echo [PROCESS] AI Background Clean Logic Complete.
echo -------------------------------------------------

:: ====== الكشف عن الفقاعات ثم إطلاق فوتوشوب مرة واحدة ======
set "bubbleJson=%folder%\all_bubbles.json"

echo [PROCESS] Checking for Bubble JSON (pre-detection)...
if exist "%bubbleJson%" (
    echo [INFO] all_bubbles.json already exists.
    goto :open_photoshop
)

echo [INFO] all_bubbles.json not found. Running Detector Script: "%DETECTOR_PY%"
if not exist "%DETECTOR_PY%" (
    echo [ERROR] Detector script not found: "%DETECTOR_PY%"
    goto :done
)

python "%DETECTOR_PY%"
if errorlevel 1 (
    echo [ERROR] Detector script failed! Errorlevel: %errorlevel%
    pause
    goto :done
)
echo [SUCCESS] Detector script finished successfully.

:: بعد الكشف، تأكد تاني من وجود JSON
if not exist "%bubbleJson%" (
    echo [WARN] all_bubbles.json still not found after detection. Skipping Photoshop.
    goto :done
)

:open_photoshop
:: لو المستخدم قال لا تفتح بعد التنظيف
if /i "%dont_open%"=="true" (
    echo [SKIP] dont_Open_After_Clean is TRUE. Skipping Photoshop launch.
    goto :done
)

:: اختر مسار الفوتوشوب
set "psApp=%pspath%"
if "%psApp%"=="" set "psApp=C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"

echo [ACTION] Launching Photoshop JSX now...
if not exist "%psApp%" (
    echo [ERROR] Photoshop not found at "%psApp%"
    goto :done
)
if not exist "%PS_JSX%" (
    echo [ERROR] JSX script not found: "%PS_JSX%"
    goto :done
)

start "" "%psApp%" "%PS_JSX%"
echo [SUCCESS] Launched Photoshop with script: "%PS_JSX%"

:done
echo -------------------------------------------------
echo [FINAL] Script execution finished.
exit /b
