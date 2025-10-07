// #target photoshop

(function () {
  var basePath = "C:/Users/abdoh/Documents/waterMark/";

  // قائمة الفرق
  var teams = [
    "rezo",
    "violet",
    "ez",
    "seren",
    "magus",
    "nyx",
    "arura",
    "ken",
    "mei",
    "quantom",
  ];

  // إنشاء واجهة المستخدم
  var dlg = new Window("dialog", "Choose Team and Pages");
  dlg.orientation = "column";
  dlg.alignChildren = "fill";
  dlg.spacing = 10;
  dlg.margins = 16;

  // اختيار الفريق
  dlg.add("statictext", undefined, "Select a Team:");
  var dropdown = dlg.add("dropdownlist", undefined, teams);
  dropdown.selection = 0; // اختيار افتراضي (rezo)

  // خيارات فتح الصفحات
  var pageGroup = dlg.add("group");
  pageGroup.orientation = "column";
  pageGroup.alignChildren = "left";
  pageGroup.add("statictext", undefined, "Select Pages to Open:");
  var openStart = pageGroup.add(
    "radiobutton",
    undefined,
    "Open Start Page (00)"
  );
  var openEnd = pageGroup.add("radiobutton", undefined, "Open End Page (99)");
  var openBoth = pageGroup.add("radiobutton", undefined, "Open Both Pages");
  openBoth.value = true; // الخيار الافتراضي: فتح الصفحتين

  // أزرار التأكيد والإلغاء
  var buttonGroup = dlg.add("group");
  buttonGroup.orientation = "row";
  var okBtn = buttonGroup.add("button", undefined, "Open", { name: "ok" });
  var cancelBtn = buttonGroup.add("button", undefined, "Cancel", {
    name: "cancel",
  });

  // عند الضغط على زر Open
  okBtn.onClick = function () {
    var teamName = dropdown.selection.text;
    var teamPath = basePath + teamName + "/";
    var exts = [".psd", ".png", ".jpg"];
    var fileNames = [];

    // تحديد الصفحات بناءً على الخيار المحدد
    if (openStart.value) {
      fileNames = ["00"];
    } else if (openEnd.value) {
      fileNames = ["99"];
    } else if (openBoth.value) {
      fileNames = ["00", "99"];
    }

    // فتح الملفات
    for (var i = 0; i < fileNames.length; i++) {
      for (var j = 0; j < exts.length; j++) {
        try {
          var file = new File(teamPath + fileNames[i] + exts[j]);
          if (file.exists) {
            app.open(file);
          }
        } catch (e) {
          // تجاهل الأخطاء إذا لم يتم العثور على الملف
        }
      }
    }

    dlg.close();
  };

  // عند الضغط على زر Cancel
  cancelBtn.onClick = function () {
    dlg.close();
  };

  // إظهار الواجهة
  dlg.center();
  dlg.show();
})();
