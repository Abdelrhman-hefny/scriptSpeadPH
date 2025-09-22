//#target photoshop

app.bringToFront();

// ===== buildFontIndex (added to fix missing function) =====
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
  // رتب بالمفتاح الأطول أولاً لتجنب مطابقة جزئية قبل كاملة
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

$.evalFile("C:/Users/abdoh/Downloads/testScript/config/json2.js");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/psHelpers.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/textReader.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/teamLoader.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/splitSubpaths.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/fileUtils.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/colorUtils.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/textFX.jsx");
$.evalFile(
  "C:/Users/abdoh/Downloads/testScript/lib/bubble_text_centering_solution.jsx"
);

// تحسينات خاصة بوضع السرعة القصوى (UltraFast):
// - كاش للخطوط
// - استخدام "template layer" و duplicate بدل create جديد لكل فقعة
// - حساب حدود المسار من نقاطه بدل makeSelection حيثما أمكن
// - تعطيل samplePixel و centerTextInBubbleWithTail في UltraFast

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

// عام: عداد التسلسل للمسارات (لابد أن يكون معرفًا قبل استخدام الدالة)
var lastBubbleIndex = 0;

// دالة للحصول على المسارات الصالحة للصفحة (بديل أسرع ومنظم)
function getSmartPathsForPage(doc) {
  try {
    var paths = doc.pathItems;
    if (!paths || paths.length === 0) {
      return [];
    }

    var pagePaths = [];
    var pathsLength = paths.length;

    for (var p = 0; p < pathsLength; p++) {
      var pi = paths[p];
      if (!pi) continue;

      // تجاهل Work Path الافتراضي
      try {
        if (pi.name === "Work Path") continue;
      } catch (_e) {}

      // التأكد من أن المسار يحتوي نقاط صالحة
      try {
        if (pi.subPathItems && pi.subPathItems.length > 0) {
          var sp = pi.subPathItems[0];
          if (sp && sp.pathPoints && sp.pathPoints.length > 1) {
            lastBubbleIndex++;
            try { pi._smartIndex = lastBubbleIndex; } catch (_e) {}
            pagePaths.push(pi);
          }
        }
      } catch (_e) {
        continue;
      }
    }

    // ترتيب المسارات بحسب الفهرس الذكي الممنوح
    pagePaths.sort(function (a, b) {
      var na = (typeof a._smartIndex === "number") ? a._smartIndex : 999999;
      var nb = (typeof b._smartIndex === "number") ? b._smartIndex : 999999;
      return na - nb;
    });

    return pagePaths;
  } catch (e) {
    return [];
  }
}

// --------------- Font cache -----------------
var _fontCache = {};
function getValidFontCached(fontName, fallbackFont) {
  var key = String(fontName || "") + "||" + String(fallbackFont || "");
  if (_fontCache.hasOwnProperty(key)) return _fontCache[key];
  try {
    var res = getValidFont(fontName, fallbackFont);
    _fontCache[key] = res;
    return res;
  } catch (e) {
    _fontCache[key] = fallbackFont || "Arial";
    return _fontCache[key];
  }
}

// --------------- حساب حدود المسار من النقاط (بديل عن selection) -----------------
function getPathBoundsFromPoints(pathItem) {
  try {
    if (!pathItem || !pathItem.subPathItems || pathItem.subPathItems.length === 0) return null;
    var sp = pathItem.subPathItems[0];
    if (!sp || !sp.pathPoints || sp.pathPoints.length === 0) return null;
    var pts = sp.pathPoints;
    var minX = Number.POSITIVE_INFINITY,
      minY = Number.POSITIVE_INFINITY,
      maxX = Number.NEGATIVE_INFINITY,
      maxY = Number.NEGATIVE_INFINITY;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i].anchor; // [x,y]
      if (!a || a.length < 2) continue;
      var x = Number(a[0]);
      var y = Number(a[1]);
      if (isNaN(x) || isNaN(y)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    if (minX === Number.POSITIVE_INFINITY) return null;
    return { left: minX, top: minY, right: maxX, bottom: maxY };
  } catch (e) {
    return null;
  }
}

