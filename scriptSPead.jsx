 //#target photoshop

app.bringToFront();
$.evalFile("C:/Users/abdoh/Downloads/testScript/json2.js");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/psHelpers.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/textReader.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/teamLoader.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/splitSubpaths.jsx");

// دالة لفتح Notepad وإنشاء ملف نصي جديد
function openNotepad() {
    try {
        // مسار افتراضي لملف النص
        var txtFilePath = "C:/Users/abdoh/Downloads/testScript/manga_text.txt";
        var txtFile = new File(txtFilePath);

        // إذا لم يكن الملف موجودًا، أنشئه مع تعليمات أولية
        if (!txtFile.exists) {
            txtFile.open("w");
            txtFile.writeln("// الصق النص هنا، استخدم 'page 1' لتحديد بداية الصفحة الأولى");
            txtFile.writeln("// مثال:");
            txtFile.writeln("page 1");
            txtFile.writeln("Hello, world!");
            txtFile.writeln("st:Action text");
            txtFile.writeln("page 2");
            txtFile.writeln("SFX:Boom!");
            txtFile.close();
        }

        // فتح الملف في Notepad
        txtFile.execute();

    } catch (e) {
        alert("خطأ أثناء فتح Notepad: " + e);
    }
}

// دالة لاستخراج رقم الصفحة من اسم المستند
function getPageNumberFromDocName(docName) {
    try {
        var match = docName.match(/^(\d+)\.psd$/i);
        if (match && match[1]) {
            return parseInt(match[1], 10);
        }
        return null;
    } catch (e) {
        return null;
    }
}

// حساب السطوع من RGB
function luminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

// اخد عينة من بكسل معين
function samplePixel(doc, x, y) {
    try {
        while (doc.colorSamplers.length > 0) {
            doc.colorSamplers[0].remove();
        }
        var colorSampler = doc.colorSamplers.add([UnitValue(x, "px"), UnitValue(y, "px")]);
        var c = colorSampler.color.rgb;
        var rgb = [c.red, c.green, c.blue];
        colorSampler.remove();
        return rgb;
    } catch (e) {
        return [128, 128, 128];
    }
}

// تطبيق تأثير Stroke باستخدام Action Manager
function applyWhiteStroke3px(targetLayer) {
    try {
        var prev = app.activeDocument.activeLayer;
        try { app.activeDocument.activeLayer = targetLayer; } catch (_eal) {}

        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
        desc.putReference(charIDToTypeID('null'), ref);

        var fx = new ActionDescriptor();
        var stroke = new ActionDescriptor();
        stroke.putBoolean(stringIDToTypeID('enabled'), true);
        stroke.putBoolean(stringIDToTypeID('present'), true);
        stroke.putEnumerated(charIDToTypeID('BlnM'), charIDToTypeID('BlnM'), charIDToTypeID('Nrml'));
        stroke.putUnitDouble(charIDToTypeID('Opct'), charIDToTypeID('#Prc'), 100);
        stroke.putEnumerated(stringIDToTypeID('style'), stringIDToTypeID('frameStyle'), stringIDToTypeID('outsetFrame'));
        stroke.putUnitDouble(stringIDToTypeID('size'), charIDToTypeID('#Pxl'), 3);
        stroke.putEnumerated(stringIDToTypeID('paintType'), stringIDToTypeID('paintType'), stringIDToTypeID('solidColor'));
        var clr = new ActionDescriptor();
        clr.putDouble(charIDToTypeID('Rd  '), 255);
        clr.putDouble(charIDToTypeID('Grn '), 255);
        clr.putDouble(charIDToTypeID('Bl  '), 255);
        stroke.putObject(charIDToTypeID('Clr '), charIDToTypeID('RGBC'), clr);

        fx.putObject(stringIDToTypeID('frameFX'), stringIDToTypeID('frameFX'), stroke);
        desc.putObject(charIDToTypeID('T   '), stringIDToTypeID('layerEffects'), fx);
        executeAction(charIDToTypeID('setd'), desc, DialogModes.NO);

        try { app.activeDocument.activeLayer = prev; } catch (_ear) {}
    } catch (_se) {}
}

