#target photoshop
app.bringToFront();

(function() {
    // مسار سكريبت AHK
    var ahkScript = "C:/Users/abdoh/Documents/AutoHotkey/capToF2.ahk";
    var ahkExe = "C:/Program Files/AutoHotkey/v2/AutoHotkey.exe";

    try {
        // أولاً: نحاول نقتل أي نسخة شغالة من AutoHotkey
        var killCmd = 'taskkill /F /IM AutoHotkey.exe';
        system.callSystem(killCmd);

        // شغل السكريبت
        var runCmd = '"' + ahkExe + '" "' + ahkScript + '"';
        system.callSystem(runCmd);

        alert("تم إغلاق أي نسخة شغالة وتشغيل السكريبت بنجاح.");
    } catch (e) {
        alert("حصل خطأ: " + e.message);
    }
})();
