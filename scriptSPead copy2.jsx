//#target photoshop

app.bringToFront();
$.evalFile("C:/Users/abdoh/Downloads/testScript/json2.js");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/psHelpers.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/textReader.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/teamLoader.jsx");

// ===== Text Layer Helpers =====
// trimString and toPx are already defined in psHelpers.jsx

// اجمع كل طبقات النص (Recursive)
function collectTextLayers(container, out) {
    for (var i = 0; i < container.layers.length; i++) {
        var lyr = container.layers[i];
        if (lyr.typename === "ArtLayer" && lyr.kind === LayerKind.TEXT) {
            out.push(lyr);
        } else if (lyr.typename === "LayerSet") {
            collectTextLayers(lyr, out);
        }
    }
}

// حساب السطوع من RGB
function luminance(r, g, b) {
    return 0.299*r + 0.587*g + 0.114*b;
}

// اخد عينة من بكسل معين
function samplePixel(doc, x, y) {
    try {
        // مسح ColorSamplers الموجودة أولاً
        while (doc.colorSamplers.length > 0) {
            doc.colorSamplers[0].remove();
        }
        
        var colorSampler = doc.colorSamplers.add([UnitValue(x,"px"), UnitValue(y,"px")]);
        var c = colorSampler.color.rgb;
        var rgb = [c.red, c.green, c.blue];
        colorSampler.remove();
        return rgb;
    } catch (e) {
        // في حالة الفشل، أرجع لون افتراضي
        return [128, 128, 128]; // رمادي متوسط
    }
}

// ===== Layer Effects helper: apply 3px white Stroke (Outside) via Action Manager =====
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

