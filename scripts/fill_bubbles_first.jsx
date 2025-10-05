// #target photoshop

//  جلب المستند الحالي
var doc = app.activeDocument;

// رقم الصفحة من اسم الملف
var filename = doc.name.replace(/\.[^\.]+$/, "");
var pageNum = parseInt(filename, 10);

// اسم اللاير الصحيح
var layerName = "Cleaned Layer page " + pageNum;

// جلب اللاير
var targetLayer = null;
for (var i = 0; i < doc.layers.length; i++) {
  if (doc.layers[i].name == layerName) {
    targetLayer = doc.layers[i];
    break;
  }
}

//  لو الطبقة مش موجودة أو مش صالحة → دور على أول ArtLayer شغالة
if (!targetLayer || !(targetLayer instanceof ArtLayer)) {
  $.writeln(
    " Layer '" + layerName + "' not found or not valid. Searching fallback..."
  );
  for (var j = 0; j < doc.layers.length; j++) {
    if (doc.layers[j] instanceof ArtLayer) {
      targetLayer = doc.layers[j];
      $.writeln(" Fallback layer found: " + targetLayer.name);
      break;
    }
  }
}

// لو لسه مفيش أي لاير شغال → وقف السكربت
if (!targetLayer) {
  $.writeln(" No valid layer found in this document, skipping...");
} else {
  doc.activeLayer = targetLayer;
  $.writeln("🎯 Using active layer: " + targetLayer.name);

  // === Duplicate the layer and move it under the current layer ===
  var backupLayer = targetLayer.duplicate();
  backupLayer.name = targetLayer.name + " (backup)";
  backupLayer.move(targetLayer, ElementPlacement.PLACEAFTER);

  $.writeln("💾 Backup layer created: " + backupLayer.name);
}

// === Function to check if layer is all white ===
function isLayerEmpty(layer) {
  if (!layer || !(layer instanceof ArtLayer)) {
    $.writeln(" isLayerEmpty: invalid layer");
    return true; // اعتبره فاضي
  }

  var bounds = layer.bounds;
  var w = bounds[2] - bounds[0];
  var h = bounds[3] - bounds[1];

  if (w <= 0 || h <= 0) {
    $.writeln("⚪ isLayerEmpty: zero bounds for " + layer.name);
    return true;
  }

  var points = [
    [bounds[0] + w / 2, bounds[1] + 1], // أعلى الوسط
    [bounds[0] + w / 2, bounds[3] - 1], // أسفل الوسط
  ];

  app.activeDocument.activeLayer = layer;

  for (var i = 0; i < points.length; i++) {
    try {
      var colorSample = app.activeDocument.colorSamplers.add(points[i]);
      var rgb = colorSample.color.rgb;
      colorSample.remove();

      if (rgb.red < 250 || rgb.green < 250 || rgb.blue < 250) {
        return false; // فيه محتوى
      }
    } catch (e) {
      $.writeln(" Sampler failed at point " + i + ": " + e);
      return false;
    }
  }

  return true;
}

// ========== Script to run action on all paths in all open documents ==========

// دالة لتشغيل الأكشن على باث واحد
function runActionOnPath(doc, pathItem) {
  try {
    pathItem.makeSelection();
    app.doAction("FILL", "path");
    doc.selection.deselect();
    $.writeln(" Action done on: " + pathItem.name + " in " + doc.name);
  } catch (e) {
    $.writeln(
      " Failed on path " + pathItem.name + " in " + doc.name + ": " + e
    );
  }
}

// دالة تمر على كل الباثات في مستند معين
function processDocument(doc) {
  app.activeDocument = doc;
  $.writeln("=== Processing document: " + doc.name + " ===");

  // لو مفيش طبقة صالحة → تجاهل المستند
  if (!targetLayer || !(targetLayer instanceof ArtLayer)) {
    $.writeln(" No valid target layer for " + doc.name + ", skipping...");
    return;
  }

  for (var i = 0; i < doc.pathItems.length; i++) {
    var pathItem = doc.pathItems[i];

    if (pathItem.kind == PathKind.WORKPATH || !pathItem.subPathItems.length) {
      continue;
    }

    // تجاهل الأكشن لو الطبقة كلها أبيض
    if (isLayerEmpty(targetLayer)) {
      $.writeln("⚪ Layer seems empty, skip fill/action: " + targetLayer.name);
    } else {
      runActionOnPath(doc, pathItem);
      $.sleep(200);
    }
  }

  $.writeln("=== Completed document: " + doc.name + " ===\n");
}

//  مر على كل المستندات المفتوحة
for (var d = 0; d < app.documents.length; d++) {
  var doc = app.documents[d];
  processDocument(doc);
}

// === Function to delete all paths in a document ===
function deleteAllPaths(doc) {
  app.activeDocument = doc;
  var count = doc.pathItems.length;
  for (var i = count - 1; i >= 0; i--) {
    try {
      doc.pathItems[i].remove();
    } catch (e) {
      $.writeln(" Failed to remove path " + i + ": " + e);
    }
  }
  $.writeln("🗑️ All paths deleted in document: " + doc.name);
}

// === Example usage after processing ===
for (var d = 0; d < app.documents.length; d++) {
  var doc = app.documents[d];
  deleteAllPaths(doc);
}
