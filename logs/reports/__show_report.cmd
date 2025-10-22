@echo off
setlocal EnableExtensions
set "WIN_TITLE=Paths vs Lines Report"
rem --- close previous report window if exists ---
taskkill /FI "WINDOWTITLE eq %WIN_TITLE%" /F >nul 2>nul
powershell -NoProfile -Command "Get-Process cmd ^| Where-Object { $_.MainWindowTitle -eq '%WIN_TITLE%' } ^| Stop-Process -Force" 2>nul
title %WIN_TITLE%
echo TXT: C:\Users\abdoh\Downloads\testScript\manga_text.txt
echo MODE: OPEN_DOCUMENTS_ONLY - MATCH BY PAGE NUMBER
echo ----------------------------------------
echo page 1 - 15 paths / 15 lines - OK
echo page 2 - 20 paths / 21 lines - MISMATCH (-1)
echo page 3 - 16 paths / 16 lines - OK
echo page 4 - 12 paths / 13 lines - MISMATCH (-1)
echo page 5 - 19 paths / 19 lines - OK
echo page 6 - 13 paths / 17 lines - MISMATCH (-4)
echo ----------------------------------------
echo EXTRA DOCS (open but not in text):
echo doc "07.psd" - page 7 - no matching text page
echo doc "08.psd" - page 8 - no matching text page
echo doc "09.psd" - page 9 - no matching text page
echo doc "10.psd" - page 10 - no matching text page
echo ----------------------------------------
echo Total mismatches: 3
echo.
cmd /d /k
