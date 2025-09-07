// تحديد مكان ملف JSON بجوار ملف PSD
if (!app.documents.length) { alert("لا يوجد ملف PSD مفتوح."); } else {
    var doc = app.activeDocument;
    var jsonFile = new File(doc.path + "/bubbles.json");
    if (!jsonFile.exists) { alert("ملف bubbles.json غير موجود بجوار ملف PSD."); } else {
        jsonFile.open("r");
        var str = jsonFile.read();
        jsonFile.close();

        // ملاحظة: الملف بصيغة [[{x,y},...], ...]
        var bubbles = JSON.parse(str);

        for (var i = 0; i < bubbles.length; i++) {
            var bubble = bubbles[i]; // array of {x,y}
            var subPathInfo = new SubPathInfo();
            subPathInfo.closed = true;
            var points = [];
            for (var j = 0; j < bubble.length; j++) {
                var pt = new PathPointInfo();
                pt.kind = PointKind.CORNERPOINT;
                pt.anchor = [bubble[j].x, bubble[j].y];
                pt.leftDirection = [bubble[j].x, bubble[j].y];
                pt.rightDirection = [bubble[j].x, bubble[j].y];
                points.push(pt);
            }
            subPathInfo.entireSubPath = points;
            var pathName = "bubble_" + (i+1);
            try { doc.pathItems.add(pathName, [subPathInfo]); }
            catch (e) { alert("فشل إنشاء المسار: " + pathName + "\n" + e); }
        }
    }
}
