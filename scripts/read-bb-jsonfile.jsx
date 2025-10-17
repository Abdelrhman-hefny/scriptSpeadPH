// #target photoshop

// --- Polyfill: لو JSON مش معرف، عرّفه بسرعة ---
if (typeof JSON === "undefined") { JSON = {}; }
if (typeof JSON.parse !== "function") {
  JSON.parse = function (s) {
    // إزالة BOM لو موجود
    s = String(s || "").replace(/^\uFEFF/, "");
    // ملاحظة: eval آمن هنا لأننا بنقرأ من ملفنا المحلي فقط
    return eval("(" + s + ")");
  };
}

if (!app.documents.length) { alert("مفيش ملف مفتوح في فوتوشوب!"); exit(); }

// مجلد الصورة المفتوحة لقراءة all_bubbles.json
var parentFolder = app.activeDocument.fullName.parent;
var jsonFile = new File(parentFolder + "/all_bubbles.json");

// قراءة JSON
if (!jsonFile.exists || !jsonFile.open("r")) {
  alert("JSON file not found! " + jsonFile);
  exit();
}
var jsonString = jsonFile.read(); jsonFile.close();
jsonString = jsonString.replace(/^\uFEFF/, ""); // إزالة BOM إن وُجد

var bubblesData;
try {
  bubblesData = JSON.parse(jsonString);
} catch (e) {
  alert("Error parsing JSON: " + e);
  exit();
}

if (!bubblesData) { alert("No data found in JSON."); exit(); }

// ================== Main Loop ==================
var shrink = 10;    // تقليص من كل جانب
var numPoints = 40; // نقاط البيضاوي لنعومة المسار

for (var d = 0; d < app.documents.length; d++) {
  var doc = app.documents[d];
  app.activeDocument = doc;
  var filename = doc.name.replace(/\.[^\.]+$/, "");

  // امسح أي Paths قديمة
  for (var p = doc.pathItems.length - 1; p >= 0; p--) {
    doc.pathItems[p].remove();
  }

  // إيجاد المفتاح داخل JSON (يحاول بدائل _mask / _clean وبعض المطابقة الجزئية)
  var key = filename;
  if (!bubblesData[key]) {
    var alt = filename + "_mask";
    if (bubblesData[alt]) key = alt;
    else {
      var alt2 = filename + "_clean";
      if (bubblesData[alt2]) key = alt2;
      else {
        var stripped = filename.replace(/_mask$/, "").replace(/_clean$/, "");
        if (bubblesData[stripped]) key = stripped;
        else {
          var keys = [];
          for (var k in bubblesData) if (bubblesData.hasOwnProperty(k)) keys.push(k);
          if (keys.length === 1) key = keys[0];
          else {
            for (var i1 = 0; i1 < keys.length; i1++) {
              if (keys[i1].indexOf(filename) !== -1) { key = keys[i1]; break; }
            }
          }
        }
      }
    }
  }

  var bubbles = bubblesData[key];
  if (!bubbles || !bubbles.length) { continue; }

  // رسم كل فقاعة كـ Path منفصل
  for (var i = 0; i < bubbles.length; i++) {
    var pts = bubbles[i].points;
    if (!pts || !pts.length) continue;

    // حساب حدود الفقاعة
    var minX = +Infinity, minY = +Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var j = 0; j < pts.length; j++) {
      var x = Number(pts[j][0]), y = Number(pts[j][1]);
      if (isNaN(x) || isNaN(y)) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (!isFinite(minX) || !isFinite(minY)) continue;

    var centerX = (minX + maxX) / 2;
    var centerY = (minY + maxY) / 2;
    var radiusX = ((maxX - minX) / 2) - shrink;
    var radiusY = ((maxY - minY) / 2) - shrink;
    if (radiusX <= 0 || radiusY <= 0) continue;

    // تكوين مسار بيضاوي
    var subPathArray = [];
    for (var k2 = 0; k2 < numPoints; k2++) {
      var theta = (k2 / numPoints) * 2 * Math.PI;
      var px = centerX + radiusX * Math.cos(theta);
      var py = centerY + radiusY * Math.sin(theta);

      var pInfo = new PathPointInfo();
      pInfo.kind = PointKind.CORNERPOINT;
      pInfo.anchor = [px, py];
      pInfo.leftDirection = [px, py];
      pInfo.rightDirection = [px, py];
      subPathArray.push(pInfo);
    }

    var subPathInfo = new SubPathInfo();
    subPathInfo.closed = true;
    subPathInfo.operation = ShapeOperation.SHAPEXOR;
    subPathInfo.entireSubPath = subPathArray;

    // إضافة المسار
    var pathName = "page_" + filename + "_bubble" + (i + 1);
    try { doc.pathItems.add(pathName, [subPathInfo]); } catch (eAdd) {}
  }
}

// //   تشغيل سكربت لاحق
if (app.documents.length > 0) app.activeDocument = app.documents[0];

// شغّل سكربت لاحق لو محتاج
$.evalFile("C:/Users/abdoh/Downloads/testScript/scripts/scriptSPead.jsx");
