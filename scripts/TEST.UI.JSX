//// #target photoshop
// محرّر المسارات - أزرار بسيطة (نسخة عربية)
// أزرار: ← → ↑ ↓   |  تصغير/تكبير أفقي / عمودي
// التطبيق الفوري عند الضغط. آمن (يحفظ نسخ احتياطية في الذاكرة).

app.bringToFront();
var prevUnits = null;
try {
  prevUnits = app.preferences.rulerUnits;
  app.preferences.rulerUnits = Units.PIXELS;
} catch (e) {}

function log(s) {
  $.writeln(s);
}

// ---- إعدادات (يمكن تعديلها) ----
var MOVE_STEP = 10; // عدد البكسلات للحركة عند كل ضغطة سهم
var SHRINK_STEP = 0.9; // معامل التصغير (10% كل ضغطة)
var EXPAND_STEP = 1.1; // معامل التكبير (10% كل ضغطة)
var BACKUP_PREFIX = "__backup__"; // بادئة للمفتاح في backupStore

// ---- دوال مساعدة ----
function getPathsList(doc) {
  var arr = [];
  for (var i = 0; i < doc.pathItems.length; i++) {
    var p = doc.pathItems[i];
    if (p.name === "Work Path") continue;
    arr.push(p);
  }
  return arr;
}

function clonePathPoints(pathItem) {
  var result = [];
  for (var si = 0; si < pathItem.subPathItems.length; si++) {
    var sp = pathItem.subPathItems[si];
    var pts = [];
    for (var pi = 0; pi < sp.pathPoints.length; pi++) {
      var pp = sp.pathPoints[pi];
      pts.push({
        anchor: [pp.anchor[0], pp.anchor[1]],
        left: [pp.leftDirection[0], pp.leftDirection[1]],
        right: [pp.rightDirection[0], pp.rightDirection[1]],
        kind: pp.kind,
      });
    }
    result.push(pts);
  }
  return result;
}

function createPathFromPoints(doc, subpathsPoints, pathName) {
  try {
    for (var i = doc.pathItems.length - 1; i >= 0; i--) {
      if (doc.pathItems[i].name === pathName) doc.pathItems[i].remove();
    }
  } catch (e) {}
  var allSubPathInfos = [];
  for (var s = 0; s < subpathsPoints.length; s++) {
    var pts = subpathsPoints[s];
    var subPathArray = [];
    for (var k = 0; k < pts.length; k++) {
      var pinfo = new PathPointInfo();
      pinfo.kind = pts[k].kind;
      pinfo.anchor = [pts[k].anchor[0], pts[k].anchor[1]];
      pinfo.leftDirection = [pts[k].left[0], pts[k].left[1]];
      pinfo.rightDirection = [pts[k].right[0], pts[k].right[1]];
      subPathArray.push(pinfo);
    }
    var spi = new SubPathInfo();
    spi.closed = true;
    spi.operation = ShapeOperation.SHAPEXOR;
    spi.entireSubPath = subPathArray;
    allSubPathInfos.push(spi);
  }
  return doc.pathItems.add(pathName, allSubPathInfos);
}

function computeCentroid(subpaths) {
  var sumX = 0,
    sumY = 0,
    count = 0;
  for (var s = 0; s < subpaths.length; s++) {
    for (var p = 0; p < subpaths[s].length; p++) {
      sumX += subpaths[s][p].anchor[0];
      sumY += subpaths[s][p].anchor[1];
      count++;
    }
  }
  if (count === 0) return [0, 0];
  return [sumX / count, sumY / count];
}

function deepCopySubpaths(subpaths) {
  var out = [];
  for (var s = 0; s < subpaths.length; s++) {
    var pts = subpaths[s];
    var arr = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      arr.push({
        anchor: [p.anchor[0], p.anchor[1]],
        left: [p.left[0], p.left[1]],
        right: [p.right[0], p.right[1]],
        kind: p.kind,
      });
    }
    out.push(arr);
  }
  return out;
}

