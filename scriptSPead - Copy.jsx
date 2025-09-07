#target photoshop
app.bringToFront();

(function () {
    // ========== إعدادات عامة ==========
    var txtFile = File.openDialog("اختر ملف النص (TXT)", "Text Files: *.txt");
    if (!txtFile) {
        alert("لم يتم اختيار ملف TXT. الخروج.");
        return;
    }

    // خريطة الخطوط (عدل الأسماء لو عندك أسماء مختلفة) الخاصه بفريق siren
var fontMap = {
    '()': 'CCVictorySpeechW00-Italic',     // Thoughts
    '“”': 'CCVictorySpeechW00-Regular',    // Dialogue
    '""': 'CCVictorySpeechW00-Regular',    // Dialogue
    '//': 'CCVictorySpeechW00-Regular',    // Dialogue
    '<>': 'CCDearDiaryOMG',                // Shout
    'NA:': 'SSRosehip',                    // Narration (Boxes)
    '[]': 'SSRosehip',                     // Box text
    '**': 'CreatorcreditsBB-Italic',       // Phone/Mechanical
    'SFX:': 'BlambasticAltBB',             // Sound effects
    'ST:': 'KomikaSlim',                   // Small text (stress/whisper)
    'OT:': 'OrangeFizz-Regular',           // Outside bubble
    '#': 'OrangeFizz-Regular',           // Outside bubble
    'BGT:': 'TightSpotBB-Italic',          // Side text / background
    'TL/N:': 'CCDashDecent-Light',         // Notes
    'TL/PR:': 'CCDashDecent-Light',        // Notes
};




    var defaultFont = 'CCWildWords';
    var baseFontSize = 33;   // الحجم الابتدائي (يمكن تغييره)
    var minFontSize  = 8;    // أقل حجم مسموح به عند تقليل الخط
    var boxPaddingRatio = 0.18; // نسبة الـ padding داخل الفقاعة (0..0.4 مثلا)

    // ========= دوال مساعدة ==========
    function tryGetFont(name) {
        try {
            if (!name) return null;
            var f = app.fonts.getByName(name);
            return f ? name : null;
        } catch (e) {
            return null;
        }
    }
    function pickFont(preferred, fallback) {
        var p = tryGetFont(preferred);
        if (p) return p;
        var f = tryGetFont(fallback);
        if (f) return f;
        try {
            if (app.fonts.length > 0) return app.fonts[0].postScriptName;
        } catch (e) {}
        return "ArialMT";
    }
    function toNum(unitVal) {
        try { return parseFloat(String(unitVal)); } catch (e) { return NaN; }
    }

    // ========= قراءة كل الأسطر (بترتيب) ==========
    var allLines = [];
    txtFile.open("r");
    while (!txtFile.eof) {
        var line = txtFile.readln() || "";
        line = line.replace(/^\s+|\s+$/g, "");
        // لو عندك عناوين page X وتريد تجاهلها، هذا السطر يتخطاها
        if (/^\s*page\s+\d+/i.test(line)) continue;
        if (line !== "") allLines.push(line);
    }
    txtFile.close();

    if (allLines.length === 0) {
        alert("ملف النص فاضي أو مفيهوش سطور صالحة!");
        return;
    }

    // ========= لوج تفصيلي ==========
    var log = [];
    var errors = [];
    function L(s) { log.push(s); }
    function E(s) { errors.push(s); log.push("ERROR: " + s); }

    L("Photoshop Text Import - verbose log");
    L("Date: " + (new Date()).toString());
    L("TXT file: " + txtFile.fsName);
    L("Total lines read: " + allLines.length);
    L("Base font size: " + baseFontSize + "  minFontSize: " + minFontSize);
    L("boxPaddingRatio: " + boxPaddingRatio);
    L("========================================");

    var totalInserted = 0;
    var totalSkipped = 0;
    var totalErrors = 0;
    var lineIndex = 0;

    // ====== نلف على كل المستندات المفتوحة بالترتيب
    for (var d = 0; d < app.documents.length; d++) {
        var doc = app.documents[d];
        try {
            app.activeDocument = doc;
        } catch (e) {
            E("Couldn't activate document index " + d + ": " + e);
            continue;
        }

        L("\n--- Processing document: " + doc.name + " ---");

        var paths = doc.pathItems;
        if (!paths || paths.length === 0) {
            L("Document '" + doc.name + "' has no path items. Skipping.");
            continue;
        }

        // نجمع و نرتب الباثس حسب bubble# إن وُجد
        var pagePaths = [];
        for (var p = 0; p < paths.length; p++) {
            try { pagePaths.push(paths[p]); } catch (e) {}
        }
        pagePaths.sort(function (a, b) {
            try {
                var ma = a.name.match(/bubble[_\s-]?(\d+)/i);
                var mb = b.name.match(/bubble[_\s-]?(\d+)/i);
                var na = ma ? parseInt(ma[1], 10) : 999999;
                var nb = mb ? parseInt(mb[1], 10) : 999999;
                return na - nb;
            } catch (e) { return 0; }
        });

        for (var k = 0; k < pagePaths.length; k++) {
            if (lineIndex >= allLines.length) {
                L("No more lines to place (finished allLines).");
                break;
            }

            var pathItem = pagePaths[k];
            var pathName = "(unknown)";
            try { pathName = pathItem.name; } catch (e) {}

            var entryPrefix = "File=" + doc.name + " | BubbleIndex=" + (k+1) + " | PathName=" + pathName;
            L("\n" + entryPrefix);

            var lineText = allLines[lineIndex];
            lineIndex++;

            // نحدّد الخط المطلوب من بداية السطر إن وُجد
		var wantedFont = null;
for (var key in fontMap) {
    var regex = new RegExp("^" + key.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1")); 
    if (regex.test(lineText)) {
        wantedFont = fontMap[key];
        lineText = lineText.replace(regex, "");  
        lineText = lineText.replace(/^\s+|\s+$/g, ""); // شيل المسافات
        break;
    }
}
if (!wantedFont) wantedFont = defaultFont;
var usedFont = pickFont(wantedFont, defaultFont);




            try {
                // محاولات تحديد الباث والتحويل إلى سليكشن
                try {
                    pathItem.makeSelection();
                } catch (eSel) {
                    throw new Error("makeSelection() failed: " + eSel);
                }

                // قراءة حدود السليكشن
                var selBounds;
                try {
                    selBounds = doc.selection.bounds;
                } catch (eb) {
                    // لو ما قدرنا ناخد bounds نلغى التحديد ونرمي خطأ
                    doc.selection.deselect();
                    throw new Error("selection.bounds failed: " + eb);
                }

                var x1 = toNum(selBounds[0]), y1 = toNum(selBounds[1]), x2 = toNum(selBounds[2]), y2 = toNum(selBounds[3]);
                var w = x2 - x1, h = y2 - y1;
                L(" selection bounds: x1=" + x1.toFixed(1) + " y1=" + y1.toFixed(1) + " x2=" + x2.toFixed(1) + " y2=" + y2.toFixed(1) + "  w=" + w.toFixed(1) + " h=" + h.toFixed(1));

                // نحدد صندوق داخلي (padding)
                var boxWidth  = Math.max(10, w * (1 - boxPaddingRatio));
                var boxHeight = Math.max(10, h * (1 - boxPaddingRatio));
                var centerX = (x1 + x2) / 2;
                var centerY = (y1 + y2) / 2;
                L(" boxWidth=" + boxWidth.toFixed(1) + " boxHeight=" + boxHeight.toFixed(1) + " centerX=" + centerX.toFixed(1) + " centerY=" + centerY.toFixed(1));

                // إنشاء طبقة النص (Paragraph)
                var textLayer = doc.artLayers.add();
                textLayer.kind = LayerKind.TEXT;
                try { textLayer.textItem.kind = TextType.PARAGRAPHTEXT; } catch (ee) {}
                textLayer.textItem.contents = lineText;
                textLayer.textItem.justification = Justification.CENTER;
                // حجم مبدئي
                var curFontSize = baseFontSize;
                try { textLayer.textItem.font = usedFont; } catch (fe) { L(" warning: font set failed: " + fe); }
                textLayer.textItem.size = curFontSize;

                // تعيين الصندوق مبدئياً top-left بناءً على المركز
                var startLeft = centerX - (boxWidth / 2);
                var startTop  = centerY - (boxHeight / 2);
                textLayer.textItem.width  = boxWidth;
                textLayer.textItem.height = boxHeight;
                textLayer.textItem.position = [ startLeft, startTop ];

                // ======== Auto-fit loop: نخفض الخط لو النص خارج الصندوق =========
                var attempts = 0;
                var fitted = false;
                while (true) {
                    attempts++;
                    // قراءة حدود طبقة النص
                    var tbounds;
                    try { tbounds = textLayer.bounds; } catch (tbE) {
                        // لو bounds غير متاحة، نكسر
                        L("  - could not read textLayer.bounds: " + tbE);
                        break;
                    }
                    var tLeft = toNum(tbounds[0]), tTop = toNum(tbounds[1]), tRight = toNum(tbounds[2]), tBottom = toNum(tbounds[3]);
                    var tW = tRight - tLeft, tH = tBottom - tTop;
                    L("  - text bounds: left=" + tLeft.toFixed(1) + " top=" + tTop.toFixed(1) + " w=" + tW.toFixed(1) + " h=" + tH.toFixed(1) + " (fontSize=" + curFontSize + ")");

                    // هل النص يتجاوز الصندوق؟
                    if (tW <= boxWidth + 0.5 && tH <= boxHeight + 0.5) {
                        fitted = true;
                        break;
                    }

                    // لو لم تنجح، نقلل الحجم
                    if (curFontSize <= minFontSize || attempts > 30) break;
                    curFontSize = Math.max(minFontSize, Math.floor(curFontSize * 0.92)); // تقليل تدريجي (~8%)
                    try { textLayer.textItem.size = curFontSize; } catch (e) { L("  - failed set size: " + e); break; }

                    // إعادة محاذاة الصندوق لأن تغيير الحجم قد يغير القياسات
                    textLayer.textItem.width  = boxWidth;
                    textLayer.textItem.height = boxHeight;
                    textLayer.textItem.position = [ startLeft, startTop ];
                }

                // الآن حنحسب مركز نص الطبقة ونعمل translate لمركزة داخل الفقاعة
                try {
                    var finalBounds = textLayer.bounds;
                    var fL = toNum(finalBounds[0]), fT = toNum(finalBounds[1]), fR = toNum(finalBounds[2]), fB = toNum(finalBounds[3]);
                    var fCX = (fL + fR) / 2;
                    var fCY = (fT + fB) / 2;
                    var dx = centerX - fCX;
                    var dy = centerY - fCY;

                    // ننقل طبقة النص
                    try { textLayer.translate(dx, dy); } catch (trE) {
                        L("  - translate failed: " + trE);
                    }

                    // قراءة bounds بعد الترجمة (للتوثيق)
                    var afterBounds = textLayer.bounds;
                    L("  => placed. final fontSize=" + curFontSize + "  translate(dx,dy)=(" + dx.toFixed(1) + "," + dy.toFixed(1) + ")");
                    L("     afterBounds: " + [toNum(afterBounds[0]).toFixed(1), toNum(afterBounds[1]).toFixed(1), toNum(afterBounds[2]).toFixed(1), toNum(afterBounds[3]).toFixed(1)].join(", "));
                } catch (finalE) {
                    L("  - final centering failed: " + finalE);
                }

                doc.selection.deselect();
                totalInserted++;
                L("  >>> OK inserted line index " + (lineIndex) + " textPreview: \"" + (lineText.length>80?lineText.substring(0,80)+"...":lineText) + "\"");

            } catch (bubbleErr) {
                // سجل الخطأ وحاول الاستمرار
                var errMsg = entryPrefix + " : EXCEPTION : " + bubbleErr.toString();
                E(errMsg);
                totalErrors++;
                try { doc.selection.deselect(); } catch (e2) {}
            }
        } // end for pagePaths
    } // end for documents

    // خاتمة اللوج وإحصاء
    L("\n===== Summary =====");
    L("Inserted: " + totalInserted);
    L("Errors: " + totalErrors);
    L("Skipped (if any): " + totalSkipped);

    // كتابة ملف اللوج المفصل (في نفس فولدر ملف الـ TXT)
    try {
        var logFile = new File(txtFile.path + "/photoshop_text_log_verbose.txt");
        logFile.open("w");
        for (var i = 0; i < log.length; i++) logFile.writeln(log[i]);
        logFile.close();
        L("Wrote verbose log: " + logFile.fsName);
    } catch (e) {
        alert("فشل في كتابة ملف اللوج: " + e);
    }

// كتابة ملف الاخطاء فقط (لو في)
try {
    if (errors.length > 0) {
        var errFile = new File(txtFile.path + "/photoshop_text_errors.txt");
        errFile.open("w");
        for (var j = 0; j < errors.length; j++) errFile.writeln(errors[j]);
        errFile.close();
        L("Wrote errors log: " + errFile.fsName);
    }
} catch (e2) {
    alert("فشل في كتابة ملف الأخطاء: " + e2);
}

alert("انتهى التشغيل.\nInserted: " + totalInserted + "  Errors: " + totalErrors + "\nتوجد لوجات في نفس فولدر ملف الـTXT.");

})();

