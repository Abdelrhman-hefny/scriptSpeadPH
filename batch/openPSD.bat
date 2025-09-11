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



REM 4️⃣ Wait 30 seconds before opening files
echo Waiting 30 seconds before opening PSD files...
timeout /t 40
echo Done waiting.


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


REM 7️⃣ Open all PSD files in alphabetical order
echo Opening PSD files in alphabetical order:
for /f "delims=" %%F in ('dir /b /a-d "%folderPath%\*.psd" ^| sort') do (
    echo Opening file: %%F
    "C:\Program Files\Adobe\Adobe Photoshop 2021\Photoshop.exe" "%folderPath%\%%F"
)
echo Done opening all PSD files.

echo Stopping any running AutoHotkey scripts...
taskkill /IM AutoHotkey.exe /F >nul 2>&1
timeout /t 5

"C:\Program Files\AutoHotkey\v2\AutoHotkey.exe" "C:\Users\abdoh\Documents\AutoHotkey\capToEnter.ahk"

REM 8️⃣ Delete the temporary file after opening the PSD files
echo Deleting temporary file...
del "C:\Users\abdoh\Downloads\testScript\psdFolderPath.txt"
echo Temporary file deleted.



