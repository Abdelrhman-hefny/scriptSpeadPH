@echo off
echo ===== Starting Batch Script =====

REM 1️⃣ Close Photoshop 2015
echo Closing Photoshop 2015...
taskkill /IM Photoshop.exe /F
echo Done closing Photoshop 2015.


REM 3️⃣ Wait 3 seconds to ensure Photoshop 2015 is closed
echo Waiting 3 seconds to ensure Photoshop 2015 is closed...
timeout /t 5 /nobreak
echo Done waiting.

REM 2️⃣ Launch Photoshop 2021 to initialize
echo Launching Photoshop 2021...
start "" "C:\Program Files\Adobe\Adobe Photoshop 2021\Photoshop.exe"
echo Photoshop 2021 launched.


REM 5️⃣ Read folder path from the temporary file
echo Reading folder path from temporary file...
set /p folderPath=<"C:\Users\abdoh\Downloads\testScript\psdFolderPath.txt"
echo Folder path read: %folderPath%
 

REM 6️⃣ Check if the folder exists
if not exist "%folderPath%" (
    echo Folder does not exist: %folderPath%
    pause
    exit /b
)
echo Folder exists.

REM 4️⃣ Wait 30 seconds before opening files
echo Waiting 30 seconds before opening PSD files...
timeout /t 30
echo Done waiting.





REM 7️⃣ Open all PSD files in numeric order
echo Opening PSD files in numeric order:
for /f "usebackq delims=" %%F in (`powershell -command ^
  "Get-ChildItem -Path '%folderPath%' -Filter *.psd | Sort-Object {[int]($_.BaseName)} | ForEach-Object { $_.Name }"`) do (
    echo Opening file: %%F
    "C:\Program Files\Adobe\Adobe Photoshop 2021\Photoshop.exe" "%folderPath%\%%F"
)
echo Done opening all PSD files.

 
REM ✅ Read team name from line 3 in temp-title.txt
setlocal enabledelayedexpansion
set "lineNum=0"
for /f "usebackq delims=" %%A in ("C:\Users\abdoh\Downloads\testScript\temp-title.txt") do (
    set /a lineNum+=1
    if !lineNum! equ 3 set "teamName=%%A"
)

echo Team name: %teamName%

if /i "%teamName%"=="rezo" (
    echo Team is REZO, opening watermark PSD...
    start "" "C:\Program Files\Adobe\Adobe Photoshop 2021\Photoshop.exe" "C:\Users\abdoh\Documents\waterMark\rezo\00.psd"
) 
 if /i "%teamName%"=="ez " (
    echo Team is EZ SCAN, opening watermark PSD...
    start "" "C:\Program Files\Adobe\Adobe Photoshop 2021\Photoshop.exe" "C:\Users\abdoh\Documents\waterMark\ez\000.jpg"
) 
 if /i "%teamName%"=="nyx " (
    echo Team is EZ SCAN, opening watermark PSD...
    start "" "C:\Program Files\Adobe\Adobe Photoshop 2021\Photoshop.exe" "C:\Users\abdoh\Documents\waterMark\nyx\00.png"
) 
 if /i "%teamName%"=="seren " (
    echo Team is EZ SCAN, opening watermark PSD...
    start "" "C:\Program Files\Adobe\Adobe Photoshop 2021\Photoshop.exe" "C:\Users\abdoh\Documents\waterMark\seren\00.psd"
) 
endlocal



REM 8️⃣ Delete the temporary file after opening the PSD files
echo Deleting temporary file...
del "C:\Users\abdoh\Downloads\testScript\psdFolderPath.txt"
echo Temporary file deleted.