// تحليل علامات النص لتطبيق Stroke
function parseStrokeTag(line) {
    try {
        var m = String(line).match(/^\s*(?:NA:\s*|\*\*:\s*|SFX:\s*|ST:\s*|Ot:\s*|OT:\s*|#\s*)([\s\S]*)$/);
        if (m) { return { needed: true, text: trimString(m[1]) }; }
    } catch (_e) {}
    return { needed: false, text: line };
}

(function() {
    // فتح Notepad في البداية
    openNotepad();

    // التحقق من وجود Photoshop
    if (typeof app === "undefined" || !app) {
        return;
    }

    // مسار ملف النص الثابت
    var txtFile = File("C:/Users/abdoh/Downloads/testScript/manga_text.txt");

    // لو الملف غير موجود أنشئه (سيتم التعامل معه بواسطة openNotepad أعلاه)
    if (!txtFile.exists) {
        try {
            txtFile.open("w");
            txtFile.close();
        } catch (e) {
            return;
        }
    }

    // مسار ملف JSON
    var jsonFile = File("C:/Users/abdoh/Downloads/testScript/teams.json");
    var teams;
    try {
        teams = loadTeams(jsonFile);
    } catch (e) {
        return;
    }

    // اختيار الفريق عبر Dropdown
    var teamNames = getTeamNames(teams);
    var settingsPath = Folder.myDocuments + "/waterMark/lastChoice.txt";
    var settingsFile = new File(settingsPath);
    var lastIdx = 0;
    try {
        if (settingsFile.exists) {
            if (settingsFile.open('r')) {
                var raw = settingsFile.read();
                settingsFile.close();
                var lines = String(raw || "").split(/\r?\n/);
                if (lines.length > 0) {
                    var t = parseInt(lines[0], 10);
                    if (!isNaN(t) && t >= 0 && t < teamNames.length) lastIdx = t;
                }
            }
        }
    } catch (_re) {}

    var dlg = new Window('dialog', 'اختر الفريق');
    dlg.orientation = 'column';
    dlg.alignChildren = ['fill', 'top'];
    dlg.add('statictext', undefined, 'اختر الفريق:');
    var dd = dlg.add('dropdownlist', undefined, []);
    for (var di = 0; di < teamNames.length; di++) {
        dd.add('item', (di + 1) + ' - ' + teamNames[di]);
    }
    try { dd.selection = dd.items[lastIdx]; } catch (_se) { if (dd.items.length > 0) dd.selection = dd.items[0]; }
    var btns = dlg.add('group');
    btns.alignment = 'right';
    var okBtn = btns.add('button', undefined, 'موافق');
    var cancelBtn = btns.add('button', undefined, 'إلغاء');
    var chosenIdx = null;
    okBtn.onClick = function() { if (dd.selection) chosenIdx = dd.selection.index; dlg.close(); };
    cancelBtn.onClick = function() { dlg.close(); };
    dlg.show();
    if (chosenIdx === null) {
        return;
    }

    // حفظ الاختيار
    try {
        settingsFile.open('w');
        settingsFile.writeln(chosenIdx);
        settingsFile.close();
    } catch (_we) {}

    var currentTeam = teamNames[chosenIdx];
    if (!teams[currentTeam]) {
        return;
    }

    var defaultFont = teams[currentTeam].defaultFont;
    var baseFontSize = teams[currentTeam].baseFontSize;
    var minFontSize = teams[currentTeam].minFontSize;
    var boxPaddingRatio = teams[currentTeam].boxPaddingRatio;
    var fontMap = teams[currentTeam].fontMap;
    var verticalCenterCompensationRatio = 0.12; // تعويض رأسي بنسبة 12%

    // تفعيل وضع السرعة افتراضياً
    var fastMode = true;
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

    // برومبت حجم الخط
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

    // ========= قراءة النصوص + بداية كل صفحة ==========
    var allLines = [], pageStartIndices = [];
    try {
        var textData = readMangaText(txtFile);
        allLines = textData.lines;
        pageStartIndices = textData.pageStarts;
    } catch (e) {
        return;
    }

    if (allLines.length === 0) {
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

    // جمع وترتيب المستندات بناءً على رقم الصفحة
    var documentsArray = [];
    for (var d = 0; d < app.documents.length; d++) {
        documentsArray.push(app.documents[d]);
    }
    documentsArray.sort(function(a, b) {
        var pageA = getPageNumberFromDocName(a.name) || 999999;
        var pageB = getPageNumberFromDocName(b.name) || 999999;
        return pageA - pageB;
    });

    var totalInserted = 0;
    var totalSkipped = 0;
    var totalErrors = 0;
    var lineIndex = 0;
    var pageCounter = 0;

    // ====== نلف على المستندات المرتبة ======
    for (var d = 0; d < documentsArray.length; d++) {
        var doc = documentsArray[d];
        var prevUnits = app.preferences.rulerUnits;
        try { app.preferences.rulerUnits = Units.PIXELS; } catch (_ue) {}
        try {
            app.activeDocument = doc;
        } catch (e) {
            E("Couldn't activate document index " + d + ": " + e);
            continue;
        }

        // تقسيم Work Path إذا وجد
        try {
            splitWorkPathIntoNamedPaths(doc, "bubble_");
        } catch (e) {
            L("Warning: Could not split Work Path: " + e);
        }

        if (!ultraFastMode) L("\n--- Processing document: " + doc.name + " ---");

        var pageNumber = getPageNumberFromDocName(doc.name);
        if (pageNumber !== null && pageNumber > 0 && pageNumber <= pageStartIndices.length) {
            lineIndex = pageStartIndices[pageNumber - 1];
            L(" Reset lineIndex to start of page " + pageNumber + " (line " + lineIndex + ")");
        } else {
            lineIndex = (pageCounter < pageStartIndices.length) ? pageStartIndices[pageCounter] : 0;
            L(" No valid page number in doc name, using pageCounter " + (pageCounter + 1) + " (line " + lineIndex + ")");
        }
        pageCounter++;

        var paths = doc.pathItems;
        if (!paths || paths.length === 0) {
            L("Document '" + doc.name + "' has no path items. Skipping.");
            continue;
        }

        var pagePaths = [];
        for (var p = 0; p < paths.length; p++) {
            try {
                var pi = paths[p];
                var isWork = false;
                try { isWork = (pi.name === "Work Path" || pi.kind === PathKind.WORKPATH); } catch(_kw) {}
                if (isWork) continue;
                var valid = false;
                try {
                    if (pi.subPathItems && pi.subPathItems.length > 0) {
                        for (var si = 0; si < pi.subPathItems.length; si++) {
                            var sp = null;
                            try { sp = pi.subPathItems[si]; } catch(_spe) { sp = null; }
                            if (sp && sp.pathPoints && sp.pathPoints.length > 1) { valid = true; break; }
                        }
                    }
                } catch(_v) {}
                if (valid) pagePaths.push(pi);
            } catch (e) {}
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

        var lastUsedFont = null;
        var lastFontSize = baseFontSize;
        var lastWasBracketTag = false;

        for (var k = 0; k < pagePaths.length; k++) {
            if (lineIndex >= allLines.length) {
                L("No more lines to place (finished allLines).");
                break;
            }

            var pathItem = pagePaths[k];
            var pathName = "(unknown)";
            try { pathName = pathItem.name; } catch (e) {}

            var entryPrefix = "File=" + doc.name + " | BubbleIndex=" + (k+1) + " | PathName=" + pathName;
            if (!ultraFastMode) L("\n" + entryPrefix);

            var lineText = allLines[lineIndex++];
            var strokeInfo = parseStrokeTag(lineText);
            lineText = strokeInfo.text;
            // توريث خط الفقاعة السابقة لأسطر // أو //:
            var inheritPrevFont = false;
            try {
                if (/^\/\/:?/.test(lineText)) {
                    inheritPrevFont = true;
                    lineText = trimString(String(lineText).replace(/^\/\/:?\s*/, ""));
                }
            } catch (_ih) {}
            // خصائص خاصة لسطور تبدأ بـ []:
            var isBracketTag = false;
            try {
                // لا نحذف الوسم هنا حتى يعمل fontMap ويختار الخط الصحيح
                var bMatch = String(lineText).match(/^\s*\[\s*\]\s*:?.*/);
                if (bMatch) {
                    isBracketTag = true;
                }
            } catch (_bt) {}

            if (!lineText) {
                L("Skipped bubble " + (k+1) + " in " + doc.name + " because no text line is available.");
                totalSkipped++;
                continue;
            }

            if (!pathItem || !pathItem.subPathItems || pathItem.subPathItems.length === 0) {
                E("Invalid or empty path: " + pathName);
                totalErrors++;
                continue;
            }

            var wantedFont = null;
            if (!inheritPrevFont) {
                for (var key in fontMap) {
                    var regex = new RegExp("^" + key.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"));
                    if (regex.test(lineText)) {
                        wantedFont = fontMap[key];
                        lineText = trimString(lineText.replace(regex, ""));
                        break;
                    }
                }
            }

            var usedFont, curFontSize;
            if (inheritPrevFont) {
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

                var textLength = lineText.length;
                var padding = Math.max(2, Math.min(8, Math.min(boxWidth, boxHeight) * 0.03));
                var availableWidth = Math.max(10, boxWidth - (padding * 2));
                var availableHeight = Math.max(10, boxHeight - (padding * 2));

                var innerSide = Math.min(availableWidth, availableHeight);

                var low = Math.max(minFontSize, 6);
                var high = Math.max(low, baseFontSize);
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

                if (textLength > 24) testLayer.textItem.tracking = -10;
                else if (textLength <= 8) testLayer.textItem.tracking = 10;

                while (low <= high && tries < 20) {
                    var mid = Math.floor((low + high) / 2);
                    testLayer.textItem.size = mid;
                    var bb = testLayer.bounds;
                    var bw = Math.max(1, toNum(bb[2]) - toNum(bb[0]));
                    var bh = Math.max(1, toNum(bb[3]) - toNum(bb[1]));
                    if (bw <= innerSide && bh <= innerSide) {
                        best = mid;
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                    tries++;
                }
                var newFontSize = Math.min(best, baseFontSize);
                try { testLayer.remove(); } catch (_rm) {}

                var textLayer = doc.artLayers.add();
                textLayer.kind = LayerKind.TEXT;
                if (!textLayer.textItem) {
                    throw new Error("Failed to create text item for path: " + pathName);
                }
                textLayer.textItem.kind = TextType.PARAGRAPHTEXT;
                textLayer.textItem.contents = lineText;
                textLayer.textItem.justification = Justification.CENTER;
                optimizeFontSettings(textLayer, usedFont, newFontSize);
                // تطبيق تنسيق خاص لسطور []: أو لأسطر // التي ترث من سطر []: سابق
                if (isBracketTag || (inheritPrevFont && lastWasBracketTag)) {
                    try {
                        textLayer.textItem.tracking = 0;
                        textLayer.textItem.leading = Math.round(newFontSize * 1.00);
                        textLayer.textItem.antiAliasMethod = AntiAlias.SMOOTH;
                        textLayer.textItem.autoKerning = AutoKernType.OPTICAL;
                        // طلبك: Faux Bold + ALL CAPS
                        textLayer.textItem.fauxBold = true;
                        try { textLayer.textItem.capitalization = TextCase.ALLCAPS; } catch (_cap) {}
                    } catch (_bfmt) {}
                }
                try { textLayer.textItem.font = usedFont; } catch (fe) { E("Font not found: " + usedFont + ", using Arial"); textLayer.textItem.font = "Arial"; }
                textLayer.textItem.size = newFontSize;

                var startLeft = centerX - (availableWidth / 2);
                var startTop = centerY - (availableHeight / 2) - (newFontSize * verticalCenterCompensationRatio);
                textLayer.textItem.width = availableWidth;
                textLayer.textItem.height = availableHeight;
                textLayer.textItem.position = [startLeft, startTop];

                // ضبط لون النص بناءً على الخلفية
                try {
                    var tlWasVisible = textLayer.visible;
                    textLayer.visible = false;
                    var centerRgb = samplePixel(doc, centerX, centerY);
                    textLayer.visible = tlWasVisible;
                    var centerBright = luminance(centerRgb[0], centerRgb[1], centerRgb[2]);
                    var textColor = new SolidColor();
                    if (centerBright < 128) {
                        textColor.rgb.red = 255;
                        textColor.rgb.green = 255;
                        textColor.rgb.blue = 255;
                    } else {
                        textColor.rgb.red = 0;
                        textColor.rgb.green = 0;
                        textColor.rgb.blue = 0;
                    }
                    textLayer.textItem.color = textColor;
                    if (strokeInfo.needed) {
                        applyWhiteStroke3px(textLayer);
                    }
                } catch (_colErr) {}

                var tb = textLayer.bounds;
                var tl = toNum(tb[0]), tt = toNum(tb[1]), tr = toNum(tb[2]), tbm = toNum(tb[3]);
                var cX = (tl + tr) / 2;
                var cY = (tt + tbm) / 2;
                var dxx = centerX - cX;
                var dyy = (centerY - cY) - (newFontSize * verticalCenterCompensationRatio);
                if (Math.abs(dxx) > 0.1 || Math.abs(dyy) > 0.1) textLayer.translate(dxx, dyy);

                if (!fastMode) {
                    try {
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
                lastWasBracketTag = isBracketTag;

            } catch (bubbleErr) {
                var errMsg = entryPrefix + " : EXCEPTION : " + bubbleErr.toString() + (bubbleErr.line ? " at line " + bubbleErr.line : "");
                E(errMsg);
                totalErrors++;
                try { doc.selection.deselect(); } catch (e2) {}
            }
        }

        // حفظ المستند إذا لم يكن محفوظًا
        try {
            var wasSaved = false;
            if (!doc.saved) {
                try { doc.save(); wasSaved = true; } catch (_sv) { wasSaved = false; }
            } else {
                wasSaved = true;
            }
            if (!wasSaved) {
                try {
                    var targetFile = doc.fullName;
                    if (targetFile) {
                        var psdOptions = new PhotoshopSaveOptions();
                        psdOptions.embedColorProfile = true;
                        psdOptions.alphaChannels = true;
                        psdOptions.layers = true;
                        doc.saveAs(targetFile, psdOptions, true, Extension.LOWERCASE);
                    }
                } catch (_sva) {}
            }
        } catch (_finalize) {}

        try { app.preferences.rulerUnits = prevUnits; } catch (_ur) {}
    }
    try {
        // ====== Summary ======
        L("\n===== Summary =====");
        L("Inserted: " + totalInserted);
        L("Errors: " + totalErrors);
        L("Skipped: " + totalSkipped);

        //  كتابة اللوج التفصيلي
        try {
            var logFile = new File(txtFile.path + "/photoshop_text_log_verbose.txt");
            logFile.open("w");
            for (var i = 0; i < log.length; i++) {
                try { 
                    logFile.writeln(log[i]); 
                } catch (e) {}
            }
            logFile.close();
        } catch (e) {}

        // كتابة الأخطاء فقط
        try {
            if (errors.length > 0) {
                var errFile = new File(txtFile.path + "/photoshop_text_errors.txt");
                errFile.open("w");
                for (var j = 0; j < errors.length; j++) {
                    try { 
                        errFile.writeln(errors[j]); 
                    } catch (e) {}
                }
                errFile.close();
            }
        } catch (e2) {}

        // 1️⃣ حدد فولدر PSD الحالي
        var doc = app.activeDocument;
        var psdFolder = doc.path;

        // 2️⃣ احفظ المسار في ملف مؤقت
        var tempFile = new File("C:/Users/abdoh/Downloads/testScript/psdFolderPath.txt");
        tempFile.open("w");
        tempFile.write(psdFolder.fsName);
        tempFile.close();

        // 3️⃣ شغل ملف الباتش الثابت
        var batchFile = new File("C:/Users/abdoh/Downloads/testScript/openPSD.bat");
        if (batchFile.exists) {
            batchFile.execute(); // يشغل الباتش
        } else {
            alert("ملف الباتش غير موجود: " + batchFile.fsName);
        }

        // 4️⃣ إغلاق Photoshop بعد تشغيل الباتش (من غير حفظ)
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);

    } catch (e) {
        alert("حدث خطأ: " + e);
    }
})();