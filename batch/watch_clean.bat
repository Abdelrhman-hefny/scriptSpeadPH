@echo off
setlocal enabledelayedexpansion

:: ===== Teams array =====
set "teams=arura ez ken magus mei quantom rezo seren"

:askTeam
echo Select the team:
set i=1
for %%t in (%teams%) do (
    echo [!i!] %%t
    set /a i+=1
)
set /p teamChoice=Enter number of the team: 

:: Get chosen team name
set i=1
set "chosenTeam="
for %%t in (%teams%) do (
    if "!i!"=="%teamChoice%" set "chosenTeam=%%t"
    set /a i+=1
)

if "%chosenTeam%"=="" (
    echo Invalid choice. Try again.
    goto askTeam
)

:: ===== Ask for folder path =====
set /p folderPath=Paste the folder path to clean: 
set "folderPath=%folderPath:"=%"

:: ===== Temp file =====
set "tempFile=%TEMP%\psScriptTemp.txt"
(
    echo %chosenTeam%
    echo %folderPath%
) > "%tempFile%"

:: ===== Photoshop path selection =====
:askPsVer
echo Choose Photoshop version:
echo [1] Photoshop CC 2015
echo [2] Photoshop 2021
set /p psver=Enter 1 or 2: 

if "%psver%"=="1" (
    set "pspath=C:\Program Files\Adobe\Adobe Photoshop CC 2015\Photoshop.exe"
) else if "%psver%"=="2" (
    set "pspath=C:\Program Files\Adobe\Adobe Photoshop 2021\Photoshop.exe"
) else (
    echo Invalid choice. Try again.
    goto askPsVer
)

if not exist "%pspath%" (
    echo Photoshop not found at %pspath%. Please check the path.
    pause
    exit /b
)

:: ===== Step 1: Run Panel Cleaner CLI to clean folder =====
echo Running Panel Cleaner on "%folderPath%"...
powershell -command "pcleaner-cli clean '%folderPath%' -c"
if errorlevel 1 (
    echo [ERROR] Panel Cleaner failed! Exiting...
    pause
    exit /b
)
echo Panel Cleaner finished.


:: ===== Step 2: Wait until Cleaned folder exists =====
echo Waiting for "%folderPath%\Cleaned\" to appear...
:waitCleaned
if exist "%folderPath%\Cleaned\" (
    echo Cleaned folder found.
) else (
    timeout /t 1 >nul
    goto waitCleaned
)


:: ===== Step 4: Launch Photoshop with script =====
echo Launching Photoshop...
start "" "%pspath%" "%~dp0script.jsx"

:: ===== Step 3: Launch AutoHotkey script =====
"C:\Program Files\AutoHotkey\v2\AutoHotkey.exe" "C:\Users\abdoh\Documents\AutoHotkey\capToF2.ahk"

:: ===== Step 5: Wait 30 seconds then delete temp file =====
echo Temporary file will exist for 30 seconds...
timeout /t 30 >nul
if exist "%tempFile%" del "%tempFile%"

echo [✅] Done.
pause