// --------------- Template layer creator -----------------
function createTemplateTextLayer(doc, usedFont, baseSize) {
  try {
    var t = doc.artLayers.add();
    t.kind = LayerKind.TEXT;
    t.textItem.kind = TextType.PARAGRAPHTEXT;
    try {
      t.textItem.font = usedFont;
    } catch (_e) {}
    try {
      t.textItem.size = baseSize;
    } catch (_e) {}
    try {
      t.textItem.justification = Justification.CENTER;
    } catch (_e) {}
    t.name = "__template_text__";
    t.visible = false;
    return t;
  } catch (e) {
    return null;
  }
}

// دوال مساعدة خفيفة من السكريبت الأصلي (تأكد أن بعض الدوال مثل toNum موجودة في libs)
function trimString(s) {
  try {
    return String(s).replace(/^\s+|\s+$/g, "");
  } catch (e) {
    return String(s);
  }
}

(function () {
  // فتح Notepad في البداية
  try {
    openNotepad();
  } catch (e) {}

  // التحقق من وجود Photoshop
  if (typeof app === "undefined" || !app) {
    return;
  }

  // مسار ملف النص الثابت
  var txtFile = File("C:/Users/abdoh/Downloads/testScript/manga_text.txt");

  // لو الملف غير موجود أنشئه
  if (!txtFile.exists) {
    try {
      txtFile.open("w");
      txtFile.close();
    } catch (e) {
      // continue
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
  var settingsFile = new File(txtFile.path + "/ps_text_settings.json");

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
    "التوقف بعد الصفحة الحالية للتحقق من الخط"
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

  // ====== Logging DISABLED (no-ops) ======
  function L(s) {}
  function E(s) {}

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

  // ابدأ من المستند/الصفحة الحالية بدلاً من البداية
  try {
    var activeDoc = app.activeDocument;
    if (activeDoc) {
      var activeName = activeDoc.name;
      var activePageNum = getPageNumberFromDocName(activeName);
      var startIdx = 0;
      for (var si = 0; si < documentsArray.length; si++) {
        var dn = documentsArray[si].name;
        if (dn === activeName) {
          startIdx = si;
          break;
        }
        var pn = getPageNumberFromDocName(dn);
        if (activePageNum !== null && pn === activePageNum) {
          startIdx = si;
          break;
        }
      }
      if (startIdx > 0) {
        documentsArray = documentsArray.slice(startIdx);
      }
    }
  } catch (_ad) {}

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

    // إعادة تعيين عداد الفقاعات لكل صفحة/مستند لضمان تسلسل محلي داخل الصفحة
    try {
      lastBubbleIndex = 0;
    } catch (_ri) {}

    // تقسيم Work Path إذا وجد
    try {
      splitWorkPathIntoNamedPaths(doc, "bubble_");
    } catch (e) {
      L("Warning: Could not split Work Path: " + e);
    }

    if (!ultraFastMode) L("\n--- Processing document: " + doc.name + " ---");

    var pageNumber = getPageNumberFromDocName(doc.name);

    // استخدام الدالة الجديدة للحصول على المسارات
    var pagePaths = getSmartPathsForPage(doc);
    if (!pagePaths || pagePaths.length === 0) {
      if (!ultraFastMode)
        L("Document '" + doc.name + "' has no valid path items. Skipping.");
      continue;
    }

    // إنشاء template layer واحد لكل مستند (لتسريع إنشاء الليرات)
    var template = null;
    try {
      template = createTemplateTextLayer(doc, defaultFont, baseFontSize);
    } catch (_tld) {
      template = null;
    }

    // استخدام الدالة الجديدة للحصول على بداية النصوص
    var startLineIndex = getSmartTextLinesForPage(
      allLines,
      pageStartIndices,
      pageNumber,
      pageCounter
    );

    // استخدام الدالة الجديدة لمطابقة المسارات مع النصوص
    var matchResult = matchPathsWithTexts(
      pagePaths,
      allLines,
      startLineIndex,
      L
    );
    var pathTextMatches = matchResult.matches;
    lineIndex = matchResult.nextLineIndex;

    var lastUsedFont = null;
    var lastFontSize = baseFontSize;
    var lastWasBracketTag = false;

    // ====== معالجة المطابقات ======
    for (var k = 0; k < pathTextMatches.length; k++) {
      var match = pathTextMatches[k];
      var pathItem = match.pathItem;
      var lineText = match.lineText;
      var pathName = "(unknown)";

      try {
        pathName = pathItem.name;
      } catch (e) {}

      var smartIdx = (function () {
        try {
          return pathItem._smartIndex;
        } catch (_e) {
          return undefined;
        }
      })();
      var entryPrefix =
        "File=" +
        doc.name +
        " | BubbleIndex=" +
        (match.pathIndex + 1) +
        (smartIdx !== undefined ? (" | SmartIndex=" + smartIdx) : "") +
        " | PathName=" +
        pathName +
        " | LineIndex=" +
        match.lineIndex;
      if (!ultraFastMode) L("\n" + entryPrefix);

      // في وضع السرعة، نحتفظ بمنطق تغيير الخطوط ولكن نبسط باقي العمليات
      var isBracketTag = false;
      var isOTTag = false;
      var inheritPrevFont = false;

      // ensure strokeInfo exists (used later)
      var strokeInfo = { needed: false, text: lineText };

      if (ultraFastMode) {
        // تاجات سريعة
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
        try {
          var _strokeInfo = parseStrokeTag(lineText);
          strokeInfo = _strokeInfo || strokeInfo;
        } catch (_si) {}

        try {
          if (/^\/\/:?/.test(lineText)) {
            inheritPrevFont = true;
            lineText = trimString(String(lineText).replace(/^\/\/:?\s*/, ""));
          }
        } catch (_ih) {}

        try {
          var bMatch = String(lineText).match(/^\s*\[\s*\]\s*:?.*/);
          if (bMatch) {
            isBracketTag = true;
          }
        } catch (_bt) {}

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
            (match.pathIndex + 1) +
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
        var wantedFont = defaultFont;

        var fontResult = findFontInCompiledMap(lineText, compiledFontIndex);
        if (fontResult.found) {
          wantedFont = fontResult.font;
          lineText = trimString(lineText.substring(fontResult.key.length));
        }

        if (wantedFont === defaultFont && /^\s*ST\s*:?\s*/.test(lineText)) {
          for (var key in fontMap) {
            if (key.toLowerCase() === "st" || key.toLowerCase() === "st:") {
              wantedFont = fontMap[key];
              lineText = lineText.replace(/^\s*ST\s*:?\s*/, "");
              break;
            }
          }
        }

        if (isBracketTag) {
          lineText = lineText.replace(/^\s*\[\s*\]\s*:?\s*/, "");
        }
        if (isOTTag) {
          lineText = lineText.replace(/^\s*(?:OT|Ot)\s*:?\s*/, "");
        }

        usedFont = wantedFont; // لا نتحقق هنا لتسريع العملية
        curFontSize = baseFontSize;
      } else {
        if (inheritPrevFont) {
          usedFont = lastUsedFont || defaultFont;
          curFontSize = lastFontSize || baseFontSize;
        } else {
          var wantedFont2 = defaultFont;
          var fontResult2 = findFontInCompiledMap(lineText, compiledFontIndex);
          if (fontResult2.found) {
            wantedFont2 = fontResult2.font;
            if (!isOTTag) {
              lineText = trimString(lineText.substring(fontResult2.key.length));
            }
          }

          usedFont = getValidFontCached(wantedFont2, defaultFont);
          curFontSize = baseFontSize;
        }
      }

      // خاصية خاصة لفريق rezo مع خط CCShoutOutGSN - زيادة حجم الخط بـ 10 نقاط
      if (currentTeam === "rezo" && usedFont === "CCShoutOutGSN") {
        curFontSize = curFontSize + 10;
      }

      try {
        // محاولة حساب حدود المسار بدون تفعيل selection (أسرع)
        var selBounds = null;
        try {
          var pb = getPathBoundsFromPoints(pathItem);
          if (pb) {
            selBounds = [pb.left, pb.top, pb.right, pb.bottom];
          }
        } catch (_e) {
          selBounds = null;
        }

        var usedSelection = false;
        if (!selBounds) {
          try {
            pathItem.makeSelection();
            if (doc.selection && doc.selection.bounds) {
              selBounds = doc.selection.bounds;
              usedSelection = true;
            }
          } catch (_selErr) {
            selBounds = null;
          }
        }

        if (!selBounds) {
          throw new Error("No valid selection or path bounds for path: " + pathName);
        }

        var x1 = toNum(selBounds[0]),
          y1 = toNum(selBounds[1]),
          x2 = toNum(selBounds[2]),
          y2 = toNum(selBounds[3]);
        var w = x2 - x1,
          h = y2 - y1;

        var boxWidth = Math.max(10, w * (1 - boxPaddingRatio));
        var boxHeight = Math.max(10, h * (1 - boxPaddingRatio));
        var centerX = (x1 + x2) / 2;
        var centerY = (y1 + y2) / 2;

        var textLength = lineText.length;
        var padding = Math.max(
          2,
          Math.min(8, Math.min(boxWidth, boxHeight) * 0.03)
        );
        var availableWidth = Math.max(10, boxWidth - padding * 2);
        var availableHeight = Math.max(10, boxHeight - padding * 2);

        var newFontSize = curFontSize;

        // استعمل template duplicate إن أمكن
        var textLayer = null;
        try {
          if (template) {
            textLayer = template.duplicate();
            textLayer.visible = true;
          } else {
            throw "no template";
          }
        } catch (_dupErr) {
          // fallback: إنشاء طبقة جديدة
          textLayer = doc.artLayers.add();
          textLayer.kind = LayerKind.TEXT;
        }

        if (!textLayer.textItem) {
          throw new Error("Failed to create text item for path: " + pathName);
        }

        // تعيين النص والسمات الأساسية
        textLayer.textItem.kind = TextType.PARAGRAPHTEXT;
        textLayer.textItem.contents = lineText;
        try {
          textLayer.textItem.font = usedFont;
        } catch (_e) {}
        try {
          textLayer.textItem.size = newFontSize;
        } catch (_e) {}
        try {
          textLayer.textItem.justification = Justification.CENTER;
        } catch (_e) {}

        // تطبيق تنسيقات سريعة أو كاملة حسب الوضع
        if (!ultraFastMode) {
          optimizeFontSettings(textLayer, usedFont, newFontSize);

          if (isBracketTag || (inheritPrevFont && lastWasBracketTag)) {
            textLayer.textItem.tracking = 0;
            textLayer.textItem.leading = Math.round(newFontSize * 1.0);
            textLayer.textItem.antiAliasMethod = AntiAlias.SMOOTH;
            textLayer.textItem.autoKerning = AutoKernType.OPTICAL;
            textLayer.textItem.fauxBold = true;
            textLayer.textItem.capitalization = TextCase.ALLCAPS;
          }

          if (isOTTag) {
            textLayer.textItem.capitalization = TextCase.ALLCAPS;
          }
        } else {
          // UltraFast: أبسط الإعدادات
          try {
            textLayer.textItem.antiAliasMethod = AntiAlias.SMOOTH;
          } catch (_e) {}
          if (isBracketTag) {
            try {
              textLayer.textItem.tracking = 0;
              textLayer.textItem.leading = Math.round(newFontSize * 1.0);
              textLayer.textItem.autoKerning = AutoKernType.OPTICAL;
              textLayer.textItem.fauxBold = true;
              textLayer.textItem.capitalization = TextCase.ALLCAPS;
            } catch (_e) {}
          }
          if (isOTTag) {
            try {
              textLayer.textItem.capitalization = TextCase.ALLCAPS;
            } catch (_e) {}
          }
        }

        var startLeft = centerX - availableWidth / 2;
        var startTop =
          centerY -
          availableHeight / 2 -
          newFontSize * verticalCenterCompensationRatio;
        try {
          textLayer.textItem.width = availableWidth;
          textLayer.textItem.height = availableHeight;
        } catch (_e) {}
        try {
          textLayer.textItem.position = [startLeft, startTop];
        } catch (_e) {}

        // ضبط اللون: في UltraFast نتجنبه لصالح لون افتراضي
        if (!ultraFastMode) {
          var tlWasVisible = textLayer.visible;
          textLayer.visible = false;
          try {
            var centerRgb = samplePixel(doc, centerX, centerY);
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
          } catch (_sp) {
            // fallback: default black
            var fallbackColor = new SolidColor();
            fallbackColor.rgb.red = 0;
            fallbackColor.rgb.green = 0;
            fallbackColor.rgb.blue = 0;
            try {
              textLayer.textItem.color = fallbackColor;
            } catch (_e) {}
          }
          textLayer.visible = tlWasVisible;
        } else {
          var defaultColor = new SolidColor();
          defaultColor.rgb.red = 0;
          defaultColor.rgb.green = 0;
          defaultColor.rgb.blue = 0;
          try {
            textLayer.textItem.color = defaultColor;
          } catch (_e) {}
        }

        // التوسيط: في UltraFast نستخدم fallback فقط
        try {
          if (!ultraFastMode) {
            pathItem.makeSelection();
            if (doc.selection && doc.selection.bounds) {
              var centeringResult = centerTextInBubbleWithTail();
              if (!centeringResult) {
                // fallback centering
                var tb = textLayer.bounds;
                var tl = toNum(tb[0]),
                  tt = toNum(tb[1]),
                  tr = toNum(tb[2]),
                  tbm = toNum(tb[3]);
                var cX = (tl + tr) / 2;
                var cY = (tt + tbm) / 2;
                var dxx = centerX - cX;
                var dyy = centerY - cY - newFontSize * verticalCenterCompensationRatio;
                if (Math.abs(dxx) > 0.1 || Math.abs(dyy) > 0.1) {
                  textLayer.translate(dxx, dyy);
                }
              }
            } else {
              // traditional fallback
              var tb2 = textLayer.bounds;
              var tl2 = toNum(tb2[0]),
                tt2 = toNum(tb2[1]),
                tr2 = toNum(tb2[2]),
                tbm2 = toNum(tb2[3]);
              var cX2 = (tl2 + tr2) / 2;
              var cY2 = (tt2 + tbm2) / 2;
              var dxx2 = centerX - cX2;
              var dyy2 = centerY - cY2 - newFontSize * verticalCenterCompensationRatio;
              if (Math.abs(dxx2) > 0.1 || Math.abs(dyy2) > 0.1) {
                textLayer.translate(dxx2, dyy2);
              }
            }
          } else {
            // UltraFast: فقط تعديل بسيط للتوسيط بالنسبة لمركز الصندوق
            var tb3 = textLayer.bounds;
            var tl3 = toNum(tb3[0]),
              tt3 = toNum(tb3[1]),
              tr3 = toNum(tb3[2]),
              tbm3 = toNum(tb3[3]);
            var cX3 = (tl3 + tr3) / 2;
            var cY3 = (tt3 + tbm3) / 2;
            var dxx3 = centerX - cX3;
            var dyy3 = centerY - cY3 - newFontSize * verticalCenterCompensationRatio;
            if (Math.abs(dxx3) > 0.1 || Math.abs(dyy3) > 0.1) {
              textLayer.translate(dxx3, dyy3);
            }
          }
        } catch (centeringError) {
          // ignore centering errors in UltraFast for speed
          try {
            // fallback safe translate based on bounds
            var tbf = textLayer.bounds;
            var tlf = toNum(tbf[0]),
              ttf = toNum(tbf[1]),
              trf = toNum(tbf[2]),
              tbfm = toNum(tbf[3]);
            var cXf = (tlf + trf) / 2;
            var cYf = (ttf + tbfm) / 2;
            var dxxf = centerX - cXf;
            var dyyf = centerY - cYf - newFontSize * verticalCenterCompensationRatio;
            if (Math.abs(dxxf) > 0.1 || Math.abs(dyyf) > 0.1) {
              textLayer.translate(dxxf, dyyf);
            }
          } catch (_e) {}
        }

        // تأثيرات إضافية في الوضع العادي
        if (!fastMode && !ultraFastMode) {
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
          } catch (_e) {}
        }

        if (usedSelection) {
          try {
            doc.selection.deselect();
          } catch (_e) {}
        }

        totalInserted++;

        lastUsedFont = usedFont;
        lastFontSize = newFontSize;
        lastWasBracketTag = isBracketTag;
      } catch (bubbleErr) {
        var errMsg = entryPrefix + " : EXCEPTION : " + bubbleErr.toString();
        E(errMsg);
        totalErrors++;
        try {
          doc.selection.deselect();
        } catch (e2) {}
      }
    }

    // حفظ المستند إذا لم يكن محفوظًا (نؤجل الحفظ إن أمكن لكن نحتفظ بالمنطق الأصلي)
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

    pageCounter++;

    // التوقف بعد الصفحة الأولى إذا تم اختيار هذا الخيار
    if (stopAfterFirstPage && d === 0) {
      L("\n===== توقف بعد الصفحة الحالية =====");
      L("تم الانتهاء من معالجة الصفحة الحالية: " + doc.name);
      L("يمكنك الآن التحقق من النتائج وإعادة تشغيل السكريبت إذا كان مناسباً");
      break; // إيقاف الحلقة والخروج من معالجة المستندات
    }
  }

  try {
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
    