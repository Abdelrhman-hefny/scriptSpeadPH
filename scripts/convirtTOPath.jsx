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

  // ===== دوال لضمان اسم فريد =====
  function pathNameExists(name) {
    for (var i = 0; i < doc.pathItems.length; i++) {
      if (doc.pathItems[i].name === name) return true;
    }
    return false;
  }

  function uniquePathName(baseName) {
    // لو الاسم الأساسي فاضي، رجّع baseName زي ما هو
    if (!baseName) baseName = "bubble";

    // لو مش موجود، استخدمه على طول
    if (!pathNameExists(baseName)) return baseName;

    // جرّب لحد ما تلاقي اسم فريد بإضافة رقم عشوائي
    for (var tries = 0; tries < 50; tries++) {
      var rnd = Math.floor(Math.random() * 9000) + 1000; // رقم 4 خانات
      var candidate = baseName + "_" + rnd;
      if (!pathNameExists(candidate)) return candidate;
    }
    // كـ fallback مضمون
    return baseName + "_" + (new Date().getTime());
  }

  var baseName = prefix + (count + 1);     // التسلسل المعتاد
  var finalName = uniquePathName(baseName); // ضمان التفرد لو فيه تعارض

  var workPath = doc.pathItems["Work Path"];
  workPath.name = finalName;
})();
