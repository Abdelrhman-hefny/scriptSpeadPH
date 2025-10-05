#target photoshop
app.bringToFront();

(function mainLoop() {

    // ======= Helpers =======
    function arrayIndexOf(arr, val) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === val) return i;
        }
        return -1;
    }

    function trimStr(str) {
        return str.replace(/^\s+|\s+$/g, '');
    }

    // ======= Teams array =======
    var teams = ["arura","ez","ken", "violet", "magus","mei","quantom","rezo","seren","nyx"];

    // ======= Read temp file =======
    var tempFile = new File("C:/Users/abdoh/Downloads/testScript/temp-title.txt");
    var chosenTeam, originalsFolder, param;

    if (tempFile.exists) {
        try {
            tempFile.open("r");
            var lines = tempFile.read().split(/\r?\n/);
            tempFile.close();
        
            if (lines.length >= 3) {
                originalsFolder = new Folder("C:/Users/abdoh/Downloads/" + trimStr(lines[0]));
                chosenTeam = trimStr(lines[2]);
                param = trimStr(lines[1]);
            }
        } catch(e) {
            alert("Error reading temp file: " + e);
            return;
        }
    }

    // ======= Validate inputs =======
    if (!originalsFolder || !originalsFolder.exists) {
        alert("Originals folder not found or invalid");
        return;
    }

    if (arrayIndexOf(teams, chosenTeam) === -1) {
        alert("Invalid team: " + chosenTeam);
        return;
    }

    var teamFolder = new Folder("~/Documents/waterMark/" + chosenTeam);
    if (!teamFolder.exists) {
        alert("Team folder not found: " + teamFolder.fsName);
        return;
    }

    // ======= Find files helper =======
    function findByRegex(folder, regex) {
        try {
            var items = folder.getFiles(function(f) { return f instanceof File; });
            for (var i = 0; i < items.length; i++) {
                if (regex.test(items[i].name)) return items[i];
            }
        } catch(e) {}
        return null;
    }

    var watermarkFile = findByRegex(teamFolder, /^watermark\.(?:png|jpe?g)$/i);
    var endFile = findByRegex(teamFolder, /^9{2,3}\.(?:png|jpe?g)$/i);

    if (!watermarkFile || !endFile) {
        alert("Cannot find watermark or end page in team folder.");
        return;
    }

    // ======= Place file as smart object =======
    function placeFileAsSmartObject(targetDoc, fileToPlace) {
        try {
            app.activeDocument = targetDoc;
            var desc = new ActionDescriptor();
            desc.putPath(charIDToTypeID('null'), fileToPlace);
            executeAction(charIDToTypeID('Plc '), desc, DialogModes.NO);
            return targetDoc.activeLayer;
        } catch(e) {
            return null;
        }
    }

    function addWatermark(doc) {
        var layer = placeFileAsSmartObject(doc, watermarkFile);
        if (!layer) return;
        layer.name = "Watermark";
        layer.opacity = 50;

        try {
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
        } catch(e){}
    }

    function addEndPage(doc) {
        var layer = placeFileAsSmartObject(doc, endFile);
        if (!layer) return;
        layer.name = "End Page";
        try {
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
        } catch(e){}
    }

    // ======= Process folder =======
    function processFolder(folder) {
        if (!folder.exists) return;
        var cleanedFolder = new Folder(folder + "/cleaned");
        if (!cleanedFolder.exists) return;

        var files = folder.getFiles(function(f){ return f instanceof File && f.name.match(/\.(jpe?g|png|psd)$/i); });

        for (var i=0; i<files.length; i++) {
            try {
                var originalFile = files[i];
                var baseName = originalFile.name.replace(/\.(jpe?g|png|psd)$/i, '');
                var regex = new RegExp("^" + baseName + "(_clean)?\\.(psd|png|jpe?g)$", "i");
                var cleanedFiles = cleanedFolder.getFiles(function(f){ return f instanceof File && regex.test(f.name); });

                if (cleanedFiles.length === 0) continue;

                var docOriginal = open(originalFile);
                var docCleaned = open(cleanedFiles[0]);

                docCleaned.selection.selectAll();
                docCleaned.selection.copy();
                docCleaned.close(SaveOptions.DONOTSAVECHANGES);

                docOriginal.paste();
                docOriginal.activeLayer.name = "Cleaned Layer page " + (i+1);

                addWatermark(docOriginal);
                if (i === files.length-1) addEndPage(docOriginal);

                var saveFile = new File(folder + "/" + baseName + ".psd");
                var psdOptions = new PhotoshopSaveOptions();
                psdOptions.embedColorProfile = true;
                psdOptions.alphaChannels = true;
                psdOptions.layers = true;
                docOriginal.saveAs(saveFile, psdOptions, true, Extension.LOWERCASE);
                docOriginal.close(SaveOptions.DONOTSAVECHANGES);

            } catch(e){
                if (app.documents.length>0) try{ app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); }catch(ignore){}
            }
        }
    }

    // ======= Reopen processed PSDs =======
    function reopenProcessedPSDs(folder){
        if (!folder.exists) return;
        var psdFiles = folder.getFiles(function(f){ return f instanceof File && f.name.match(/\.psd$/i); });
        psdFiles.sort(function(a,b){ return a.name.toLowerCase() > b.name.toLowerCase()?1:-1; });

        for(var i=0;i<psdFiles.length;i++){
            try{ open(psdFiles[i]); }catch(e){}
        }

        // افتح صفحات إضافية حسب الفريق
        try {
            if(chosenTeam.toLowerCase() === "rezo") open(new File("C:/Users/abdoh/Documents/waterMark/rezo/00.psd"));
            else if(chosenTeam.toLowerCase() === "ez") open(new File("C:/Users/abdoh/Documents/waterMark/ez/00.psd"));
            else if(chosenTeam.toLowerCase() === "nyx") open(new File("C:/Users/abdoh/Documents/waterMark/nyx/00.png"));
            else if(chosenTeam.toLowerCase() === "seren") open(new File("C:/Users/abdoh/Documents/waterMark/seren/00.psd"));
        } catch(e){}
    }

    // ======= Run Python Script =======
    try {
        var pythonScript = "C:\\Users\\abdoh\\Downloads\\testScript\\python\\extract_bubbles_from_mask.py";
        var cmd = 'python "' + pythonScript + '" "' + param + '"';
        var runFile = new File(Folder.temp + "/runPython.bat");
        runFile.open("w");
        runFile.writeln("@echo off");
        runFile.writeln(cmd);
        runFile.close();
        runFile.execute();
    } catch(e){ alert("Python script failed: " + e); }

    // ======= Start processing =======
    processFolder(originalsFolder);
    reopenProcessedPSDs(originalsFolder);

    // ======= Run BAT file =======
    try {
        var batFile = new File("C:\\Users\\abdoh\\Downloads\\testScript\\batch\\run_detext-bb-by-json.bat");
        if(batFile.exists) batFile.execute();
    } catch(e){ alert("BAT execution failed: " + e); }

    // ======= Go to first document =======
    if(app.documents.length>0) app.activeDocument = app.documents[0];

    // ======= Ask for another folder =======
    if(confirm("Do you want to select another folder?")) mainLoop();

})();
