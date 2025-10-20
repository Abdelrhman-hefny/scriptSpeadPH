// #target photoshop
app.bringToFront();

(function mainLoop() {
  // JSON helpers
  function parseJSONSafe(s) {
    s = String(s || "").replace(/^\uFEFF/, "");
    if (typeof JSON !== "undefined" && typeof JSON.parse === "function") {
      try { return JSON.parse(s); } catch (e) {}
    }
    try { return eval("(" + s + ")"); } catch (e2) { return null; }
  }
  function readJSONFile(f) {
    try {
      if (!f || !f.exists) return null;
      f.encoding = "UTF8";
      if (!f.open("r")) return null;
      var raw = f.read(); f.close();
      return parseJSONSafe(raw);
    } catch (e) { return null; }
  }

  // Helpers
  function arrayIndexOf(arr, val) {
    for (var i = 0; i < arr.length; i++) { if (arr[i] === val) return i; }
    return -1;
  }
  function trimStr(str) { return String(str).replace(/^\s+|\s+$/g, ""); }

  // Read config
  var teams = ["arura","ez","ken","violet","magus","mei","quantom","rezo","seren","nyx"];
  var jsonCfgFile = new File("C:/Users/abdoh/Downloads/testScript/config/temp-title.json");
  var cfg = readJSONFile(jsonCfgFile);
  if (!cfg) { $.writeln("Error: cannot read JSON: " + jsonCfgFile.fsName); return; }

  var folderPath = (cfg.folder && String(cfg.folder)) || (cfg.folder_url && String(cfg.folder_url)) || "";
  var originalsFolder = folderPath ? new Folder(folderPath) : null;
  var chosenTeam = trimStr(String(cfg.team || ""));

  // Validation
  if (!originalsFolder || !originalsFolder.exists) { $.writeln("Originals folder not found/invalid"); return; }
  if (arrayIndexOf(teams, chosenTeam) === -1) { $.writeln("Invalid team: " + chosenTeam); return; }

  var teamFolder = new Folder("~/Documents/waterMark/" + chosenTeam);
  if (!teamFolder.exists) { $.writeln("Team folder not found: " + teamFolder.fsName); return; }

  // Find assets
  function findByRegex(folder, regex) {
    try {
      var items = folder.getFiles(function (f) { return f instanceof File; });
      for (var i = 0; i < items.length; i++) { if (regex.test(items[i].name)) return items[i]; }
    } catch (e) {}
    return null;
  }
  var watermarkFile = findByRegex(teamFolder, /^watermark\.(?:png|jpe?g)$/i);
  var endFile       = findByRegex(teamFolder, /^9{2,3}\.(?:png|jpe?g)$/i);
  if (!watermarkFile || !endFile) { $.writeln("Missing watermark or end page"); return; }

  // PS ops
  function placeFileAsSmartObject(targetDoc, fileToPlace) {
    try {
      app.activeDocument = targetDoc;
      var desc = new ActionDescriptor();
      desc.putPath(charIDToTypeID("null"), fileToPlace);
      executeAction(charIDToTypeID("Plc "), desc, DialogModes.NO);
      return targetDoc.activeLayer;
    } catch (e) { return null; }
  }

  function addWatermark(doc) {
    var layer = placeFileAsSmartObject(doc, watermarkFile);
    if (!layer) return;
    layer.name = "Watermark";
    layer.opacity = chosenTeam.toLowerCase() === "ken" ? 100 : 50;
    try {
      var docW = doc.width.as("px");
      var b = layer.bounds;
      var curW = b[2].as("px") - b[0].as("px");
      layer.resize(((docW * 0.35) / curW) * 100, ((docW * 0.35) / curW) * 100);
      b = layer.bounds;
      var curH = b[3].as("px") - b[1].as("px");
      var targetX = 10 - b[0].as("px");
      var targetY = doc.height.as("px") - 1000 - curH - b[1].as("px");
      layer.translate(targetX, targetY);
    } catch (e) {}
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
      layer.resize((docW / curW) * 100, (docW / curW) * 100);

      b = layer.bounds;
      var curW2 = b[2].as("px") - b[0].as("px");
      var curH2 = b[3].as("px") - b[1].as("px");

      doc.resizeCanvas(docW, docH + curH2, AnchorPosition.TOPCENTER);
      var offsetX = (docW - curW2) / 2 - b[0].as("px");
      var offsetY = docH - b[1].as("px"); // تبسيط مكافئ
      layer.translate(offsetX, offsetY);
    } catch (e) {}
  }

  // Main
  function processFolder(folder) {
    if (!folder.exists) return;
    var cleanedFolder = new Folder(folder + "/cleaned");
    if (!cleanedFolder.exists) return;

    var files = folder.getFiles(function (f) {
      return f instanceof File && f.name.match(/\.(jpe?g|png|psd)$/i);
    });

    for (var i = 0; i < files.length; i++) {
      var docOriginal, docCleaned;
      try {
        var originalFile = files[i];
        var baseName = originalFile.name.replace(/\.(jpe?g|png|psd)$/i, "");
        var regex = new RegExp("^" + baseName + "(_clean)?\\.(psd|png|jpe?g)$", "i");
        var cleanedFiles = cleanedFolder.getFiles(function (f) {
          return f instanceof File && regex.test(f.name);
        });
        if (cleanedFiles.length === 0) continue;

        docOriginal = open(originalFile);
        docCleaned  = open(cleanedFiles[0]);

        docCleaned.selection.selectAll();
        docCleaned.selection.copy();
        docCleaned.close(SaveOptions.DONOTSAVECHANGES);

        docOriginal.paste();
        docOriginal.activeLayer.name = "Cleaned Layer page " + (i + 1);

        addWatermark(docOriginal);
        if (i === files.length - 1) addEndPage(docOriginal);

        var saveFile = new File(folder + "/" + baseName + ".psd");
        var psdOptions = new PhotoshopSaveOptions();
        psdOptions.embedColorProfile = true;
        psdOptions.alphaChannels = true;
        psdOptions.layers = true;
        docOriginal.saveAs(saveFile, psdOptions, true, Extension.LOWERCASE);
        docOriginal.close(SaveOptions.DONOTSAVECHANGES);
      } catch (e) {
        if (app.documents.length > 0) {
          try { app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch (ignore) {}
        }
      }
    }
  }

  function reopenProcessedPSDs(folder) {
    if (!folder.exists) return;
    var psdFiles = folder.getFiles(function (f) {
      return f instanceof File && f.name.match(/\.psd$/i);
    });
    psdFiles.sort(function (a, b) {
      return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
    });
    for (var i = 0; i < psdFiles.length; i++) { try { open(psdFiles[i]); } catch (e) {} }

    try {
      var team = chosenTeam.toLowerCase();
      if (team === "rezo")      open(new File("C:/Users/abdoh/Documents/waterMark/rezo/00.psd"));
      else if (team === "ez")   open(new File("C:/Users/abdoh/Documents/waterMark/ez/00.psd"));
      else if (team === "nyx")  open(new File("C:/Users/abdoh/Documents/waterMark/nyx/00.png"));
      else if (team === "seren")open(new File("C:/Users/abdoh/Documents/waterMark/seren/00.psd"));
    } catch (e) {}
  }

  // Run
  processFolder(originalsFolder);
  reopenProcessedPSDs(originalsFolder);

  if (app.documents.length > 0) app.activeDocument = app.documents[0];

  try { $.evalFile("C:/Users/abdoh/Downloads/testScript/scripts/read-bb-jsonfile.jsx"); }
  catch (e) { $.writeln("Skip read-bb-jsonfile.jsx: " + e); }
})();
