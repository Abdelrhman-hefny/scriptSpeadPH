@echo off
setlocal
setlocal enabledelayedexpansion

:: ===== Ask user for folder URL or local path =====
set /p folder_url=Enter Google Drive folder URL or local folder path: 

:: ===== Get chosen team name =====
set "teams=rezo violet ez seren magus nyx arura ken mei quantom  "

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

:: ===== Photoshop path fixed to 2021 =====
set "pspath=C:\Program Files\Adobe\Adobe Photoshop 2021\Photoshop.exe"
if not exist "%pspath%" (
    echo Photoshop 2021 not found at %pspath%.
    echo Please install Photoshop 2021 or update the fixed path in get_link_drive_and_dwnload.bat
    pause
    exit /b
)

:: ===== Display the entered URL =====
echo You entered: %folder_url%

:: ===== Check if local folder exists =====
if exist "%folder_url%" (
    echo Local folder detected: %folder_url%
    for %%F in ("%folder_url%") do set "title=%%~nxF"
) else (
    echo Google Drive URL detected, extracting title...
    for /f "delims=" %%A in ('powershell -NoLogo -NoProfile -Command ^
        "$html = Invoke-WebRequest '%folder_url%' | Select-Object -ExpandProperty Content; $start = $html.IndexOf('<title>')+7; $end = $html.IndexOf('</title>'); $title = $html.Substring($start, $end-$start); $title -replace ' - Google Drive',''" 
    ') do set "title=%%A"
)

echo 📌 Folder/Title: %title%
set "cleanTitle=%title:?=%"

:: ===== Save folder name and other info to file =====
set "savePath=C:\Users\abdoh\Downloads\testScript\temp-title.txt"

if defined cleanTitle (
    echo %cleanTitle% > "%savePath%"
) else (
    echo UntitledFolder > "%savePath%"
)

echo %folder_url% >> "%savePath%"
echo %chosenTeam% >> "%savePath%"
echo %pspath% >> "%savePath%"

:: ===== Run Python script =====
python "C:\Users\abdoh\Downloads\testScript\python\download_and_unzip.py"

 