(function () {
    if (typeof readMangaText !== 'undefined') return;
  
    // =========================
    // Helpers (محلية)
    // =========================
    function stripBOM(s) {
      // يزيل BOM إن وجد
      return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
    }
  
    function unifyNewlines(s) {
      // توحيد نهايات الأسطر إلى \n فقط
      return s.replace(/\r\n|\r/g, "\n");
    }
  
    function isOnlySFXLine(line) {
      // تجاهل فقط لو SFX بدون محتوى
      // أمثلة: "sfx", "SFX", "sfx:", "SFX :   "
      return /^\s*sfx\s*:?[\s]*$/i.test(line);
    }
  
    function isOnlyPunctuation(line) {
      // لو السطر كله رموز/مسافات (؟ ! … “ ” — - . , :) نعتبره فراغ معنوي
      // لاحظ أننا لا نحذف السطور التي تحتوي على نص فعلي
      return /^[\s?!…“”"'\-—.,:()]+$/.test(line);
    }
  
    function smartTrim(line) {
      // قصّ بسيط من الطرفين + طيّ المسافات المتعددة الداخلية الخالصة
      // (اتركها كما هي لو عندك محاذاة مقصودة، احذف السطر التالي)
      return line.replace(/^\s+|\s+$/g, "");
    }
  
    // =========================
    // Normalizer (تطبيع النص الكامل)
    // =========================
    function normalizeWholeText(content) {
      // 1) إزالة BOM + توحيد نهايات الأسطر
      content = stripBOM(content);
      content = unifyNewlines(content);
  
      // 2) استبدال :: أو :- في أول السطر إلى "<> "
      content = content.replace(/^(\s*)(::|:-)\s*/gm, "$1<> ");
  
      // 3) تصحيح "<>:" إلى "<>" في أول السطر
      content = content.replace(/^(\s*<>)\s*:/gm, "$1");
  
      // 4) تطبيع OT / ST في أول السطر إلى Uppercase + نقطتين ومسافة
      // يدعم: "ot", "Ot:", "st :" إلخ
      content = content.replace(/^(\s*)ot\s*:?\s*/gim, "$1OT: ");
      content = content.replace(/^(\s*)st\s*:?\s*/gim, "$1ST: ");
  
      // 5) توحيد عناوين الصفحات: "page N" في أول السطر مع الحفاظ على الرقم
      // نتجاهل علامات Markdown المحتملة قبله (= أو #) إن وُجدت
      content = content.replace(/^\s*(?:=+|#+)?\s*page\s+(\d+)\s*$/gim, "page $1");
  
      // 6) إزالة الفراغات الزائدة في نهاية الأسطر (تجميل فقط)
      content = content.replace(/[ \t]+$/gm, "");
  
      return content;
    }
  
    // =========================
    // API
    // =========================
    readMangaText = function (txtFile) {
      var pageStartIndices = [];
      var pageNumbers = [];
      var allLines = [];
  
      // قراءة النص بأمان
      txtFile.open("r");
      var original = txtFile.read() || "";
      txtFile.close();
  
      // تطبيع النص
      var normalized = normalizeWholeText(original);
  
      // اكتب الملف فقط إذا تغير
      if (normalized !== original) {
        txtFile.open("w");
        txtFile.write(normalized);
        txtFile.close();
      }
  
      // تقسيم الأسطر بعد التطبيع
      var linesArr = normalized.split("\n");
  
      for (var i = 0; i < linesArr.length; i++) {
        var line = linesArr[i];
        if (!line) continue;
  
        line = smartTrim(line);
        if (!line) continue;
  
        // تجاهل سطور SFX الفارغة فقط
        if (isOnlySFXLine(line)) continue;
  
        // تجاهل السطور التي هي مجرد علامات ترقيم
        if (isOnlyPunctuation(line)) continue;
  
        // علامات الصفحات
        var m = /^page\s*(\d+)\s*$/i.exec(line);
        if (m) {
          pageStartIndices.push(allLines.length);
          pageNumbers.push(parseInt(m[1], 10));
          continue;
        }
  
        // احتفظ بالأسطر الفعلية
        allLines.push(line);
      }
  
      // نحافظ على التوافق: نرجع الواجهات القديمة + إضافي اختياري
      return {
        lines: allLines,
        pageStarts: pageStartIndices,
        pageNumbers: pageNumbers,   // جديد (اختياري للاستخدام)
        changed: (normalized !== original) // مفيد للتشخيص
      };
    };
  })();
  