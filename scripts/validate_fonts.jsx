// #target photoshop
app.bringToFront();

// تحميل مكتبات المساعدة
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/fontUtils.jsx");
$.evalFile("C:/Users/abdoh/Downloads/testScript/lib/teamLoader.jsx");

(function () {
  // قائمة الخطوط المطلوبة للتحقق منها
  var requiredFonts = [
    "CCVictorySpeech-Regular",
    "CCMightyMouth-Italic",
    "CCShoutOutGSN",
    "CCTallTales-Regular",
    "CCPhilYeh",
    "BestMarker",
    "CCMarianChurchland-Regular",
    "Arial",
    "Tahoma",
  ];

  var availableFonts = [];
  var missingFonts = [];

  // التحقق من كل خط
  for (var i = 0; i < requiredFonts.length; i++) {
    var fontName = requiredFonts[i];
    if (isFontAvailable(fontName)) {
      availableFonts.push(fontName);
    } else {
      missingFonts.push(fontName);
    }
  }

  // عرض النتائج
  var message = "نتائج فحص الخطوط:\n\n";
  message += " الخطوط المتاحة (" + availableFonts.length + "):\n";
  for (var j = 0; j < availableFonts.length; j++) {
    message += "• " + availableFonts[j] + "\n";
  }

  if (missingFonts.length > 0) {
    message += "\n الخطوط المفقودة (" + missingFonts.length + "):\n";
    for (var k = 0; k < missingFonts.length; k++) {
      message += "• " + missingFonts[k] + "\n";
    }
  }

  alert(message);

  // حفظ النتائج في ملف
  try {
    var logFile = new File(
      "C:/Users/abdoh/Downloads/testScript/font_validation_log.txt"
    );
    logFile.open("w");
    logFile.writeln("Font Validation Report - " + new Date().toString());
    logFile.writeln("=====================================");
    logFile.writeln("Available Fonts: " + availableFonts.length);
    for (var m = 0; m < availableFonts.length; m++) {
      logFile.writeln("✓ " + availableFonts[m]);
    }
    logFile.writeln("\nMissing Fonts: " + missingFonts.length);
    for (var n = 0; n < missingFonts.length; n++) {
      logFile.writeln("✗ " + missingFonts[n]);
    }
    logFile.close();
  } catch (e) {
    // تجاهل أخطاء كتابة الملف
  }
})();
