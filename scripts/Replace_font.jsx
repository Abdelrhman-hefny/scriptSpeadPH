// #target photoshop
app.bringToFront();

/*
 * Photoshop CC 2019 (ES3-compatible)
 * يستبدل الخط "CCVictorySpeech-Regular" بـ "CCWildWords" في جميع طبقات النص داخل كل الوثائق المفتوحة.
 * يعمل على الطبقات داخل الجروبات أيضاً. لا يفتح السمارت أوبجيكتس تلقائياً.
 * ملاحظة: لا يمكن تعديل الصور المسطحة (JPG/PNG) التي لا تحتوي طبقات نص قابلة للتحرير.
 */

(function () {
  if (!app.documents || app.documents.length === 0) {
    alert("افتح ملفاً واحداً على الأقل قبل تشغيل السكربت.");
    return;
  }

  // ===== إعدادات الخط =====
  var SOURCE_FONT = "CCMightyMouth-Italic"; // اسم PostScript الحالي المطلوب استبداله
  var TARGET_FONT_CANDIDATES = [
    "CCWildWords-Italic",             // المحاولة الأولى
    "CCWildWords-Italic-Regular",     // بدائل محتملة حسب التثبيت
    "CCWildWordsRoman",
    "CCWildWords-Roman",
    "CCWildWordsPro-Regular"
  ];

  // ===== تهيئة البيئة =====
  var oldRuler = app.preferences.rulerUnits;
  var oldDialogs = app.displayDialogs;
  app.preferences.rulerUnits = Units.PIXELS;
  app.displayDialogs = DialogModes.NO;

  // ===== أدوات مساعدة =====
  function isLayerSet(l) { try { return l.typename === "LayerSet"; } catch (e) { return false; } }
  function isArtLayer(l)  { try { return l.typename === "ArtLayer"; } catch (e) { return false; } }

  function walkLayers(container, fn) {
    // نعكس الترتيب لتفادي مشاكل التحديد التاريخي
    for (var i = container.layers.length - 1; i >= 0; i--) {
      var lyr = container.layers[i];
      if (isLayerSet(lyr)) {
        walkLayers(lyr, fn);
      } else if (isArtLayer(lyr)) {
        fn(lyr);
      }
    }
  }

  function trySetFont(textItem, names) {
    for (var i = 0; i < names.length; i++) {
      try {
        textItem.font = names[i];
        return names[i]; // نجحت
      } catch (e) {
        // تجاهل وحاول الاسم التالي
      }
    }
    return null; // لم ينجح أي اسم
  }

  // ===== إحصاءات =====
  var totalDocs = 0, totalTextLayers = 0, changed = 0, skippedLocked = 0, notMatched = 0;

  // ===== المعالجة على كل الوثائق المفتوحة =====
  for (var d = 0; d < app.documents.length; d++) {
    var doc = app.documents[d];
    app.activeDocument = doc;
    totalDocs++;

    doc.suspendHistory("Swap '" + SOURCE_FONT + "' → 'CCWildWords-Italic'", "processDoc(doc)");
  }

  function processDoc(doc) {
    walkLayers(doc, function (lyr) {
      if (lyr.kind == LayerKind.TEXT) {
        totalTextLayers++;
        if (lyr.allLocked || lyr.textItem == null) { skippedLocked++; return; }

        var ti = lyr.textItem;
        var currFont = "";
        try { currFont = ti.font; } catch (e) { currFont = ""; }

        if (currFont === SOURCE_FONT) {
          var setName = trySetFont(ti, TARGET_FONT_CANDIDATES);
          if (setName) { changed++; }
        } else {
          notMatched++;
        }
      }
    });
  }

  // ===== استرجاع الإعدادات =====
  app.preferences.rulerUnits = oldRuler;
  app.displayDialogs = oldDialogs;

  // ===== تقرير سريع =====
  alert(
    "تم الفحص ✅\n" +
    "الوثائق المفتوحة: " + totalDocs + "\n" +
    "طبقات النص: " + totalTextLayers + "\n" +
    "تم تغيير الخط: " + changed + "\n" +
    "غير مطابقة للمصدر: " + notMatched + "\n" +
    "متخطّاة (مقفولة): " + skippedLocked
  );
})();
