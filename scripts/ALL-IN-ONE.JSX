#target photoshop
app.bringToFront();

(function () {
    if (app.documents.length === 0) {
        alert("⚠️ لا يوجد مستند مفتوح في الفوتوشوب.");
        return;
    }

    // --- المتغيرات الأساسية ---
    var docPath = app.activeDocument.path.fsName;
    var currentFolderName = new Folder(docPath).name;
    var parentFolder = new Folder(docPath).fsName;

    var jpgFolder = new Folder(parentFolder + "\\" + currentFolderName + "_JPG");
    if (!jpgFolder.exists) jpgFolder.create();

    // --- 1) الحفظ كـ JPG ---
    var jpgOptions = new JPEGSaveOptions();
    jpgOptions.quality = 12;

    for (var i = 0; i < app.documents.length; i++) {
        var doc = app.documents[i];
        app.activeDocument = doc;
        var fileName = doc.name.replace(/\.[^\.]+$/, "") + ".jpg";
        var saveFile = new File(jpgFolder.fsName + "\\" + fileName);
        doc.saveAs(saveFile, jpgOptions, true, Extension.LOWERCASE);
    }
    $.writeln("✅ تم حفظ كل الملفات في: " + jpgFolder.fsName);

    // --- 2) التحويل بـ SmartStitch ---
    var smartStitchDir = "C:\\Users\\abdoh\\Downloads\\testScript\\SmartStitch-3.1";
    var ssFile = new File(smartStitchDir + "\\SmartStitchConsole.py");
    if (!ssFile.exists) {
        alert("لم أجد SmartStitchConsole.py:\n" + ssFile.fsName);
        return;
    }

    var batPath = parentFolder + "\\run_smartstitch_temp.bat";
    var batFile = new File(batPath);

    function esc(p) { return p.replace(/\\/g, "\\\\"); }
    var psCmd = ""
        + "if (Get-Command py -ErrorAction SilentlyContinue) {"
        + "  & py -3 '" + esc(ssFile.fsName) + "' -i '" + esc(jpgFolder.fsName) + "' -sh 14000 -t .webp -lq 95 -dt pixel -s 90 -ip 5 -sl 5"
        + "} elseif (Get-Command python -ErrorAction SilentlyContinue) {"
        + "  & python '" + esc(ssFile.fsName) + "' -i '" + esc(jpgFolder.fsName) + "' -sh 14000 -t .webp -lq 95 -dt pixel -s 90 -ip 5 -sl 5"
        + "} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {"
        + "  & python3 '" + esc(ssFile.fsName) + "' -i '" + esc(jpgFolder.fsName) + "' -sh 14000 -t .webp -lq 95 -dt pixel -s 90 -ip 5 -sl 5"
        + "} else { Write-Error 'No Python found.'; }";

    batFile.open("w");
    batFile.writeln('@echo off');
    batFile.writeln('chcp 65001>nul');
    batFile.writeln('pushd "' + esc(smartStitchDir) + '"');
    batFile.writeln('powershell -NoProfile -ExecutionPolicy Bypass -Command "' + psCmd + '"');
    batFile.writeln('popd');
    batFile.writeln('del "%~f0"');
    batFile.close();

    try {
        batFile.execute();
        $.writeln("⚙️ تم تشغيل SmartStitch...");
    } catch (e) {
        alert("خطأ عند تشغيل SmartStitch:\n" + e);
        return;
    }

    // --- 3) الضغط باستخدام WinRAR ---
    // نفترض إن SmartStitch بينشئ فولدر باسم: "_JPG [stitched]"
    var stitchedFolder = new Folder(parentFolder + "\\" + currentFolderName + "_JPG [stitched]");
    if (!stitchedFolder.exists) {
        $.writeln("⚠️ فولدر التحويل غير موجود: " + stitchedFolder.fsName);
        return;
    }

    var zipFile = parentFolder + "\\" + currentFolderName + ".zip";
    try {
        var rarBat = new File(Folder.temp + "/zipWithWinRAR.bat");
        rarBat.open("w");
        rarBat.writeln('cd /d "' + stitchedFolder.fsName + '"');
        rarBat.writeln('"C:\\Program Files\\WinRAR\\WinRAR.exe" a -afzip "' + zipFile + '" "*"');
        rarBat.writeln('del "%~f0"'); // حذف نفسه بعد الانتهاء
        rarBat.close();
        rarBat.execute();
        $.writeln("✅ تم الضغط في ملف: " + zipFile);
    } catch (e) {
        $.writeln("❌ فشل الضغط: " + e);
        alert("فشل الضغط. تحقق من مسار WinRAR.");
    }
})();
