#target photoshop
app.bringToFront();

(function() {

    // فولدر PSD الأصلي (نفترض إنه نفس فولدر أول ملف مفتوح)
    if (app.documents.length === 0) {
        alert("لا يوجد ملفات مفتوحة.");
        return;
    }

    var saveFolder = new Folder(app.documents[0].path);

    // فولدر الملفات المحوَّلة [stitched]
    var stitchedFolder = new Folder(saveFolder.parent.fsName + "\\" + saveFolder.name + " [stitched]");
    if (!stitchedFolder.exists) {
        alert("⚠️ فولدر التحويل غير موجود: " + stitchedFolder.fsName);
        return;
    }

    // اسم ملف ZIP الناتج
    var zipFile = saveFolder.fsName + ".zip";

    // إنشاء ملف باتش لتشغيل WinRAR
    try {
        var rarBat = new File(Folder.temp + "/zipWithWinRAR.bat");
        rarBat.open("w");
        rarBat.writeln('cd /d "' + stitchedFolder.fsName + '"');
        rarBat.writeln('"C:\\Program Files\\WinRAR\\WinRAR.exe" a -afzip "' + zipFile + '" "*"');
        rarBat.close();
        rarBat.execute();
        $.writeln("✅ تم الضغط باستخدام WinRAR: " + zipFile);
    } catch (e) {
        $.writeln("WinRAR فشل: " + e);
        alert("❌ فشل الضغط. تحقق من مسار WinRAR والفولدر.");
    }

})();
