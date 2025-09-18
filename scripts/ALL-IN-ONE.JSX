#target photoshop
app.bringToFront();

(function () {
    // 0) تحقق من وجود مستندات مفتوحة
if (app.documents.length === 0) {
    alert("لا يوجد مستند مفتوح في الفوتوشوب.");
    return;
}
var url = "https://coda.io/d/Work_dhT8XA1rThZ/rezo_supN5Ws5#_luDJkH25";
 var chrome = '"C:\\Users\\abdoh\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"';
var f = new File(Folder.temp + "/o.bat");
f.open("w");
f.writeln('@echo off');
f.writeln(chrome + ' "' + url + '"');
f.writeln('del "%~f0"');
f.close();
f.execute();

// 1) تحديد مجلد العمل والمسارات
var parentFolder, currentFolderName;
var baseFolder = null;
try {
    for (var di = 0; di < app.documents.length; di++) {
        try {
            var p = app.documents[di].path; // يرمي خطأ إذا المستند غير محفوظ
            if (p) { baseFolder = p; break; }
        } catch (_ignored) {}
    }
} catch (_scanErr) {}
if (baseFolder) {
    parentFolder = baseFolder.fsName;
    currentFolderName = new Folder(parentFolder).name;
} else {
    var pick = Folder.selectDialog("لم يتم حفظ أي مستند بعد. اختر مجلد المشروع الذي يحتوي على ملفات PSD:");
    if (!pick) { alert("تم الإلغاء."); return; }
    currentFolderName = pick.name;
    parentFolder = pick.fsName;
}

// فتح ملف 00.psd إن وجد ولم يكن مفتوحًا بالفعل
try {
    var zeroPsd = new File(parentFolder + "\\00.psd");
    if (zeroPsd.exists) {
        var isZeroOpen = false;
        try {
            for (var zi = 0; zi < app.documents.length; zi++) {
                try {
                    var zdoc = app.documents[zi];
                    if (zdoc && zdoc.fullName && zdoc.fullName.fsName) {
                        if (String(zdoc.fullName.fsName).toLowerCase() === String(zeroPsd.fsName).toLowerCase()) { isZeroOpen = true; break; }
                    } else if (zdoc && zdoc.name && /\.psd$/i.test(zdoc.name)) {
                        if (String(zdoc.name).toLowerCase() === "00.psd") { isZeroOpen = true; break; }
                    }
                } catch (_ze) {}
            }
        } catch (_zl) {}
        if (!isZeroOpen) {
            try { app.open(zeroPsd); } catch (_zo) {}
        }
    }
} catch (_zerr) {}

// مجلد ناتج JPG
var jpgTargetFolder = parentFolder + "\\" + currentFolderName + "_JPG";
var jpgFolder = new Folder(jpgTargetFolder);
if (!jpgFolder.exists) jpgFolder.create();

// 2) حفظ كل الملفات المفتوحة كـ JPG
try {
    var jpgOptions = new JPEGSaveOptions();
    jpgOptions.quality = 12;

    for (var i = 0; i < app.documents.length; i++) {
        var d = app.documents[i];
        app.activeDocument = d; // ✅ لازم تعيّن المستند قبل الحفظ

        var saveFile = new File(jpgFolder.fsName + "\\" + d.name.replace(/\.[^\.]+$/, "") + ".jpg");
        d.saveAs(saveFile, jpgOptions, true, Extension.LOWERCASE);
    }
} catch (e1) {
    alert("خطأ أثناء حفظ JPG: " + e1);
    return;
}


    // 3) تشغيل SmartStitch (الخطوة الثانية) والانتظار حتى ينتهي
    // إعداد المسارات
    var pythonPath = "C:\\Users\\abdoh\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe";
    var smartStitchPath = "C:\\Users\\abdoh\\Downloads\\testScript\\SmartStitch-3.1\\SmartStitchConsole.py";

    // ملف BAT مؤقت لتشغيل SmartStitch بدون صلاحيات مسؤول + لوج إلى فولدر مؤقت للمستخدم
    var cmdFile = new File(parentFolder + "\\run_smartstitch.bat");
    // فولدر لوج في Temp خاص بالمستخدم لضمان صلاحيات الكتابة
    var tempLogsRoot = new Folder(Folder.temp.fsName + "/smartstitch_logs");
    if (!tempLogsRoot.exists) tempLogsRoot.create();
    var logsDir = new Folder(tempLogsRoot.fsName + "/" + currentFolderName);
    if (!logsDir.exists) logsDir.create();
    var stdOutLog = new File(logsDir.fsName + "\\smartstitch.out.log");
    var stdErrLog = new File(logsDir.fsName + "\\smartstitch.err.log");
    // ملف علامة الانتهاء أيضاً في Temp
    var doneMarker = new File(logsDir.fsName + "\\stitch_done.flag");
    try {
        if (doneMarker.exists) try { doneMarker.remove(); } catch (_) {}
        cmdFile.open("w");
        cmdFile.writeln("@echo off");
        // اجعل مجلد العمل هو مجلد JPG لتجنب أي مشاكل مسارات
        cmdFile.writeln('cd /d "' + jpgTargetFolder + '"');
        // شغّل بايثون مباشرة بدون مسؤول، ووجه المخرجات إلى فولدر Temp، ثم اكتب ملف الانتهاء
        var line = '"' + pythonPath + '" "' + smartStitchPath + '" -i "' + jpgTargetFolder + '" -sh 14000 -cw 800 -t .webp -lq 95 -dt pixel -s 90 -ip 5 -sl 5 > "' + stdOutLog.fsName + '" 2> "' + stdErrLog.fsName + '"';
        cmdFile.writeln(line);
        cmdFile.writeln('echo done > "' + doneMarker.fsName + '"');
        cmdFile.close();
        // نفّذ الملف (سيعمل في الخلفية)، وسننتظر ملف العلامة
        cmdFile.execute();
    } catch (e2) {
        alert("حدث خطأ عند تجهيز/تشغيل SmartStitch:\n" + e2);
        return;
    }

    // الانتظار حتى يتم إنشاء ملف العلامة (يعني أن الخطوة الثانية انتهت)
    // نتحقق كل 3 ثواني، بحد أقصى 2 ساعة (2400 محاولة)
    var tries = 0;
    var maxTries = 2400;
    while (!doneMarker.exists && tries < maxTries) {
        $.sleep(3000);
        tries++;
    }
    if (!doneMarker.exists) {
        alert("انتهت مهلة الانتظار لعملية SmartStitch. لم يتم العثور على ملف الإنهاء.");
        return;
    }

    // 4) ضغط ناتج SmartStitch (الخطوة الثالثة)
    // فولدر ملفات التحويل الناتجة من SmartStitch
    var stitchedFolder = new Folder(parentFolder + "\\" + currentFolderName + "_JPG [stitched]");
    if (!stitchedFolder.exists) {
        alert("⚠️ فولدر التحويل غير موجود: " + stitchedFolder.fsName + "\nتأكد أن SmartStitch انتهى وأن المجلد أُنشئ.");
        return;
    }

    // مسار ملف ZIP الناتج في نفس فولدر PSDs
    var zipFile = parentFolder + "\\" + currentFolderName + ".zip";
    try {
        var rarBat = new File(Folder.temp + "/zipWithWinRAR.bat");
        rarBat.open("w");
        rarBat.writeln('cd /d "' + stitchedFolder.fsName + '"');
        rarBat.writeln('"C:\\Program Files\\WinRAR\\WinRAR.exe" a -afzip "' + zipFile + '" "*"');
        rarBat.close();
        rarBat.execute();
    } catch (e3) {
        alert("❌ فشل الضغط. تحقق من مسار WinRAR والفولدر.\n" + e3);
        return;
    }

    alert("✅ تم التنفيذ بالتتابع:\n1) حفظ JPG\n2) تشغيل SmartStitch والانتظار\n3) ضغط الناتج إلى: " + zipFile);
})();


