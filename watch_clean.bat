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
set /p folderPath=Paste the folder path to watch: 
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

:: ===== Watch loop =====
echo Watching folder for 'Cleaned' folder...
:watchLoop
if exist "%folderPath%\Cleaned\" (
    echo Cleaned folder found! Launching Photoshop...
    start "" "%pspath%" "%~dp0script.jsx"
    goto waitDelete
)

:: ===== Countdown 5 seconds =====
for /l %%i in (5,-1,1) do (
    <nul set /p "=Checking again in %%i... seconds! "
    timeout /t 1 >nul
)
echo.
goto watchLoop

:waitDelete
:: ===== Wait 30 seconds while keeping batch open =====
echo Temporary file will exist for 30 seconds...
timeout /t 30 >nul

:: ===== Delete temp file =====
if exist "%tempFile%" del "%tempFile%"
exit /b