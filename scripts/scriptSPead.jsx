//#target photoshop

app.bringToFront();
$.evalFile("C:/Users/abdoh/Downloads/testScript/config/json2.js");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/psHelpers.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/textReader.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/teamLoader.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/splitSubpaths.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/fileUtils.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/colorUtils.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/textFX.jsx");

// استخدام الدوال المنظمة من ملفات lib/

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

// دالة للتحقق من وجود خط وتطبيق خط بديل
function getValidFont(fontName, fallbackFont) {
  try {
    // إنشاء مستند مؤقت للاختبار
    var testDoc = app.documents.add(
      100,
      100,
      72,
      "Font Test",
      NewDocumentMode.RGB
    );
    var testLayer = testDoc.artLayers.add();
    testLayer.kind = LayerKind.TEXT;
    testLayer.textItem.contents = "Test";

    try {
      testLayer.textItem.font = fontName;
      // إذا وصلنا هنا بدون خطأ، فالخط موجود
      testDoc.close(SaveOptions.DONOTSAVECHANGES);
      return fontName;
    } catch (e) {
      // الخط غير موجود، جرب الخط البديل
      try {
        testLayer.textItem.font = fallbackFont;
        testDoc.close(SaveOptions.DONOTSAVECHANGES);
        return fallbackFont;
      } catch (e2) {
        testDoc.close(SaveOptions.DONOTSAVECHANGES);
        return "Arial"; // خط افتراضي
      }
    }
  } catch (e) {
    return fallbackFont || "Arial";
  }
}

// دالة للبحث في المفاتيح المجمعة
function findFontInMap(lineText, fontMap) {
  for (var key in fontMap) {
    // تقسيم المفتاح المجمع إلى مفاتيح منفصلة
    var keys = key.split("|");
    for (var i = 0; i < keys.length; i++) {
      var singleKey = keys[i];
      if (lineText.indexOf(singleKey) === 0) {
        return {
          found: true,
          font: fontMap[key],
          key: singleKey,
        };
      }
    }
  }
  return { found: false, font: null, key: null };
}

// ====== بناء فهرس سريع لمفاتيح الخطوط ======
function buildFontIndex(fontMap) {
  var entries = [];
  for (var k in fontMap) {
    if (!fontMap.hasOwnProperty(k)) continue;
    var raw = String(k);
    var arr = raw.indexOf("|") >= 0 ? raw.split("|") : [raw];
    for (var i = 0; i < arr.length; i++) {
      var kk = arr[i];
      if (!kk) continue;
      entries.push({ key: kk, font: fontMap[k] });
    }
  }
  // رتب بالمفتاح الأطول أولاً ليتجنب مطابقة جزئية قبل كاملة
  entries.sort(function (a, b) {
    return b.key.length - a.key.length;
  });
  // فهرسة بالحرف الأول لتقليل قائمة المرشحين
  var byFirst = {};
  for (var j = 0; j < entries.length; j++) {
    var f = entries[j];
    var ch = f.key.charAt(0);
    if (!byFirst[ch]) byFirst[ch] = [];
    byFirst[ch].push(f);
  }
  return { entries: entries, byFirst: byFirst };
}

function findFontInCompiledMap(lineText, compiled) {
  if (!lineText) return { found: false, font: null, key: null };
  var ch = String(lineText).charAt(0);
  var list = compiled.byFirst[ch] || compiled.entries;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (lineText.indexOf(e.key) === 0) {
      return { found: true, font: e.font, key: e.key };
    }
  }
  return { found: false, font: null, key: null };
}

