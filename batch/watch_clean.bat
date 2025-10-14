@echo off
setlocal enabledelayedexpansion

:: === Load config JSON ===
set "json=C:\Users\abdoh\Downloads\testScript\config\temp-title.json"
if not exist "%json%" (
    echo [ERROR] Config file not found: %json%
    exit /b
)

where python >nul 2>&1 || (
    echo [ERROR] Python not found.
    exit /b
)

for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%json%' -Raw | ConvertFrom-Json).title"`) do set "title=%%A"
for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%json%' -Raw | ConvertFrom-Json).folder_url"`) do set "folder=%%A"
for /f "usebackq delims=" %%A in (`powershell -Command "(Get-Content '%json%' -Raw | ConvertFrom-Json).team"`) do set "team=%%A"

if "%team%"=="" (
    set "teams=rezo violet ez seren magus nyx arura ken mei quantom"
    set /a i=1
    for %%t in (%teams%) do (
        echo [!i!] %%t
        set "t[!i!]=%%t"
        set /a i+=1
    )
    set /p "n=Select team number: "
    if defined t[%n%] (set "team=!t[%n%]!") else exit /b
)

if "%folder%"=="" set /p "folder=Enter folder path: "
if not exist "%folder%" (
    echo [ERROR] Folder not found: %folder%
    exit /b
)

:: === Check for 'clean' folder ===
set "cleanFolder=%folder%\cleaned"
set "pcleaner=C:\Users\abdoh\AppData\Roaming\Python\Python313\site-packages\pcleaner\main.py"

if exist "%cleanFolder%" (
    echo Found clean folder.
) else (
    echo Clean folder not found. Running PanelCleaner...
    python "%pcleaner%" clean "%folder%"
    if errorlevel 1 (
        echo [ERROR] PanelCleaner failed!
        pause
        exit /b
    )
)





:: === Check for all_bubble.json ===
set "bubbleJson=%folder%\all_bubbles.json"

if exist "%bubbleJson%" (
    echo [INFO] all_bubble.json found in cleaned folder.
    echo Running Photoshop script directly...

    :: run Photoshop script
    set "psScript=C:\Users\abdoh\Downloads\testScript\scripts\script.jsx"
    set "psApp=C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"

    if exist "!psApp!" (
        start "" "!psApp!" "!psScript!"
    ) else (
        echo [ERROR] Photoshop not found at "!psApp!"
        pause
        exit /b
    )

    goto :done
)

:: === Run detector script ===
set "py=C:\Users\abdoh\Downloads\testScript\python\extract_bubbles_by_images_ai.py"
if not exist "%py%" (
    echo [ERROR] Detector script not found: %py%
    exit /b
)

python "%py%"
if errorlevel 1 (
    echo [ERROR] Detector script failed!
    pause
    exit /b
)

:done
echo Done.
exit /b
