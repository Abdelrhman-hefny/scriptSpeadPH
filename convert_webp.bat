 :: ===== تأكد من إدخال مجلد الصور =====
@echo off
set "INPUT_FOLDER=%~1"
if "%INPUT_FOLDER%"=="" (
    exit /b
)

set "PYTHON=C:\Users\abdoh\AppData\Local\Microsoft\WindowsApps\python.exe"
set "SMARTSTITCH=C:\Users\abdoh\Downloads\testScript\SmartStitch-3.1\SmartStitchConsole.py"

"%PYTHON%" "%SMARTSTITCH%" -i "%INPUT_FOLDER%" -sh 14000 -cw 800 -t ".webp" -lq 95 -dt pixel -s 90 -ip 5 -sl 5

pause
