// #target photoshop

(function () {
    var basePath = "C:/Users/abdoh/Documents/waterMark/";

    // الفرق اللي حددتها
    var teams = ["rezo", "violet", "ez", "seren", "magus", "nyx", "arura", "ken", "mei", "quantom"];

    // واجهة بسيطة
    var dlg = new Window("dialog", "Choose Team");
    dlg.orientation = "column";
    dlg.alignChildren = "fill";

    dlg.add("statictext", undefined, "Select a Team:");
    var dropdown = dlg.add("dropdownlist", undefined, teams);
    dropdown.selection = 0; // أول اختيار افتراضي

    var okBtn = dlg.add("button", undefined, "Open", { name: "ok" });
    var cancelBtn = dlg.add("button", undefined, "Cancel", { name: "cancel" });

    okBtn.onClick = function () {
        var teamName = dropdown.selection.text;
        var teamPath = basePath + teamName + "/";

        // جرب الملفات
        var fileNames = ["00", "99"];
        var exts = [".psd", ".png", ".jpg"];

        for (var i = 0; i < fileNames.length; i++) {
            for (var j = 0; j < exts.length; j++) {
                try {
                    var file = new File(teamPath + fileNames[i] + exts[j]);
                    if (file.exists) open(file);
                } catch (e) {}
            }
        }

        dlg.close();
    };

    cancelBtn.onClick = function () { dlg.close(); };

    dlg.show();
})();
