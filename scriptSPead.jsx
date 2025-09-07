//#target photoshop

app.bringToFront();
$.evalFile("C:/Users/abdoh/Downloads/testScript/json2.js");

(function() {
    // التحقق من وجود Photoshop
    if (typeof app === "undefined" || !app) {
        alert("هذا السكريبت يجب تشغيله في Photoshop فقط!");
        return;
    }

    // مسار ملف النص الثابت
    var txtFile = File("C:/Users/abdoh/Downloads/testScript/manga_text.txt");

    // لو الملف غير موجود أنشئه
    if (!txtFile.exists) {
        try {
            txtFile.open("w");
            txtFile.writeln("// الصق النص هنا، استخدم 'page 1' لتحديد بداية الصفحة الأولى");
            txtFile.close();
        } catch (e) {
            alert("فشل في إنشاء ملف النص: " + e);
            return;
        }
    }
    // إغلاق نافذة التقدم في النهاية
    closeProgress();

    // فتح الملف تلقائياً بدون رسائل
    try {
        txtFile.execute(); // يفتح الملف بالبرنامج الافتراضي
    } catch (e) {
        // فشل في فتح الملف - نكمل بدون إيقاف
    }

    // مسار ملف JSON
    var jsonFile = File("C:/Users/abdoh/Downloads/testScript/teams.json");
    if (!jsonFile.exists) {
        alert("ملف الفرق غير موجود: " + jsonFile.fsName);
        return;
    }

    try {
        jsonFile.open("r");
        var jsonStr = jsonFile.read();
        jsonFile.close();
    } catch (e) {
        alert("فشل في قراءة ملف JSON: " + e);
        return;
    }

    if (!jsonStr) {
        alert("ملف JSON فارغ!");
        return;
    }

    var teams;
    try {
        teams = JSON.parse(jsonStr);
    } catch (e) {
        alert("خطأ في قراءة JSON: " + e);
        return;
    }

// دالة بديلة لـ Array.isArray في ExtendScript
function isArray(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
}

if (!teams || typeof teams !== "object" || isArray(teams)) {
    alert("الـ JSON غير صالح ككائن: تحقق من teams.json");
    return;
}

    // دالة بديلة لـ Object.keys في ExtendScript
    function getObjectKeys(obj) {
        var keys = [];
        for (var key in obj) {
            if (obj.hasOwnProperty && obj.hasOwnProperty(key)) {
                keys.push(key);
            } else if (obj[key] !== undefined) {
                keys.push(key);
            }
        }
        return keys;
    }

    // اختيار الفريق الحالي
    var teamNames = getObjectKeys(teams); // أسماء الفرق من JSON
    var choiceStr = "اختر الفريق:\n";
    for (var i = 0; i < teamNames.length; i++) {
        // اسماء الفرق جنب بعض
        choiceStr += (i+1) + ". " + teamNames[i] ;
    }

    var sel = prompt(choiceStr, "1"); // يطلب الرقم من المستخدم
    var idx = parseInt(sel, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= teamNames.length) {
        alert("اختيار غير صالح!");
        return;
    }

    var currentTeam = teamNames[idx]; // الفريق المختار
    if (!teams[currentTeam]) {
        alert("الفريق المحدد غير موجود في JSON: " + currentTeam);
        return;
    }

    var defaultFont = teams[currentTeam].defaultFont;
    var baseFontSize = teams[currentTeam].baseFontSize;
    var minFontSize = teams[currentTeam].minFontSize;
    var boxPaddingRatio = teams[currentTeam].boxPaddingRatio;
    var fontMap = teams[currentTeam].fontMap;
    
    // تفعيل وضع السرعة افتراضياً، بدون برومبت
    var fastMode = true;
    // إلغاء الوضع فائق السرعة افتراضياً لإبقاء نافذة التقدم مرئية
    var ultraFastMode = false;
    
    // قراءة آخر قيمة محفوظة لاستخدامها كقيمة افتراضية
    var settingsFile = new File(txtFile.path + "/ps_text_settings.json");
    var lastBase = null;
    try {
        if (settingsFile.exists) {
            settingsFile.open('r');
            var sraw = settingsFile.read();
            settingsFile.close();
            var sobj = null;
            try { sobj = JSON.parse(sraw); } catch (_je) { sobj = null; }
            if (sobj && sobj.lastBaseFontSize) lastBase = parseInt(sobj.lastBaseFontSize, 10);
        }
    } catch (_re) {}

    // برومبت حجم الخط: نستخدم آخر قيمة محفوظة كافتراضي
    var fsDefault = (lastBase && !isNaN(lastBase) && lastBase > 0) ? lastBase : (baseFontSize || 30);
    try {
        var fsPrompt = prompt("أدخل حجم الخط الأساسي (pt):", String(fsDefault));
        if (fsPrompt !== null && fsPrompt !== undefined) {
            var fsVal = parseInt(fsPrompt, 10);
            if (!isNaN(fsVal) && fsVal > 0) baseFontSize = fsVal; else baseFontSize = fsDefault;
        } else {
            baseFontSize = fsDefault;
        }
    } catch (_pf) {
        baseFontSize = fsDefault;
    }
    if (minFontSize && minFontSize > baseFontSize) minFontSize = Math.max(8, Math.floor(baseFontSize * 0.7));

    // حفظ آخر قيمة للاستخدام القادم
    try {
        var toSave = { lastBaseFontSize: baseFontSize };
        settingsFile.open('w');
        settingsFile.write(JSON.stringify(toSave));
        settingsFile.close();
    } catch (_we) {}

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
        // جرّب المطلوب ثم fallback من JSON
        var p = tryGetFont(preferred);
        if (p) return p;
        var f = tryGetFont(fallback);
        if (f) return f;

        // قائمة بدائل شائعة على ويندوز (PostScriptName أو العائلة)
        var commonFallbacks = [
            "Tahoma",
            "Arial",
            "SegoeUI",
            "SegoeUI-Regular",
            "Segoe UI",
            "Verdana",
            "Georgia",
            "TimesNewRomanPSMT",
            "Times New Roman",
            "Impact",
            "ComicSansMS",
            "Comic Sans MS"
        ];

        for (var i = 0; i < commonFallbacks.length; i++) {
            var cf = tryGetFont(commonFallbacks[i]);
            if (cf) return cf;
        }

        // آخر حل: أول خط متاح في فوتوشوب
        try {
            if (app.fonts.length > 0) return app.fonts[0].postScriptName;
        } catch (e) {}
        return "Arial"; // خط آمن كبديل نهائي
    }
    
    // دالة لتحسين إعدادات الخط بناءً على نوعه
    function optimizeFontSettings(textLayer, fontName, fontSize) {
        try {
            // تحسينات خاصة لأنواع الخطوط المختلفة
            var fontLower = fontName.toLowerCase();
            
            if (fontLower.indexOf("comic") !== -1 || fontLower.indexOf("manga") !== -1) {
                // خطوط الكوميكس تحتاج مسافات أكثر
                textLayer.textItem.tracking = 10;
                textLayer.textItem.leading = fontSize * 1.15;
            } else if (fontLower.indexOf("arial") !== -1 || fontLower.indexOf("helvetica") !== -1) {
                // الخطوط العادية
                textLayer.textItem.tracking = 0;
                textLayer.textItem.leading = fontSize * 1.1;
            } else if (fontLower.indexOf("times") !== -1 || fontLower.indexOf("serif") !== -1) {
                // الخطوط المزخرفة
                textLayer.textItem.tracking = -5;
                textLayer.textItem.leading = fontSize * 1.05;
            }
            
            // تحسين عام للوضوح
            textLayer.textItem.antiAliasMethod = AntiAlias.SMOOTH;
            textLayer.textItem.autoKerning = AutoKernType.METRICS;
            
        } catch (e) {
            // تجاهل الأخطاء في تحسين الخط
        }
    }
    
    function toNum(unitVal) {
        try { return parseFloat(String(unitVal)); } catch (e) { return NaN; }
    }
    
    // دالة بديلة لـ trim في ExtendScript
    function trimString(str) {
        return str.replace(/^\s+|\s+$/g, "");
    }
    
    // ========= قراءة النصوص + بداية كل صفحة ==========
    var pageStartIndices = [];
    var currentPage = -1;
    var allLines = [];

    try {
        txtFile.open("r");
        while (!txtFile.eof) {
            var line = txtFile.readln() || "";
            line = trimString(line); // إزالة المسافات من بداية ونهاية السطر

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
    } catch (e) {
        alert("فشل في قراءة ملف النص: " + e);
        return;
    }

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

    // ====== Progress UI (ScriptUI) ======
    var progressWin = null, progressBar = null, progressText = null;
    var progressTotal = 0, progressValue = 0;
    var cancelRequested = false;
    function createProgress(total) {
        try {
            progressTotal = Math.max(1, total|0);
            progressValue = 0;
            progressWin = new Window('palette', 'Progress');
            progressWin.orientation = 'column';
            progressText = progressWin.add('statictext', undefined, 'Starting...');
            progressText.preferredSize = [320, 18];
            if (!ultraFastMode) {
                progressBar = progressWin.add('progressbar', undefined, 0, progressTotal);
                progressBar.preferredSize = [320, 14];
                var row = progressWin.add('group');
                row.orientation = 'row';
                var cancelBtn = row.add('button', undefined, 'Cancel');
                cancelBtn.onClick = function () { cancelRequested = true; };
            }
            progressWin.show();
            app.refresh();
        } catch (e) {}
    }
    function updateProgress(increment, message) {
        try {
            progressValue += (increment|0);
            // حدّث النص دائماً؛ في UltraFast لا يوجد شريط تقدّم
            if (progressText && typeof message === 'string') progressText.text = message + '  (' + progressValue + '/' + progressTotal + ')';
            if (!ultraFastMode && progressBar) progressBar.value = Math.min(progressTotal, Math.max(0, progressValue));
            if (progressWin) progressWin.update();
            if (ultraFastMode && (progressValue % 10 === 0)) $.writeln(message + '  (' + progressValue + '/' + progressTotal + ')');
        } catch (e) {}
    }
    function closeProgress() {
        try { if (progressWin) progressWin.close(); } catch (e) {}
    }

    // حساب إجمالي الفقاعات قبل البدء لعرض تقدم دقيق
    try {
        var totalBubbles = 0;
        for (var dd = 0; dd < app.documents.length; dd++) {
            try { var pcount = app.documents[dd].pathItems.length; totalBubbles += (pcount|0); } catch (_e) {}
        }
        createProgress(totalBubbles);
    } catch (_pe) {}

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

        if (!ultraFastMode) L("\n--- Processing document: " + doc.name + " ---");

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

            if (cancelRequested) { L('Cancelled by user'); break; }
            var pathItem = pagePaths[k];
            var pathName = "(unknown)";
            try { pathName = pathItem.name; } catch (e) {}

            var entryPrefix = "File=" + doc.name + " | BubbleIndex=" + (k+1) + " | PathName=" + pathName;
            if (!ultraFastMode) L("\n" + entryPrefix);

            var lineText = allLines[lineIndex++];
            
            // إزالة المسافات الزائدة من بداية ونهاية النص
            lineText = trimString(lineText);

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
                    lineText = trimString(lineText.replace(regex, ""));
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

                // حساب مساحة متاحة مع هامش صغير ثابت وواضح
                var textLength = lineText.length;
                // هامش صغير جداً لملء الفقاعة قدر الإمكان
                var padding = Math.max(2, Math.min(8, Math.min(boxWidth, boxHeight) * 0.03));
                var availableWidth = Math.max(10, boxWidth - (padding * 2));
                var availableHeight = Math.max(10, boxHeight - (padding * 2));

                // مربع داخلي ليعطي شكل دائري متناسق
                var innerSide = Math.min(availableWidth, availableHeight);

                // بحث ثنائي داخل صندوق فقرة مربع مع حد أقصى يساوي قيمة البرومبت
                var low = Math.max(minFontSize, 6);
                var high = Math.max(low, baseFontSize); // أقصى حد هو قيمة المستخدم
                var best = low;
                var tries = 0;
                var testLayer = doc.artLayers.add();
                testLayer.kind = LayerKind.TEXT;
                testLayer.textItem.kind = TextType.PARAGRAPHTEXT;
                testLayer.textItem.contents = lineText;
                testLayer.textItem.justification = Justification.CENTER;
                try { testLayer.textItem.font = usedFont; } catch (_e) { testLayer.textItem.font = "Arial"; }
                testLayer.textItem.width = innerSide;
                testLayer.textItem.height = innerSide;
                testLayer.textItem.position = [centerX - (innerSide/2), centerY - (innerSide/2)];

                // ضبط أولي للمسافات لتعزيز المظهر الدائري
                if (lineText.length > 24) testLayer.textItem.tracking = -10;
                else if (lineText.length <= 8) testLayer.textItem.tracking = 10;

                while (low <= high && tries < 20) {
                    var mid = Math.floor((low + high) / 2);
                    testLayer.textItem.size = mid;
                    // قياس دقيق
                    var bb = testLayer.bounds;
                    var bw = Math.max(1, toNum(bb[2]) - toNum(bb[0]));
                    var bh = Math.max(1, toNum(bb[3]) - toNum(bb[1]));
                    if (bw <= innerSide && bh <= innerSide) {
                        best = mid; // صالح
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                    tries++;
                }
                var newFontSize = Math.min(best, baseFontSize);
                try { testLayer.remove(); } catch (_rm) {}

                // إنشاء الطبقة النهائية كنص فقرة داخل المساحة المتاحة مع هامش
                var textLayer = doc.artLayers.add();
                textLayer.kind = LayerKind.TEXT;
                if (!textLayer.textItem) {
                    throw new Error("Failed to create text item for path: " + pathName);
                }
                textLayer.textItem.kind = TextType.PARAGRAPHTEXT;
                textLayer.textItem.contents = lineText;
                textLayer.textItem.justification = Justification.CENTER;
                optimizeFontSettings(textLayer, usedFont, newFontSize);
                try { textLayer.textItem.font = usedFont; } catch (fe) { E("Font not found: " + usedFont + ", using Arial"); textLayer.textItem.font = "Arial"; }
                textLayer.textItem.size = newFontSize;

                var startLeft = centerX - (availableWidth / 2);
                var startTop = centerY - (availableHeight / 2);
                // حرّك الصندوق للداخل ليترك هامش داخل حدود الفقاعة
                startLeft = startLeft + 0; // المركزية بالفعل تحقق الهامش عبر availableWidth/Height
                startTop = startTop + 0;
                textLayer.textItem.width = availableWidth;
                textLayer.textItem.height = availableHeight;
                textLayer.textItem.position = [startLeft, startTop];

                // قياس وتحريك دقيق لتوسيط الطبقة داخل مركز الفقاعة
                var tb = textLayer.bounds;
                var tl = toNum(tb[0]), tt = toNum(tb[1]), tr = toNum(tb[2]), tbm = toNum(tb[3]);
                var cX = (tl + tr) / 2;
                var cY = (tt + tbm) / 2;
                var dxx = centerX - cX;
                var dyy = centerY - cY;
                if (Math.abs(dxx) > 0.1 || Math.abs(dyy) > 0.1) textLayer.translate(dxx, dyy);

                // ========= إضافة التحسينات البصرية للخط =========
                if (!fastMode) {
                    try {
                        // حدود خفيفة + لون
                        var stroke = textLayer.effects.add();
                        stroke.kind = "stroke";
                        stroke.enabled = true;
                        stroke.mode = "normal";
                        stroke.opacity = 75;
                        stroke.size = Math.max(1, Math.floor(newFontSize * 0.02));
                        stroke.position = "outside";
                        stroke.color = new SolidColor();
                        stroke.color.rgb.red = 255;
                        stroke.color.rgb.green = 255;
                        stroke.color.rgb.blue = 255;
                        var textColor = new SolidColor();
                        textColor.rgb.red = 0;
                        textColor.rgb.green = 0;
                        textColor.rgb.blue = 0;
                        textLayer.textItem.color = textColor;
                        if (textLength > 15) textLayer.textItem.tracking = -20;
                        else if (textLength <= 5) textLayer.textItem.tracking = 20;
                        textLayer.textItem.leading = Math.round(newFontSize * 1.05);
                    } catch (effectError) { if (!ultraFastMode) L("  Warning: Could not apply visual effects: " + effectError); }
                }

                doc.selection.deselect();
                totalInserted++;
                L("  >>> OK inserted line index " + (lineIndex - 1) + " fontSize: " + textLayer.textItem.size + " textPreview: \"" + (lineText.length > 80 ? lineText.substring(0, 80) + "..." : lineText) + "\"");

                lastUsedFont = usedFont;
                lastFontSize = newFontSize;

            } catch (bubbleErr) {
                var errMsg = entryPrefix + " : EXCEPTION : " + bubbleErr.toString() + (bubbleErr.line ? " at line " + bubbleErr.line : "");
                E(errMsg);
                totalErrors++;
                try { doc.selection.deselect(); } catch (e2) {}
            }

            // تحديث التقدم بعد كل فقاعة
            updateProgress(1, 'Processing ' + doc.name + ' - ' + (k+1) + '/' + pagePaths.length);
            if (ultraFastMode && progressValue % 20 === 0) app.refresh();
        }

        // ====== Summary ======
        L("\n===== Summary =====");
        L("Inserted: " + totalInserted);
        L("Errors: " + totalErrors);
        L("Skipped: " + totalSkipped);

        try {
            var logFile = new File(txtFile.path + "/photoshop_text_log_verbose.txt");
            logFile.open("w");
            for (var i = 0; i < log.length; i++) {
                try {
                    logFile.writeln(log[i]);
                } catch (e) {
                    // تجاهل الأخطاء في كتابة سطر واحد
                }
            }
            logFile.close();
        } catch (e) {
            alert("فشل في كتابة ملف اللوج: " + e);
        }

        try {
            if (errors.length > 0) {
                var errFile = new File(txtFile.path + "/photoshop_text_errors.txt");
                errFile.open("w");
                for (var j = 0; j < errors.length; j++) {
                    try {
                        errFile.writeln(errors[j]);
                    } catch (e) {
                        // تجاهل الأخطاء في كتابة سطر واحد
                    }
                }
                errFile.close();
            }
        } catch (e2) {
            alert("فشل في كتابة ملف الأخطاء: " + e2);
        }

        // عرض النتائج مع معلومات إضافية عن التحسينات
        if (totalErrors > 0) {
            alert("انتهى التشغيل مع أخطاء.\nInserted: " + totalInserted + "  Errors: " + totalErrors + "\nتوجد لوجات في نفس فولدر ملف الـTXT.");
        } else if (totalInserted === 0) {
            alert("لم يتم إدراج أي نص.\nتأكد من وجود paths في المستند.");
        } else {
            // رسالة نجاح مع معلومات عن التحسينات المطبقة
            alert("تم إدراج النصوص بنجاح! ✨\n\n" +
                  "التحسينات المطبقة:\n" +
                  "• تكيف ذكي لحجم الخط مع الفقاعة\n" +
                  "• حدود للوضوح\n" +
                  "• تحسين المسافات والموضع\n" +
                  "• تحسينات بصرية للخط\n\n" +
                  "عدد النصوص المدرجة: " + totalInserted);
        }
    }
})();