@echo off
setlocal
setlocal enabledelayedexpansion

:: ===== Ask user for folder URL or local path =====
set /p folder_url=Enter Google Drive folder URL or local folder path: 

:: ===== Get chosen team name =====
set "teams=rezo violet ez seren magus nyx arura ken mei quantom"

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

:: ===== Ask for manga type =====
echo.
echo Select manga type:
echo [1] Korian (Default)
echo [2] Japanise
set /p mangaChoice=Enter number: 

if "%mangaChoice%"=="1" (
    set "mangaType=korian"
) else if "%mangaChoice%"=="2" (
    set "mangaType=japanise"
) else (
    echo No choice entered, defaulting to Korian.
    set "mangaType=korian"
)

:: ===== Photoshop path fixed to CC 2019 =====
set "pspath=C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"
if not exist "%pspath%" (
    echo Photoshop CC 2019 not found at %pspath%.
    echo Please install Photoshop CC 2019 or update the fixed path in get_link_drive_and_dwnload.bat
    pause
    exit /b
)

:: ===== Display the entered URL =====
echo You entered: %folder_url%

:: ===== Resolve title =====
if exist "%folder_url%" (
    for %%F in ("%folder_url%") do set "title=%%~nxF"
) else (
    echo Google Drive URL detected, extracting title...
    for /f "delims=" %%A in ('powershell -NoLogo -NoProfile -Command ^
        "$html = Invoke-WebRequest '%folder_url%' | Select-Object -ExpandProperty Content; $start = $html.IndexOf('<title>')+7; $end = $html.IndexOf('</title>'); if($start -ge 7 -and $end -gt $start){$t=$html.Substring($start,$end-$start)} else {$t='UntitledFolder'}; $t -replace ' - Google Drive',''" 
    ') do set "title=%%A"
)

set "cleanTitle=%title:?=%"
if not defined cleanTitle set "cleanTitle=UntitledFolder"

:: ===== Escape backslashes for JSON =====
set "json_folder=%folder_url:\=\\%"
set "json_pspath=%pspath:\=\\%"

:: ===== Save JSON ONLY =====
(
    echo {
    echo   "title": "%cleanTitle%",
    echo   "folder_url": "%json_folder%",
    echo   "team": "%chosenTeam%",
    echo   "pspath": "%json_pspath%",
    echo   "mangaType": "%mangaType%"
    echo }
) > "C:\Users\abdoh\Downloads\testScript\config\temp-title.json"

:: ===== Run Python script =====
python "C:\Users\abdoh\Downloads\testScript\python\download_and_unzip.py"
