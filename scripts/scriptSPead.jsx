// #target photoshop
app.bringToFront();
$.evalFile("C:/Users/abdoh/Downloads/testScript/config/json2.js");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/psHelpers.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/textReader.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/teamLoader.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/splitSubpaths.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/fileUtils.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/colorUtils.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/textFX.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/bubble_text_centering_solution.jsx");

// ===== JSON (OLD SAFE READER) =====
function parseJSONSafe(s) {
  s = String(s || "").replace(/^\uFEFF/, ""); // strip BOM
  if (typeof JSON !== "undefined" && JSON.parse) {
    try { return JSON.parse(s); } catch (e) {}
  }
  try { return eval("(" + s + ")"); } catch (e2) { return null; } // tolerates // and trailing commas
}
function readJSONFile(file) {
  try {
    if (!file || !file.exists) return null;
    file.encoding = "UTF8";
    if (!file.open("r")) return null;
    var raw = file.read();
    file.close();
    return parseJSONSafe(raw);
  } catch (e) { return null; }
}

// Utility: read page number (e.g., "12.psd" -> 12)
function getPageNumberFromDocName(docName) {
  try {
    var m = docName.match(/^(\d+)\.psd$/i);
    return m && m[1] ? parseInt(m[1], 10) : null;
  } catch (e) {
    return null;
  }
}

// Fonts: ensure a font exists; fallback to provided fallback or Arial
function getValidFont(fontName, fallbackFont) {
  try {
    var td = app.documents.add(100, 100, 72, "Font Test", NewDocumentMode.RGB);
    var tl = td.artLayers.add();
    tl.kind = LayerKind.TEXT;
    tl.textItem.contents = "Test";
    try {
      tl.textItem.font = fontName;
      td.close(SaveOptions.DONOTSAVECHANGES);
      return fontName;
    } catch (e) {
      try {
        tl.textItem.font = fallbackFont;
        td.close(SaveOptions.DONOTSAVECHANGES);
        return fallbackFont;
      } catch (e2) {
        td.close(SaveOptions.DONOTSAVECHANGES);
        return "Arial";
      }
    }
  } catch (e) {
    return fallbackFont || "Arial";
  }
}

// Fonts: precompile map keys for fast prefix matching
function buildFontIndex(fontMap) {
  var entries = [];
  for (var k in fontMap) {
    if (!fontMap.hasOwnProperty(k)) continue;
    var raw = String(k),
      arr = raw.indexOf("|") >= 0 ? raw.split("|") : [raw];
    for (var i = 0; i < arr.length; i++) {
      var kk = arr[i];
      if (!kk) continue;
      entries.push({ key: kk, font: fontMap[k] });
    }
  }
  entries.sort(function (a, b) {
    return b.key.length - a.key.length;
  });
  var byFirst = {};
  for (var j = 0; j < entries.length; j++) {
    var f = entries[j],
      ch = f.key.charAt(0);
    if (!byFirst[ch]) byFirst[ch] = [];
    byFirst[ch].push(f);
  }
  return { entries: entries, byFirst: byFirst };
}

// Fonts: find which font key (prefix) matches a line, if any
function findFontInCompiledMap(lineText, compiled) {
  if (!lineText) return { found: false, font: null, key: null };
  var ch = String(lineText).charAt(0),
    list = compiled.byFirst[ch] || compiled.entries;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (lineText.indexOf(e.key) === 0)
      return { found: true, font: e.font, key: e.key };
  }
  return { found: false, font: null, key: null };
}

