#target photoshop
app.bringToFront();

// ===== Helper: trim function =====
function trimStr(str) {
    return str.replace(/^\s+|\s+$/g, "");
}

// ===== Array.indexOf polyfill for old ExtendScript =====
function arrayIndexOf(arr, val) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] === val) return i;
    }
    return -1;
}

// ======= Teams array =======
var teams = ["arura","ez","ken","magus","mei","quantom","rezo","seren"];

(function mainLoop () {
    var tempFile = new File(Folder.temp + "/psScriptTemp.txt");
    var chosenTeam, originalsFolder;

    if (tempFile.exists) {
        tempFile.open("r");
        var lines = tempFile.read().split(/\r?\n/);
        tempFile.close();

        if (lines.length >= 2) {
            chosenTeam = trimStr(lines[0]);
            originalsFolder = new Folder(trimStr(lines[1]));
        }
    }

    // ======= If no temp file → show UI =======
    if (!chosenTeam || !originalsFolder || !originalsFolder.exists) {
        var dlg = new Window("dialog", "Select Team & Folder");
        dlg.alignChildren = "fill";

        dlg.add("statictext", undefined, "Choose Team:");
        var teamDropdown = dlg.add("dropdownlist", undefined, teams);
        teamDropdown.selection = 0;

        dlg.add("statictext", undefined, "Choose Originals Folder:");
        var folderGroup = dlg.add("group");
        folderGroup.orientation = "row";
        var folderPath = folderGroup.add("edittext", undefined, "");
        folderPath.characters = 40;
        var browseBtn = folderGroup.add("button", undefined, "Browse");

        browseBtn.onClick = function () {
            var f = Folder.selectDialog("اختر مجلد الصور الأصلية");
            if (f) folderPath.text = f.fsName;
        };

        var btns = dlg.add("group");
        btns.alignment = "center";
        btns.add("button", undefined, "OK", {name: "ok"});
        btns.add("button", undefined, "Cancel", {name: "cancel"});

        if (dlg.show() != 1) return;

        chosenTeam = teamDropdown.selection.text;
        originalsFolder = new Folder(folderPath.text);

        if (!originalsFolder.exists) {
            alert("Original folder not found:\n" + originalsFolder.fsName);
            return;
        }
    }

    // ======= Validate chosen team =======
    if (arrayIndexOf(teams, chosenTeam) === -1) {
        alert("Team name invalid: " + chosenTeam);
        return;
    }

    var teamFolder = new Folder("~/Documents/waterMark/" + chosenTeam);
    if (!teamFolder.exists) { 
        alert("Team folder not found: " + teamFolder.fsName); 
        return; 
    }

    // ======= Find files =======
    function findByRegex(folder, regex) {
        var items = folder.getFiles(function(f) { return f instanceof File; });
        for (var i = 0; i < items.length; i++) {
            try { if (regex.test(items[i].name)) return items[i]; } catch(_e){}
        }
        return null;
    }

    var watermarkFile = findByRegex(teamFolder, /^watermark\.(?:png|jpe?g)$/i);
    var endFile = findByRegex(teamFolder, /^9{2,3}\.(?:png|jpe?g)$/i);
    if (!watermarkFile || !endFile) {
        alert("Cannot find watermark or end page files in team folder.");
        return;
    }

    // ======= Place file as smart object =======
    function placeFileAsSmartObject(targetDoc, fileToPlace) {
        app.activeDocument = targetDoc;
        var desc = new ActionDescriptor();
        desc.putPath(charIDToTypeID('null'), fileToPlace);
        executeAction(charIDToTypeID('Plc '), desc, DialogModes.NO);
        return targetDoc.activeLayer;
    }

    function addWatermark(doc) {
        var layer = placeFileAsSmartObject(doc, watermarkFile);
        if (!layer) return;
        layer.name = "Watermark";
        layer.opacity = 50;

        var docW = doc.width.as("px");
        var docH = doc.height.as("px");

        var b = layer.bounds;
        var curW = b[2].as("px") - b[0].as("px");

        var scale = (docW * 0.35 / curW) * 100;
        layer.resize(scale, scale);

        b = layer.bounds;
        var curH = b[3].as("px") - b[1].as("px");

        var targetX = 10 - b[0].as("px");
        var targetY = (docH - 1000 - curH) - b[1].as("px");
        layer.translate(targetX, targetY);
    }

    function addEndPage(doc) {
        var layer = placeFileAsSmartObject(doc, endFile);
        if (!layer) return;
        layer.name = "End Page";

        var docW = doc.width.as("px");
        var docH = doc.height.as("px");

        var b = layer.bounds;
        var curW = b[2].as("px") - b[0].as("px");
        var curH = b[3].as("px") - b[1].as("px");

        var scale = (docW / curW) * 100;
        layer.resize(scale, scale);

        b = layer.bounds;
        curW = b[2].as("px") - b[0].as("px");
        curH = b[3].as("px") - b[1].as("px");

        doc.resizeCanvas(docW, docH + curH, AnchorPosition.TOPCENTER);

        var offsetX = (docW - curW) / 2 - b[0].as("px");
        var offsetY = (docH + curH) - curH - b[1].as("px");
        layer.translate(offsetX, offsetY);
    }

    // ======= Process folder =======
    function processFolder(originalsFolder) {
        if (originalsFolder == null) return;

        var cleanedFolder = new Folder(originalsFolder + "/Cleaned");
        if (!cleanedFolder.exists) {
            alert("Cleaned folder not found:\n" + originalsFolder.fsName);
            return;
        }

        var files = originalsFolder.getFiles(function(f){
            return f instanceof File && f.name.match(/\.(jpe?g|png|psd)$/i);
        });

        var createdPsdCount = 0;
        var errorCount = 0;

        for (var i = 0; i < files.length; i++) {
            var originalFile = files[i];
            var baseName = originalFile.name.replace(/\.(jpe?g|png|psd)$/i, '');
            var regex = new RegExp("^" + baseName + "(_clean)?\\.(psd|png|jpe?g)$", "i");
            var cleanedFiles = cleanedFolder.getFiles(function(f){
                return f instanceof File && regex.test(f.name);
            });

            if (cleanedFiles.length > 0) {
                try {
                    var docOriginal = open(originalFile);
                    var docCleaned = open(cleanedFiles[0]);

                    docCleaned.selection.selectAll();
                    docCleaned.selection.copy();
                    docCleaned.close(SaveOptions.DONOTSAVECHANGES);

                    docOriginal.paste();
                    docOriginal.activeLayer.name = "Cleaned Layer page " + (i + 1);

                    addWatermark(docOriginal);
                    if (i === files.length - 1) addEndPage(docOriginal);

                    var saveFile = new File(originalsFolder + "/" + baseName + ".psd");
                    var psdOptions = new PhotoshopSaveOptions();
                    psdOptions.embedColorProfile = true;
                    psdOptions.alphaChannels = true;
                    psdOptions.layers = true;
                    docOriginal.saveAs(saveFile, psdOptions, true, Extension.LOWERCASE);

                    docOriginal.close(SaveOptions.DONOTSAVECHANGES);
                    createdPsdCount++;
                } catch (e) {
                    errorCount++;
                    if (app.documents.length > 0) {
                        try { app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch(ignore) {}
                    }
                }
            } else {
                errorCount++;
            }
        }

        // Final message
    }

// ======= Re-open processed PSD files in alphabetical order =======
function reopenProcessedPSDs(folder) {
    if (!folder.exists) return;
    var psdFiles = folder.getFiles(function(f){
        return f instanceof File && f.name.match(/\.psd$/i);
    });

    // ترتيب الملفات أبجدي
    psdFiles.sort(function(a,b){
        return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
    });

    for (var i = 0; i < psdFiles.length; i++) {
        try {
            open(psdFiles[i]);
        } catch(e) {
            // لو فيه خطأ في الفتح، نتجاهله
        }
    }

}

// ======= Start processing =======
processFolder(originalsFolder);

// ======= Reopen PSDs after processing =======
reopenProcessedPSDs(originalsFolder);


    // ======= Ask if user wants another folder =======
    var again = confirm("Do you want to select another folder?");
    if (again) {
        mainLoop();
    }

})();
