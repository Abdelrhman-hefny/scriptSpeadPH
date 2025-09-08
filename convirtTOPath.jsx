#target photoshop
app.bringToFront();

(function () {
    if (!app.documents.length) return;
    var doc = app.activeDocument;

    var tolerance = 1.0; // خفض الرقم = دقة أعلى (أكثر نقاط)
    var namingMode = "page_prefix"; // أو "flat" لاسم قصير bubbleN

    function getPageNumber(d) {
        var docName = d.name.replace(/\.[^\.]+$/, "");
        var m = docName.match(/(\d+)/);
        if (m) return m[1];
        if (typeof app.pageCounter === "undefined") app.pageCounter = 1; else app.pageCounter++;
        return app.pageCounter;
    }

    var pageNum = getPageNumber(doc);
    function basePrefix() { return namingMode === "flat" ? "bubble" : ("page_" + pageNum + "_bubble"); }

    // تحقق من وجود تحديد (يمكن أن يكون متعدد المناطق)
    var hasSelection = true;
    try { var _ = doc.selection.bounds; } catch (_e) { hasSelection = false; }
    if (!hasSelection) return;

    // حوّل التحديد (قد ينتج SubPathItems متعددة) إلى Work Path
    doc.selection.makeWorkPath(tolerance);
    var workPath = doc.pathItems["Work Path"];

    // احسب البداية للترقيم دون المرور على كل المسارات
    var startIdx = 1;
    while (true) {
        var probeName = basePrefix() + startIdx;
        try { var _exists = doc.pathItems.getByName(probeName); startIdx++; continue; }
        catch (e1) { break; }
    }

    // أنشئ Path مستقل لكل SubPath داخل Work Path
    var subPaths = workPath.subPathItems;
    var created = 0;
    for (var s = 0; s < subPaths.length; s++) {
        var spi = subPaths[s];
        // جهّز SubPathInfo جديد من نقاط الـ SubPath الحالي
        var subPathInfo = new SubPathInfo();
        subPathInfo.closed = spi.closed;
        subPathInfo.operation = spi.operation; // SHAPEXOR/ADD إلخ

        var points = [];
        for (var p = 0; p < spi.pathPoints.length; p++) {
            var pnt = spi.pathPoints[p];
            var pInfo = new PathPointInfo();
            pInfo.kind = PointKind.CORNERPOINT; // كفاية للفقاعات
            pInfo.anchor = [pnt.anchor[0], pnt.anchor[1]];
            pInfo.leftDirection = [pnt.leftDirection[0], pnt.leftDirection[1]];
            pInfo.rightDirection = [pnt.rightDirection[0], pnt.rightDirection[1]];
            points.push(pInfo);
        }
        subPathInfo.entireSubPath = points;

        var newName = basePrefix() + (startIdx + created);
        try {
            doc.pathItems.add(newName, [subPathInfo]);
            created++;
        } catch (_e2) {
            // تجاهل الفشل في SubPath واحد ونكمل
        }
    }

    // احذف Work Path المؤقت
    try { workPath.remove(); } catch (_e3) {}
})();
