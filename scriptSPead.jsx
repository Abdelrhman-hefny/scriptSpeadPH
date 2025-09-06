#target photoshop
app.bringToFront();

(function () {
    var txtFile = File.openDialog("اختر ملف النص (TXT)", "Text Files: *.txt");
    if (!txtFile) return;

    var fontMap = {
        '“”': 'CCWildWords',
        '()': 'CCWildWords faux italics',
        '#': 'Dom Casual',
        '[]': 'CCTallTales',
        'ST:': 'Kid Knowledges 1',
        'OT:': 'Kid Knowledges 1',
        '<>': 'CC Ultimatum',
        '**': 'Abel',
        'NA:': 'Dom Casual',
        'SFX:': 'Blambastic Alt BB',
        'BGT:': 'CCTallTales',
        'TL/N:': 'CCMarianChurchland',
        'TL/PR:': 'CCMarianChurchland'
    };

    var defaultFont = 'CCWildWords'; 
    var fontSize = 33;

    // قراءة كل النصوص في مصفوفة واحدة
    var allLines = [];
    txtFile.open("r");
    while (!txtFile.eof) {
        var line = txtFile.readln() || "";
        line = line.replace(/^\s+|\s+$/g, "");
        if (/^\s*page\s+\d+/i.test(line)) {
            continue; // تخطي عناوين الصفحات
        } else if (line !== "") {
            allLines.push(line);
        }
    }
    txtFile.close();

    if (allLines.length === 0) {
        alert("ملف النص فاضي أو مفيهوش سطور صالحة!");
        return;
    }

    var totalInserted = 0;
    var logEntries = [];
    var lineIndex = 0; // مؤشر عالمي للسطور

    function getAvailableFont(preferred, fallback) {
        try { if (app.fonts.getByName(preferred)) return preferred; } catch (e) {}
        try { if (app.fonts.getByName(fallback)) return fallback; } catch (e) {}
        return app.fonts.length > 0 ? app.fonts[0].postScriptName : "ArialMT";
    }

    // نلف على كل الملفات المفتوحة بالترتيب
    for (var d = 0; d < app.documents.length; d++) {
        var doc = app.documents[d];
        app.activeDocument = doc;

        var paths = doc.pathItems;
        if (paths.length === 0) {
            logEntries.push("ملف " + doc.name + " مفيهوش Paths");
            continue;
        }

        // ترتيب الباثات حسب الترقيم bubble#
        var pagePaths = [];
        for (var j = 0; j < paths.length; j++) pagePaths.push(paths[j]);
        pagePaths.sort(function (a, b) {
            function getNum(item) {
                var m = item.name.match(/bubble(\d+)$/i);
                return m ? parseInt(m[1], 10) : 999999;
            }
            return getNum(a) - getNum(b);
        });

        for (var k = 0; k < pagePaths.length; k++) {
            if (lineIndex >= allLines.length) break; // خلصنا النصوص

            var status = "OK";
            var usedFont = defaultFont;
            var wantedFont = defaultFont;
            var lineText = allLines[lineIndex];
            lineIndex++;

            try {
                var path = pagePaths[k];
                path.makeSelection();
                var bounds = doc.selection.bounds;
                var x1 = bounds[0], y1 = bounds[1], x2 = bounds[2], y2 = bounds[3], w = x2 - x1, h = y2 - y1;

                // اختيار الخط
                for (var key in fontMap) {
                    if (lineText.indexOf(key) === 0) {
                        wantedFont = fontMap[key];
                        lineText = lineText.substring(key.length).replace(/^\s+/, "");
                        break;
                    }
                }

                usedFont = getAvailableFont(wantedFont, defaultFont);

// إنشاء طبقة النص
var textLayer = doc.artLayers.add();
textLayer.kind = LayerKind.TEXT;
try { textLayer.textItem.kind = TextType.PARAGRAPHTEXT; } catch (e) {}
textLayer.textItem.contents = lineText;
textLayer.textItem.size = fontSize;
textLayer.textItem.justification = Justification.CENTER;
try { textLayer.textItem.font = usedFont; } catch (e) { status = "FontError"; }

try {
    // نخلي الصندوق قريب من حجم الفقاعة
    var boxWidth  = w * 0.8;
    var boxHeight = h * 0.8;

    textLayer.textItem.width  = boxWidth;
    textLayer.textItem.height = boxHeight;
    textLayer.textItem.position = [x1, y1]; // مؤقت

    // ----------------------------
    // هنا بيجي شغل الـ Align
    // ----------------------------
    var textBounds = textLayer.bounds;
    var textW = textBounds[2] - textBounds[0];
    var textH = textBounds[3] - textBounds[1];

    var moveX = (w - textW) / 2 - (textBounds[0] - x1);
    var moveY = (h - textH) / 2 - (textBounds[1] - y1);

    textLayer.translate(moveX, moveY);

} catch (e) {
    status = "PositionError";
}

doc.selection.deselect();
totalInserted++;


            } catch (err) {
                status = "Fail: " + err;
            }

            logEntries.push(
                "File=" + doc.name +
                " | Bubble=" + (k + 1) +
                " | WantedFont=" + wantedFont +
                " | UsedFont=" + usedFont +
                " | Text=\"" + lineText + "\"" +
                " | Status=" + status
            );
        }
    }

    // كتابة ملف لوج شامل
    try {
        var logFile = new File(Folder.desktop + "/photoshop_text_log.txt");
        logFile.open("w");
        for (var i = 0; i < logEntries.length; i++) logFile.writeln(logEntries[i]);
        logFile.close();
    } catch (e) {
        alert("مشكلة في إنشاء ملف اللوج: " + e);
    }

    alert("تم إدخال النصوص في " + totalInserted + " فقاعات ✅\n" +
          "تم إنشاء ملف لوج شامل على سطح المكتب باسم photoshop_text_log.txt");
})();
