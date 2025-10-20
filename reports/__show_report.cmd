@echo off
setlocal EnableExtensions
echo TXT: C:\Users\abdoh\Downloads\testScript\manga_text.txt
echo MODE: OPEN_DOCUMENTS_ONLY - MATCH BY PAGE NUMBER
echo ----------------------------------------
echo page 1 - 7 paths / 4 lines - MISMATCH (+3)
echo page 2 - 10 paths / 9 lines - MISMATCH (+1)
echo page 3 - 8 paths / 8 lines - OK
echo page 4 - 9 paths / 9 lines - OK
echo page 5 - 8 paths / 8 lines - OK
echo page 6 - 6 paths / 6 lines - OK
echo page 7 - 11 paths / 9 lines - MISMATCH (+2)
echo page 8 - 5 paths / 5 lines - OK
echo page 9 - 7 paths / 8 lines - MISMATCH (-1)
echo page 10 - 6 paths / 6 lines - OK
echo page 11 - 8 paths / 8 lines - OK
echo page 12 - 6 paths / 6 lines - OK
echo page 13 - 11 paths / 9 lines - MISMATCH (+2)
echo page 14 - 6 paths / 5 lines - MISMATCH (+1)
echo ----------------------------------------
echo Total mismatches: 6
echo.
cmd /d /k