// Tags: detect stroke-trigger tags and return cleaned text
function parseStrokeTag(line) {
  try {
    var m = String(line).match(
      /^\s*(?:NA:\s*|\*\*:\s*|SFX:\s*|ST:\s*|Ot:\s*|OT:\s*|#\s*)([\s\S]*)$/
    );
    if (m) return { needed: true, text: trimString(m[1]) };
  } catch (_e) {}
  return { needed: false, text: line };
}

// Text layout: split first line by available width (single break heuristic)
function breakFirstLineByWidth(doc, text, fontName, fontSizePt, targetWidthPx) {
  try {
    if (!text) return text;
    if (/\r|\n/.test(text)) return text;
    var words = String(text).split(/(\s+)/);
    if (words.length <= 1) return text;
    var tl = doc.artLayers.add();
    tl.kind = LayerKind.TEXT;
    tl.textItem.kind = TextType.POINTTEXT;
    tl.textItem.font = fontName;
    tl.textItem.size = fontSizePt;
    tl.textItem.justification = Justification.CENTER;
    var firstLine = "",
      built = "";
    for (var i = 0; i < words.length; i++) {
      var cand = built + words[i];
      tl.textItem.contents = cand || "";
      var b = tl.bounds,
        cw = Math.max(0, toNum(b[2]) - toNum(b[0]));
      if (cw > targetWidthPx && built) {
        firstLine = built;
        break;
      }
      built = cand;
    }
    if (!firstLine) {
      var approxChars = Math.max(
        1,
        Math.floor(targetWidthPx / Math.max(1, fontSizePt * 0.55))
      );
      var acc = "";
      for (var j = 0; j < words.length; j++) {
        var nacc = acc + words[j];
        if (nacc.replace(/\s+/g, " ").length > approxChars) break;
        acc = nacc;
      }
      firstLine = acc || built;
    }
    firstLine = trimString(firstLine);
    if (!firstLine) {
      tl.remove();
      return text;
    }
    var rest = trimString(String(text).substring(firstLine.length));
    tl.remove();
    if (!rest) return text;
    return firstLine + "\r" + rest;
  } catch (_e) {
    try {
      if (tl) tl.remove();
    } catch (_ee) {}
    return text;
  }
}

// Paths: stable ordering of valid paths per page (ignore Work Path)
var lastBubbleIndex = 0;
function getSmartPathsForPage(doc) {
  var paths = doc.pathItems;
  if (!paths || paths.length === 0) return [];
  var pagePaths = [],
    n = paths.length;
  for (var p = 0; p < n; p++) {
    var pi = paths[p];
    if (!pi) continue;
    if (pi.name === "Work Path") continue;
    if (pi.subPathItems && pi.subPathItems.length > 0) {
      var sp = pi.subPathItems[0];
      if (sp && sp.pathPoints && sp.pathPoints.length > 1) {
        lastBubbleIndex++;
        try {
          pi._smartIndex = lastBubbleIndex;
        } catch (_e) {}
        pagePaths.push(pi);
      }
    }
  }
  pagePaths.sort(function (a, b) {
    var na = typeof a._smartIndex === "number" ? a._smartIndex : 999999,
      nb = typeof b._smartIndex === "number" ? b._smartIndex : 999999;
    return na - nb;
  });
  return pagePaths;
}

/* ============================================================
   Helpers لكشف وجود Text داخل مستطيل الباث (لتفادي التكرار)
   ============================================================ */
function _rectFromBounds(b) {
  return { l: toNum(b[0]), t: toNum(b[1]), r: toNum(b[2]), b: toNum(b[3]) };
}
function _rectArea(R) {
  return Math.max(0, R.r - R.l) * Math.max(0, R.b - R.t);
}
function _interArea(A, B) {
  var l = Math.max(A.l, B.l), t = Math.max(A.t, B.t);
  var r = Math.min(A.r, B.r), b = Math.min(A.b, B.b);
  return Math.max(0, r - l) * Math.max(0, b - t);
}
function _hasVisibleTextIntersecting(doc, rect, minOverlapRatio) {
  var thr = (minOverlapRatio == null) ? 0.12 : minOverlapRatio; // 12%
  function _walk(container) {
    var Ls;
    try { Ls = container.layers; } catch (e) { return false; }
    for (var i = 0; i < Ls.length; i++) {
      var lyr = Ls[i];
      try { if (!lyr.visible) continue; } catch (e1) {}
      if (lyr.typename === "ArtLayer") {
        try {
          if (lyr.kind === LayerKind.TEXT) {
            var lb = lyr.bounds, R = _rectFromBounds(lb);
            var inter = _interArea(rect, R);
            var ratio = inter / Math.max(1, _rectArea(rect));
            if (inter > 0 && ratio >= thr) return true;
          }
        } catch (e2) {}
      } else if (lyr.typename === "LayerSet") {
        if (_walk(lyr)) return true;
      }
    }
    return false;
  }
  return _walk(doc);
}

// Text paging: pick starting line index for current page
function getSmartTextLinesForPage(
  allLines,
  pageStartIndices,
  pageNumber,
  pageCounter
) {
  var li;
  if (
    pageNumber !== null &&
    pageNumber > 0 &&
    pageNumber <= pageStartIndices.length
  ) {
    li = pageStartIndices[pageNumber - 1];
  } else {
    li =
      pageCounter < pageStartIndices.length ? pageStartIndices[pageCounter] : 0;
  }
  return li;
}

// Matching: pair each path with one text line (1:1, sequential)
function matchPathsWithTexts(pagePaths, allLines, startLineIndex, L) {
  var matches = [],
    lineIndex = startLineIndex,
    maxMatches = Math.min(pagePaths.length, allLines.length - lineIndex);
  for (var i = 0; i < maxMatches; i++) {
    if (lineIndex >= allLines.length) break;
    matches.push({
      pathItem: pagePaths[i],
      lineText: allLines[lineIndex],
      pathIndex: i,
      lineIndex: lineIndex,
    });
    lineIndex++;
  }
  return { matches: matches, nextLineIndex: lineIndex };
}

// Helper: ensure manga_text.txt exists then open it in Notepad
function openNotepad() {
  try {
    var p = "C:/Users/abdoh/Downloads/testScript/manga_text.txt",
      f = new File(p);
    if (!f.exists) {
      f.open("w");
      f.writeln("// Paste your text here. Use 'page 1' to mark the start of page 1");
      f.writeln("// Example:");
      f.writeln("page 1");
      f.writeln("Hello, world!");
      f.writeln("st:Action text");
      f.writeln("page 2");
      f.writeln("SFX:Boom!");
      f.close();
    }
    f.execute();
  } catch (e) {
    alert("Error opening Notepad: " + e);
  }
}

// MAIN
(function () {
  openNotepad();
  if (typeof app === "undefined" || !app) return;

  // Config I/O (ABSOLUTE PATHS)
  var basePath = "C:/Users/abdoh/Downloads/testScript/",
      configFile = File(basePath + "config/temp-title.json"),
      foldersFile = File(basePath + "config/folders.json");

  // ⬇️ استبدلنا القراءة هنا
  var cfg = readJSONFile(configFile),
      txtFile = File(basePath + "manga_text.txt");

  if (!cfg) {
    alert("Cannot read temp-title.json");
  } else if (cfg.autoNext === true) {
    var folders = readJSONFile(foldersFile);
    if (folders && folders.folders && folders.folders.length > 0) {
      for (var i = 0; i < folders.folders.length; i++) {
        if (folders.folders[i].id === cfg.title) {
          var found = folders.folders[i],
              parentFolder = Folder(found.path).parent;
          txtFile = File(parentFolder.fsName + "/" + found.txt_file);
          break;
        }
      }
    }
  }
  if (!txtFile.exists) { try { txtFile.open("w"); txtFile.close(); } catch (e) { return; } }

  // Load team settings
  var teams;
  try {
    teams = loadTeams(File("C:/Users/abdoh/Downloads/testScript/config/teams.json"));
  } catch (e) {
    return;
  }
  var settingsFile = new File(txtFile.path + "/config/ps_text_settings.json"),
      teamNames = getTeamNames(teams),
      settingsPath = Folder.myDocuments + "/waterMark/lastChoice.txt",
      lastTeamIdx = 0;

  // اقرأ الإعدادات بالطريقة القديمة لو كانت JSON
  try {
    if (settingsFile.exists) {
      var sobj = readJSONFile(settingsFile); // قد تكون JSON كاملة
      if (sobj && typeof sobj === "object") {
        if (sobj.teamIndex != null) lastTeamIdx = parseInt(sobj.teamIndex,10) || 0;
      } else {
        // صيغة قديمة: سطر رقم فقط
        if (settingsFile.open("r")) {
          var raw = settingsFile.read(); settingsFile.close();
          var lines = String(raw || "").split(/\r?\n/);
          if (lines.length > 0) {
            var t = parseInt(lines[0], 10);
            if (!isNaN(t) && t >= 0 && t < teamNames.length) lastTeamIdx = t;
          }
        }
      }
    }
  } catch (_re) {}

  // UI defaults
  var lastSettings = { teamIndex: lastTeamIdx, baseFontSize: 30, ultraFastMode: false, stopAfterFirstPage: false };

  // UI dialog (unchanged) …
  var settingsDialog = new Window("dialog", "Script Settings");
  settingsDialog.orientation = "column";
  settingsDialog.alignChildren = ["fill", "top"];
  settingsDialog.spacing = 10;
  settingsDialog.margins = 20;
  var teamGroup = settingsDialog.add("panel", undefined, "Team");
  teamGroup.orientation = "column";
  teamGroup.alignChildren = ["fill", "top"];
  teamGroup.add("statictext", undefined, "Choose team:");
  var teamDropdown = teamGroup.add("dropdownlist", undefined, []);
  for (var di = 0; di < teamNames.length; di++) teamDropdown.add("item", di + 1 + " - " + teamNames[di]);
  try { teamDropdown.selection = teamDropdown.items[lastSettings.teamIndex]; } catch (_se) { if (teamDropdown.items.length > 0) teamDropdown.selection = teamDropdown.items[0]; }

  var fontGroup = settingsDialog.add("panel", undefined, "Font");
  fontGroup.orientation = "column";
  fontGroup.alignChildren = ["fill", "top"];
  var fontSizeGroup = fontGroup.add("group");
  fontSizeGroup.add("statictext", undefined, "Base font size (pt):");
  var fontSizeInput = fontSizeGroup.add("edittext", undefined, String(lastSettings.baseFontSize));
  fontSizeInput.characters = 10;

  var performanceGroup = settingsDialog.add("panel", undefined, "Performance");
  performanceGroup.orientation = "column";
  performanceGroup.alignChildren = ["fill", "top"];
  var ultraFastCheck = performanceGroup.add("checkbox", undefined, "Ultra Fast Mode");
  ultraFastCheck.value = lastSettings.ultraFastMode;

  var runGroup = settingsDialog.add("panel", undefined, "Run");
  runGroup.orientation = "column";
  runGroup.alignChildren = ["fill", "top"];
  var stopAfterFirstCheck = runGroup.add("checkbox", undefined, "Stop after current page");
  stopAfterFirstCheck.value = lastSettings.stopAfterFirstPage;

  var buttonGroup = settingsDialog.add("group");
  buttonGroup.alignment = "right";
  var okButton = buttonGroup.add("button", undefined, "OK"),
      cancelButton = buttonGroup.add("button", undefined, "Cancel");

  var dialogResult = null, chosenTeamIdx = null, baseFontSize = null, ultraFastMode = null, stopAfterFirstPage = null;
  okButton.onClick = function () {
    var fontSize = parseInt(fontSizeInput.text, 10);
    if (isNaN(fontSize) || fontSize <= 0) { alert("Enter a valid font size"); return; }
    if (!teamDropdown.selection) { alert("Choose a team"); return; }
    chosenTeamIdx = teamDropdown.selection.index;
    baseFontSize = fontSize;
    ultraFastMode = ultraFastCheck.value;
    stopAfterFirstPage = stopAfterFirstCheck.value;
    try {
      var toSave = { teamIndex: chosenTeamIdx, lastBaseFontSize: baseFontSize, ultraFastMode: ultraFastMode, stopAfterFirstPage: stopAfterFirstPage };
      settingsFile.open("w"); settingsFile.write(JSON.stringify(toSave)); settingsFile.close();
    } catch (_we) {}
    try {
      var teamSettingsFile = new File(settingsPath);
      teamSettingsFile.open("w"); teamSettingsFile.writeln(chosenTeamIdx); teamSettingsFile.close();
    } catch (_we) {}
    dialogResult = true; settingsDialog.close();
  };
  cancelButton.onClick = function () { dialogResult = false; settingsDialog.close(); };

  // Headless mode via temp-title.json (read by old reader)
  var tempSettingsFile = File("C:/Users/abdoh/Downloads/testScript/config/temp-title.json"),
      continueWithoutDialog = false,
      jsonSettings = readJSONFile(tempSettingsFile);
  if (jsonSettings) continueWithoutDialog = jsonSettings.continueWithoutDialog === true;

  if (continueWithoutDialog && jsonSettings) {
    chosenTeamIdx = 0;
    for (var ii = 0; ii < teamNames.length; ii++) {
      if (teamNames[ii].toLowerCase() === String(jsonSettings.team || "").toLowerCase()) { chosenTeamIdx = ii; break; }
    }
    baseFontSize = parseInt(jsonSettings.fontSize, 10) || 30;
    stopAfterFirstPage = jsonSettings.stopAfterFirstPage === true;
    ultraFastMode = jsonSettings.mode === "ultra";
  } else {
    settingsDialog.show();
    if (dialogResult !== true) return;
  }

  // Team properties
  var currentTeam = teamNames[chosenTeamIdx];
  if (!teams[currentTeam]) return;
  var defaultFont = teams[currentTeam].defaultFont,
      minFontSize = teams[currentTeam].minFontSize,
      boxPaddingRatio = teams[currentTeam].boxPaddingRatio,
      fontMap = teams[currentTeam].fontMap,
      compiledFontIndex = buildFontIndex(fontMap),
      verticalCenterCompensationRatio = 0.06,
      isEzTeam = /^(ez japan|ez scan)$/i.test(currentTeam);
  if (minFontSize && minFontSize > baseFontSize) minFontSize = Math.max(8, Math.floor(baseFontSize * 0.7));

  // Text input
  var allLines = [], pageStartIndices = [];
  try {
    var textData = readMangaText(txtFile);
    allLines = textData.lines; pageStartIndices = textData.pageStarts;
  } catch (e) { return; }
  if (allLines.length === 0) return;

  // Logging (minimal)
  var log = [], errors = [];
  function E(s) { errors.push(s); }

  // Performance: disable history + dialogs off
  var __prevHistoryStates = undefined, __prevDisplayDialogs = undefined;
  try { __prevHistoryStates = app.preferences.numberOfHistoryStates; } catch (_e) {}
  try { __prevDisplayDialogs = app.displayDialogs; } catch (_e) {}
  try { app.preferences.numberOfHistoryStates = 1; } catch (_e) {}
  try { app.displayDialogs = DialogModes.NO; } catch (_e) {}

  // Order docs by page number
  var documentsArray = [];
  for (var d0 = 0; d0 < app.documents.length; d0++) documentsArray.push(app.documents[d0]);
  documentsArray.sort(function (a, b) {
    var A = getPageNumberFromDocName(a.name) || 999999, B = getPageNumberFromDocName(b.name) || 999999; return A - B;
  });
  try {
    var activeDoc = app.activeDocument;
    if (activeDoc) {
      var activeName = activeDoc.name, activePageNum = getPageNumberFromDocName(activeName), startIdx = 0;
      for (var si = 0; si < documentsArray.length; si++) {
        var dn = documentsArray[si].name;
        if (dn === activeName) { startIdx = si; break; }
        var pn = getPageNumberFromDocName(dn);
        if (activePageNum !== null && pn === activePageNum) { startIdx = si; break; }
      }
      if (startIdx > 0) documentsArray = documentsArray.slice(startIdx);
    }
  } catch (_ad) {}

  var totalInserted = 0, totalSkipped = 0, totalErrors = 0, lineIndex = 0, pageCounter = 0;

  // MAIN LOOP
  for (var d = 0; d < documentsArray.length; d++) {
    var doc = documentsArray[d],
        prevUnits = app.preferences.rulerUnits;
    try { app.preferences.rulerUnits = Units.PIXELS; } catch (_ue) {}
    try { app.activeDocument = doc; } catch (e) { E("Cannot activate document index " + d + ": " + e); continue; }
    try { lastBubbleIndex = 0; } catch (_ri) {}
    try { splitWorkPathIntoNamedPaths(doc, "bubble_"); } catch (e) {}

    var pageNumber = getPageNumberFromDocName(doc.name),
        pagePaths = getSmartPathsForPage(doc);
    if (!pagePaths || pagePaths.length === 0) continue;

    var startLineIndex = getSmartTextLinesForPage(allLines, pageStartIndices, pageNumber, pageCounter),
        matchResult = matchPathsWithTexts(pagePaths, allLines, startLineIndex, null),
        pathTextMatches = matchResult.matches;

    lineIndex = matchResult.nextLineIndex;

    if (!pathTextMatches || pathTextMatches.length === 0) {
      try { app.preferences.rulerUnits = prevUnits; } catch (_ur) {}
      pageCounter++; continue;
    }

    var lastUsedFont = null, lastFontSize = baseFontSize, lastWasBracketTag = false;

    for (var k = 0; k < pathTextMatches.length; k++) {
      var m = pathTextMatches[k],
          pathItem = m.pathItem,
          lineText = m.lineText,
          originalLineText = m.lineText,
          pathName = "(unknown)";
      try { pathName = pathItem.name; } catch (e) {}

      var smartIdx = (function () { try { return pathItem._smartIndex; } catch (_e) { return undefined; } })();
      var isBracketTag = false, isOTTag = false, inheritPrevFont = false,
          isSTTag = /^\s*ST\s*:?\s*/.test(originalLineText || ""),
          matchedPrefixKey = null,
          strokeInfo = { needed: false, text: lineText };

      if (ultraFastMode) {
        if (/^\s*\[\s*\]\s*:?/.test(lineText)) isBracketTag = true;
        if (/^\s*(?:OT|Ot)\s*:?\s*/.test(lineText)) isOTTag = true;
        if (/^\/\/:?/.test(lineText)) inheritPrevFont = true;
        lineText = lineText.replace(/^\s*(NA:|SFX:|\*\*:|#\s*)\s*/i, "");
        if (inheritPrevFont) lineText = trimString(String(lineText).replace(/^\/\/:?\s*/, ""));
      } else {
        strokeInfo = parseStrokeTag(lineText);
        lineText = strokeInfo.text;
        try {
          if (/^\/\/:?/.test(lineText)) { inheritPrevFont = true; lineText = trimString(String(lineText).replace(/^\/\/:?\s*/, "")); }
        } catch (_ih) {}
        try { if (/^\s*\[\s*\]\s*:?.*/.test(String(lineText))) isBracketTag = true; } catch (_bt) {}
        try { if (/^\s*(?:OT|Ot)\s*:?\s*.*/.test(String(lineText))) isOTTag = true; } catch (_ot) {}
      }

      if (!lineText) { totalSkipped++; continue; }
      if (!pathItem || !pathItem.subPathItems || pathItem.subPathItems.length === 0) {
        E("Invalid or empty path: " + pathName); totalErrors++; continue;
      }

      var usedFont, curFontSize;
      if (ultraFastMode) {
        var wantedFont = defaultFont, fr = findFontInCompiledMap(lineText, compiledFontIndex);
        if (fr.found) { wantedFont = fr.font; matchedPrefixKey = fr.key; lineText = trimString(lineText.substring(fr.key.length)); }
        if (wantedFont === defaultFont && /^\s*ST\s*:?\s*/.test(lineText)) {
          for (var key in fontMap) {
            if (key.toLowerCase() === "st" || key.toLowerCase() === "st:") {
              wantedFont = fontMap[key]; lineText = lineText.replace(/^\s*ST\s*:?\s*/, ""); break;
            }
          }
        }
        if (isBracketTag) lineText = lineText.replace(/^\s*\[\s*\]\s*:?\s*/, "");
        if (isOTTag)     lineText = lineText.replace(/^\s*(?:OT|Ot)\s*:?\s*/, "");
        usedFont = wantedFont; curFontSize = baseFontSize;
      } else {
        if (inheritPrevFont) {
          usedFont = lastUsedFont || defaultFont; curFontSize = lastFontSize || baseFontSize;
        } else {
          var wf = defaultFont, fr2 = findFontInCompiledMap(lineText, compiledFontIndex);
          if (fr2.found) {
            wf = fr2.font; matchedPrefixKey = fr2.key;
            if (!isOTTag) lineText = trimString(lineText.substring(fr2.key.length));
          } else if (isSTTag) {
            for (var key2 in fontMap) {
              if (key2 && typeof key2 === "string") {
                var k2 = key2.toLowerCase();
                if (k2 === "st" || k2 === "st:") { wf = fontMap[key2]; break; }
              }
            }
          }
          usedFont = getValidFont(wf, defaultFont);
          curFontSize = baseFontSize;
        }
      }

      if (usedFont === "CCShoutOutGSN") { curFontSize += 20; }

      try {
        pathItem.makeSelection();
        if (!doc.selection || !doc.selection.bounds) throw new Error("No valid selection for path: " + pathName);

        var b = doc.selection.bounds,
            x1 = toNum(b[0]), y1 = toNum(b[1]), x2 = toNum(b[2]), y2 = toNum(b[3]),
            w = x2 - x1, h = y2 - y1;

        var selRect = { l: x1, t: y1, r: x2, b: y2 };
        if (_hasVisibleTextIntersecting(doc, selRect, 0.12)) {
          try { doc.selection.deselect(); } catch (_de) {}
          totalSkipped++; continue;
        }

        var boxW = Math.max(10, w * (1 - boxPaddingRatio)),
            boxH = Math.max(10, h * (1 - boxPaddingRatio)),
            cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
        var tlen = lineText.length,
            pad = Math.max(2, Math.min(8, Math.min(boxW, boxH) * 0.03)),
            availW = Math.max(10, boxW - pad * 2),
            availH = Math.max(10, boxH - pad * 2);

        var newFontSize = curFontSize;

        if (tlen > 25) {
          try {
            var approxChars = Math.max(5, Math.floor(availW / Math.max(1, newFontSize * 0.6))),
                words = String(lineText).split(/(\s+)/),
                acc = "";
            for (var wi = 0; wi < words.length; wi++) {
              var tent = acc + words[wi];
              if (tent.replace(/\s+/g, " ").length > approxChars) break;
              acc = tent;
            }
            if (acc && acc.length < lineText.length) lineText = acc + "\r" + trimString(lineText.substring(acc.length));
          } catch (_br) {}
        }

        var tl = doc.artLayers.add();
        tl.kind = LayerKind.TEXT;
        if (!tl.textItem) throw new Error("Failed to create text item for path: " + pathName);
        tl.textItem.kind = TextType.PARAGRAPHTEXT;
        tl.textItem.contents = lineText;
        tl.textItem.justification = Justification.CENTER;
        tl.textItem.font = usedFont;
        tl.textItem.size = newFontSize;

        if (isEzTeam) {
          try {
            var keyForScale = matchedPrefixKey || "";
            if (isSTTag) {
              tl.textItem.horizontalScale = 97;
            } else if (
              /^\s*(["“”]{2}:?|\(\):?)/.test(originalLineText || "") ||
              keyForScale === '""' || keyForScale === '"":' || keyForScale === "““" || keyForScale === "““:" ||
              keyForScale === "()" || keyForScale === "():"
            ) { tl.textItem.horizontalScale = 95; }
            else if (/^\s*<>:?/.test(originalLineText || "") || keyForScale === "<>" || keyForScale === "<>:") {
              tl.textItem.horizontalScale = 90;
            }
          } catch (_hs) {}
        }

        if (!ultraFastMode) {
          optimizeFontSettings(tl, usedFont, newFontSize);
          if (isBracketTag || (inheritPrevFont && lastWasBracketTag)) {
            tl.textItem.tracking = 0;
            tl.textItem.leading = Math.round(newFontSize * 1.0);
            tl.textItem.antiAliasMethod = AntiAlias.SMOOTH;
            tl.textItem.autoKerning = AutoKernType.OPTICAL;
            tl.textItem.fauxBold = true;
            tl.textItem.capitalization = TextCase.ALLCAPS;
          }
          if (isOTTag) tl.textItem.capitalization = TextCase.ALLCAPS;
        } else {
          tl.textItem.antiAliasMethod = AntiAlias.SMOOTH;
          if (isBracketTag) {
            tl.textItem.tracking = 0;
            tl.textItem.leading = Math.round(newFontSize * 1.0);
            tl.textItem.autoKerning = AutoKernType.OPTICAL;
            tl.textItem.fauxBold = true;
            tl.textItem.capitalization = TextCase.ALLCAPS;
          }
          if (isOTTag) tl.textItem.capitalization = TextCase.ALLCAPS;
        }

        var startLeft = cx - availW / 2,
            startTop  = cy - availH / 2 - newFontSize * verticalCenterCompensationRatio;
        tl.textItem.width = availW;
        tl.textItem.height = availH;
        tl.textItem.position = [startLeft, startTop];

        if (!ultraFastMode) {
          var vis = tl.visible;
          tl.visible = false;
          var centerRgb = samplePixel(doc, cx, cy);
          tl.visible = vis;
          var centerBright = luminance(centerRgb[0], centerRgb[1], centerRgb[2]),
              tc = new SolidColor();
          if (centerBright < 128) { tc.rgb.red = 255; tc.rgb.green = 255; tc.rgb.blue = 255; }
          else                    { tc.rgb.red = 0;   tc.rgb.green = 0;   tc.rgb.blue = 0;   }
          tl.textItem.color = tc;
          if (strokeInfo.needed) applyWhiteStroke3px(tl);
        } else {
          var defc = new SolidColor(); defc.rgb.red = 0; defc.rgb.green = 0; defc.rgb.blue = 0; tl.textItem.color = defc;
        }

        try {
          pathItem.makeSelection();
          if (doc.selection && doc.selection.bounds) {
            var centered = centerTextInBubbleWithTail();
            if (!centered) {
              var tb = tl.bounds, tlx = toNum(tb[0]), tty = toNum(tb[1]), trx = toNum(tb[2]), tby = toNum(tb[3]),
                  cX = (tlx + trx) / 2, cY = (tty + tby) / 2,
                  dx = cx - cX, dy = cy - cY - newFontSize * verticalCenterCompensationRatio;
              if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) tl.translate(dx, dy);
            }
          } else {
            var tb2 = tl.bounds, tlx2 = toNum(tb2[0]), tty2 = toNum(tb2[1]), trx2 = toNum(tb2[2]), tby2 = toNum(tb2[3]),
                cX2 = (tlx2 + trx2) / 2, cY2 = (tty2 + tby2) / 2,
                dx2 = cx - cX2, dy2 = cy - cY2 - newFontSize * verticalCenterCompensationRatio;
            if (Math.abs(dx2) > 0.1 || Math.abs(dy2) > 0.1) tl.translate(dx2, dy2);
          }
        } catch (_ce) {
          var tb3 = tl.bounds, tlx3 = toNum(tb3[0]), tty3 = toNum(tb3[1]), trx3 = toNum(tb3[2]), tby3 = toNum(tb3[3]),
              cX3 = (tlx3 + trx3) / 2, cY3 = (tty3 + tby3) / 2,
              dx3 = cx - cX3, dy3 = cy - cY3 - newFontSize * verticalCenterCompensationRatio;
          if (Math.abs(dx3) > 0.1 || Math.abs(dy3) > 0.1) tl.translate(dx3, dy3);
        }

        if (!ultraFastMode) {
          if (tlen > 15) tl.textItem.tracking = -20;
          else if (tlen <= 5) tl.textItem.tracking = 20;
          tl.textItem.leading = Math.round(newFontSize * 1.05);
        }

        doc.selection.deselect();
        totalInserted++;
        lastUsedFont = usedFont;
        lastFontSize = newFontSize;
        lastWasBracketTag = isBracketTag;
      } catch (bubbleErr) {
        var errMsg =
          "File=" + doc.name +
          " | BubbleIndex=" + (m.pathIndex + 1) +
          (smartIdx !== undefined ? " | SmartIndex=" + smartIdx : "") +
          " | PathName=" + pathName +
          " | LineIndex=" + m.lineIndex +
          " : EXCEPTION : " + bubbleErr.toString() +
          (bubbleErr.line ? " at line " + bubbleErr.line : "");
        E(errMsg);
        totalErrors++;
        try { doc.selection.deselect(); } catch (e2) {}
      }
    }

    // Save doc; free history; restore units
    try {
      var wasSaved = false;
      if (!doc.saved) { try { doc.save(); wasSaved = true; } catch (_sv) { wasSaved = false; } }
      else { wasSaved = true; }
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
    try { app.purge(PurgeTarget.HISTORYCACHES); } catch (_pg) {}
    try { app.preferences.rulerUnits = prevUnits; } catch (_ur) {}
    pageCounter++;
    if (stopAfterFirstPage && d === 0) break;
  }

  // Logs + autoNext + reset env
  try {
    if (!ultraFastMode) {
      try {
        var logPath = txtFile.path + "/photoshop_text_log_verbose.txt";
        writeLogFile(logPath, log, errors);
      } catch (e) {}
    }
    if (ultraFastMode && errors.length > 0) {
      try {
        var errFile = new File(txtFile.path + "/photoshop_text_errors.txt");
        errFile.open("w");
        for (var j = 0; j < errors.length; j++) errFile.writeln(errors[j]);
        errFile.close();
      } catch (e2) {}
    }
  } catch (e) { alert("An error occurred: " + e); }

  // ⬇️ اقرأ temp-title.json تاني بالطريقة القديمة قبل الإغلاق
  var config = readJSONFile(tempSettingsFile);
  if (config && config.autoNext === true) {
    for (var i3 = app.documents.length - 1; i3 >= 0; i3--) {
      var ddoc = app.documents[i3];
      try {
        if (ddoc.saved === false) { ddoc.save(); }
        ddoc.close(SaveOptions.SAVECHANGES);
      } catch (e) { $.writeln("Close file error: " + e); }
    }
    $.writeln("All files saved and closed (autoNext = true).");
  } else {
    $.writeln("autoNext = false → no files were closed.");
  }

  try {
    if (config) {
      config.continueWithoutDialog = false;
      tempSettingsFile.encoding = "UTF8";
      tempSettingsFile.open("w");
      tempSettingsFile.write(JSON.stringify(config, null, 2));
      tempSettingsFile.close();
      $.writeln("continueWithoutDialog set to false and saved.");
    }
  } catch (e) {
    $.writeln("temp-title.json save error: " + e);
  }

  try { if (__prevHistoryStates !== undefined) app.preferences.numberOfHistoryStates = __prevHistoryStates; } catch (_rh) {}
  try { if (__prevDisplayDialogs !== undefined) app.displayDialogs = __prevDisplayDialogs; } catch (_rd) {}
})();
