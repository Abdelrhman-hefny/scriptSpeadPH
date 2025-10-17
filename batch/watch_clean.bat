@echo off
setlocal enabledelayedexpansion

echo #################################################
echo #           Manga Automation Script             #
echo #################################################

:: === 1. Load config JSON path ===
set "json=C:\Users\abdoh\Downloads\testScript\config\temp-title.json"
echo [SETUP] Attempting to load config file: %json%
if not exist "%json%" (
    echo [ERROR] Config file not found: %json%
    exit /b 1
)
echo [SETUP] Config file loaded successfully.

:: === 2. Check for Python ===
echo [SETUP] Checking for Python environment...
where python >nul 2>&1 || (
    echo [ERROR] Python not found. Please ensure Python is in your PATH.
    exit /b 1
)
echo [SETUP] Python found.

:: === 3. Load basic JSON values ===
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "(Get-Content '%json%' -Raw | ConvertFrom-Json).title"`) do set "title=%%A"
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "(Get-Content '%json%' -Raw | ConvertFrom-Json).folder_url"`) do set "folder=%%A"
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "(Get-Content '%json%' -Raw | ConvertFrom-Json).team"`) do set "team=%%A"

echo [CONFIG] Folder URL: %folder%
echo [CONFIG] Team: %team%

:: === 4. Team/Folder setup (Optional/Pre-existing logic) ===
if "%team%"=="" (
    echo [SETUP] Team is not set in config. Prompting user...
    set "teams=rezo violet ez seren magus nyx arura ken mei quantom"
    set /a i=1
    for %%t in (%teams%) do (
        echo [!i!] %%t
        set "t[!i!]=%%t"
        set /a i+=1
    )
    set /p "n=Select team number: "
    if defined t[%n%] (set "team=!t[%n%]!") else exit /b 1
    echo [CONFIG] Selected Team: %team%
)

if "%folder%"=="" (
    set /p "folder=Enter folder path: "
)
if not exist "%folder%" (
    echo [ERROR] Folder not found: %folder%
    exit /b 1
)

:: === 5. PanelCleaner Check ===
set "cleanFolder=%folder%\cleaned"
set "pcleaner=C:\Users\abdoh\AppData\Roaming\Python\Python313\site-packages\pcleaner\main.py"

echo -------------------------------------------------
echo [PROCESS] Checking for Clean Folder...
if exist "%cleanFolder%" (
    echo [INFO] Found clean folder: %cleanFolder%. Skipping PanelCleaner.
) else (
    echo [INFO] Clean folder not found. Running PanelCleaner...
    python "%pcleaner%" clean "%folder%"
    if errorlevel 1 (
        echo [ERROR] PanelCleaner failed! Errorlevel: %errorlevel%
        pause
        exit /b 1
    )
    echo [SUCCESS] PanelCleaner executed successfully.
)

echo -------------------------------------------------

:: === 6. Check for all_bubbles.json and Photoshop Run Logic ===
set "bubbleJson=%folder%\all_bubbles.json"
set "psScript=C:\Users\abdoh\Downloads\testScript\scripts\script.jsx"
set "psApp=C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"

echo [PROCESS] Checking for Bubble JSON and Photoshop Execution...

if exist "%bubbleJson%" (
    echo [INFO] all_bubbles.json found.
    if exist "%psApp%" (
        echo [ACTION] Launching Photoshop...
        :: يمكنك الإبقاء على السطر التالي كما هو، أو استبداله بصيغة -r إذا رغبت
        start "" "%psApp%" "%psScript%"
        echo [SUCCESS] Photoshop launched with script.
    ) else (
        echo [ERROR] Photoshop not found at "%psApp%"
        pause
        exit /b 1
    )
    goto :done
)

:: === 7. Run detector script (If no bubble JSON found) ===
set "py=C:\Users\abdoh\Downloads\testScript\python\extract_bubbles_by_images_ai.py"
echo [INFO] all_bubbles.json not found. Running Detector Script: %py%

if not exist "%py%" (
    echo [ERROR] Detector script not found: %py%
    exit /b 1
)

python "%py%"
if errorlevel 1 (
    echo [ERROR] Detector script failed! Errorlevel: %errorlevel%
    pause
    exit /b 1
)
echo [SUCCESS] Detector script finished successfully.

:done
echo -------------------------------------------------
echo [FINAL] Script execution finished.
exit /b 0
