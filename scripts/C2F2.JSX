//// #target photoshop
app.bringToFront();

(function () {
  function fileExists(p) {
    try {
      return new File(p).exists;
    } catch (e) {
      return false;
    }
  }

  // مسارات محتملة للـ EXE (v2)
  var ahkExe1 = "C:/Program Files/AutoHotkey/v2/AutoHotkey.exe";
  var ahkExe2 = "C:/Program Files/AutoHotkey/v2/AutoHotkey64.exe";
  var ahkExe = fileExists(ahkExe1)
    ? ahkExe1
    : fileExists(ahkExe2)
    ? ahkExe2
    : null;

  var ahkScript = "C:/Users/abdoh/Documents/AutoHotkey/capToF2.ahk";

  if (!fileExists(ahkScript)) {
    alert("لم يتم العثور على ملف AHK: " + ahkScript);
    return;
  }
  if (!ahkExe) {
    alert("لم يتم العثور على AutoHotkey v2 في Program Files/AutoHotkey/v2.");
    return;
  }

  try {
    // أمر باورشيل لتشغيل AHK
    var psStart =
      "powershell -Command \"Start-Process -FilePath '" +
      ahkExe +
      "' -ArgumentList '" +
      ahkScript +
      "'\"";

    // دالة صغيرة تحاول تشغيل الأمر
    function runCmd(cmd) {
      if (typeof app.system === "function") {
        return app.system(cmd);
      } else if (typeof System !== "undefined" && System.callSystem) {
        return System.callSystem(cmd);
      } else {
        throw new Error("لا app.system ولا System.callSystem مدعومين");
      }
    }

    // إيقاف أي نسخة سابقة (taskkill)
    runCmd("cmd /c taskkill /F /IM AutoHotkey.exe 2>nul");
    runCmd("cmd /c taskkill /F /IM AutoHotkey64.exe 2>nul");

    // تشغيل الجديد عبر باورشيل
    runCmd(psStart);
  } catch (e) {
    alert("حصل خطأ: " + e);
  }
})();