(function() {
    // تمييز الأسطر التي تتطلب ستروك 3px وعكس اللون
    function parseStrokeTag(line) {
        try {
            var m = String(line).match(/^\s*(?:NA:\s*|\*\*:\s*|SFX:\s*|ST:\s*|Ot:\s*|OT:\s*|#\s*)([\s\S]*)$/);
            if (m) { return { needed: true, text: trimString(m[1]) }; }
        } catch (_e) {}
        return { needed: false, text: line };
    }
    // نعرّفها على النطاق العام للاستخدام بالأسفل
    this.__parseStrokeTag = parseStrokeTag;
}).call(this);

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

    // فتح الملف تلقائياً بدون رسائل
    try {
        txtFile.execute(); // يفتح الملف بالبرنامج الافتراضي
    } catch (e) {
        // فشل في فتح الملف - نكمل بدون إيقاف
    }

    // مسار ملف JSON
    var jsonFile = File("C:/Users/abdoh/Downloads/testScript/teams.json");
    var teams; try { teams = loadTeams(jsonFile); } catch (e) { alert(e); return; }

    // getObjectKeys provided by utils.jsx

    // اختيار الفريق الحالي عبر نافذة Dropdown مع تذكّر آخر اختيار + مجلد
    var teamNames = getObjectKeys(teams);
    var settingsPath = Folder.myDocuments + "/waterMark/lastChoice.txt";
    var settingsFile = new File(settingsPath);
    var lastIdx = 0;
    var lastFolderPath = null;
    try {
        if (settingsFile.exists) {
            if (settingsFile.open('r')) {
                var raw = settingsFile.read();
                settingsFile.close();
                var lines = String(raw || "").split(/\r?\n/);
                if (lines.length > 0) {
                    var t = parseInt(lines[0], 10); if (!isNaN(t) && t >= 0 && t < teamNames.length) lastIdx = t;
                }
                if (lines.length > 1 && lines[1]) {
                    var f = new Folder(lines[1]); if (f && f.exists) lastFolderPath = f.fsName;
                }
            }
        }
    } catch (_re) {}

    var dlg = new Window('dialog', 'اختر الفريق');
    dlg.orientation = 'column';
    dlg.alignChildren = ['fill', 'top'];
    dlg.add('statictext', undefined, 'اختر الفريق:');
    var dd = dlg.add('dropdownlist', undefined, []);
    for (var di = 0; di < teamNames.length; di++) { dd.add('item', (di+1) + ' - ' + teamNames[di]); }
    try { dd.selection = dd.items[lastIdx]; } catch (_se) { if (dd.items.length>0) dd.selection = dd.items[0]; }
    var btns = dlg.add('group'); btns.alignment = 'right';
    var okBtn = btns.add('button', undefined, 'موافق'); var cancelBtn = btns.add('button', undefined, 'إلغاء');
    var chosenIdx = null; okBtn.onClick = function(){ if (dd.selection) chosenIdx = dd.selection.index; dlg.close(); }; cancelBtn.onClick = function(){ dlg.close(); };
    dlg.show();
    if (chosenIdx === null) { alert('تم الإلغاء'); return; }

    var currentTeam = teamNames[chosenIdx];
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
    // إلغاء البروجرس بار للسرعة القصوى
    var noProgressBar = true;
    
    // تعويض بصري لتمركز النص رأسيًا داخل البوكس (بسبب اختلاف الـ ascender/descender)
    // يمكن تعديل النسبة لو لاحظت انحرافًا بسيطًا لأعلى/أسفل
    var verticalCenterCompensationRatio = 0.12; // 12% من حجم الخط
    
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

    // helpers provided by utils.jsx: tryGetFont, pickFont, optimizeFontSettings, toNum, trimString

    
    // ========= قراءة النصوص + بداية كل صفحة ==========
    var allLines = [], pageStartIndices = [];
    try { var _t = readMangaText(txtFile); allLines = _t.lines; pageStartIndices = _t.pageStarts; } catch (e) { alert("فشل في قراءة ملف النص: " + e); return; }

    // التحقق بعد قراءة الملف بالكامل
    if (allLines.length === 0) {
        alert("الملف فارغ أو لم يتم إدخال نص!");
        return;
    }

    // ========= لوج ==========
    var __logs = [];
    var __errs = [];
    function L(msg) { try { __logs.push(String(msg)); } catch (_l) {} }
    function E(msg) { try { __errs.push(String(msg)); } catch (_e) {} }

    // ====== Progress removed for maximum speed ======

    // Skip progress-bar setup for speed

    var totalInserted = 0;
    var totalSkipped = 0;
    var totalErrors = 0;
    var lineIndex = 0;
    var pageCounter = 0;

    // ====== نلف على كل المستندات المفتوحة بالترتيب ======
    for (var d = app.documents.length - 1; d >= 0; d--) {
        var doc = app.documents[d];
        // فرض استخدام البيكسل لتوحيد الحسابات ثم نرجع الإعداد لاحقًا
        var prevUnits = app.preferences.rulerUnits;
        try { app.preferences.rulerUnits = Units.PIXELS; } catch (_ue) {}
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

        // جمع الباثس
        var paths = doc.pathItems;
        var pagePaths = [];
        if (paths && paths.length > 0) {
            for (var p = 0; p < paths.length; p++) {
                try {
                    var pi = paths[p];
                    // تجاهل Work Path بالاسم أو النوع
                    var isWork = false; try { isWork = (pi.name === "Work Path" || pi.kind === PathKind.WORKPATH); } catch(_kw) {}
                    if (isWork) continue;
                    // تأكد من وجود نقاط فعلية
                    var valid = false;
                    try {
                        if (pi.subPathItems && pi.subPathItems.length > 0) {
                            for (var si = 0; si < pi.subPathItems.length; si++) {
                                var sp = null; try { sp = pi.subPathItems[si]; } catch(_spe) { sp = null; }
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
        }
        
        // جمع طبقات النص
        var textLayers = [];
        collectTextLayers(doc, textLayers);
        if (textLayers.length > 0) {
            // ترتيب بصري من أعلى لأسفل حسب bounds
            textLayers.sort(function(a, b) {
                var ay = toPx(a.bounds[1]); // top
                var by = toPx(b.bounds[1]);
                return ay - by; // الأصغر فوق
            });
        }
        
        // إذا لم يوجد باثس ولا طبقات نص، نتخطى المستند
        if (pagePaths.length === 0 && textLayers.length === 0) {
            L("Document '" + doc.name + "' has no path items or text layers. Skipping.");
            continue;
        }

        // ======= قبل حلقة المعالجة =======
        var lastUsedFont = null;
        var lastFontSize = baseFontSize;

        // اختيار إما الباثس أو طبقات النص (الباثس له الأولوية)
        var allItems = [];
        if (pagePaths.length > 0) {
            // إذا وجد باثس، استخدم الباثس فقط
        for (var k = 0; k < pagePaths.length; k++) {
                allItems.push({type: "path", item: pagePaths[k], index: k});
            }
            L("Found " + pagePaths.length + " paths. Using paths only (text layers ignored).");
        } else if (textLayers.length > 0) {
            // إذا لم يوجد باثس، استخدم طبقات النص
            for (var t = 0; t < textLayers.length; t++) {
                allItems.push({type: "text", item: textLayers[t], index: t});
            }
            L("No paths found. Using " + textLayers.length + " text layers.");
        }

        for (var k = 0; k < allItems.length; k++) {
            if (lineIndex >= allLines.length) {
                L("No more lines to place (finished allLines).");
                break;
            }

            // removed cancelRequested/progress UI for speed
            var currentItem = allItems[k];
            var itemType = currentItem.type;
            var item = currentItem.item;
            var itemName = "(unknown)";
            try { 
                if (itemType === "path") {
                    itemName = item.name;
                } else {
                    itemName = item.name || "TextLayer_" + (currentItem.index + 1);
                }
            } catch (e) {}

            var entryPrefix = "File=" + doc.name + " | " + (itemType === "path" ? "BubbleIndex" : "TextIndex") + "=" + (currentItem.index+1) + " | " + (itemType === "path" ? "PathName" : "LayerName") + "=" + itemName;
            if (!ultraFastMode) L("\n" + entryPrefix);

            var lineText = allLines[lineIndex++];
            
            // إزالة المسافات الزائدة من بداية ونهاية النص
            lineText = trimString(lineText);
            // تحليل مفاتيح الستروك: st / ST / St مع نقطتين أو بدون
            var __strokeWhite = false;
            (function(){
                try {
                    var m = String(lineText).match(/^\s*(?:st:?\s*|ST:?\s*|St:?\s*)([\s\S]*)$/);
                    if (m) { __strokeWhite = true; lineText = trimString(m[1]); return; }
                    // دعْم إضافي للمفاتيح السابقة إن وُجدت
                    var m2 = String(lineText).match(/^\s*(?:NA:\s*|\*\*:\s*|SFX:\s*|OT:?\s*|Ot:?\s*|#\s*)([\s\S]*)$/);
                    if (m2) { lineText = trimString(m2[1]); }
                } catch(_pt) {}
            })();

            if (!lineText) {
                L("Skipped " + itemType + " " + (currentItem.index+1) + " in " + doc.name + " because no text line is available.");
                totalSkipped++;
                continue;
            }

            // التأكد من أن العنصر صالح
            if (itemType === "path") {
                if (!item || !item.subPathItems || item.subPathItems.length === 0) {
                    E("Invalid or empty path: " + itemName);
                    totalErrors++;
                    continue;
                }
            } else if (itemType === "text") {
                if (!item || item.kind !== LayerKind.TEXT) {
                    E("Invalid text layer: " + itemName);
                totalErrors++;
                continue;
                }
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
                if (itemType === "path") {
                    // معالجة الباث
                    item.makeSelection();
                if (!doc.selection || !doc.selection.bounds) {
                        throw new Error("No valid selection for path: " + itemName);
                    }
                } else if (itemType === "text") {
                    // معالجة طبقة النص
                    // حساب حدود الطبقة قبل تحديث المحتوى (للحصول على الحجم الأصلي)
                    var originalBounds = item.bounds;
                    var x1 = toPx(originalBounds[0]), y1 = toPx(originalBounds[1]), x2 = toPx(originalBounds[2]), y2 = toPx(originalBounds[3]);
                    var w = x2 - x1, h = y2 - y1;
                    var centerX = (x1 + x2) / 2;
                    var centerY = (y1 + y2) / 2;
                    
                    // تحديث محتوى النص بعد حساب الحدود
                    item.textItem.contents = lineText;
                    try { item.name = lineText; } catch (e) {}
                    
                    // التأكد من تحديث النص
                    if (item.textItem.contents !== lineText) {
                        item.textItem.contents = lineText;
                    }

                    // حساب مساحة متاحة مع هامش (نفس منطق الباثس)
                    var boxWidth = Math.max(10, w * (1 - boxPaddingRatio));
                    var boxHeight = Math.max(10, h * (1 - boxPaddingRatio));
                    
                    // هامش صغير لملء الفقاعة قدر الإمكان
                    var padding = Math.max(2, Math.min(8, Math.min(boxWidth, boxHeight) * 0.03));
                    var availableWidth = Math.max(10, boxWidth - (padding * 2));
                    var availableHeight = Math.max(10, boxHeight - (padding * 2));

                    // مربع داخلي ليعطي شكل دائري متناسق
                    var innerSide = Math.min(availableWidth, availableHeight);

                    // بحث ثنائي لحجم الخط المناسب (نفس منطق الباثس)
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

                    // ضبط أولي للمسافات لتعزيز المظهر الدائري
                    if (lineText.length > 24) testLayer.textItem.tracking = -10;
                    else if (lineText.length <= 8) testLayer.textItem.tracking = 10;

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

                    // تطبيق الإعدادات على الطبقة الأصلية
                    item.textItem.kind = TextType.PARAGRAPHTEXT;
                    item.textItem.justification = Justification.CENTER;
                    try { item.textItem.font = usedFont; } catch (fe) { 
                        E("Font not found: " + usedFont + ", using Arial"); 
                        item.textItem.font = "Arial"; 
                    }
                    item.textItem.size = newFontSize;

                    // ضبط نوع المحاذاة وضمان تمركز baseline
                    item.textItem.justification = Justification.CENTER;
                    item.textItem.direction = Direction.HORIZONTAL;

                    // تحديد موضع النص في المنتصف بدقة (left, top)
                    var startLeft = centerX - (availableWidth / 2);
                    // تعويض رأسي بسيط لتمركز بصري أدق
                    var startTop = centerY - (availableHeight / 2) - (newFontSize * verticalCenterCompensationRatio);
                    item.textItem.width = availableWidth;
                    item.textItem.height = availableHeight;
                    item.textItem.position = [startLeft, startTop];

                    // قياس وتحريك دقيق لتوسيط الطبقة داخل مركز الفقاعة (نعتمد على bounds بعد ضبط width/height)
                    var tb = item.bounds;
                    var tl = toNum(tb[0]), tt = toNum(tb[1]), tr = toNum(tb[2]), tbm = toNum(tb[3]);
                    var cX = (tl + tr) / 2;
                    var cY = (tt + tbm) / 2;
                    var dxx = centerX - cX;
                    // عوض الفرق الرأسي وفق حجم الخط
                    var dyy = (centerY - cY) - (newFontSize * verticalCenterCompensationRatio);
                    
                    // تحريك الطبقة للمركز بدقة أكبر
                    if (Math.abs(dxx) > 0.5 || Math.abs(dyy) > 0.5) {
                        item.translate(dxx, dyy);
                    }
                    
                    // إعادة تطبيق الموضع للتأكد من التوسيط
                    var finalBounds = item.bounds;
                    var finalX = (toNum(finalBounds[0]) + toNum(finalBounds[2])) / 2;
                    var finalY = (toNum(finalBounds[1]) + toNum(finalBounds[3])) / 2;
                    var finalDx = centerX - finalX;
                    var finalDy = (centerY - finalY) - (newFontSize * verticalCenterCompensationRatio);
                    if (Math.abs(finalDx) > 0.5 || Math.abs(finalDy) > 0.5) {
                        item.translate(finalDx, finalDy);
                    }

                    // تأكد أن الطبقة مرئية
                    item.visible = true;

                    // خد عينة لون من الخلفية (بدون إخفاء الطبقة)
                    var rgb = samplePixel(doc, centerX, centerY);

                    var bright = luminance(rgb[0], rgb[1], rgb[2]);

                    // غامق أو فاتح
                    var c = new SolidColor();
                    if (bright < 128) {
                        // خلفية غامقة → نص أبيض
                        c.rgb.red = 255; c.rgb.green = 255; c.rgb.blue = 255;
                    } else {
                        // خلفية فاتحة → نص أسود
                        c.rgb.red = 0; c.rgb.green = 0; c.rgb.blue = 0;
                    }
                    item.textItem.color = c;
                    if (__strokeWhite) {
                        applyWhiteStroke3px(item);
                    }

                    // إضافة التحسينات البصرية للخط (نفس الباثس)
                    if (!fastMode) {
                        try {
                            // حدود خفيفة + لون
                            var stroke = item.effects.add();
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
                            
                            // تحسين المسافات
                            var textLength = lineText.length;
                            if (textLength > 15) item.textItem.tracking = -20;
                            else if (textLength <= 5) item.textItem.tracking = 20;
                            item.textItem.leading = Math.round(newFontSize * 1.05);
                        } catch (effectError) { 
                            if (!ultraFastMode) L("  Warning: Could not apply visual effects: " + effectError); 
                        }
                    }
                    
                    // التأكد النهائي من أن الطبقة مرئية ومحدثة
                    item.visible = true;
                    item.opacity = 100;
                    
                    // التأكد النهائي من تحديث النص
                    if (item.textItem.contents !== lineText) {
                        item.textItem.contents = lineText;
                    }
                    
                    totalInserted++;
                    L("  >>> OK updated text layer " + (currentItem.index + 1) + " fontSize: " + item.textItem.size + " textPreview: \"" + (lineText.length > 80 ? lineText.substring(0, 80) + "..." : lineText) + "\"");
                    
                    lastUsedFont = usedFont;
                    lastFontSize = curFontSize;
                } else {
                    // إذا لم يكن path أو text، تخطى
                    L("Unknown item type: " + itemType);
                }
                
                // إذا كان text layer، انتقل للعنصر التالي
                if (itemType === "text") {
                    continue;
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

                // ضبط لون النص بناءً على لون الخلفية عند مركز الفقاعة
                try {
                    var tlWasVisible = textLayer.visible;
                    textLayer.visible = false; // أخفِ النص مؤقتًا حتى لا يؤثر على القراءة
                    var centerRgb = samplePixel(doc, centerX, centerY);
                    textLayer.visible = tlWasVisible;
                    var centerBright = luminance(centerRgb[0], centerRgb[1], centerRgb[2]);
                    var autoColor = new SolidColor();
                    if (centerBright < 128) { autoColor.rgb.red = 255; autoColor.rgb.green = 255; autoColor.rgb.blue = 255; }
                    else { autoColor.rgb.red = 0; autoColor.rgb.green = 0; autoColor.rgb.blue = 0; }
                    textLayer.textItem.color = autoColor;
                    if (__strokeWhite) {
                        applyWhiteStroke3px(textLayer);
                    }
                } catch(_colErr) {}

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

            // progress updates removed for speed
        }

        // summaries and file logging
        try {
            var logPath = txtFile.path + "/manga_log.txt";
            var lf = new File(logPath);
            if (lf.open("a")) {
                var now = new Date();
                lf.writeln("===== Run @ " + now.toUTCString() + " | Doc: " + doc.name + " =====");
                lf.writeln("Inserted=" + totalInserted + ", Skipped=" + totalSkipped + ", Errors=" + totalErrors);
                if (__errs.length > 0) {
                    lf.writeln("-- Errors --");
                    for (var ei = 0; ei < __errs.length; ei++) lf.writeln(__errs[ei]);
                }
                if (__logs.length > 0) {
                    lf.writeln("-- Logs --");
                    for (var li = 0; li < __logs.length; li++) lf.writeln(__logs[li]);
                }
                lf.writeln("");
                lf.close();
            }
        } catch (_lferr) {}

        // استرجاع وحدات القياس الأصلية
        try { app.preferences.rulerUnits = prevUnits; } catch (_ur) {}

        // حفظ صامت للوثيقة وإغلاقها لضمان عدم معالجتها مرة أخرى إذا توقف البرنامج
        try {
            var wasSaved = false;
            try {
                if (!doc.saved) {
                    try { doc.save(); wasSaved = true; } catch (_sv) { wasSaved = false; }
                } else {
                    wasSaved = true; // لا تغييرات غير محفوظة
                }
            } catch (_sd) {}

            if (!wasSaved) {
                try {
                    var targetFile = null;
                    try { targetFile = doc.fullName; } catch (_fn) { targetFile = null; }
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
    }
    try {
        // 1️⃣ حدد فولدر PSD الحالي
        var doc = app.activeDocument;
        var psdFolder = doc.path;
    
        // 2️⃣ احفظ المسار في ملف مؤقت
        var tempFile = new File( "C:/Users/abdoh/Downloads/testScript/psdFolderPath.txt");
        tempFile.open("w");
        tempFile.write(psdFolder.fsName);
        tempFile.close();
    
        // 3️⃣ شغل ملف الباتش الثابت
        var batchFile = new File("C:/Users/abdoh/Downloads/testScript/openPSD.bat");
        if (batchFile.exists) {
            batchFile.execute(); // يشغل الباتش ويكمل الباتش لوحده
        } else {
            alert("ملف الباتش غير موجود: " + batchFile.fsName);
        }
    
        // 4️⃣ يمكن إغلاق Photoshop 2015 تلقائي بعد تشغيل الباتش
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
    
    } catch (e) {
        alert("حدث خطأ: " + e);
    }
    

})();
