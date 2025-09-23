#target photoshop
app.bringToFront();

function main() {
    if (app.documents.length === 0) {
        alert("لا يوجد مستند مفتوح في الفوتوشوب.");
        return;
    }

    var docPath = app.activeDocument.path.fsName;
    var currentFolderName = new Folder(docPath).name;
    var parentFolder = new Folder(docPath).fsName;
    var jpgFolderPath = parentFolder + "\\" + currentFolderName + "_JPG";
    var jpgFolder = new Folder(jpgFolderPath);

    if (!jpgFolder.exists) {
        alert("المجلد غير موجود:\n" + jpgFolderPath);
        return;
    }

    var smartStitchDir = "C:\\Users\\abdoh\\Downloads\\testScript\\SmartStitch-3.1";
    var ssFile = new File(smartStitchDir + "\\SmartStitchConsole.py");
    if (!ssFile.exists) {
        alert("لم أجد SmartStitchConsole.py:\n" + ssFile.fsName);
        return;
    }

    var batPath = parentFolder + "\\run_smartstitch_temp.bat";
    var batFile = new File(batPath);

    function esc(p) { return p.replace(/\\/g, "\\\\"); }
    var escapedSmart = esc(ssFile.fsName);
    var escapedJpg = esc(jpgFolderPath);

    var psCmd = ""
        + "if (Get-Command py -ErrorAction SilentlyContinue) {"
        + "  & py -3 '" + escapedSmart + "' -i '" + escapedJpg + "' -sh 14000 -t .webp -lq 95 -dt pixel -s 90 -ip 5 -sl 5"
        + "} elseif (Get-Command python -ErrorAction SilentlyContinue) {"
        + "  & python '" + escapedSmart + "' -i '" + escapedJpg + "' -sh 14000 -t .webp -lq 95 -dt pixel -s 90 -ip 5 -sl 5"
        + "} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {"
        + "  & python3 '" + escapedSmart + "' -i '" + escapedJpg + "' -sh 14000 -t .webp -lq 95 -dt pixel -s 90 -ip 5 -sl 5"
        + "} else { Write-Error 'No Python found.'; }";

    // إنشاء BAT مؤقت
    batFile.open("w");
    batFile.writeln('@echo off');
    batFile.writeln('chcp 65001>nul');
    batFile.writeln('pushd "' + esc(smartStitchDir) + '"');
    // هنا استدعاء PowerShell عادي وهيقفل بعد التنفيذ
    batFile.writeln('powershell -NoProfile -ExecutionPolicy Bypass -Command "' + psCmd + '"');
    batFile.writeln('popd');
    batFile.writeln('del "%~f0"'); // يحذف نفسه بعد الانتهاء
    batFile.close();

    // تشغيله
    try {
        batFile.execute();
    } catch (e) {
        alert("خطأ عند تشغيل SmartStitch:\n" + e);
    }
}

main();
    