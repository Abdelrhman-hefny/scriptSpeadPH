// #target photoshop
app.bringToFront();

(function () {
  var doc = app.activeDocument;

  // استخراج رقم الصفحة من اسم الملف
  var pageNum = null;
  var docName = doc.name.replace(/\.[^\.]+$/, "");
  var match = docName.match(/(\d+)/);
  if (match) {
    pageNum = match[1];
  } else {
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

  // =========================
  // ✨ اختار نوع الفقاعة يدوي
  // true = منحنية (دائرة/بيضوية)
  // false = بزوايا (مربع/مستطيل/صراخ)
  // =========================
  var isCurvedBubble = true; // ← غيرها حسب نوع الفقاعة

  try {
    if (isCurvedBubble) {
      // فقاعات دائرية / بيضاوية
      for (var i = 0; i < 3; i++) {
        doc.selection.contract(5);
        doc.selection.smooth(12);
      }
      doc.selection.expand(12);
      doc.selection.smooth(10);
    } else {
      // فقاعات بزوايا
      doc.selection.contract(5);
      doc.selection.expand(5);
      // تنعيم خفيف جدًا عشان بس يشيل النتوءات الصغيرة
      doc.selection.smooth(2);
    }
  } catch (e) {}

  // تحويل التحديد لباث
  doc.selection.makeWorkPath(2.0);

  var workPath = doc.pathItems["Work Path"];
  workPath.name = prefix + (count + 1);
})();
