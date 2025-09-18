#target photoshop
app.bringToFront();

if (app.documents.length === 0) {
    alert("لا يوجد مستند مفتوح في الفوتوشوب.");
} else {
    var docPath = app.activeDocument.path.fsName;
    var currentFolderName = new Folder(docPath).name;
    var parentFolder = new Folder(docPath).fsName;

    // افتح 00.psd إن وجد ولم يكن مفتوحًا
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
