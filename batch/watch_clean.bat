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
    exit /b
)
echo [SETUP] Config file loaded successfully.

:: === 2. Check for Python ===
echo [SETUP] Checking for Python environment...
where python >nul 2>&1 || (
    echo [ERROR] Python not found. Please ensure Python is in your PATH.
    exit /b
)
echo [SETUP] Python found.

:: === 3. Load basic JSON values ===
for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%json%' -Raw | ConvertFrom-Json).title"`) do set "title=%%A"
for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%json%' -Raw | ConvertFrom-Json).folder_url"`) do set "folder=%%A"
for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%json%' -Raw | ConvertFrom-Json).team"`) do set "team=%%A"

:: === 4. Load AI/Open JSON values ===
for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%json%' -Raw | ConvertFrom-Json).'dont_Open_After_Clean'"`) do set "dont_open=%%A"
for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%json%' -Raw | ConvertFrom-Json).'ai_clean'"`) do set "ai_clean=%%A"

:: Convert PowerShell boolean "True" / "False" to simple string "true" / "false"
if /i "%dont_open%"=="True" set "dont_open=true"
if /i "%dont_open%"=="False" set "dont_open=false"
if /i "%ai_clean%"=="True" set "ai_clean=true"
if /i "%ai_clean%"=="False" set "ai_clean=false"

echo [CONFIG] dont_Open_After_Clean: %dont_open%
echo [CONFIG] ai_clean: %ai_clean%
echo [CONFIG] Folder URL: %folder%

:: === 5. Team/Folder setup (Optional/Pre-existing logic) ===

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
    if defined t[%n%] (set "team=!t[%n%]!") else exit /b
    echo [CONFIG] Selected Team: %team%
)

if "%folder%"=="" (
    set /p "folder=Enter folder path: "
)
if not exist "%folder%" (
    echo [ERROR] Folder not found: %folder%
    exit /b
)

:: === 6. PanelCleaner Check ===
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
        exit /b
    )
    echo [SUCCESS] PanelCleaner executed successfully.
)

:: -------------------------------------------------
:: === 7. Conditional Execution for clean_background.py ===
set "clean_script=C:\Users\abdoh\Downloads\testScript\python\clean_background.py"
echo -------------------------------------------------
echo [PROCESS] Evaluating AI Background Clean Logic...

if /i "%ai_clean%"=="true" (
    echo [ACTION] ai_clean is TRUE. Running background clean script: %clean_script%
    python "%clean_script%"
    if errorlevel 1 (
        echo [ERROR] clean_background.py failed! Errorlevel: %errorlevel%
        pause
        goto :skip_bubble_check
    )
    echo [SUCCESS] clean_background.py finished successfully.

) else if /i "%dont_open%"=="true" (
    echo [ACTION] ai_clean is FALSE, but dont_Open_After_Clean is TRUE. Running background clean script: %clean_script%
    python "%clean_script%"
    if errorlevel 1 (
        echo [ERROR] clean_background.py failed! Errorlevel: %errorlevel%
        pause
        goto :skip_bubble_check
    )
    echo [SUCCESS] clean_background.py finished successfully.

) else (
    echo [INFO] ai_clean and dont_Open_After_Clean are both FALSE. Skipping background clean script.
)

:skip_bubble_check
echo [PROCESS] AI Background Clean Logic Complete.
echo -------------------------------------------------


:: === 8. Check for all_bubble.json and Photoshop Run Logic ===
set "bubbleJson=%folder%\all_bubbles.json"
set "psScript=C:\Users\abdoh\Downloads\testScript\scripts\script.jsx"
set "psApp=C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"

echo [PROCESS] Checking for Bubble JSON and Photoshop Execution...

if exist "%bubbleJson%" (
    echo [INFO] all_bubble.json found in cleaned folder.
    
    :: Logic: If dont_open_after_clean is TRUE, the Python script (clean_background.py) is responsible for opening PS.
    if /i "%dont_open%"=="true" (
        echo [INFO] dont_Open_After_Clean is TRUE. Assuming Photoshop was handled/will be handled by Python script.
        echo [SKIP] Skipping direct Photoshop launch from Batch script to prevent duplicates.
        goto :done
    )

    :: Logic: If dont_open_after_clean is FALSE, the Batch script handles the PS launch here.
    echo [ACTION] dont_Open_After_Clean is FALSE. Running Photoshop script directly...

    if exist "!psApp!" (
        start "" "!psApp!" "!psScript!"
        echo [SUCCESS] Launched Photoshop with script: !psScript!
    ) else (
        echo [ERROR] Photoshop not found at "!psApp!"
        pause
        exit /b
    )

    goto :done
)

:: === 9. Run detector script (If no bubble JSON found) ===
set "py=C:\Users\abdoh\Downloads\testScript\python\extract_bubbles_by_images_ai.py"
echo [INFO] all_bubble.json not found. Running Detector Script: %py%

if not exist "%py%" (
    echo [ERROR] Detector script not found: %py%
    exit /b
)

python "%py%"
if errorlevel 1 (
    echo [ERROR] Detector script failed! Errorlevel: %errorlevel%
    pause
    exit /b
)
echo [SUCCESS] Detector script finished successfully.

:done
echo -------------------------------------------------
echo [FINAL] Script execution finished.
exit /b