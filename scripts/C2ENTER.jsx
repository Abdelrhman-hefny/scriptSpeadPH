//#target photoshop
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

  var ahkScript = "C:/Users/abdoh/Documents/AutoHotkey/capToEnter.ahk";

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
    var psCommand =
      'powershell -Command "Start-Process -FilePath \'' +
      ahkExe +
      '\' -ArgumentList \'' +
      ahkScript +
      '\'"';

    // استدعاء الباورشيل
    var result = app.system(psCommand); // في Photoshop 2015 الكائن اسمه app.system مش System.callSystem
   } catch (e) {
    alert("حصل خطأ: " + e);
  }
})();
