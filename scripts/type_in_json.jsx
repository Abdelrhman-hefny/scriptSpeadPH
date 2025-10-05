#target photoshop

// مسار ملف JSON
var filePath = File("C:/Sandbox/abdoh/DefaultBox/user/current/Downloads/testScript/config/temp-title.json");

// التحقق من وجود الملف
if (!filePath.exists) {
    alert(" الملف غير موجود: " + filePath.fsName);
} else {

    // إنشاء نافذة ScriptUI
    var win = new Window("dialog", "تعديل بيانات JSON");
    
    // الحقول
    win.add("statictext", undefined, "Title:");
    var titleInput = win.add("edittext", undefined, "74");
    titleInput.characters = 30;

    win.add("statictext", undefined, "Folder URL:");
    var folderInput = win.add("edittext", undefined, "C:/Users/abdoh/Downloads/74");
    folderInput.characters = 50;

    win.add("statictext", undefined, "Team:");
    var teamInput = win.add("edittext", undefined, "ken");
    teamInput.characters = 30;

    win.add("statictext", undefined, "Photoshop Path:");
    var psInput = win.add("edittext", undefined, "C:/Program Files/Adobe/Adobe Photoshop CC 2019/Photoshop.exe");
    psInput.characters = 50;

    win.add("statictext", undefined, "Manga Type:");
    var mangaInput = win.add("edittext", undefined, "korian");
    mangaInput.characters = 30;

    // زر الحفظ
    var saveBtn = win.add("button", undefined, "Save");

    // عند الضغط على Save
    saveBtn.onClick = function() {
        // تجميع البيانات من الحقول
        var jsonData = {
            "title": titleInput.text,
            "folder_url": folderInput.text,
            "team": teamInput.text,
            "pspath": psInput.text,
            "mangaType": mangaInput.text
        };

        try {
            filePath.encoding = "UTF-8";

            // فتح الملف للكتابة مع التحقق
            if (filePath.open("w")) {
                filePath.write(JSON.stringify(jsonData, null, 2));
                filePath.close();
                alert(" تم تعديل البيانات وحفظها!");
                win.close();
            } else {
                alert(" لم أستطع فتح الملف للكتابة. تحقق من الصلاحيات.");
            }

        } catch(e) {
            alert(" حدث خطأ أثناء الكتابة:\n" + e);
        }
    }

    win.center();
    win.show();
}
