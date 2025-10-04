#target photoshop
app.bringToFront();

if (app.documents.length === 0) {
    alert("⚠️ مفيش ملفات مفتوحة.");
} else {
    for (var i = 0; i < app.documents.length; i++) {
        var doc = app.documents[i];
        app.activeDocument = doc;

        try {
            // امسح كل الـ Paths في المستند
            while (doc.pathItems.length > 0) {
                doc.pathItems[0].remove();
            }

            // احفظ الملف بعد حذف الباث
            if (doc.fullName) { // لو الملف محفوظ أصلاً
                doc.save();
            } else { // لو ملف جديد مش محفوظ
                var psdOptions = new PhotoshopSaveOptions();
                psdOptions.embedColorProfile = true;
                psdOptions.alphaChannels = true;
                psdOptions.layers = true;

                var saveFile = File("~/Desktop/" + doc.name.replace(/\.[^\.]+$/, "") + ".psd");
                doc.saveAs(saveFile, psdOptions, true, Extension.LOWERCASE);
            }
        } catch (e) {
            // تجاهل أي أخطاء
        }
    }
 }
