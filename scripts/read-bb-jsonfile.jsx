//// // #target photoshop
var folderName;
var parentFolder;

if (app.documents.length > 0) {
  var fullPath = app.activeDocument.fullName;
  parentFolder = fullPath.parent;
  folderName = parentFolder.name;
} else {
  alert("مفيش ملف مفتوح في فوتوشوب!");
  exit();
}

// ==== JSON file path ====
var jsonFile = new File(parentFolder + "/all_bubbles.json");

// ==== Open and read JSON ====
if (!jsonFile.exists || !jsonFile.open("r")) {
  alert("JSON file not found!" + jsonFile + " FOLDER NAME: " + folderName);
  exit();
}
var jsonString = jsonFile.read();
jsonFile.close();
jsonString = jsonString.replace(/^\uFEFF/, "");

// Parse JSON
var bubblesData;
if (typeof JSON !== "undefined" && JSON.parse) {
  try {
    bubblesData = JSON.parse(jsonString);
  } catch (e) {
    try {
      bubblesData = eval("(" + jsonString + ")");
    } catch (e2) {
      alert("Error parsing JSON: " + e + "\nFallback eval failed: " + e2);
      exit();
    }
  }
} else {
  try {
    bubblesData = eval("(" + jsonString + ")");
  } catch (e) {
    alert("Error parsing JSON with eval: " + e);
    exit();
  }
}

if (!bubblesData) {
  alert("No data found in JSON.");
  exit();
}

// ================== اقرأ نوع المانجا ==================
var tempFile = new File("~/Downloads/testScript/temp-title.txt");
var mangaType = "japanise"; // الافتراضي

if (tempFile.exists) {
  tempFile.open("r");
  var lines = [];
  while (!tempFile.eof) {
    lines.push(tempFile.readln());
  }
  tempFile.close();

  if (lines.length >= 5) {
    var line5 = lines[4].toLowerCase();
    if (line5.indexOf("korian") !== -1) mangaType = "korian";
    else if (line5.indexOf("japanise") !== -1) mangaType = "japanise";
  }
}

$.writeln("📌 Manga type detected: " + mangaType);

// ================== Main Loop ==================
if (!app.documents.length) {
  alert("No open document");
  exit();
}

var pathCounter = 1;

for (var d = 0; d < app.documents.length; d++) {
  var doc = app.documents[d];
  app.activeDocument = doc;
  var filename = doc.name.replace(/\.[^\.]+$/, "");

  // 🗑️ امسح أي باثات قديمة
  for (var p = doc.pathItems.length - 1; p >= 0; p--) {
    doc.pathItems[p].remove();
  }

  // Find key
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
          for (var k in bubblesData)
            if (bubblesData.hasOwnProperty(k)) keys.push(k);
          if (keys.length === 1) key = keys[0];
          else {
            for (var i = 0; i < keys.length; i++) {
              if (keys[i].indexOf(filename) !== -1) {
                key = keys[i];
                break;
              }
            }
          }
        }
      }
    }
  }

  var bubbles = bubblesData[key];
  if (!bubbles || bubbles.length === 0) {
    $.writeln("No bubbles found for key: " + key);
    continue;
  }

  // ==== Draw Bubbles (كل فقاعة Path Item منفصل) ====
  // الحلقة تبدأ من 0 حتى النهاية لضمان الترتيب (1, 2, 3...)
  for (var i = 0; i < bubbles.length; i++) {
    var bubble = bubbles[i];
    var pts = bubble.points;
    if (!pts || pts.length === 0) continue;

    // احسب المدى الكامل (Bounding Box)
    var xCoords = [],
      yCoords = [];
    for (var j = 0; j < pts.length; j++) {
      var xy = pts[j];
      var x = Number(xy[0]);
      var y = Number(xy[1]);
      if (isNaN(x) || isNaN(y)) continue;
      xCoords.push(x);
      yCoords.push(y);
    }
    if (xCoords.length === 0) continue;

    // 🔹 حساب مركز الفقاعة
    var minX = Math.min.apply(null, xCoords);
    var maxX = Math.max.apply(null, xCoords);
    var minY = Math.min.apply(null, yCoords);
    var maxY = Math.max.apply(null, yCoords);

    var centerX = (minX + maxX) / 2;
    var centerY = (minY + maxY) / 2;

    // 🔹 نصف القطر بناءً على حجم الفقاعة الحقيقي
    var radiusX = (maxX - minX) / 2;
    var radiusY = (maxY - minY) / 2;

    // ✳️ رسم باث بيضاوي مطابق لحجم الفقاعة الحقيقي
    var numPoints = 40; // نقاط أكثر لنعومة الدائرة
    var subPathArray = [];
    for (var k = 0; k < numPoints; k++) {
      var theta = (k / numPoints) * 2 * Math.PI;
      var px = centerX + radiusX * Math.cos(theta);
      var py = centerY + radiusY * Math.sin(theta);

      var p = new PathPointInfo();
      p.kind = PointKind.CORNERPOINT;
      p.anchor = [px, py];
      p.leftDirection = [px, py];
      p.rightDirection = [px, py];
      subPathArray.push(p);
    }

    var subPathInfo = new SubPathInfo();
    subPathInfo.closed = true;
    // هنا تم استخدام SHAPEXOR كما كان في كودك القديم، لاختيار الفقاعة كنظام شكل
    subPathInfo.operation = ShapeOperation.SHAPEXOR;
    subPathInfo.entireSubPath = subPathArray;

    // ⭐️ إضافة المسار كـ Path Item منفصل، باستخدام ID المرتب
    // نستخدم i + 1 لأن الـ JSON مرتب من 1 إلى N
    var bubbleNumber = i + 1;
    var pathName = "page_" + filename + "_bubble" + bubbleNumber;

    try {
      // يتم إضافة Path Item جديد في كل تكرار
      doc.pathItems.add(pathName, [subPathInfo]);
      pathCounter++;
    } catch (e) {
      $.writeln("⚠️ Failed to add path: " + e);
    }
  }
  $.writeln(
    "✅ Processed " +
      filename +
      ". Created " +
      bubbles.length +
      " separate, sorted Path Items."
  );
  // ======= Go to first document =======

  // ======= Ask for another folder =======
  // if(confirm("Do you want to select another folder?")) mainLoop();
}
if (app.documents.length > 0) app.activeDocument = app.documents[0];
$.evalFile("C:/Users/abdoh/Downloads/testScript/scripts/scriptSPead.jsx");
