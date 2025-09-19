#target photoshop
#include "C:/Users/abdoh/Downloads/testScript/config/json2.js"




// === Function to delete all paths in a document ===
function deleteAllPaths(doc) {
    app.activeDocument = doc;
    var count = doc.pathItems.length;
    for (var i = count - 1; i >= 0; i--) {
        try {
            doc.pathItems[i].remove();
        } catch (e) {
            $.writeln("❌ Failed to remove path " + i + ": " + e);
        }
    }
    $.writeln("🗑️ All paths deleted in document: " + doc.name);
}



// ==== Read folder name from temp-title.txt ====
var tempFile = new File("C:/Users/abdoh/Downloads/testScript/temp-title.txt");
tempFile.open("r");
var folderName = tempFile.readln().replace(/\s+$/, "");
tempFile.close();

// ==== JSON file path ====
var jsonFile = new File("C:/Users/abdoh/Downloads/" + folderName + "/cleaned/all_bubbles.json");

// ==== Open and read JSON ====
if (!jsonFile.exists || !jsonFile.open("r")) {
    alert("JSON file not found!\n" + jsonFile);
    exit();
}
var jsonString = jsonFile.read();
jsonFile.close();

// remove BOM if present
jsonString = jsonString.replace(/^\uFEFF/, '');

var bubblesData;
try {
    bubblesData = JSON.parse(jsonString);
} catch (e) {
    alert("Error parsing JSON: " + e + jsonFile);
    exit();
}

// === Convex Hull ===
function convexHull(points) {
    points.sort(function(a, b) {
        return a[0] === b[0] ? a[1] - b[1] : a[0] - b[0];
    });
    function cross(o, a, b) {
        return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
    }
    var lower = [];
    for (var i = 0; i < points.length; i++) {
        while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], points[i]) <= 0) {
            lower.pop();
        }
        lower.push(points[i]);
    }
    var upper = [];
    for (var i = points.length-1; i >= 0; i--) {
        while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], points[i]) <= 0) {
            upper.pop();
        }
        upper.push(points[i]);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
}

// === Create Hull Path with Expansion ===
function createHullPath(doc, pts, pathName, expandBy) {
    var hull = convexHull(pts);
    if (hull.length < 3) return null;

    var cx = 0, cy = 0;
    for (var i = 0; i < hull.length; i++) {
        cx += hull[i][0];
        cy += hull[i][1];
    }
    cx /= hull.length;
    cy /= hull.length;

    var subPathArray = [];
    for (var j = 0; j < hull.length; j++) {
        var x = hull[j][0];
        var y = hull[j][1];

        var dx = x - cx;
        var dy = y - cy;
        var len = Math.sqrt(dx*dx + dy*dy);

        if (len > 0) {
            x = cx + dx * ((len + expandBy) / len);
            y = cy + dy * ((len + expandBy) / len);
        }

        var p = new PathPointInfo();
        p.kind = PointKind.CORNERPOINT;
        p.anchor = [x, y];
        p.leftDirection = [x, y];
        p.rightDirection = [x, y];
        subPathArray.push(p);
    }

    var subPathInfo = new SubPathInfo();
    subPathInfo.closed = true;
    subPathInfo.operation = ShapeOperation.SHAPEXOR;
    subPathInfo.entireSubPath = subPathArray;

    return doc.pathItems.add(pathName, [subPathInfo]);
}

// === Main Loop over all open PSDs ===
for (var d = 0; d < app.documents.length; d++) {
    var doc = app.documents[d];
    app.activeDocument = doc; // اجعل الملف الحالي Active
    // 🗑️ امسح كل الباثات القديمة في الملف الحالي
    deleteAllPaths(doc);


    var filename = doc.name.replace(/\.[^\.]+$/, "");

    // ممكن يكون عندك suffix زي _mask
    var key = filename + "_mask";
    if (!bubblesData[key]) {
        $.writeln("⚠️ No bubbles for " + key);
        continue;
    }

    var bubbles = bubblesData[key];
    if (!bubbles || bubbles.length === 0) {
        $.writeln("⚠️ No bubbles in JSON for: " + filename);
        continue;
    }

    $.writeln("=== Processing " + doc.name + " with " + bubbles.length + " bubbles ===");

    for (var i = 0; i < bubbles.length; i++) {
        var bubble = bubbles[i];
        var pts = bubble.points;
        if (!pts || pts.length === 0) continue;

        var pathName = "bubble_" + (i + 1);
        try {
            createHullPath(doc, pts, pathName, 25); // توسعة 25px
            $.writeln("✅ Path created: " + pathName);
        } catch (e) {
            $.writeln("❌ Failed on bubble " + (i+1) + ": " + e);
        }
    }

    $.writeln("=== Done with " + doc.name + " ===\n");
}
// === Run another JSX script at the end ===
$.evalFile(new File("C:\\Users\\abdoh\\Downloads\\testScript\\fill_bubbles_first.jsx"));

 