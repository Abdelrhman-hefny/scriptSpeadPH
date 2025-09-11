@echo off
echo ===== Watch Clean Script =====
echo Starting file monitoring...

REM مراقبة التغييرات في المجلد الحالي
:watch_loop
timeout /t 5 /nobreak >nul

REM فحص وجود ملفات جديدة
for %%f in (*.psd) do (
    echo Found new PSD file: %%f
    REM يمكن إضافة معالجة إضافية هنا
)

goto watch_loop
