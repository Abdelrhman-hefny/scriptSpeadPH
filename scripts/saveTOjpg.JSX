#target photoshop
app.bringToFront();

if (app.documents.length === 0) {
    alert("لا يوجد مستند مفتوح في الفوتوشوب.");
} else {
    var docPath = app.activeDocument.path.fsName;
    var currentFolderName = new Folder(docPath).name;
    var parentFolder = new Folder(docPath).fsName;

    var targetFolder = parentFolder + "\\" + currentFolderName + "_JPG";
    var jpgFolder = new Folder(targetFolder);
    if (!jpgFolder.exists) jpgFolder.create();

    var jpgOptions = new JPEGSaveOptions();
    jpgOptions.quality = 12;

    for (var i = 0; i < app.documents.length; i++) {
        var doc = app.documents[i];
        app.activeDocument = doc; // ✅ لازم تخليه Active قبل الحفظ

        var fileName = doc.name.replace(/\.[^\.]+$/, "") + ".jpg";
        var saveFile = new File(jpgFolder.fsName + "\\" + fileName);

        doc.saveAs(saveFile, jpgOptions, true, Extension.LOWERCASE);
    }
}