// تحويل المسارات: يدعم scaleX, scaleY, translateX, translateY, tighten, handleScale
function transformSubpaths(subpaths, opts) {
  var cp = opts.centroid || computeCentroid(subpaths);
  var cx = cp[0],
    cy = cp[1];
  var out = deepCopySubpaths(subpaths);
  var sX = typeof opts.scaleX === "number" ? opts.scaleX : 1;
  var sY = typeof opts.scaleY === "number" ? opts.scaleY : 1;
  var tx = opts.translateX || 0;
  var ty = opts.translateY || 0;
  var tighten = opts.tighten || 0;
  var hs = typeof opts.handleScale === "number" ? opts.handleScale : 1;

  for (var s = 0; s < out.length; s++) {
    for (var i = 0; i < out[s].length; i++) {
      var pt = out[s][i];
      var ox = pt.anchor[0] - cx;
      var oy = pt.anchor[1] - cy;

      var newAx = cx + ox * sX + tx;
      var newAy = cy + oy * sY + ty;

      if (tighten > 0) {
        var vx = cx - newAx;
        var vy = cy - newAy;
        newAx = newAx + vx * tighten;
        newAy = newAy + vy * tighten;
      }

      var oldAx = pt.anchor[0],
        oldAy = pt.anchor[1];
      pt.anchor[0] = newAx;
      pt.anchor[1] = newAy;

      var ldvx = pt.left[0] - oldAx,
        ldvy = pt.left[1] - oldAy;
      var rdvx = pt.right[0] - oldAx,
        rdvy = pt.right[1] - oldAy;

      pt.left[0] = newAx + ldvx * sX * hs;
      pt.left[1] = newAy + ldvy * sY * hs;
      pt.right[0] = newAx + rdvx * sX * hs;
      pt.right[1] = newAy + rdvy * sY * hs;
    }
  }
  return out;
}

// ---- دالة تطبيق التحويل على مسار واحد ----
function applyTransformToPath(doc, pathItem, opts) {
  try {
    var name = pathItem.name;
    var orig = clonePathPoints(pathItem);
    // حفظ نسخة احتياطية مرة واحدة
    var key = doc.name + "::" + name;
    if (!backupStore[key]) backupStore[key] = orig;
    var centroid = computeCentroid(orig);
    opts.centroid = centroid;
    var modified = transformSubpaths(orig, opts);
    try {
      pathItem.remove();
    } catch (e) {}
    createPathFromPoints(doc, modified, name);
    return true;
  } catch (e) {
    log("applyTransformToPath error: " + e);
    return false;
  }
}

// ---- تطبيق على جميع المسارات في المستند ----
function applyToAllPaths(doc, opts) {
  var paths = getPathsList(doc);
  for (var i = 0; i < paths.length; i++) {
    applyTransformToPath(doc, paths[i], opts);
  }
}

// ---- مخزن النسخ الاحتياطية ----
var backupStore = {}; // المفتاح: docname::pathname -> subpaths الأصلية

// ---- واجهة المستخدم (عربية) ----
var win = new Window("dialog", "محرّر المسارات - أزرار بسيطة");
win.orientation = "column";
win.alignChildren = ["fill", "top"];
win.margins = 12;
win.spacing = 8;

// اختيار المستند والمسار
var top = win.add("group");
top.add("statictext", undefined, "المستند:");
var docDrop = top.add("dropdownlist", undefined, []);
for (var i = 0; i < app.documents.length; i++)
  docDrop.add("item", app.documents[i].name);
if (docDrop.items.length > 0) docDrop.selection = docDrop.items[0];

top.add("statictext", undefined, "  المسار:");
var pathDrop = top.add("dropdownlist", undefined, []);
function refreshPaths() {
  pathDrop.removeAll();
  if (!docDrop.selection) return;
  var doc = app.documents[docDrop.selection.index];
  var paths = getPathsList(doc);
  for (var i = 0; i < paths.length; i++) pathDrop.add("item", paths[i].name);
  if (pathDrop.items.length > 0) pathDrop.selection = pathDrop.items[0];
}
refreshPaths();
docDrop.onChange = refreshPaths;

// خيار التطبيق على كل المسارات
var applyAllChk = win.add(
  "checkbox",
  undefined,
  "طبق على كل المسارات في المستند"
);
applyAllChk.value = false;

// خيار التطبيق على كل المسارات في كل الملفات المفتوحة
var applyAllDocsChk = win.add(
  "checkbox",
  undefined,
  "طبق على كل المسارات في كل الملفات المفتوحة"
);
applyAllDocsChk.value = false;

