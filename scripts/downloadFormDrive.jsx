#target photoshop
app.bringToFront();

(function () {
    var folderURL = prompt("أدخل رابط فولدر Google Drive:", "");
    if (!folderURL) {
        alert("❌ لم يتم إدخال رابط.");
        return;
    }

    // مسارات بايثون والسكريبت
    var pythonPath = "C:\\Users\\abdoh\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe";
    var scriptPath = "C:\\Users\\abdoh\\Downloads\\testScript\\download_and_unzip.py";

    // فولدر مؤقت لإنشاء ملف BAT
    var tempBat = new File(Folder.temp.fsName + "/run_drive_download.bat");
    tempBat.open("w");
    tempBat.writeln("@echo off");
    tempBat.writeln("echo === تشغيل سكربت البايثون ===");
    tempBat.writeln('"' + pythonPath + '" "' + scriptPath + '" "' + folderURL + '"');
    tempBat.writeln("echo.");
    tempBat.writeln("echo [انتهى التشغيل - اضغط أي زر للإغلاق]");
    tempBat.writeln("pause");
    tempBat.close();

    // تشغيل الملف BAT
    try {
        tempBat.execute();
    } catch (e) {
        alert("❌ خطأ أثناء تشغيل السكربت:\n" + e);
    }
})();
