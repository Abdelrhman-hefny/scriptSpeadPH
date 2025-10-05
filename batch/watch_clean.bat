@echo off
setlocal enabledelayedexpansion

:: ===== JSON CONFIG FILE =====
set "configPath=C:\Users\abdoh\Downloads\testScript\config\temp-title.json"

if not exist "%configPath%" (
    echo [ERROR] JSON config not found at %configPath%
    pause
    exit /b
)

:: ===== Extract fields from JSON =====
for /f "delims=" %%A in ('powershell -NoProfile -Command ^
    "(Get-Content -Raw '%configPath%' | ConvertFrom-Json).title"') do set "title=%%A"

for /f "delims=" %%A in ('powershell -NoProfile -Command ^
    "(Get-Content -Raw '%configPath%' | ConvertFrom-Json).folder_url"') do set "folder_url=%%A"

for /f "delims=" %%A in ('powershell -NoProfile -Command ^
    "(Get-Content -Raw '%configPath%' | ConvertFrom-Json).team"') do set "team=%%A"

for /f "delims=" %%A in ('powershell -NoProfile -Command ^
    "(Get-Content -Raw '%configPath%' | ConvertFrom-Json).pspath"') do set "pspath=%%A"

for /f "delims=" %%A in ('powershell -NoProfile -Command ^
    "(Get-Content -Raw '%configPath%' | ConvertFrom-Json).mangaType"') do set "mangaType=%%A"

echo ---------------------------
echo 🔖 Title: %title%
echo 🌐 Folder/URL: %folder_url%
echo 👥 Team: %team%
echo 🖼️ Photoshop Path: %pspath%
echo 🧩 Manga Type: %mangaType%
echo ---------------------------

:: ===== Build folder path =====
set "basePath=C:\Users\abdoh\Downloads"
set "folderPath=%basePath%\%title%"

:: ===== Detect if it's a Google Drive link =====
echo %folder_url% | find "drive.google.com" >nul
if %errorlevel%==0 (
    echo 🌍 Google Drive link detected, downloading folder...
    set "isDrive=1"
) else (
    set "isDrive=0"
)

:: ===== If Google Drive link -> run gdown =====
if "%isDrive%"=="1" (
    if not exist "%folderPath%" (
        mkdir "%folderPath%"
    )
    echo ⬇️ Downloading from Google Drive into "%folderPath%"...
    python -c "import gdown; gdown.download_folder('%folder_url%', output='%folderPath%', quiet=False, use_cookies=False)" 
)

:: ===== Step 1: Check if cleaned folder exists =====
if exist "%folderPath%\cleaned\" (
    echo [INFO] cleaned folder already exists, skipping Panel Cleaner.
) else (
    echo 🧹 Running Panel Cleaner on "%folderPath%"...
    powershell -command "pcleaner-cli clean '%folderPath%' --extract-text --cache-masks"
    if errorlevel 1 (
        echo [ERROR] Panel Cleaner failed! Exiting...
        pause
        exit /b
    )
    echo ✅ Panel Cleaner finished.

    echo Waiting for "%folderPath%\cleaned\" to appear...
    :waitCleaned
    if exist "%folderPath%\cleaned\" (
        echo 📁 Cleaned folder found.
    ) else (
        timeout /t 1 >nul
        goto waitCleaned
    )
)

:: ===== Step 2: Launch Photoshop =====
if not exist "%pspath%" (
    echo [ERROR] Photoshop not found at "%pspath%"
    pause
    exit /b
)

echo 🚀 Launching Photoshop...
start "" "%pspath%" "C:\Users\abdoh\Downloads\testScript\scripts\script.jsx"

:: ===== Step 3: Run Bubble Extractor AI =====
echo 🧠 Running bubble extractor AI...
python "C:\Users\abdoh\Downloads\testScript\python\extract_bubbles_by_images_ai.py"

if errorlevel 1 (
    echo [ERROR] Bubble extractor failed! Check the script.
) else (
    echo ✅ Bubble extractor finished successfully.
)

echo 🎉 All done for %title%!
pause