// مجموعة أزرار التحريك
var arrows = win.add("panel", undefined, "تحريك");
arrows.orientation = "column";
arrows.alignChildren = ["center", "center"];
var rowA = arrows.add("group");
rowA.add("statictext", undefined, "");
var upBtn = arrows.add("button", undefined, "▲  أعلى");
var rowB = arrows.add("group");
var leftBtn = rowB.add("button", undefined, "◀  يسار");
var rightBtn = rowB.add("button", undefined, "يمين  ▶");
var rowC = arrows.add("group");
rowC.add("statictext", undefined, "");
var downBtn = arrows.add("button", undefined, "▼  أسفل");

// مجموعة أزرار التصغير/التكبير
var sePanel = win.add("group");
sePanel.orientation = "row";
var shrinkH = sePanel.add("button", undefined, ">-<تصغير أفقي");
var shrinkV = sePanel.add("button", undefined, "|تصغير عمودي");
var expandH = sePanel.add("button", undefined, "<->تكبير     أفقي");
var expandV = sePanel.add("button", undefined, "|تكبير عمودي");

// أزرار إعادة الضبط والإغلاق
var bottom = win.add("group");
var resetBtn = bottom.add(
  "button",
  undefined,
  "إعادة ضبط (استعادة النسخ الاحتياطية)"
);
var closeBtn = bottom.add("button", undefined, "إغلاق");

// دالة الحصول على المسار/المستند المحدد
function getSelectedPathItem() {
  if (!docDrop.selection) return null;
  var doc = app.documents[docDrop.selection.index];
  var paths = getPathsList(doc);
  if (applyAllChk.value) return { doc: doc, path: null }; // null = كل المسارات
  if (!pathDrop.selection) return null;
  var name = pathDrop.selection.text;
  for (var i = 0; i < paths.length; i++)
    if (paths[i].name === name) return { doc: doc, path: paths[i] };
  return null;
}

// تعاملات الأزرار (تنبيه باللغة العربية عند المشكلة)
var selMissingMsg = "اختر المستند/المسار أولاً";

// معالجات الأزرار
upBtn.onClick = function () {
  var opts = {
    scaleX: 1,
    scaleY: 1,
    translateX: 0,
    translateY: -MOVE_STEP,
    tighten: 0,
    handleScale: 1,
  };
  if (applyAllDocsChk.value) {
    for (var di = 0; di < app.documents.length; di++) {
      applyToAllPaths(app.documents[di], opts);
    }
    return;
  }
  var sel = getSelectedPathItem();
  if (!sel) return alert(selMissingMsg);
  if (applyAllChk.value) {
    applyToAllPaths(sel.doc, opts);
  } else {
    applyTransformToPath(sel.doc, sel.path, opts);
  }
};
downBtn.onClick = function () {
  var opts = {
    scaleX: 1,
    scaleY: 1,
    translateX: 0,
    translateY: MOVE_STEP,
    tighten: 0,
    handleScale: 1,
  };
  if (applyAllDocsChk.value) {
    for (var di = 0; di < app.documents.length; di++) {
      applyToAllPaths(app.documents[di], opts);
    }
    return;
  }
  var sel = getSelectedPathItem();
  if (!sel) return alert(selMissingMsg);
  if (applyAllChk.value) {
    applyToAllPaths(sel.doc, opts);
  } else {
    applyTransformToPath(sel.doc, sel.path, opts);
  }
};
leftBtn.onClick = function () {
  var opts = {
    scaleX: 1,
    scaleY: 1,
    translateX: -MOVE_STEP,
    translateY: 0,
    tighten: 0,
    handleScale: 1,
  };
  if (applyAllDocsChk.value) {
    for (var di = 0; di < app.documents.length; di++) {
      applyToAllPaths(app.documents[di], opts);
    }
    return;
  }
  var sel = getSelectedPathItem();
  if (!sel) return alert(selMissingMsg);
  if (applyAllChk.value) {
    applyToAllPaths(sel.doc, opts);
  } else {
    applyTransformToPath(sel.doc, sel.path, opts);
  }
};
rightBtn.onClick = function () {
  var opts = {
    scaleX: 1,
    scaleY: 1,
    translateX: MOVE_STEP,
    translateY: 0,
    tighten: 0,
    handleScale: 1,
  };
  if (applyAllDocsChk.value) {
    for (var di = 0; di < app.documents.length; di++) {
      applyToAllPaths(app.documents[di], opts);
    }
    return;
  }
  var sel = getSelectedPathItem();
  if (!sel) return alert(selMissingMsg);
  if (applyAllChk.value) {
    applyToAllPaths(sel.doc, opts);
  } else {
    applyTransformToPath(sel.doc, sel.path, opts);
  }
};

