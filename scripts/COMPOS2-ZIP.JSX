#target photoshop
app.bringToFront();

(function() {

    var url = "https://coda.io/d/Work_dhT8XA1rThZ/rezo_supN5Ws5#_luDJkH25";
    //var chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
    var chrome = '"C:\\Users\\abdoh\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"';

    var f = new File(Folder.temp + "/o.bat");
    f.open("w");
    f.writeln('@echo off');
    f.writeln(chrome + ' "' + url + '"');
    f.writeln('del "%~f0"');
    f.close();
    f.execute();
    

    // فولدر PSD الأصلي (نفترض إنه نفس فولدر أول ملف مفتوح)
    if (app.documents.length === 0) {
        alert("لا يوجد ملفات مفتوحة.");
        return;
    }

    var saveFolder = new Folder(app.documents[0].path);

    // فولدر الملفات المحوَّلة [stitched]
    var stitchedFolder = new Folder(saveFolder.fsName + "\\" + saveFolder.name + "_JPG [stitched]");
    if (!stitchedFolder.exists) {
        alert("⚠️ فولدر التحويل غير موجود: " + stitchedFolder.fsName);
        return;
    }

   // اسم ملف ZIP الناتج داخل نفس فولدر التحويل
// نحفظ ملف ZIP في نفس مستوى ملفات الفوتوشوب (مش جوه فولدر stitched)
var zipFile = saveFolder.fsName + "\\" + saveFolder.name + ".zip";

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
