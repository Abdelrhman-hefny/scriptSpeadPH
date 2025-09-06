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

    var defaultFont = 'CCWildWords'; // fallback الأساسي
    var fontSize = 35;

    // تحميل النصوص
    var pages = {}, currentPage = null;
    txtFile.open("r");
    while (!txtFile.eof) {
        var line = txtFile.readln() || "";
        line = line.replace(/^\s+|\s+$/g, "");
        if (/^\s*page\s+\d+/i.test(line)) {
            var num = line.match(/\d+/)[0];
            if (num.length === 1) num = "0" + num;
            currentPage = "page_" + num;
            pages[currentPage] = [];
        } else if (line !== "" && currentPage) {
            pages[currentPage].push(line);
        }
    }
    txtFile.close();

    var doc = app.activeDocument;
    var paths = doc.pathItems;
    if (paths.length === 0) {
        alert("مفيش Paths في الملف!");
        return;
    }

    var totalInserted = 0;
    var logEntries = [];

    // دالة تجيب أول خط متاح من الخطوط
    function getAvailableFont(preferred, fallback) {
        try {
            if (app.fonts.getByName(preferred)) return preferred;
        } catch (e) {}
        try {
            if (app.fonts.getByName(fallback)) return fallback;
        } catch (e) {}
        // آخر اختيار: أي خط متاح
        return app.fonts.length > 0 ? app.fonts[0].postScriptName : "ArialMT";
    }

    for (var pName in pages) {
        if (!pages.hasOwnProperty(pName)) continue;
        var pageTexts = pages[pName];

        var pagePaths = [];
        for (var j = 0; j < paths.length; j++) {
            try {
                if (paths[j].name.toLowerCase().indexOf(pName) === 0) pagePaths.push(paths[j]);
            } catch (e) {}
        }

        pagePaths.sort(function (a, b) {
            function getNum(item) {
                var m = item.name.match(/bubble(\d+)$/i);
                return m ? parseInt(m[1], 10) : 999999;
            }
            return getNum(a) - getNum(b);
        });

        if (pagePaths.length === 0) continue;

        var count = Math.min(pagePaths.length, pageTexts.length);
        for (var k = 0; k < count; k++) {
            var status = "OK";
            var usedFont = defaultFont;
            var wantedFont = defaultFont;
            var lineText = pageTexts[k];

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

                try { textLayer.textItem.font = usedFont; } catch (e) {
                    status = "FontError";
                }

                try {
                    textLayer.textItem.width = w;
                    textLayer.textItem.height = h;
                    textLayer.textItem.position = [x1, y1 + h / 2 - fontSize / 2];
                } catch (e) {
                    status = "PositionError";
                }

                doc.selection.deselect();
                totalInserted++;
            } catch (err) {
                status = "Fail: " + err;
            }

            // سجل تفصيلي
            logEntries.push(
                "Page=" + pName +
                " | Bubble=" + (k + 1) +
                " | WantedFont=" + wantedFont +
                " | UsedFont=" + usedFont +
                " | Text=\"" + lineText + "\"" +
                " | Status=" + status
            );
        }
    }

    // كتابة ملف اللوج
    try {
        var logFile = new File(doc.path + "/photoshop_text_log.txt");
        logFile.open("w");
        for (var i = 0; i < logEntries.length; i++) {
            logFile.writeln(logEntries[i]);
        }
        logFile.close();
    } catch (e) {
        alert("مشكلة في إنشاء ملف اللوج: " + e);
    }

    alert("تم إدخال النصوص في " + totalInserted + " فقاعات ✅\n" +
          "تم إنشاء ملف لوج تفصيلي باسم photoshop_text_log.txt");
})();
