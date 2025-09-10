#target photoshop
app.bringToFront();

if (app.documents.length === 0) {
    alert("لا يوجد مستند مفتوح في الفوتوشوب.");
} else {
    // مسار أول مستند مفتوح (نفترض جميع الملفات في نفس المجلد)
    var docPath = app.activeDocument.path.fsName;

    // اسم المجلد الحالي
    var currentFolderName = new Folder(docPath).name;

    // المجلد الأب
    var parentFolder = new Folder(docPath).parent.fsName;

    // إنشاء اسم المجلد الجديد _JPG
    var targetFolder = parentFolder + "\\" + currentFolderName + "_JPG";

    // إنشاء المجلد إذا لم يكن موجودًا
    var jpgFolder = new Folder(targetFolder);
    if (!jpgFolder.exists) jpgFolder.create();

    // إعدادات الحفظ بصيغة JPG
    var jpgOptions = new JPEGSaveOptions();
    jpgOptions.quality = 12; // أعلى جودة (1-12)

    // حفظ كل مستند مفتوح في المجلد الجديد
    for (var i = 0; i < app.documents.length; i++) {
        var doc = app.documents[i];
        // اسم الملف + امتداد JPG
        var saveFile = new File(jpgFolder.fsName + "\\" + doc.name.replace(/\.[^\.]+$/, "") + ".jpg");
        doc.saveAs(saveFile, jpgOptions, true, Extension.LOWERCASE);
    }

    alert("تم حفظ كل الصور المفتوحة في:\n" + targetFolder);
}
