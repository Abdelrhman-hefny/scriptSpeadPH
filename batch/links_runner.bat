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
    echo   !i!^) %%t
    set "option[!i!]=%%t"
    set /a i+=1
)

set /p choice=Enter number: 
set "chosenTeam=!option[%choice%]!"
if not defined chosenTeam (
    echo Invalid choice. Try again.
    goto askTeam
)

:: ===== Ask for Photoshop path =====
set "pspath="
set /p pspath=Enter Photoshop full path: 

:: ===== Save inputs into temp file =====
set "savePath=%~dp0temp-title.txt"
(
    echo !folder_url!
    echo !chosenTeam!
    echo !pspath!
) > "!savePath!"

echo ================== LINKS LOADED ==================
for /f "usebackq tokens=* delims=" %%a in ("%~dp0LINKS.txt") do (
    set "line=%%a"
    if not "!line!"=="" (
        echo LINK: "!line!"
        :: هنا تقدر تحط الكود اللي هيعالج اللينك
    ) else (
        echo Skipped empty line
    )
)
echo ===============================================

echo.
echo Data saved to: "!savePath!"
echo Done!
pause
