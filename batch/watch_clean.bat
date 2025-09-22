@echo off
setlocal enabledelayedexpansion

:: ===== قراءة أول 4 أسطر من الملف =====
set "filePath=C:\Users\abdoh\Downloads\testScript\temp-title.txt"
set "lineNum=0"

for /f "usebackq delims=" %%A in ("%filePath%") do (
    set /a lineNum+=1
    if !lineNum! leq 4 (
        set "line!lineNum!=%%A"
    ) else (
        goto :doneReading
    )
)
:doneReading

echo Line 1: %line1%
echo Line 2: %line2%
echo Line 3: %line3%
echo Line 4: %line4%


:trimEnd
if "%line1:~-1%"==" " (
    set "line1=%line1:~0,-1%"
    goto trimEnd
)

echo echo Line 4: %line1%

:: ===== Teams array =====
if "%line4%"=="" (
    set "teams=rezo violet ez seren magus nyx arura ken mei quantom"
    set "teamChoice="

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

    if "!chosenTeam!"=="" (
        echo Invalid choice. Try again.
        goto askTeam
    )
) else (
    set "teamChoice=%line3%"
)

:: ===== Ask for folder path =====
set "folderPath=" 
 
if "%line2%"=="" (
    set /p folderPath=Paste the folder path to clean: 
    set "folderPath=%folderPath:"=%"
    :: ===== Temp file =====
    set "tempFile=%TEMP%\psScriptTemp.txt"
    (
        echo %chosenTeam%
        echo %folderPath%
    ) > "%tempFile%"
) else (
    set "folderPath=C:\Users\abdoh\Downloads\%line1%"
)

:: ===== Photoshop path selection =====
:askPsVer
if "%line4%"=="" (
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
) else (
    set "pspath=%line4%"
)
:: ===== Step 1: Check if cleaned folder already exists =====
if exist "%folderPath%\cleaned\" (
    echo [INFO] cleaned folder already exists, skipping Panel Cleaner.
      
) else (
    echo Running Panel Cleaner on "%folderPath%" with text extraction...
    powershell -command "pcleaner-cli clean '%folderPath%' --extract-text --cache-masks"
    if errorlevel 1 (
        echo [ERROR] Panel Cleaner failed! Exiting...
        pause
       
    )
    echo Panel Cleaner finished.

    :: ===== Step 2: Wait until cleaned folder exists =====
    echo Waiting for "%folderPath%\cleaned\" to appear...
    :waitCleaned
    if exist "%folderPath%\cleaned\" (
        echo cleaned folder found.
    ) else (
        timeout /t 1 >nul
        goto waitCleaned
    )
)



 
:: ===== Step 3: Comprehensive mask finding and copying =====
echo Finding and copying mask files to cleaned folder...
python "C:\Users\abdoh\Downloads\testScript_auto_path\python\comprehensive_mask_finder.py" "%folderPath%"
if errorlevel 1 (
    echo [ERROR] Failed to find/copy mask files! Check the script.

) else (
    echo Mask files found and copied successfully.
)

:: ===== Step 4: Launch Photoshop with script =====
echo Launching Photoshop...
start "" "%pspath%" "C:\Users\abdoh\Downloads\testScript\scripts\script.jsx"

:: ===== Step 5: Extract bubble coordinates from masks =====
:: لازم يكون عندك Python متضاف في PATH
python "C:\Users\abdoh\Downloads\testScript\extract_bubbles_from_mask.py" "%folderPath%\cleaned"

if errorlevel 1 (
    echo [ERROR] Bubble extractor failed! Check the script.

) else (
    echo Bubble extractor finished successfully.
)
