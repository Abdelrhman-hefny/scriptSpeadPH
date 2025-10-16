// // #target photoshop

app.bringToFront();
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

// استخدام الدوال المنظمة من ملفات lib/
var __oldDialogs = app.displayDialogs;
var __oldUnits = app.preferences.rulerUnits;
app.displayDialogs = DialogModes.NO;
try { app.preferences.rulerUnits = Units.PIXELS; } catch(_){}
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
function sampleRgbSafe(doc, x, y) {
  var cs = doc.colorSamplers.add([x, y]);   // ما بيلعبش في الـSelection
  var c = cs.color.rgb;
  var out = [c.red, c.green, c.blue];
  cs.remove();
  return out;
}

var __fontCache = {}; // name -> resolvedName

function getValidFontCached(fontName, fallbackFont) {
  var key = fontName + "||" + (fallbackFont || "");
  if (__fontCache.hasOwnProperty(key)) return __fontCache[key];

  // جرّب مباشرة على لير مؤقت في نفس الدوكيومنت الفعلي (أخف من فتح دوك جديد)
  var tempLayer = app.activeDocument.artLayers.add();
  tempLayer.kind = LayerKind.TEXT;
  tempLayer.textItem.kind = TextType.POINTTEXT;
  tempLayer.textItem.contents = "T";

  var resolved = "Arial";
  try {
    tempLayer.textItem.font = fontName;
    resolved = fontName;
  } catch(_){
    try {
      tempLayer.textItem.font = fallbackFont;
      resolved = fallbackFont;
    } catch(_){
      resolved = "Arial";
    }
  }
  try { tempLayer.remove(); } catch(_){}
  __fontCache[key] = resolved;
  return resolved;
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


function getSTFontFromMap(fontMap, defaultFont) {
  try {
    for (var k in fontMap) {
      if (!fontMap.hasOwnProperty(k)) continue;
      var kk = String(k).toLowerCase();
      if (kk === "st" || kk === "st:") return fontMap[k];
    }
  } catch (_e) {}
  return defaultFont;
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

// كسر السطر الأول فقط بشكل ذكي وفق عرض معيّن (بدون كسر حروف)
function breakFirstLineByWidth(doc, text, fontName, fontSizePt, targetWidthPx) {
  try {
    if (!text) return text;
    // لا نعبث بالنص إذا كان يحتوي على كسر أسطر مسبقًا
    if (/\r|\n/.test(text)) return text;

    // قسّم حسب المسافات فقط حتى لا نكسر الحروف
    var words = String(text).split(/(\s+)/); // يشمل الفواصل البيضاء للحفاظ على المسافات
    if (words.length <= 1) return text;

    // أنشئ طبقة مؤقتة لقياس العرض الفعلي للنص بالنمط والخط المطلوبين
    var tempLayer = doc.artLayers.add();
    tempLayer.kind = LayerKind.TEXT;
    tempLayer.textItem.kind = TextType.POINTTEXT;
    tempLayer.textItem.font = fontName;
    tempLayer.textItem.size = fontSizePt;
    tempLayer.textItem.justification = Justification.CENTER;

    // نبني السطر الأول تدريجيًا حتى نقترب من الهدف
    var firstLine = "";
    var built = "";
    for (var i = 0; i < words.length; i++) {
      var candidate = built + words[i];
      tempLayer.textItem.contents = candidate || "";
      var b = tempLayer.bounds;
      var cw = Math.max(0, toNum(b[2]) - toNum(b[0]));
      if (cw > targetWidthPx && built) {
        // تجاوزنا العرض المستهدف، نتوقف عند البُنية السابقة
        firstLine = built;
        break;
      }
      built = candidate;
    }

    // لم نتجاوز الهدف أبدًا — اجعل أول سطر أقل بقليل عبر قصٍ محفوظ
    if (!firstLine) {
      // تقدير طول مقارب: متوسط عرض الحرف ~ 0.55 من حجم النقطة
      var approxChars = Math.max(
        1,
        Math.floor(targetWidthPx / Math.max(1, fontSizePt * 0.55))
      );
      // حاول القطع عند أول حد كلمة قبل هذا العدد التقريبي
      var acc = "";
      for (var j = 0; j < words.length; j++) {
        var nacc = acc + words[j];
        if (nacc.replace(/\s+/g, " ").length > approxChars) break;
        acc = nacc;
      }
      firstLine = acc || built;
    }

    // تنظيف المسافات الطرفية
    firstLine = trimString(firstLine);
    if (!firstLine) {
      tempLayer.remove();
      return text;
    }

    // بقية النص بعد السطر الأول
    var rest = trimString(String(text).substring(firstLine.length));
    tempLayer.remove();

    if (!rest) return text; // لا داعي للكسر إن لم توجد بقية
    return firstLine + "\r" + rest; // كسر سطر أول فقط
  } catch (_e) {
    // في حال أي خطأ، أعد النص دون تعديل
    try {
      if (tempLayer) tempLayer.remove();
    } catch (_ee) {}
    return text;
  }
}

// دالة جديدة لإدارة المسارات بشكل ذكي
// عداد عام للباثات ليضمن تسلسلًا خطيًا ثابتًا عبر كل الصفحات أثناء التشغيل
var lastBubbleIndex = 0;
function getSmartPathsForPage(doc) {
  var paths = doc.pathItems;
  if (!paths || paths.length === 0) {
    return [];
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
        // منح المسار رقمًا تسلسليًا ثابتًا أثناء هذا التشغيل
        lastBubbleIndex++;
        try {
          pi._smartIndex = lastBubbleIndex;
        } catch (_e) {
          // تجاهل أخطاء التعيين إذا حدثت
        }
        pagePaths.push(pi);
      }
    }
  }

  // ترتيب المسارات حسب الرقم التسلسلي الممنوح بدلًا من اسم المسار
  pagePaths.sort(function (a, b) {
    var na = typeof a._smartIndex === "number" ? a._smartIndex : 999999;
    var nb = typeof b._smartIndex === "number" ? b._smartIndex : 999999;
    return na - nb;
  });

  return pagePaths;
}