// تحليل علامات النص لتطبيق Stroke
function parseStrokeTag(line) {
  try {
    var m = String(line).match(
      /^\s*(?:NA:\s*|\*\*:\s*|SFX:\s*|ST:\s*|Ot:\s*|OT:\s*|#\s*)([\s\S]*)$/
    );
    if (m) {
      return { needed: true, text: trimString(m[1]) };
    }
  } catch (_e) {}
  return { needed: false, text: line };
}

// دالة لفتح Notepad وإنشاء ملف نصي جديد
function openNotepad() {
  try {
    // مسار افتراضي لملف النص
    var txtFilePath = "C:/Users/abdoh/Downloads/testScript/manga_text.txt";
    var txtFile = new File(txtFilePath);

    // إذا لم يكن الملف موجودًا، أنشئه مع تعليمات أولية
    if (!txtFile.exists) {
      txtFile.open("w");
      txtFile.writeln(
        "// الصق النص هنا، استخدم 'page 1' لتحديد بداية الصفحة الأولى"
      );
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

(function () {
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
  var jsonFile = File("C:/Users/abdoh/Downloads/testScript/config/teams.json");
  var teams;
  try {
    teams = loadTeams(jsonFile);
  } catch (e) {
    return;
  }

  // تحضير قائمة الفرق
  var teamNames = getTeamNames(teams);
  var settingsPath = Folder.myDocuments + "/waterMark/lastChoice.txt";
  var lastTeamIdx = 0;
  try {
    if (settingsFile.exists) {
      if (settingsFile.open("r")) {
        var raw = settingsFile.read();
        settingsFile.close();
        var lines = String(raw || "").split(/\r?\n/);
        if (lines.length > 0) {
          var t = parseInt(lines[0], 10);
          if (!isNaN(t) && t >= 0 && t < teamNames.length) lastTeamIdx = t;
        }
      }
    }
  } catch (_re) {}

  // ========= دايالوج الإعدادات الشامل ==========
  var settingsFile = new File(txtFile.path + "/ps_text_settings.json");
  var lastSettings = {
    teamIndex: lastTeamIdx,
    baseFontSize: 30,
    ultraFastMode: false,
    fastMode: true,
    stopAfterFirstPage: false,
    openPS21: false,
  };

  // قراءة الإعدادات المحفوظة
  try {
    if (settingsFile.exists) {
      settingsFile.open("r");
      var sraw = settingsFile.read();
      settingsFile.close();
      var sobj = null;
      try {
        sobj = JSON.parse(sraw);
      } catch (_je) {
        sobj = null;
      }
      if (sobj) {
        if (sobj.teamIndex !== undefined)
          lastSettings.teamIndex = parseInt(sobj.teamIndex, 10);
        if (sobj.lastBaseFontSize)
          lastSettings.baseFontSize = parseInt(sobj.lastBaseFontSize, 10);
        if (sobj.ultraFastMode !== undefined)
          lastSettings.ultraFastMode = sobj.ultraFastMode;
        if (sobj.fastMode !== undefined) lastSettings.fastMode = sobj.fastMode;
        if (sobj.stopAfterFirstPage !== undefined)
          lastSettings.stopAfterFirstPage = sobj.stopAfterFirstPage;
        if (sobj.openPS21 !== undefined) lastSettings.openPS21 = sobj.openPS21;
      }
    }
  } catch (_re) {}

  // إنشاء دايالوج الإعدادات
  var settingsDialog = new Window("dialog", "إعدادات السكريبت");
  settingsDialog.orientation = "column";
  settingsDialog.alignChildren = ["fill", "top"];
  settingsDialog.spacing = 10;
  settingsDialog.margins = 20;

  // عنوان الدايالوج
  var titleGroup = settingsDialog.add("group");
  titleGroup.add("statictext", undefined, "إعدادات سكريبت إدراج النصوص", {
    style: "bold",
  });

  // اختيار الفريق
  var teamGroup = settingsDialog.add("panel", undefined, "اختيار الفريق");
  teamGroup.orientation = "column";
  teamGroup.alignChildren = ["fill", "top"];
  teamGroup.spacing = 5;
  teamGroup.margins = 10;

  teamGroup.add("statictext", undefined, "اختر الفريق:");
  var teamDropdown = teamGroup.add("dropdownlist", undefined, []);
  for (var di = 0; di < teamNames.length; di++) {
    teamDropdown.add("item", di + 1 + " - " + teamNames[di]);
  }
  try {
    teamDropdown.selection = teamDropdown.items[lastSettings.teamIndex];
  } catch (_se) {
    if (teamDropdown.items.length > 0)
      teamDropdown.selection = teamDropdown.items[0];
  }

  // إعدادات الخط
  var fontGroup = settingsDialog.add("panel", undefined, "إعدادات الخط");
  fontGroup.orientation = "column";
  fontGroup.alignChildren = ["fill", "top"];
  fontGroup.spacing = 5;
  fontGroup.margins = 10;

  var fontSizeGroup = fontGroup.add("group");
  fontSizeGroup.add("statictext", undefined, "حجم الخط الأساسي (pt):");
  var fontSizeInput = fontSizeGroup.add(
    "edittext",
    undefined,
    String(lastSettings.baseFontSize)
  );
  fontSizeInput.characters = 10;

  // إعدادات الأداء
  var performanceGroup = settingsDialog.add(
    "panel",
    undefined,
    "إعدادات الأداء"
  );
  performanceGroup.orientation = "column";
  performanceGroup.alignChildren = ["fill", "top"];
  performanceGroup.spacing = 5;
  performanceGroup.margins = 10;

  var ultraFastCheck = performanceGroup.add(
    "checkbox",
    undefined,
    "وضع السرعة القصوى (أسرع أداء بدون تأثيرات إضافية)"
  );
  ultraFastCheck.value = lastSettings.ultraFastMode;

  var fastModeCheck = performanceGroup.add(
    "checkbox",
    undefined,
    "وضع السرعة العادي (أداء سريع مع تأثيرات كاملة)"
  );
  fastModeCheck.value = lastSettings.fastMode;

  // إعدادات التشغيل
  var runGroup = settingsDialog.add("panel", undefined, "إعدادات التشغيل");
  runGroup.orientation = "column";
  runGroup.alignChildren = ["fill", "top"];
  runGroup.spacing = 5;
  runGroup.margins = 10;

  var stopAfterFirstCheck = runGroup.add(
    "checkbox",
    undefined,
    "التوقف بعد الصفحة الأولى للتحقق من الخط"
  );
  stopAfterFirstCheck.value = lastSettings.stopAfterFirstPage;

  var openPS21Check = runGroup.add(
    "checkbox",
    undefined,
    "إغلاق فوتوشوب وفتح نسخة 21 بعد الانتهاء"
  );
  openPS21Check.value = lastSettings.openPS21;

  // أزرار التحكم
  var buttonGroup = settingsDialog.add("group");
  buttonGroup.alignment = "right";
  var okButton = buttonGroup.add("button", undefined, "موافق");
  var cancelButton = buttonGroup.add("button", undefined, "إلغاء");

  // معالجة الأحداث
  var dialogResult = null;
  var chosenTeamIdx = null;
  var baseFontSize = null;
  var ultraFastMode = null;
  var fastMode = null;
  var stopAfterFirstPage = null;
  var openPS21 = null;

  okButton.onClick = function () {
    // التحقق من صحة البيانات
    var fontSize = parseInt(fontSizeInput.text, 10);
    if (isNaN(fontSize) || fontSize <= 0) {
      alert("يرجى إدخال حجم خط صحيح");
      return;
    }

    // التحقق من اختيار الفريق
    if (!teamDropdown.selection) {
      alert("يرجى اختيار فريق");
      return;
    }

    // حفظ الإعدادات
    chosenTeamIdx = teamDropdown.selection.index;
    baseFontSize = fontSize;
    ultraFastMode = ultraFastCheck.value;
    fastMode = fastModeCheck.value;
    stopAfterFirstPage = stopAfterFirstCheck.value;
    openPS21 = openPS21Check.value;

    // حفظ الإعدادات في الملف
    try {
      var toSave = {
        teamIndex: chosenTeamIdx,
        lastBaseFontSize: baseFontSize,
        ultraFastMode: ultraFastMode,
        fastMode: fastMode,
        stopAfterFirstPage: stopAfterFirstPage,
        openPS21: openPS21,
      };
      settingsFile.open("w");
      settingsFile.write(JSON.stringify(toSave));
      settingsFile.close();
    } catch (_we) {}

    // حفظ اختيار الفريق في الملف المنفصل
    try {
      var teamSettingsFile = new File(settingsPath);
      teamSettingsFile.open("w");
      teamSettingsFile.writeln(chosenTeamIdx);
      teamSettingsFile.close();
    } catch (_we) {}

    dialogResult = true;
    settingsDialog.close();
  };

  cancelButton.onClick = function () {
    dialogResult = false;
    settingsDialog.close();
  };

  // عرض الدايالوج
  settingsDialog.show();

  // التحقق من النتيجة
  if (dialogResult !== true) {
    return; // إلغاء العملية
  }

  // تعريف متغيرات الفريق المختار
  var currentTeam = teamNames[chosenTeamIdx];
  if (!teams[currentTeam]) {
    return;
  }

  var defaultFont = teams[currentTeam].defaultFont;
  var minFontSize = teams[currentTeam].minFontSize;
  var boxPaddingRatio = teams[currentTeam].boxPaddingRatio;
  var fontMap = teams[currentTeam].fontMap;
  var compiledFontIndex = buildFontIndex(fontMap);
  var verticalCenterCompensationRatio = 0.06; // تعويض رأسي أخف لتقليل الرفع للأعلى

  if (minFontSize && minFontSize > baseFontSize)
    minFontSize = Math.max(8, Math.floor(baseFontSize * 0.7));

  // ========= قراءة النصوص + بداية كل صفحة ==========
  var allLines = [],
    pageStartIndices = [];
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

  // ========= لوج محسن ==========
  var log = [];
  var errors = [];
  function L(s) {
    if (!ultraFastMode) log.push(s);
  }
  function E(s) {
    errors.push(s);
    if (!ultraFastMode) log.push("ERROR: " + s);
  }

  // ====== مركز هندسي محسّن للـ path (شبيه بطريقة إضافات التوسيط) ======
  // الفكرة: نحسب سنتر أولي من كل نقاط الـ path، ثم نزيل 20% الأبعد (tail/زيادات)
  // ونعيد حساب السنتر من النقاط المتبقية لتمثيل جسم الفقاعة الحقيقي.
  function getTrimmedCentroid(pathItem, x1, y1, x2, y2) {
    try {
      if (
        !pathItem ||
        !pathItem.subPathItems ||
        pathItem.subPathItems.length === 0
      )
        return [(x1 + x2) / 2, (y1 + y2) / 2];

      var points = [];
      for (var si = 0; si < pathItem.subPathItems.length; si++) {
        var sp = pathItem.subPathItems[si];
        if (!sp || !sp.pathPoints) continue;
        for (var pi = 0; pi < sp.pathPoints.length; pi++) {
          try {
            var a = sp.pathPoints[pi].anchor;
            if (a && a.length === 2) points.push([a[0], a[1]]);
          } catch (_e) {}
        }
      }
      if (points.length < 5) {
        try {
          var pb = pathItem.bounds;
          if (pb && pb.length === 4) {
            var px1 = toNum(pb[0]),
              py1 = toNum(pb[1]),
              px2 = toNum(pb[2]),
              py2 = toNum(pb[3]);
            return [(px1 + px2) / 2, (py1 + py2) / 2];
          }
        } catch (_b) {}
        return [(x1 + x2) / 2, (y1 + y2) / 2];
      }

      // سنتر أولي
      var cx = 0,
        cy = 0;
      for (var i = 0; i < points.length; i++) {
        cx += points[i][0];
        cy += points[i][1];
      }
      cx /= points.length;
      cy /= points.length;

      // مسافات من السنتر الأولي
      var distIdx = [];
      for (var j = 0; j < points.length; j++) {
        var dx = points[j][0] - cx;
        var dy = points[j][1] - cy;
        distIdx.push({ d: Math.sqrt(dx * dx + dy * dy), p: points[j] });
      }
      distIdx.sort(function (a, b) {
        return a.d - b.d;
      });

      // احتفظ بـ 80% الأقرب (شطب الذيل/النتوءات)
      var keepCount = Math.max(3, Math.floor(distIdx.length * 0.8));
      var sumX = 0,
        sumY = 0;
      for (var k = 0; k < keepCount; k++) {
        sumX += distIdx[k].p[0];
        sumY += distIdx[k].p[1];
      }
      return [sumX / keepCount, sumY / keepCount];
    } catch (_err) {
      return [(x1 + x2) / 2, (y1 + y2) / 2];
    }
  }

  L("Photoshop Text Import - verbose log");
  L("Date: " + new Date().toString());
  L("TXT file: " + txtFile.fsName);
  L("Total lines read: " + allLines.length);
  L("Pages detected: " + pageStartIndices.length);
  L("Base font size: " + baseFontSize + "  minFontSize: " + minFontSize);
  L("Stop after first page: " + (stopAfterFirstPage ? "YES" : "NO"));
  L("========================================");

  // جمع وترتيب المستندات بناءً على رقم الصفحة
  var documentsArray = [];
  for (var d = 0; d < app.documents.length; d++) {
    documentsArray.push(app.documents[d]);
  }
  documentsArray.sort(function (a, b) {
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
    try {
      app.preferences.rulerUnits = Units.PIXELS;
    } catch (_ue) {}
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
    if (
      pageNumber !== null &&
      pageNumber > 0 &&
      pageNumber <= pageStartIndices.length
    ) {
      lineIndex = pageStartIndices[pageNumber - 1];
      L(
        " Reset lineIndex to start of page " +
          pageNumber +
          " (line " +
          lineIndex +
          ")"
      );
    } else {
      lineIndex =
        pageCounter < pageStartIndices.length
          ? pageStartIndices[pageCounter]
          : 0;
      L(
        " No valid page number in doc name, using pageCounter " +
          (pageCounter + 1) +
          " (line " +
          lineIndex +
          ")"
      );
    }
    pageCounter++;

    // تحسين إدارة المسارات - تخزين مؤقت
    var paths = doc.pathItems;
    if (!paths || paths.length === 0) {
      if (!ultraFastMode)
        L("Document '" + doc.name + "' has no path items. Skipping.");
      continue;
    }

    // تجميع المسارات الصالحة مرة واحدة
    var pagePaths = [];
    var pathsLength = paths.length;

    for (var p = 0; p < pathsLength; p++) {
      var pi = paths[p];
      if (!pi) continue;

      // فحص سريع للـ Work Path
      if (pi.name === "Work Path") continue;

      // فحص صحة المسار بطريقة مبسطة
      if (pi.subPathItems && pi.subPathItems.length > 0) {
        var sp = pi.subPathItems[0];
        if (sp && sp.pathPoints && sp.pathPoints.length > 1) {
          pagePaths.push(pi);
        }
      }
    }

    // ترتيب المسارات بطريقة محسنة
    pagePaths.sort(function (a, b) {
      var ma = a.name.match(/bubble[_\s-]?(\d+)/i);
      var mb = b.name.match(/bubble[_\s-]?(\d+)/i);
      var na = ma ? parseInt(ma[1], 10) : 999999;
      var nb = mb ? parseInt(mb[1], 10) : 999999;
      return na - nb;
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
      try {
        pathName = pathItem.name;
      } catch (e) {}

      var entryPrefix =
        "File=" +
        doc.name +
        " | BubbleIndex=" +
        (k + 1) +
        " | PathName=" +
        pathName;
      if (!ultraFastMode) L("\n" + entryPrefix);

      var lineText = allLines[lineIndex++];

      // في وضع السرعة، نحتفظ بمنطق تغيير الخطوط ولكن نبسط باقي العمليات
      var isBracketTag = false;
      var isOTTag = false;
      var inheritPrevFont = false;

      if (ultraFastMode) {
        // فحص التاجات الخاصة قبل حذفها
        if (/^\s*\[\s*\]\s*:?/.test(lineText)) {
          isBracketTag = true;
        }
        if (/^\s*(?:OT|Ot)\s*:?\s*/.test(lineText)) {
          isOTTag = true;
        }
        if (/^\/\/:?/.test(lineText)) {
          inheritPrevFont = true;
        }

        // إزالة التاجات العامة فقط (وليس مفاتيح الخطوط أو التاجات الخاصة)
        lineText = lineText.replace(/^\s*(NA:|SFX:|\*\*:|#\s*)\s*/i, "");

        // حذف تاج // إذا كان موجوداً
        if (inheritPrevFont) {
          lineText = trimString(String(lineText).replace(/^\/\/:?\s*/, ""));
        }
      } else {
        var strokeInfo = parseStrokeTag(lineText);
        lineText = strokeInfo.text;
        // توريث خط الفقاعة السابقة لأسطر // أو //:
        try {
          if (/^\/\/:?/.test(lineText)) {
            inheritPrevFont = true;
            lineText = trimString(String(lineText).replace(/^\/\/:?\s*/, ""));
          }
        } catch (_ih) {}
        // خصائص خاصة لسطور تبدأ بـ []:
        try {
          // لا نحذف الوسم هنا حتى يعمل fontMap ويختار الخط الصحيح
          var bMatch = String(lineText).match(/^\s*\[\s*\]\s*:?.*/);
          if (bMatch) {
            isBracketTag = true;
          }
        } catch (_bt) {}

        // خصائص خاصة لسطور تبدأ بـ OT: أو Ot:
        try {
          var otMatch = String(lineText).match(/^\s*(?:OT|Ot)\s*:?\s*.*/);
          if (otMatch) {
            isOTTag = true;
          }
        } catch (_ot) {}
      }

      if (!lineText) {
        L(
          "Skipped bubble " +
            (k + 1) +
            " in " +
            doc.name +
            " because no text line is available."
        );
        totalSkipped++;
        continue;
      }

      if (
        !pathItem ||
        !pathItem.subPathItems ||
        pathItem.subPathItems.length === 0
      ) {
        E("Invalid or empty path: " + pathName);
        totalErrors++;
        continue;
      }

      // تحسين اختيار الخطوط
      var usedFont, curFontSize;

      if (ultraFastMode) {
        // في وضع السرعة، نحتفظ بمنطق تغيير الخطوط بناءً على المفاتيح
        var wantedFont = defaultFont;

        // فحص مفاتيح الخطوط وحذفها باستخدام الدالة الجديدة
        var fontResult = findFontInCompiledMap(lineText, compiledFontIndex);
        if (fontResult.found) {
          wantedFont = fontResult.font;
          lineText = trimString(lineText.substring(fontResult.key.length));
        }

        // فحص تاج ST: إذا لم يتم العثور على مفتاح خط
        if (wantedFont === defaultFont && /^\s*ST\s*:?\s*/.test(lineText)) {
          // البحث عن خط ST في fontMap
          for (var key in fontMap) {
            if (key.toLowerCase() === "st" || key.toLowerCase() === "st:") {
              wantedFont = fontMap[key];
              lineText = lineText.replace(/^\s*ST\s*:?\s*/, "");
              break;
            }
          }
        }

        // حذف التاجات الخاصة بعد تحديد نوع الخط
        if (isBracketTag) {
          lineText = lineText.replace(/^\s*\[\s*\]\s*:?\s*/, "");
        }
        if (isOTTag) {
          lineText = lineText.replace(/^\s*(?:OT|Ot)\s*:?\s*/, "");
        }

        usedFont = wantedFont; // استخدام الخط مباشرة بدون فحص getValidFont
        curFontSize = baseFontSize;
      } else {
        if (inheritPrevFont) {
          usedFont = lastUsedFont || defaultFont;
          curFontSize = lastFontSize || baseFontSize;
        } else {
          var wantedFont = defaultFont;

          // فحص سريع للخطوط المطلوبة باستخدام الدالة الجديدة
          var fontResult = findFontInCompiledMap(lineText, compiledFontIndex);
          if (fontResult.found) {
            wantedFont = fontResult.font;
            if (!isOTTag) {
              lineText = trimString(lineText.substring(fontResult.key.length));
            }
          }

          usedFont = getValidFont(wantedFont, defaultFont);
          curFontSize = baseFontSize; // استخدام الخط الثابت
        }
      }

      // خاصية خاصة لفريق rezo مع خط CCShoutOutGSN - زيادة حجم الخط بـ 10 نقاط
      if (currentTeam === "rezo" && usedFont === "CCShoutOutGSN") {
        curFontSize = curFontSize + 10;
      }

      try {
        pathItem.makeSelection();
        if (!doc.selection || !doc.selection.bounds) {
          throw new Error("No valid selection for path: " + pathName);
        }

        var selBounds = doc.selection.bounds;
        var x1 = toNum(selBounds[0]),
          y1 = toNum(selBounds[1]),
          x2 = toNum(selBounds[2]),
          y2 = toNum(selBounds[3]);
        var w = x2 - x1,
          h = y2 - y1;

        var boxWidth = Math.max(10, w * (1 - boxPaddingRatio));
        var boxHeight = Math.max(10, h * (1 - boxPaddingRatio));
        // توسيط تمامًا إلى حدود التحديد (نفس سلوك TyperTools)
        var centerX = (x1 + x2) / 2;
        var centerY = (y1 + y2) / 2;

        var textLength = lineText.length;
        var padding = Math.max(
          2,
          Math.min(8, Math.min(boxWidth, boxHeight) * 0.03)
        );
        var availableWidth = Math.max(10, boxWidth - padding * 2);
        var availableHeight = Math.max(10, boxHeight - padding * 2);

        // استخدام الخط الثابت بدلاً من الحساب الديناميكي
        var newFontSize = curFontSize;

        var textLayer = doc.artLayers.add();
        textLayer.kind = LayerKind.TEXT;
        if (!textLayer.textItem) {
          throw new Error("Failed to create text item for path: " + pathName);
        }
        textLayer.textItem.kind = TextType.PARAGRAPHTEXT;
        textLayer.textItem.contents = lineText;
        textLayer.textItem.justification = Justification.CENTER;
        textLayer.textItem.font = usedFont;
        textLayer.textItem.size = newFontSize;

        // تطبيق تنسيقات إضافية فقط إذا لم يكن في وضع Ultra Fast
        if (!ultraFastMode) {
          optimizeFontSettings(textLayer, usedFont, newFontSize);

          // تطبيق تنسيق خاص لسطور []: أو لأسطر // التي ترث من سطر []: سابق
          if (isBracketTag || (inheritPrevFont && lastWasBracketTag)) {
            textLayer.textItem.tracking = 0;
            textLayer.textItem.leading = Math.round(newFontSize * 1.0);
            textLayer.textItem.antiAliasMethod = AntiAlias.SMOOTH;
            textLayer.textItem.autoKerning = AutoKernType.OPTICAL;
            textLayer.textItem.fauxBold = true;
            textLayer.textItem.capitalization = TextCase.ALLCAPS;
          }

          // تطبيق تأثير ALL CAPS على سطور OT: أو Ot:
          if (isOTTag) {
            textLayer.textItem.capitalization = TextCase.ALLCAPS;
          }
        } else {
          // في وضع السرعة، تطبيق تنسيقات أساسية + تأثيرات خاصة
          textLayer.textItem.antiAliasMethod = AntiAlias.SMOOTH;

          // تطبيق تأثيرات خاصة لسطور []: في وضع السرعة
          if (isBracketTag) {
            textLayer.textItem.tracking = 0;
            textLayer.textItem.leading = Math.round(newFontSize * 1.0);
            textLayer.textItem.autoKerning = AutoKernType.OPTICAL;
            textLayer.textItem.fauxBold = true;
            textLayer.textItem.capitalization = TextCase.ALLCAPS;
          }

          // تطبيق تأثير ALL CAPS على سطور OT: في وضع السرعة
          if (isOTTag) {
            textLayer.textItem.capitalization = TextCase.ALLCAPS;
          }
        }

        var startLeft = centerX - availableWidth / 2;
        var startTop =
          centerY -
          availableHeight / 2 -
          newFontSize * verticalCenterCompensationRatio;
        textLayer.textItem.width = availableWidth;
        textLayer.textItem.height = availableHeight;
        textLayer.textItem.position = [startLeft, startTop];

        // ضبط لون النص بناءً على الخلفية (تخطي في Ultra Fast Mode)
        if (!ultraFastMode) {
          var tlWasVisible = textLayer.visible;
          textLayer.visible = false;
          var centerRgb = samplePixel(doc, centerX, centerY);
          textLayer.visible = tlWasVisible;
          var centerBright = luminance(
            centerRgb[0],
            centerRgb[1],
            centerRgb[2]
          );
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
        } else {
          // لون افتراضي في Ultra Fast Mode
          var defaultColor = new SolidColor();
          defaultColor.rgb.red = 0;
          defaultColor.rgb.green = 0;
          defaultColor.rgb.blue = 0;
          textLayer.textItem.color = defaultColor;
        }

        var tb = textLayer.bounds;
        var tl = toNum(tb[0]),
          tt = toNum(tb[1]),
          tr = toNum(tb[2]),
          tbm = toNum(tb[3]);
        var cX = (tl + tr) / 2;
        var cY = (tt + tbm) / 2;
        var dxx = centerX - cX;
        var dyy = centerY - cY - newFontSize * verticalCenterCompensationRatio;
        if (Math.abs(dxx) > 0.1 || Math.abs(dyy) > 0.1)
          textLayer.translate(dxx, dyy);

        // تطبيق تأثيرات إضافية فقط في الوضع العادي
        if (!fastMode && !ultraFastMode) {
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
        }

        doc.selection.deselect();
        totalInserted++;
        L(
          "  >>> OK inserted line index " +
            (lineIndex - 1) +
            " fontSize: " +
            textLayer.textItem.size +
            " font: " +
            usedFont +
            ' textPreview: "' +
            (lineText.length > 80
              ? lineText.substring(0, 80) + "..."
              : lineText) +
            '"'
        );

        lastUsedFont = usedFont;
        lastFontSize = newFontSize;
        lastWasBracketTag = isBracketTag;
      } catch (bubbleErr) {
        var errMsg =
          entryPrefix +
          " : EXCEPTION : " +
          bubbleErr.toString() +
          (bubbleErr.line ? " at line " + bubbleErr.line : "");
        E(errMsg);
        totalErrors++;
        try {
          doc.selection.deselect();
        } catch (e2) {}
      }
    }

    // حفظ المستند إذا لم يكن محفوظًا
    try {
      var wasSaved = false;
      if (!doc.saved) {
        try {
          doc.save();
          wasSaved = true;
        } catch (_sv) {
          wasSaved = false;
        }
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

    try {
      app.preferences.rulerUnits = prevUnits;
    } catch (_ur) {}

    // التوقف بعد الصفحة الأولى إذا تم اختيار هذا الخيار
    if (stopAfterFirstPage && d === 0) {
      L("\n===== توقف بعد الصفحة الأولى =====");
      L("تم الانتهاء من معالجة الصفحة الأولى: " + doc.name);
      L("يمكنك الآن التحقق من الخط وإعادة تشغيل السكريبت إذا كان مناسباً");
      break; // إيقاف الحلقة والخروج من معالجة المستندات
    }
  }
  try {
    // ====== Summary ======
    L("\n===== Summary =====");
    L("Inserted: " + totalInserted);
    L("Errors: " + totalErrors);
    L("Skipped: " + totalSkipped);

    // كتابة اللوج محسنة - في الذاكرة أولاً ثم كتابة مرة واحدة
    if (!ultraFastMode) {
      try {
        var logPath = txtFile.path + "/photoshop_text_log_verbose.txt";
        writeLogFile(logPath, log, errors);
      } catch (e) {}
    }

    // كتابة الأخطاء فقط في Ultra Fast Mode
    if (ultraFastMode && errors.length > 0) {
      try {
        var errFile = new File(txtFile.path + "/photoshop_text_errors.txt");
        errFile.open("w");
        for (var j = 0; j < errors.length; j++) {
          errFile.writeln(errors[j]);
        }
        errFile.close();
      } catch (e2) {}
    }

    // افتح نسخة 21 فقط لو تم اختيار ذلك في الإعدادات
    if (openPS21 === true) {
      try {
        var _docPS = app.activeDocument;
        var _psdFolder = _docPS.path;
        var _tmp = new File(
          "C:/Users/abdoh/Downloads/testScript/psdFolderPath.txt"
        );
        _tmp.open("w");
        _tmp.write(_psdFolder.fsName);
        _tmp.close();

        var _bat = new File(
          "C:/Users/abdoh/Downloads/testScript/batch/openPSD.bat"
        );
        if (_bat.exists) {
          _bat.execute();
        } else {
          alert("ملف الباتش غير موجود: " + _bat.fsName);
        }

        var _ver = parseInt(app.version.split(".")[0]);
        if (_ver < 21) {
          app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
        }
      } catch (_eop) {}
    }
  } catch (e) {
    alert("حدث خطأ: " + e);
  }
})();
