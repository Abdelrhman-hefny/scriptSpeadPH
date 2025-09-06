#target photoshop
app.bringToFront();

(function () {
    var doc = app.activeDocument;

    // استخراج رقم الصفحة من اسم الملف (مثلاً: manga_page_3.psd → 3)
    var pageNum = null;
    var docName = doc.name.replace(/\.[^\.]+$/, ""); // شيل الامتداد
    var match = docName.match(/(\d+)/);
    if (match) {
        pageNum = match[1];
    } else {
        // لو مفيش رقم في الاسم، نخلي فوتوشوب يدير رقم الصفحة تلقائي
        if (typeof app.pageCounter === "undefined") {
            app.pageCounter = 1;
        } else {
            app.pageCounter++;
        }
        pageNum = app.pageCounter;
    }

    var prefix = "page_" + pageNum + "_bubble";

    // اتأكد إن فيه Selection
    try {
        var bounds = doc.selection.bounds;
    } catch (e) {
        alert("مفيش تحديد معمول!");
        return;
    }

    // عدّ عدد الباثات اللي تبع الصفحة دي
    var count = 0;
    for (var i = 0; i < doc.pathItems.length; i++) {
        if (doc.pathItems[i].name.indexOf(prefix) === 0) {
            count++;
        }
    }

    // اعمل Path جديد من الـ Selection
    doc.selection.makeWorkPath(1.0); // 1.0 = tolerance
    var workPath = doc.pathItems["Work Path"];
    workPath.name = prefix + (count + 1);

 })();