// دالة جديدة لإدارة النصوص بشكل ذكي
function getSmartTextLinesForPage(
  allLines,
  pageStartIndices,
  pageNumber,
  pageCounter
) {
  var lineIndex;

  if (
    pageNumber !== null &&
    pageNumber > 0 &&
    pageNumber <= pageStartIndices.length
  ) {
    lineIndex = pageStartIndices[pageNumber - 1];
  } else {
    lineIndex =
      pageCounter < pageStartIndices.length ? pageStartIndices[pageCounter] : 0;
  }

  return lineIndex;
}

// دالة جديدة لمطابقة المسارات مع النصوص بشكل ذكي
function matchPathsWithTexts(pagePaths, allLines, startLineIndex, L) {
  var matches = [];
  var lineIndex = startLineIndex;

  L("=== Smart Path-Text Matching ===");
  L("Available paths: " + pagePaths.length);
  L("Available text lines: " + (allLines.length - lineIndex));

  // إذا كان عدد المسارات أكبر من النصوص المتاحة
  if (pagePaths.length > allLines.length - lineIndex) {
    L("⚠️  More paths than text lines available!");
    L("Will use available text lines only, remaining paths will be skipped.");
  }

  // إذا كان عدد النصوص أكبر من المسارات
  if (allLines.length - lineIndex > pagePaths.length) {
    L("⚠️  More text lines than paths available!");
    L("Will use available paths only, remaining text lines will be skipped.");
  }

  var maxMatches = Math.min(pagePaths.length, allLines.length - lineIndex);

  for (var i = 0; i < maxMatches; i++) {
    if (lineIndex >= allLines.length) break;

    var pathItem = pagePaths[i];
    var lineText = allLines[lineIndex];

    matches.push({
      pathItem: pathItem,
      lineText: lineText,
      pathIndex: i,
      lineIndex: lineIndex,
    });

    lineIndex++;
  }

  L("Successfully matched: " + matches.length + " path-text pairs");

  return {
    matches: matches,
    nextLineIndex: lineIndex,
  };
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

  // إعداد المسارات
  var basePath = "C:/Users/abdoh/Downloads/testScript/";
  var configFile = File(basePath + "config/temp-title.json");
  var foldersFile = File(basePath + "config/folders.json");

  // دالة لقراءة JSON
  function readJSON(file) {
    if (!file.exists) return null;
    try {
      file.open("r");
      var content = JSON.parse(file.read());
      file.close();
      return content;
    } catch (e) {
      return null;
    }
  }

  // المنطق الرئيسي
  var cfg = readJSON(configFile);
  if (!cfg) {
    alert("⚠ لا يمكن قراءة temp-title.json");
  } else {
    var txtFile = File(basePath + "manga_text.txt"); // افتراضي

    if (cfg.autoNext === true) {
      var folders = readJSON(foldersFile);
      if (folders && folders.folders && folders.folders.length > 0) {
        for (var i = 0; i < folders.folders.length; i++) {
          if (folders.folders[i].id === cfg.title) {
            var found = folders.folders[i];
            // احصل على المجلد الأب (اللي يحتوي مجلد 01 مثلاً)
            var parentFolder = Folder(found.path).parent;

            // ابنِ المسار الجديد بحيث يكون بجانب المجلد
            txtFile = File(parentFolder.fsName + "/" + found.txt_file);

            break;
          }
        }
      }
    }
  }

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
  var settingsFile = new File(txtFile.path + "/config/ps_text_settings.json");

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

    // حفظ الإعدادات في الملف
    try {
      var toSave = {
        teamIndex: chosenTeamIdx,
        lastBaseFontSize: baseFontSize,
        ultraFastMode: ultraFastMode,
        fastMode: fastMode,
        stopAfterFirstPage: stopAfterFirstPage,
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

  // قراءة ملف الإعدادات
  var tempSettingsFile = File(
    "C:/Users/abdoh/Downloads/testScript/config/temp-title.json"
  );
  var continueWithoutDialog = false;
  var jsonSettings = null;

  if (tempSettingsFile.exists) {
    tempSettingsFile.open("r");
    var jsonText = tempSettingsFile.read();
    tempSettingsFile.close();
    try {
      jsonSettings = JSON.parse(jsonText);
      continueWithoutDialog = jsonSettings.continueWithoutDialog === true;
    } catch (e) {
      $.writeln("⚠️ خطأ في قراءة ملف الإعدادات: " + e);
    }
  }

  // لو continueWithoutDialog = true ناخد القيم من JSON مباشرة
  if (continueWithoutDialog && jsonSettings) {
    $.writeln("✅ التشغيل بدون دايالوج (continueWithoutDialog = true)");

    // استبدال القيم
    chosenTeamIdx = 0; // افتراضيًا أول فريق
    for (var i = 0; i < teamNames.length; i++) {
      if (teamNames[i].toLowerCase() === jsonSettings.team.toLowerCase()) {
        chosenTeamIdx = i;
        break;
      }
    }

    baseFontSize = parseInt(jsonSettings.fontSize, 10) || 30;
    stopAfterFirstPage = jsonSettings.stopAfterFirstPage === true;

    // وضع السرعة بناءً على mode
    ultraFastMode = jsonSettings.mode === "ultra";
    fastMode = jsonSettings.mode === "fast" || jsonSettings.mode === "normal";

    $.writeln("📘 الفريق: " + teamNames[chosenTeamIdx]);
    $.writeln("🔤 حجم الخط: " + baseFontSize);
    $.writeln("⏹️ توقف بعد أول صفحة: " + stopAfterFirstPage);
    $.writeln(
      "⚡ وضع السرعة: " +
        (ultraFastMode ? "Ultra" : fastMode ? "Fast" : "Normal")
    );
  } else {
    // عرض الدايالوج لو continueWithoutDialog = false
    settingsDialog.show();
    if (dialogResult !== true) {
      return; // المستخدم لغى
    }
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
  // فريق EZ: تطبيق قواعد scale أفقية خاصة بناءً على البادئة
  var isEzTeam = /^(ez japan|ez scan)$/i.test(currentTeam);

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
  // تقليل اللوج لأقصى حد: لا نضيف أي لوج أثناء التشغيل، ونحتفظ فقط بالأخطاء
  function L(_s) {}
  function E(s) {
    errors.push(s);
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

  // تقليل/تعطيل الUndo: اجعل عدد حالات التاريخ 1 طيلة التنفيذ ثم أعِدها لاحقًا
// قبل اللوب
var __prevHistoryStates;
try { __prevHistoryStates = app.preferences.numberOfHistoryStates; } catch(_){}
try { app.preferences.numberOfHistoryStates = 1; } catch(_){}

// .. وبالنهاية ارجع للقيمة القديمة
try {
  if (__prevHistoryStates !== undefined)
    app.preferences.numberOfHistoryStates = __prevHistoryStates;
} catch(_){}


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
      var originalLineText = match.lineText; // احتفظ بالنص الأصلي لاكتشاف البادئة
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
        (smartIdx !== undefined ? " | SmartIndex=" + smartIdx : "") +
        " | PathName=" +
        pathName +
        " | LineIndex=" +
        match.lineIndex;
      if (!ultraFastMode) L("\n" + entryPrefix);

      // في وضع السرعة، نحتفظ بمنطق تغيير الخطوط ولكن نبسط باقي العمليات
      var isBracketTag = false;
      var isOTTag = false;
      var inheritPrevFont = false;
      var isSTTag = /^\s*ST\s*:?\s*/.test(originalLineText || "");
      var matchedPrefixKey = null; // سنملؤها عند مطابقة fontMap

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
        // في وضع السرعة، نحتفظ بمنطق تغيير الخطوط بناءً على المفاتيح
        var wantedFont = defaultFont;

        // فحص مفاتيح الخطوط وحذفها باستخدام الدالة الجديدة
        var fontResult = findFontInCompiledMap(lineText, compiledFontIndex);
        if (fontResult.found) {
          wantedFont = fontResult.font;
          matchedPrefixKey = fontResult.key;
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
      
          if (isSTTag) {
            // WHY: parseStrokeTag شال ST: من lineText، فلازم نفرض خط ST هنا يدويًا
            wantedFont = getSTFontFromMap(fontMap, defaultFont);
            // لا تحاول أي مفاتيح تانية لسطر ST
          } else {
            // مفاتيح الخطوط الأخرى ("" , (), <> , ...etc)
            var fontResult = findFontInCompiledMap(lineText, compiledFontIndex);
            if (fontResult.found) {
              wantedFont = fontResult.font;
              matchedPrefixKey = fontResult.key;
              if (!isOTTag) {
                lineText = trimString(lineText.substring(fontResult.key.length));
              }
            }
          }
      
          usedFont = getValidFontCached(wantedFont, defaultFont);
          curFontSize = baseFontSize;
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
        // var newFontSize = curFontSize;
        var newFontSize = baseFontSize;

        // تخفيف breakFirstLineByWidth للصفحات الطويلة: تقريب سريع بدون قياس مكثف
        try {
          if (textLength > 25) {
            var approxChars = Math.max(
              5,
              Math.floor(availableWidth / Math.max(1, newFontSize * 0.6))
            );
            var words = String(lineText).split(/(\s+)/);
            var acc = "";
            for (var wi = 0; wi < words.length; wi++) {
              var tentative = acc + words[wi];
              if (tentative.replace(/\s+/g, " ").length > approxChars) break;
              acc = tentative;
            }
            if (acc && acc.length < lineText.length) {
              lineText =
                acc + "\r" + trimString(lineText.substring(acc.length));
            }
          }
        } catch (_br) {}

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

        // تطبيق horizontalScale خاص لفريق EZ بناءً على البادئة
        if (isEzTeam) {
          try {
            var keyForScale = matchedPrefixKey || "";
            // طبّق 97% إذا كان ST: (حتى لو لم تكن في fontMap)
            if (isSTTag) {
              textLayer.textItem.horizontalScale = 97;
            } else if (
              /^\s*(["“”]{2}:?|\(\):?)/.test(originalLineText || "") ||
              keyForScale === '""' ||
              keyForScale === '"":' ||
              keyForScale === "““" ||
              keyForScale === "““:" ||
              keyForScale === "()" ||
              keyForScale === "():"
            ) {
              textLayer.textItem.horizontalScale = 95;
            } else if (
              /^\s*<>:?/.test(originalLineText || "") ||
              keyForScale === "<>" ||
              keyForScale === "<>:"
            ) {
              textLayer.textItem.horizontalScale = 90;
            }
          } catch (_hs) {}
        }

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

        
// ===== لون النص مع استثناء ST =====
// ===== لون النص مع استثناء ST =====
var black = new SolidColor();
black.rgb.red = 0;
black.rgb.green = 0;
black.rgb.blue = 0;

if (isSTTag) {
  // ST: دايمًا أسود — تجاهل فحص الخلفية
  textLayer.textItem.color = black;

  // ✅ إضافة ستروك للـ ST في كل الأوضاع (حتى Ultra Fast)
  try {
    applyWhiteStroke3px(textLayer);
  } catch (_e) {}
} else {
  if (!ultraFastMode) {
    // باقي الأنواع: لون ذكي حسب الخلفية
    var textColor = getOptimalTextColor(doc, centerX, centerY);
    textLayer.textItem.color = textColor;
    if (strokeInfo && strokeInfo.needed) {
      applyWhiteStroke3px(textLayer);
    }
  } else {
    // Ultra Fast: أسود افتراضي للجميع
    textLayer.textItem.color = black;
  }
}
 



        // تطبيق التوسيط المحسن باستخدام دالة TyperTools
        // أولاً: التأكد من وجود selection على الباث
        try {
          pathItem.makeSelection();
          if (doc.selection && doc.selection.bounds) {
            // استدعاء دالة التوسيط المحسنة من bubble_text_centering_solution.jsx
            var centeringResult = centerTextInBubbleWithTail();

            if (centeringResult) {
              if (!ultraFastMode) {
                L(
                  "  >>> Text centered using TyperTools method with tail consideration"
                );
              }
            } else {
              // في حالة فشل التوسيط، نطبق التوسيط التقليدي كبديل
              var tb = textLayer.bounds;
              var tl = toNum(tb[0]),
                tt = toNum(tb[1]),
                tr = toNum(tb[2]),
                tbm = toNum(tb[3]);
              var cX = (tl + tr) / 2;
              var cY = (tt + tbm) / 2;
              var dxx = centerX - cX;
              var dyy =
                centerY - cY - newFontSize * verticalCenterCompensationRatio;

              if (Math.abs(dxx) > 0.1 || Math.abs(dyy) > 0.1) {
                textLayer.translate(dxx, dyy);
                if (!ultraFastMode) {
                  L(
                    "  >>> Fallback centering applied: dx=" +
                      Math.round(dxx) +
                      " dy=" +
                      Math.round(dyy)
                  );
                }
              }
            }
          } else {
            // في حالة عدم وجود selection، نطبق التوسيط التقليدي
            var tb = textLayer.bounds;
            var tl = toNum(tb[0]),
              tt = toNum(tb[1]),
              tr = toNum(tb[2]),
              tbm = toNum(tb[3]);
            var cX = (tl + tr) / 2;
            var cY = (tt + tbm) / 2;
            var dxx = centerX - cX;
            var dyy =
              centerY - cY - newFontSize * verticalCenterCompensationRatio;

            if (Math.abs(dxx) > 0.1 || Math.abs(dyy) > 0.1) {
              textLayer.translate(dxx, dyy);
              if (!ultraFastMode) {
                L(
                  "  >>> Traditional centering applied (no selection): dx=" +
                    Math.round(dxx) +
                    " dy=" +
                    Math.round(dyy)
                );
              }
            }
          }
        } catch (centeringError) {
          // في حالة حدوث خطأ، نطبق التوسيط التقليدي
          var tb = textLayer.bounds;
          var tl = toNum(tb[0]),
            tt = toNum(tb[1]),
            tr = toNum(tb[2]),
            tbm = toNum(tb[3]);
          var cX = (tl + tr) / 2;
          var cY = (tt + tbm) / 2;
          var dxx = centerX - cX;
          var dyy =
            centerY - cY - newFontSize * verticalCenterCompensationRatio;

          if (Math.abs(dxx) > 0.1 || Math.abs(dyy) > 0.1) {
            textLayer.translate(dxx, dyy);
            if (!ultraFastMode) {
              L(
                "  >>> Error in centering, fallback applied: " +
                  centeringError.message
              );
            }
          }
        }

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
            match.lineIndex +
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
// === 1) وسّط أولاً ===
pathItem.makeSelection();
var centered = false;
try { centered = centerTextInBubbleWithTail(); } catch(_) {}
if (!centered) {
  var tb = textLayer.bounds;
  var cx = (toNum(tb[0]) + toNum(tb[2]))/2;
  var cy = (toNum(tb[1]) + toNum(tb[3]))/2;
  var dxx = centerX - cx;
  var dyy = centerY - cy - newFontSize * verticalCenterCompensationRatio;
  if (Math.abs(dxx) > 0.1 || Math.abs(dyy) > 0.1) textLayer.translate(dxx, dyy);
}

// === 2) بعد ما اتوسّط.. لوّن بقى ===
if (!ultraFastMode) {
  var wasVisible = textLayer.visible; textLayer.visible = false;
  var centerRgb = sampleRgbSafe(doc, centerX, centerY); // ← استخدم الدالة الجديدة
  textLayer.visible = wasVisible;

  var centerBright = luminance(centerRgb[0], centerRgb[1], centerRgb[2]);
  var textColor = new SolidColor();
  if (centerBright < 128) { textColor.rgb.red=255; textColor.rgb.green=255; textColor.rgb.blue=255; }
  else { textColor.rgb.red=0; textColor.rgb.green=0; textColor.rgb.blue=0; }
  textLayer.textItem.color = textColor;

  if (strokeInfo && strokeInfo.needed) applyWhiteStroke3px(textLayer);
} else {
  var black = new SolidColor(); black.rgb.red=0; black.rgb.green=0; black.rgb.blue=0;
  textLayer.textItem.color = black;
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

    // تفريغ التاريخ بعد إنهاء المستند لتقليل الذاكرة ومنع الUndo
    try {
      app.purge(PurgeTarget.HISTORYCACHES);
    } catch (_pg) {}

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
  } catch (e) {
    alert("حدث خطأ: " + e);
  }

  // === قراءة ملف الإعدادات ===
  tempSettingsFile.encoding = "UTF8";
  tempSettingsFile.open("r");
  var config = JSON.parse(tempSettingsFile.read());
  tempSettingsFile.close();

  // === تحقق من قيمة autoNext ===
  if (config.autoNext === true) {
    // حفظ وإغلاق جميع المستندات المفتوحة
    for (var i = app.documents.length - 1; i >= 0; i--) {
      var doc = app.documents[i];
      try {
        // لو الملف متعدل نحفظه قبل الإغلاق
        if (doc.saved === false) {
          doc.save();
        }
        doc.close(SaveOptions.SAVECHANGES);
      } catch (e) {
        $.writeln("⚠️ خطأ أثناء إغلاق الملف: " + e);
      }
    }

    $.writeln("✅ تم حفظ وإغلاق جميع الملفات لأن autoNext = true");
  } else {
    $.writeln("ℹ️ autoNext = false → لم يتم إغلاق أي ملفات");
  }

  // تحديد مسار سكريبت بايثون
  //  var scriptPath = "C:\\Users\\abdoh\\Downloads\\testScript\\python\\auto_next.py";

  // تنفيذ الأمر
  // // تشغيل البايثون مع نافذة CMD ظاهرة
  // var cmd = 'cmd /k "python ' + scriptPath + '"';
  // app.system(cmd);

  // === تعديل continueWithoutDialog وحفظ الملف ===
  try {
    config.continueWithoutDialog = false; // تعديل القيمة في كائن JSON
    tempSettingsFile.encoding = "UTF8";
    tempSettingsFile.open("w");
    tempSettingsFile.write(JSON.stringify(config, null, 2)); // كتابة الكائن مع تنسيق جميل
    tempSettingsFile.close();
    $.writeln("✅ تم تعيين continueWithoutDialog إلى false وحفظ الملف");
  } catch (e) {
    $.writeln("⚠️ خطأ أثناء حفظ ملف temp-title.json: " + e);
  }

  // إعادة ضبط عدد حالات التاريخ كما كان
  try {
    if (__prevHistoryStates !== undefined)
      app.preferences.numberOfHistoryStates = __prevHistoryStates;
  } catch (_rh) {}
  // .. وفي الآخر رجّعهم
try { app.displayDialogs = __oldDialogs; } catch(_){}
try { app.preferences.rulerUnits = __oldUnits; } catch(_){}

})(); 

// يسسيبينملالكيابميستب