shrinkH.onClick = function () {
  var opts = {
    scaleX: SHRINK_STEP,
    scaleY: 1,
    translateX: 0,
    translateY: 0,
    tighten: 0,
    handleScale: 1,
  };
  if (applyAllDocsChk.value) {
    for (var di = 0; di < app.documents.length; di++) {
      applyToAllPaths(app.documents[di], opts);
    }
    return;
  }
  var sel = getSelectedPathItem();
  if (!sel) return alert(selMissingMsg);
  if (applyAllChk.value) {
    applyToAllPaths(sel.doc, opts);
  } else {
    applyTransformToPath(sel.doc, sel.path, opts);
  }
};

shrinkV.onClick = function () {
  var opts = {
    scaleX: 1,
    scaleY: SHRINK_STEP,
    translateX: 0,
    translateY: 0,
    tighten: 0,
    handleScale: 1,
  };
  if (applyAllDocsChk.value) {
    for (var di = 0; di < app.documents.length; di++) {
      applyToAllPaths(app.documents[di], opts);
    }
    return;
  }
  var sel = getSelectedPathItem();
  if (!sel) return alert(selMissingMsg);
  if (applyAllChk.value) {
    applyToAllPaths(sel.doc, opts);
  } else {
    applyTransformToPath(sel.doc, sel.path, opts);
  }
};

expandH.onClick = function () {
  var opts = {
    scaleX: EXPAND_STEP,
    scaleY: 1,
    translateX: 0,
    translateY: 0,
    tighten: 0,
    handleScale: 1,
  };
  if (applyAllDocsChk.value) {
    for (var di = 0; di < app.documents.length; di++) {
      applyToAllPaths(app.documents[di], opts);
    }
    return;
  }
  var sel = getSelectedPathItem();
  if (!sel) return alert(selMissingMsg);
  if (applyAllChk.value) {
    applyToAllPaths(sel.doc, opts);
  } else {
    applyTransformToPath(sel.doc, sel.path, opts);
  }
};

expandV.onClick = function () {
  var opts = {
    scaleX: 1,
    scaleY: EXPAND_STEP,
    translateX: 0,
    translateY: 0,
    tighten: 0,
    handleScale: 1,
  };
  if (applyAllDocsChk.value) {
    for (var di = 0; di < app.documents.length; di++) {
      applyToAllPaths(app.documents[di], opts);
    }
    return;
  }
  var sel = getSelectedPathItem();
  if (!sel) return alert(selMissingMsg);
  if (applyAllChk.value) {
    applyToAllPaths(sel.doc, opts);
  } else {
    applyTransformToPath(sel.doc, sel.path, opts);
  }
};

// إعادة الضبط: استعادة النسخ الاحتياطية
resetBtn.onClick = function () {
  if (!docDrop.selection) return alert("اختر المستند أولاً");
  var doc = app.documents[docDrop.selection.index];
  var keys = [];
  for (var k in backupStore)
    if (backupStore.hasOwnProperty(k) && k.indexOf(doc.name + "::") === 0)
      keys.push(k);
  if (keys.length === 0) return alert("لا توجد نسخ احتياطية لهذا المستند");
  var restored = 0;
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var pname = key.split("::")[1];
    try {
      for (var pi = doc.pathItems.length - 1; pi >= 0; pi--) {
        if (doc.pathItems[pi].name === pname) {
          try {
            doc.pathItems[pi].remove();
          } catch (_) {}
        }
      }
      createPathFromPoints(doc, backupStore[key], pname);
      restored++;
    } catch (e) {
      log("reset error for " + pname + " : " + e);
    }
  }
  alert("تم استعادة " + restored + " مسار(مسارات) للمستند: " + doc.name);
};

// إغلاق النافذة
closeBtn.onClick = function () {
  win.close();
};

// عرض النافذة
win.center();
win.show();

// استعادة وحدات القياس الأصلية
try {
  app.preferences.rulerUnits = prevUnits;
} catch (e) {}
