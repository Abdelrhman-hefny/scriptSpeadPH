#target photoshop
app.bringToFront();

if (app.documents.length === 0) {
    alert("لا يوجد مستند مفتوح في الفوتوشوب.");
} else {
    // مسار أول مستند مفتوح
    var docPath = app.activeDocument.path.fsName;

    // اسم المجلد الحالي
    var currentFolderName = new Folder(docPath).name;

    // المجلد الأب
    var parentFolder = new Folder(docPath).fsName;

    // إنشاء اسم المجلد الجديد _JPG
    var targetFolder = parentFolder + "\\" + currentFolderName + "_JPG";
    var jpgFolder = new Folder(targetFolder);
    if (!jpgFolder.exists) jpgFolder.create();

    // إعدادات الحفظ بصيغة JPG
    var jpgOptions = new JPEGSaveOptions();
    jpgOptions.quality = 12;

    // حفظ كل مستند مفتوح في المجلد الجديد
    for (var i = 0; i < app.documents.length; i++) {
        var doc = app.documents[i];
        var saveFile = new File(jpgFolder.fsName + "\\" + doc.name.replace(/\.[^\.]+$/, "") + ".jpg");
        doc.saveAs(saveFile, jpgOptions, true, Extension.LOWERCASE);
    }

    // إعداد مسار بايثون و SmartStitch
    var pythonPath = "C:\\Users\\abdoh\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe";
    var smartStitchPath = "C:\\Users\\abdoh\\Downloads\\testScript\\SmartStitch-3.1\\SmartStitchConsole.py";

    // إنشاء ملف BAT لتشغيل SmartStitch كمسؤول
    var cmdFile = new File(parentFolder + "\\run_smartstitch_admin.bat");
    cmdFile.open("w");
    cmdFile.writeln("@echo off");
    // تشغيل SmartStitch بصلاحيات المسؤول
    cmdFile.writeln('powershell -Command "Start-Process \'' + pythonPath + '\' -ArgumentList \'' + smartStitchPath + ' -i \\\"' + targetFolder + '\\\" -sh 14000 -cw 800 -t .webp -lq 95 -dt pixel -s 90 -ip 5 -sl 5\' -Verb RunAs"');
     cmdFile.close();

    // تنفيذ الملف BAT
    try {
        cmdFile.execute();
     } catch (e) {
        alert("حدث خطأ عند تشغيل SmartStitch:\n" + e);
    }
}
