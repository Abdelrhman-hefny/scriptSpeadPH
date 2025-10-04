@echo off
setlocal enabledelayedexpansion

:: temp file path
set "tempFile=C:\Users\abdoh\Downloads\testScript\temp-title.txt"

:: read first line
set /p folderName=<"%tempFile%"

:: remove spaces from both ends
for /f "tokens=* delims= " %%a in ("!folderName!") do set "folderName=%%a"

:trimLoop
if "!folderName:~-1!"==" " (
    set "folderName=!folderName:~0,-1!"
    goto :trimLoop
)

:: python script path
set "pythonScript=C:\Users\abdoh\Downloads\testScript\python\extract_bubbles_from_mask.py"

:: cleaned folder
set "cleanedFolder=C:\Users\abdoh\Downloads\!folderName!\cleaned"

cd /d "!cleanedFolder!" || (
    echo ❌ Invalid path: "!cleanedFolder!"
    pause
    exit /b
)

python "!pythonScript!" "!cleanedFolder!"

:: run Photoshop script
set "psScript=C:\Users\abdoh\Downloads\testScript\scripts\read-bb-jsonfile.jsx"
set "psApp=C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"

if exist "!psApp!" (
    start "" "!psApp!" "!psScript!"
) else (
    echo ❌ Photoshop not found at "!psApp!"
    pause
    exit /b
)


pause
