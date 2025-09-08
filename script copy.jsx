// دالة لمعالجة المجلد المحدد
function processFolder(originalsFolder) {
    if (originalsFolder != null) {
        // اختيار فريق الووترمارك
        var wmBase = new Folder("C:/Users/abdoh/Documents/waterMark");
        var teamDir = null;
        if (wmBase.exists) {
            var subDirs = wmBase.getFiles(function (f) { return f instanceof Folder; });
            if (subDirs && subDirs.length > 0) {
                var promptMsg = "اختر رقم الفريق للووترمارك والصفحة الأخيرة:\n";
                for (var si = 0; si < subDirs.length; si++) {
                    promptMsg += (si + 1) + ". " + subDirs[si].name + (si < subDirs.length - 1 ? "  |  " : "");
                }
                var sel = prompt(promptMsg, "1");
                var idx = parseInt(sel, 10);
                if (!isNaN(idx) && idx >= 1 && idx <= subDirs.length) {
                    teamDir = subDirs[idx - 1];
                } else {
                    teamDir = subDirs[0];
                }
            }
        }

        function findFileByRegex(folder, regex) {
            if (!folder || !folder.exists) return null;
            var list = folder.getFiles(function (f) { return f instanceof File; });
            for (var fi = 0; fi < list.length; fi++) {
                try { if (regex.test(list[fi].name)) return list[fi]; } catch (_e) {}
            }
            return null;
        }

        // العثور على ملفات الووترمارك داخل مجلد الفريق (إن وجد)
        var watermarkFile = teamDir ? findFileByRegex(teamDir, /watermark[\s\S]*\.png$/i) : null;
        var lastPageBadge = teamDir ? findFileByRegex(teamDir, /^999\.(?:png|jpe?g)$/i) : null;

        function pasteImageAsLayerBottomCenter(targetDoc, imageFile, bottomMarginPx) {
            if (!imageFile || !imageFile.exists) return false;
            var prevUnits = app.preferences.rulerUnits;
            try { app.preferences.rulerUnits = Units.PIXELS; } catch (_u) {}
            var imgDoc = null;
            try {
                imgDoc = open(imageFile);
                imgDoc.selection.selectAll();
                imgDoc.selection.copy();
            } catch (_co) {
                try { if (imgDoc) imgDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (_c1) {}
                try { app.preferences.rulerUnits = prevUnits; } catch (_ur) {}
                return false;
            }
            try { imgDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (_c2) {}

            app.activeDocument = targetDoc;
            targetDoc.paste();
            var lyr = targetDoc.activeLayer;
            // حساب الوضع السفلي الوسطي مع هامش 50px
            try {
                var docW = targetDoc.width.as("px");
                var docH = targetDoc.height.as("px");
                var b = lyr.bounds;
                var lw = (b[2] - b[0]).as ? (b[2] - b[0]).as("px") : (b[2] - b[0]);
                var lh = (b[3] - b[1]).as ? (b[3] - b[1]).as("px") : (b[3] - b[1]);

                // تحريك الطبقة بحيث يكون مركزها في منتصف العرض وأسفل الصفحة بهامش
                var targetCenterX = docW / 2;
                var targetBottomY = docH - bottomMarginPx;

                // مركز الطبقة الحالي
                var cb = lyr.bounds;
                var cx = (((cb[0].as ? cb[0].as("px") : cb[0]) + (cb[2].as ? cb[2].as("px") : cb[2])) / 2);
                var cy = (((cb[1].as ? cb[1].as("px") : cb[1]) + (cb[3].as ? cb[3].as("px") : cb[3])) / 2);

                var desiredCy = targetBottomY - (lh / 2);
                var dx = targetCenterX - cx;
                var dy = desiredCy - cy;
                if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                    lyr.translate(dx, dy);
                }
            } catch (_pos) {}
            try { app.preferences.rulerUnits = prevUnits; } catch (_urs) {}
            return true;
        }

        var cleanedFolder = new Folder(originalsFolder + "/Cleaned");

        if (!cleanedFolder.exists) {
            alert("مجلد Cleaned غير موجود داخل مجلد الصور الأصلية:\n" + originalsFolder.fsName);
            return;
        }

        var files = originalsFolder.getFiles(function (f) {
            return f instanceof File && f.name.match(/\.(jpe?g|png)$/i);
        });

        // تتبع حالة الإنشاء
        var createdPsdCount = 0;
        var hadErrors = false;

        for (var i = 0; i < files.length; i++) {
            var originalFile = files[i];
            var baseName = originalFile.name.replace(/\.(jpe?g|png)$/i, '');

            // ابحث عن صورة مبيضة حسب رقم الصفحة داخل مجلد Cleaned (رقم الصفحة من اسم الملف الأصلي إن وجد)
            var mNum = baseName.match(/(\d+)/);
            var pageNumber = mNum ? parseInt(mNum[1], 10) : (i + 1);
            // اسم الملف يمكن أن يحتوي على أصفار بادئة مثل 01/002
            var numberRegex = new RegExp("(^|[^\\d])0*" + pageNumber + "([^\\d]|$)", "i");
            var cleanedMatches = cleanedFolder.getFiles(function (f) {
                try {
                    return (f instanceof File) && /\.(jpe?g|png)$/i.test(f.name) && numberRegex.test(f.name);
                } catch (_e) { return false; }
            });
            var cleanedFile = (cleanedMatches && cleanedMatches.length > 0) ? cleanedMatches[0] : null;

            if (cleanedFile != null) {
                var docOriginal = open(originalFile);
                var docCleaned = open(cleanedFile);

                docCleaned.selection.selectAll();
                docCleaned.selection.copy();
                docCleaned.close(SaveOptions.DONOTSAVECHANGES);

                docOriginal.paste();
                docOriginal.activeLayer.name = "Cleaned Layer page " + (i + 1);

                // لصق الووترمارك أسفل كل صفحة (إن وجد)
                try { if (watermarkFile) { pasteImageAsLayerBottomCenter(docOriginal, watermarkFile, 50); } } catch (_wm) {}
                // لو آخر صفحة، أضف 999 في الأسفل أيضًا (إن وجد)
                try { if (lastPageBadge && (i === files.length - 1)) { pasteImageAsLayerBottomCenter(docOriginal, lastPageBadge, 50); } } catch (_lp) {}

                var saveFile = new File(originalsFolder + "/" + baseName + ".psd");
                var psdOptions = new PhotoshopSaveOptions();
                psdOptions.embedColorProfile = true;
                psdOptions.alphaChannels = true;
                psdOptions.layers = true;

                try {
                    docOriginal.saveAs(saveFile, psdOptions, true, Extension.LOWERCASE);
                    docOriginal.saved = true; // اترك المستند مفتوح لتجنب فتح/غلق متكرر يسبب لاج
                    createdPsdCount++;
                } catch (_sv) {
                    hadErrors = true;
                }
            } else {
                // لا تنبيه؛ اعتبرها محاولة فاشلة
                hadErrors = true;
            }
        }

        // ===== بعد الانتهاء: لا نحذف إلا في حالة اكتمال إنشاء جميع PSD بدون أخطاء =====
        if (!hadErrors && createdPsdCount === files.length) {
            if (cleanedFolder.exists) {
                var cleanedFiles = cleanedFolder.getFiles();
                for (var c = 0; c < cleanedFiles.length; c++) {
                    try { cleanedFiles[c].remove(); } catch (e) {}
                }
                try { cleanedFolder.remove(); } catch (e) {}
            }
        }

        // ===== امسح كل الملفات غير PSD فقط عند الاكتمال 100% =====
        if (!hadErrors && createdPsdCount === files.length) {
            var allFiles = originalsFolder.getFiles();
            for (var f = 0; f < allFiles.length; f++) {
                if (allFiles[f] instanceof File && !allFiles[f].name.match(/\.psd$/i)) {
                    try { allFiles[f].remove(); } catch (e) {}
                }
            }
        }

        // ===== اقفل كل المستندات المفتوحة في فوتوشوب =====
        while (app.documents.length > 0) {
            try {
                app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
            } catch (e) {
                break;
            }
        }

        // ===== افتح كل ملفات الـ PSD من المجلد =====
        var psdFiles = originalsFolder.getFiles("*.psd");
        for (var p = 0; p < psdFiles.length; p++) {
            try { open(psdFiles[p]); } catch (e) {}
        }
    }
}

// انتظار 5 ثواني قبل البدء لإتاحة تحميل الواجهة
try { $.sleep(5000); } catch (e) {}

// بداية السكربت: اسأل المستخدم يختار مجلد، وكرر حسب رغبته
do {
    var originalsFolder = Folder.selectDialog("اختر مجلد الصور الأصلية");
    if (originalsFolder != null) {
        processFolder(originalsFolder);
    }
} while (confirm("هل تريد اختيار مجلد آخر؟"));
