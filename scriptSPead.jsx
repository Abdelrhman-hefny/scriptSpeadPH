#target photoshop
app.bringToFront();
$.evalFile("C:/Users/abdoh/Downloads/testScript/json2.js");

(function() {
    // مسار ملف النص الثابت
    var txtFile = File("C:/Users/abdoh/Downloads/testScript/manga_text.txt");

    // لو الملف غير موجود أنشئه
    if (!txtFile.exists) {
        txtFile.open("w");
        txtFile.writeln("// الصق النص هنا، استخدم 'page 1' لتحديد بداية الصفحة الأولى");
        txtFile.close();
    }

    // فتح الملف
    try {
        txtFile.execute(); // يفتح الملف بالبرنامج الافتراضي (Notepad غالبًا)
        alert("افتح الملف وأضف النص، بعد الحفظ أغلق الملف ثم اضغط OK للاستمرار.");
    } catch (e) {
        alert("فشل في فتح الملف تلقائيًا. أضف النص يدويًا في:\n" + txtFile.fsName);
    }

  // مسار ملف JSON
var jsonFile = File("C:/Users/abdoh/Downloads/testScript/teams.json");

if (!jsonFile.exists) {
    alert("ملف الفرق غير موجود: " + jsonFile.fsName);
    return;
}

jsonFile.open("r");
var jsonStr = jsonFile.read();
jsonFile.close();

var teams;
try {
    teams = JSON.parse(jsonStr);
} catch (e) {
    alert("خطأ في قراءة JSON: " + e);
    return;
}

// اختيار الفريق الحالي
var currentTeam = "rezo"; // أو يمكن جعله ديناميكي
if (!teams[currentTeam]) {
    alert("الفريق المحدد غير موجود في JSON: " + currentTeam);
    return;
}

var defaultFont = teams[currentTeam].defaultFont;
var baseFontSize = teams[currentTeam].baseFontSize;
var minFontSize = teams[currentTeam].minFontSize;
var boxPaddingRatio = teams[currentTeam].boxPaddingRatio;
var fontMap = teams[currentTeam].fontMap;



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
        return "Arial"; // خط آمن كبديل نهائي
    }
    function toNum(unitVal) {
        try { return parseFloat(String(unitVal)); } catch (e) { return NaN; }
    }
	
    // ========= قراءة النصوص + بداية كل صفحة ==========
    var pageStartIndices = [];
    var currentPage = -1;
    var allLines = [];

    txtFile.open("r");
    while (!txtFile.eof) {
        var line = txtFile.readln() || "";
        line = line.replace(/^\s+|\s+$/g, "");

        var m = line.match(/(?:===\s*)?page\s*(\d+)/i);
        if (m) {
            currentPage++;
            pageStartIndices.push(allLines.length);
            continue; 
        }

        if (/^sfx\b/i.test(line)) continue;

        if (line !== "") allLines.push(line);
    }
    txtFile.close();

    // التحقق بعد قراءة الملف بالكامل
    if (allLines.length === 0) {
        alert("الملف فارغ أو لم يتم إدخال نص!");
        return;
    }

    // ========= لوج ==========
    var log = [];
    var errors = [];
    function L(s) { log.push(s); }
    function E(s) { errors.push(s); log.push("ERROR: " + s); }

    L("Photoshop Text Import - verbose log");
    L("Date: " + (new Date()).toString());
    L("TXT file: " + txtFile.fsName);
    L("Total lines read: " + allLines.length);
    L("Pages detected: " + pageStartIndices.length);
    L("Base font size: " + baseFontSize + "  minFontSize: " + minFontSize);
    L("========================================");

    var totalInserted = 0;
    var totalSkipped = 0;
    var totalErrors = 0;
    var lineIndex = 0;
    var pageCounter = 0;

    // ====== نلف على كل المستندات المفتوحة بالترتيب ======
    for (var d = 0; d < app.documents.length; d++) {
        var doc = app.documents[d];
        try {
            app.activeDocument = doc;
        } catch (e) {
            E("Couldn't activate document index " + d + ": " + e);
            continue;
        }

        L("\n--- Processing document: " + doc.name + " ---");

        // كل مستند يبدأ من بداية صفحة جديدة
        if (pageCounter < pageStartIndices.length) {
            lineIndex = pageStartIndices[pageCounter];
            L(" Reset lineIndex to start of page " + (pageCounter+1) + " (line " + lineIndex + ")");
            pageCounter++;
        }

        var paths = doc.pathItems;
        if (!paths || paths.length === 0) {
            L("Document '" + doc.name + "' has no path items. Skipping.");
            continue;
        }
        // نجمع ونرتب الباثس
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

        // ======= قبل حلقة pagePaths =======
        var lastUsedFont = null;
        var lastFontSize = baseFontSize;

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

            var lineText = allLines[lineIndex++];

            if (!lineText) {
                L("Skipped bubble " + (k+1) + " in " + doc.name + " because no text line is available.");
                totalSkipped++;
                continue;
            }

            // التأكد من أن الباث صالح
            if (!pathItem || !pathItem.subPathItems || pathItem.subPathItems.length === 0) {
                E("Invalid or empty path: " + pathName);
                totalErrors++;
                continue;
            }

            // تحديد الخط
            var wantedFont = null;
            for (var key in fontMap) {
                var regex = new RegExp("^" + key.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"));
                if (regex.test(lineText)) {
                    wantedFont = fontMap[key];
                    lineText = lineText.replace(regex, "").trim();
                    break;
                }
            }

            var usedFont, curFontSize;
            if (/^\/\/:?/.test(lineText)) {
                usedFont = lastUsedFont || defaultFont;
                curFontSize = lastFontSize || baseFontSize;
            } else {
                if (!wantedFont) wantedFont = defaultFont;
                usedFont = pickFont(wantedFont, defaultFont);
                curFontSize = baseFontSize;
            }

            try {
                pathItem.makeSelection();
                if (!doc.selection || !doc.selection.bounds) {
                    throw new Error("No valid selection for path: " + pathName);
                }

                var selBounds = doc.selection.bounds;
                var x1 = toNum(selBounds[0]), y1 = toNum(selBounds[1]), x2 = toNum(selBounds[2]), y2 = toNum(selBounds[3]);
                var w = x2 - x1, h = y2 - y1;

                var boxWidth = Math.max(10, w * (1 - boxPaddingRatio));
                var boxHeight = Math.max(10, h * (1 - boxPaddingRatio));
                var centerX = (x1 + x2) / 2;
                var centerY = (y1 + y2) / 2;

                var textLayer = doc.artLayers.add();
                textLayer.kind = LayerKind.TEXT;
                if (!textLayer.textItem) {
                    throw new Error("Failed to create text item for path: " + pathName);
                }

                textLayer.textItem.kind = TextType.PARAGRAPHTEXT;
                textLayer.textItem.contents = lineText;
                textLayer.textItem.justification = Justification.CENTER;
                try { textLayer.textItem.font = usedFont; } catch (fe) {
                    E("Font not found: " + usedFont + ", using Arial");
                    textLayer.textItem.font = "Arial";
                }
                textLayer.textItem.size = curFontSize;

                var startLeft = centerX - (boxWidth / 2);
                var startTop = centerY - (boxHeight / 2);
                textLayer.textItem.width = boxWidth;
                textLayer.textItem.height = boxHeight;
                textLayer.textItem.position = [startLeft, startTop];

                // قياس النص والتعديل على الحجم
                var tbounds = textLayer.bounds;
                var tLeft = toNum(tbounds[0]), tTop = toNum(tbounds[1]), tRight = toNum(tbounds[2]), tBottom = toNum(tbounds[3]);
                var tW = tRight - tLeft;
                var tH = tBottom - tTop;

                var scaleW = boxWidth / tW;
                var scaleH = boxHeight / tH;
                var fontScale = Math.min(scaleW, scaleH, 1);

                var newFontSize = Math.max(minFontSize, Math.floor(curFontSize * fontScale));
                textLayer.textItem.size = newFontSize;

                tbounds = textLayer.bounds;
                var fL = toNum(tbounds[0]), fT = toNum(tbounds[1]);
                var fR = toNum(tbounds[2]), fB = toNum(tbounds[3]);
                var fCX = (fL + fR) / 2;
                var fCY = (fT + fB) / 2;
                var dx = centerX - fCX;
                var dy = centerY - fCY;
                textLayer.translate(dx, dy);

                doc.selection.deselect();
                totalInserted++;
                L("  >>> OK inserted line index " + (lineIndex) + " textPreview: \"" + (lineText.length > 80 ? lineText.substring(0, 80) + "..." : lineText) + "\"");

                lastUsedFont = usedFont;
                lastFontSize = newFontSize;

            } catch (bubbleErr) {
                var errMsg = entryPrefix + " : EXCEPTION : " + bubbleErr.toString() + " at line " + bubbleErr.line;
                E(errMsg);
                totalErrors++;
                try { doc.selection.deselect(); } catch (e2) {}
            }
        }

        // ====== Summary ======
        L("\n===== Summary =====");
        L("Inserted: " + totalInserted);
        L("Errors: " + totalErrors);
        L("Skipped: " + totalSkipped);

        try {
            var logFile = new File(txtFile.path + "/photoshop_text_log_verbose.txt");
            logFile.open("w");
            for (var i = 0; i < log.length; i++) logFile.writeln(log[i]);
            logFile.close();
        } catch (e) {
            alert("فشل في كتابة ملف اللوج: " + e);
        }

        try {
            if (errors.length > 0) {
                var errFile = new File(txtFile.path + "/photoshop_text_errors.txt");
                errFile.open("w");
                for (var j = 0; j < errors.length; j++) errFile.writeln(errors[j]);
                errFile.close();
            }
        } catch (e2) {
            alert("فشل في كتابة ملف الأخطاء: " + e2);
        }

        alert("انتهى التشغيل.\nInserted: " + totalInserted + "  Errors: " + totalErrors + "\nتوجد لوجات في نفس فولدر ملف الـTXT.");
    }
})();