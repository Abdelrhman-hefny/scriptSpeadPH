#target photoshop

// ==== Read folder name from temp-title.txt ====
var tempFile = new File("C:/Users/abdoh/Downloads/testScript/temp-title.txt");
tempFile.open("r");
var folderName = tempFile.readln().replace(/\s+$/, ""); // remove trailing spaces/newlines
tempFile.close();

// ==== JSON file path ====
var jsonFile = new File("C:/Users/abdoh/Downloads/" + folderName + "/cleaned/all_bubbles.json");

// ==== Open and read JSON ====
if (!jsonFile.exists || !jsonFile.open("r")) {
    alert("JSON file not found!"+jsonFile);
    exit();
}
var jsonString = jsonFile.read();
jsonFile.close();

// remove BOM if present
jsonString = jsonString.replace(/^\uFEFF/, '');


// Parse JSON (try JSON.parse, fallback to eval)
var bubblesData;
if (typeof JSON !== "undefined" && JSON.parse) {
    try {
        bubblesData = JSON.parse(jsonString);
    } catch (e) {
        // fallback to eval
        try {
            bubblesData = eval('(' + jsonString + ')');
        } catch (e2) {
            alert("Error parsing JSON: " + e + "\nFallback eval failed: " + e2);
            exit();
        }
    }
} else {
    try {
        bubblesData = eval('(' + jsonString + ')');
    } catch (e) {
        alert("Error parsing JSON with eval: " + e);
        exit();
    }
}

if (!bubblesData) {
    alert("No data found in JSON.");
    exit();
}

// Get active document
if (!app.documents.length) {
    alert("No open document");
    exit();
}
var doc = app.activeDocument;
var filename = doc.name.replace(/\.[^\.]+$/, ""); // without extension

// Find key in JSON that matches document
var key = filename;
if (!bubblesData[key]) {
    // try common alternatives
    var alt = filename + "_mask";
    if (bubblesData[alt]) key = alt;
    else {
        alt = filename + "_clean";
        if (bubblesData[alt]) key = alt;
        else {
            // try strip suffixes
            var stripped = filename.replace(/_mask$/, "").replace(/_clean$/, "");
            if (bubblesData[stripped]) key = stripped;
            else {
                // if only one key in object, use it
                var keys = [];
                for (var k in bubblesData) {
                    if (bubblesData.hasOwnProperty(k)) keys.push(k);
                }
                if (keys.length === 1) key = keys[0];
                else {
                    // try to find a key that contains the filename
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
    alert("No bubbles found for: " + filename + " (tried key: " + key + ")");
    exit();
}
var pathCounter = 1; // counter across all docs
for (var d = 0; d < app.documents.length; d++) {
  var doc = app.documents[d];
  app.activeDocument = doc;
  var filename = doc.name.replace(/\.[^\.]+$/, "");
  // 🗑️ امسح أي باثات قديمة
for (var p = doc.pathItems.length - 1; p >= 0; p--) {
    doc.pathItems[p].remove();
}

  // Find key for this document
  var key = filename;
  if (!bubblesData[key]) {
      var alt = filename + "_mask";
      if (bubblesData[alt]) key = alt;
      else {
          alt = filename + "_clean";
          if (bubblesData[alt]) key = alt;
          else {
              var stripped = filename.replace(/_mask$/, "").replace(/_clean$/, "");
              if (bubblesData[stripped]) key = stripped;
              else {
                  var keys = [];
                  for (var k in bubblesData) if (bubblesData.hasOwnProperty(k)) keys.push(k);
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
  if (!bubbles || bubbles.length === 0) continue;

    // رسم الباثات كما هو موجود في الكود
    for (var i = bubbles.length - 1; i >= 0; i--) {
        var bubble = bubbles[i];
        var pts = bubble.points;
        if (!pts || pts.length === 0) continue;

        // --- compute bounding box
var xCoords = [], yCoords = [];
for (var j = 0; j < pts.length; j++) {
    var xy = pts[j];
    var x = Number(xy[0]);
    var y = Number(xy[1]);
    if (isNaN(x) || isNaN(y)) continue;
    xCoords.push(x);
    yCoords.push(y);
}
if (xCoords.length === 0) continue;

var minX = Math.min.apply(null, xCoords);
var maxX = Math.max.apply(null, xCoords);
var minY = Math.min.apply(null, yCoords);
var maxY = Math.max.apply(null, yCoords);

var centerX = (minX + maxX) / 2;
var centerY = (minY + maxY) / 2;
var radiusX = (maxX - minX) * 0.7; // 80% من العرض الكامل
var radiusY = (maxY - minY) * 0.8; // 80% من الارتفاع الكامل


// create circular path (32 points)
var numPoints = 32;
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


        if (subPathArray.length === 0) continue;

        var subPathInfo = new SubPathInfo();
        subPathInfo.closed = true;
        subPathInfo.operation = ShapeOperation.SHAPEXOR;
        subPathInfo.entireSubPath = subPathArray;

// نفترض أن لدينا متغير pathCounter لكل فقاعه
// و pageNumber يمثل رقم الصفحة أو المستند الحالي
var doc = app.activeDocument;  
var fileName = doc.name;  

// Remove extension (png, jpg, jpeg, psd)
var baseName = fileName.replace(/\.(png|jpg|jpeg|psd)$/i, "");  

// Try to parse number from the name
var pageNumber = baseName;  

var bubbleNumber = bubbles.length - i; // بما أن الباثات معكوسة
var pathName = "page_" + pageNumber + "_bubble" + bubbleNumber;
        pathCounter++;

        try {
            doc.pathItems.add(pathName, [subPathInfo]);
        } catch (e) {
            $.writeln("Failed to add path: " + e);
        }
    }
}



 