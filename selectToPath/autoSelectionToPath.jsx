// يجب تشغيله داخل فوتوشوب
#target photoshop
app.bringToFront();

if (!app.documents.length) {
    alert("لا يوجد ملف PSD مفتوح.");
} else {
    var doc = app.activeDocument;
    var jsonFile = new File(doc.path + "/bubbles.json");
    if (!jsonFile.exists) {
        alert("ملف bubbles.json غير موجود بجوار ملف PSD.");
    } else {
        jsonFile.open("r");
        var jsonStr = jsonFile.read();
        jsonFile.close();

        var bubbles = JSON.parse(jsonStr);
        for (var i = 0; i < bubbles.length; i++) {
            var bubble = bubbles[i];
            var subPathInfo = new SubPathInfo();
            subPathInfo.closed = true;
            subPathInfo.operation = ShapeOperation.SHAPEXOR;
            var points = [];

            for (var j = 0; j < bubble.length; j++) {
                var p = new PathPointInfo();
                p.kind = PointKind.CORNERPOINT;
                p.anchor = [bubble[j].x, bubble[j].y];
                p.leftDirection = [bubble[j].x, bubble[j].y];
                p.rightDirection = [bubble[j].x, bubble[j].y];
                points.push(p);
            }

            subPathInfo.entireSubPath = points;
            var pathName = "bubble_" + (i + 1);
            try { doc.pathItems.add(pathName, [subPathInfo]); }
            catch (e) { alert("فشل إنشاء المسار: " + pathName + "\n" + e); }
        }
    }
}
