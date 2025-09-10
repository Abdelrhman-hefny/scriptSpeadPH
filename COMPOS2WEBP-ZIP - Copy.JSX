#target photoshop
app.bringToFront();

(function() {
    // فحص وجود ملفات مفتوحة
    if (app.documents.length === 0) {
        alert("لا يوجد ملفات مفتوحة.");
        return;
    }

    // تحديد فولدر ملفات PSD
    var saveFolder = new Folder(app.documents[0].path);
    $.writeln("فولدر الحفظ: " + saveFolder.fsName);

    // حفظ كل الملفات المفتوحة كـ JPG
    var jpgFiles = [];
    for (var i = 0; i < app.documents.length; i++) {
        var doc = app.documents[i];
        var baseName = doc.name.replace(/\.[^\.]+$/, '');
        var jpgFile = new File(saveFolder + "/" + baseName + ".jpg");

        $.writeln("حفظ ملف JPG: " + jpgFile.fsName);
        var jpgOptions = new JPEGSaveOptions();
        jpgOptions.quality = 12;
        try {
            doc.saveAs(jpgFile, jpgOptions, true);
            $.writeln("تم حفظ " + jpgFile.fsName + " بنجاح");
            jpgFiles.push(jpgFile); // حفظ مسار الملف للحذف لاحقًا
        } catch (e) {
            $.writeln("خطأ أثناء حفظ " + jpgFile.fsName + ": " + e);
        }
    }

    // تحويل JPG إلى WebP باستخدام Smart Stitch
    var pythonExe = '"python"'; // تأكد أن Python في PATH
    var smartStitch = '"C:\\Users\\abdoh\\Downloads\\testScript\\SmartStitch-3.1\\SmartStitchConsole.py"';
    $.writeln("مسار Smart Stitch: " + smartStitch);

    // إنشاء ملف باتش مؤقت
    var batFile = new File(Folder.temp + "/runSmartStitch.bat");
    $.writeln("إنشاء ملف باتش: " + batFile.fsName);
    
    try {
        batFile.open("w");
        // أمر Smart Stitch مع تسجيل المخرجات في ملف نصي
        batFile.writeln(
            'cd /d "' + saveFolder.fsName + '" && ' +
            pythonExe + ' ' + smartStitch + ' -i "' + saveFolder.fsName + '" -sh 15000 -cw 800 -t ".webp" > "' + 
            Folder.temp.fsName + '\\smart_stitch_log.txt" 2>&1'
        );
        batFile.close();
        $.writeln("تم إنشاء ملف الباتش بنجاح");
    } catch (e) {
        $.writeln("خطأ أثناء إنشاء ملف الباتش: " + e);
        return;
    }

    // تشغيل ملف الباتش
    $.writeln("تشغيل ملف الباتش...");
    try {
        batFile.execute();
        $.writeln("تم تشغيل ملف الباتش بنجاح");
    } catch (e) {
        $.writeln("خطأ أثناء تشغيل ملف الباتش: " + e);
        alert("خطأ أثناء تشغيل Smart Stitch. تحقق من ملف اللوج: " + Folder.temp.fsName + "\\smart_stitch_log.txt");
        return;
    }

    // حذف ملفات JPG المؤقتة
    $.writeln("حذف ملفات JPG المؤقتة...");
    for (var i = 0; i < jpgFiles.length; i++) {
        try {
            if (jpgFiles[i].exists) {
                jpgFiles[i].remove();
                $.writeln("تم حذف " + jpgFiles[i].fsName + " بنجاح");
            } else {
                $.writeln("الملف " + jpgFiles[i].fsName + " غير موجود");
            }
        } catch (e) {
            $.writeln("خطأ أثناء حذف " + jpgFiles[i].fsName + ": " + e);
        }
    }

    // ملاحظة للمستخدم
 })();