// #target photoshop
app.bringToFront();
app.preferences.rulerUnits = Units.PIXELS;
app.displayDialogs = DialogModes.NO;
app.preferences.numberOfHistoryStates = 1; // تقليل استهلاك الرام

var emptyDoc = open(
  new File("C:\\Users\\abdoh\\Documents\\waterMark\\seren\\empty.jpg")
);

(function mainLoop() {
  // ======= Helpers =======
  function trimStr(str) {
    return str.replace(/^\s+|\s+$/g, "");
  }

  function findByRegex(folder, regex) {
    var items = folder.getFiles(function (f) {
      return f instanceof File;
    });
    for (var i = 0; i < items.length; i++) {
      try {
        if (regex.test(items[i].name)) return items[i];
      } catch (_e) {}
    }
    return null;
  }

  // نسخة جاهزة من الووترمارك
  function prepareWatermarkLayer() {
    if (!watermarkFile) return;
    var wmDoc = open(watermarkFile);
    wmDoc.activeLayer = wmDoc.layers[0];
    wmDoc.selection.selectAll();
    wmDoc.selection.copy();
    wmDoc.close(SaveOptions.DONOTSAVECHANGES);
  }

  function addWatermark(doc) {
    app.activeDocument = doc;
    doc.paste();
    var layer = doc.activeLayer;
    layer.name = "Watermark";
    layer.opacity = 80;

    var docW = doc.width.as("px");
    var docH = doc.height.as("px");

    var b = layer.bounds;
    var curW = b[2].as("px") - b[0].as("px");

    var scale = ((docW * 0.35) / curW) * 100;
    layer.resize(scale, scale);

    b = layer.bounds;
    var curH = b[3].as("px") - b[1].as("px");

    // watermark تحت
    var targetX = 10 - b[0].as("px");
    var targetY = docH - 1000 - curH - b[1].as("px");
    layer.translate(targetX, targetY);

    // ✅ لو الفريق ken انسخ نسخة وحطها فوق بنفس المسافة اللي تحت
    if (chosenTeam.toLowerCase() === "ken") {
      var secondLayer = layer.duplicate();
      secondLayer.name = "Watermark Top";

      var b2 = secondLayer.bounds;
      var curH2 = b2[3].as("px") - b2[1].as("px");

      var topX = 10 - b2[0].as("px");
      // نفس المسافة من فوق (1000 px) زي اللي تحت
      var topY = 1000 - b2[1].as("px");

      secondLayer.translate(topX, topY);
    }
  }

  function processFolder(originalsFolder) {
    if (!originalsFolder) return;
    var cleanedFolder = new Folder(originalsFolder + "/cleaned");
    if (!cleanedFolder.exists) return;

    var files = originalsFolder.getFiles(/\.(jpe?g|png|psd)$/i);

    for (var i = 0; i < files.length; i++) {
      try {
        var originalFile = files[i];
        var baseName = originalFile.name.replace(/\.(jpe?g|png|psd)$/i, "");

        var regex = new RegExp(
          "^" + baseName + "(_clean)?\\.(psd|png|jpe?g)$",
          "i"
        );
        var cleanedFiles = cleanedFolder.getFiles(function (f) {
          return f instanceof File && regex.test(f.name);
        });
        if (cleanedFiles.length === 0) continue;

        var docOriginal = open(originalFile);
        var docCleaned = open(cleanedFiles[0]);

        docCleaned.activeLayer.duplicate(
          docOriginal,
          ElementPlacement.PLACEATBEGINNING
        );
        docCleaned.close(SaveOptions.DONOTSAVECHANGES);

        docOriginal.activeLayer.name = "Cleaned Layer page " + (i + 1);

        addWatermark(docOriginal);

        if (originalFile.name.match(/\.psd$/i)) {
          docOriginal.save();
        } else {
          var saveFile = new File(originalsFolder + "/" + baseName + ".psd");
          var psdOptions = new PhotoshopSaveOptions();
          psdOptions.embedColorProfile = true;
          psdOptions.alphaChannels = true;
          psdOptions.layers = true;
          docOriginal.saveAs(saveFile, psdOptions, true, Extension.LOWERCASE);
        }

        docOriginal.close(SaveOptions.DONOTSAVECHANGES);
      } catch (e) {
        if (app.documents.length > 0) {
          try {
            app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
          } catch (_e) {}
        }
      }
    }
  }

  function reopenProcessedPSDs(folder) {
    if (!folder.exists) return;
    var psdFiles = folder.getFiles(/\.psd$/i);
    psdFiles.sort(function (a, b) {
      return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
    });
    for (var i = 0; i < psdFiles.length; i++) {
      try {
        open(psdFiles[i]);
      } catch (e) {}
    }
  }

  function saveDocAsPSD(doc, name, outFolder) {
    var saveFile = new File(outFolder + "/" + name + ".psd");
    var psdOptions = new PhotoshopSaveOptions();
    psdOptions.embedColorProfile = true;
    psdOptions.alphaChannels = true;
    psdOptions.layers = true;
    doc.saveAs(saveFile, psdOptions, true, Extension.LOWERCASE);
    doc.close(SaveOptions.DONOTSAVECHANGES);
  }

  // ======= Read JSON config file =======
  var jsonFile = new File(
    "C:/Users/abdoh/Downloads/testScript/config/temp-title.json"
  );
  if (!jsonFile.exists) {
    alert("JSON config file not found");
    return;
  }

  jsonFile.open("r");
  var jsonStr = jsonFile.read();
  jsonFile.close();

  var data;
  try {
    data = eval("(" + jsonStr + ")");
  } catch (e) {
    alert("Error parsing JSON: " + e);
    return;
  }

  var title = trimStr(data.title);
  var originalsFolder = new Folder(data.folder_url);
  var param = data.pspath;
  var chosenTeam = trimStr(data.team);

  if (!originalsFolder.exists) {
    alert("originals folder not found");
    return;
  }

  // ======= Validate chosen team =======
  var teams = [
    "arura",
    "ez",
    "ken",
    "violet",
    "magus",
    "mei",
    "quantom",
    "rezo",
    "seren",
    "nyx",
  ];
  function inArray(arr, val) {
    for (var i = 0; i < arr.length; i++) if (arr[i] == val) return true;
    return false;
  }
  if (!inArray(teams, chosenTeam)) {
    alert("Invalid team in temp: " + chosenTeam);
    return;
  }

  var teamFolder = new Folder("~/Documents/waterMark/" + chosenTeam);
  if (!teamFolder.exists) {
    alert("Team folder not found: " + teamFolder.fsName);
    return;
  }

  // ======= Load watermark & end page =======
  var watermarkFile = findByRegex(teamFolder, /^watermark\.(?:png|jpe?g)$/i);
  var endFile = findByRegex(teamFolder, /^9{2,3}\.(?:png|jpe?g)$/i);
  if (!watermarkFile || !endFile) {
    alert("Missing watermark or end page");
    return;
  }

  prepareWatermarkLayer();

  // ======= Run Python script =======
  var pythonScript =
    "C:\\Users\\abdoh\\Downloads\\testScript\\python\\extract_bubbles_from_mask.py";
  var cmd = 'python "' + pythonScript + '" "' + param + '"';
  var runFile = new File(Folder.temp + "/runPython.bat");
  runFile.open("w");
  runFile.writeln("@echo off");
  runFile.writeln(cmd);
  runFile.close();
  runFile.execute();

  processFolder(originalsFolder);
  reopenProcessedPSDs(originalsFolder);

  // ======= Process 00 & 99 =======
  var basePath =
    "C:/Users/abdoh/Documents/waterMark/" + chosenTeam.toLowerCase() + "/";
  var exts = [".psd", ".png", ".jpg"],
    names = ["99", "00"];
  var outFolder = new Folder(data.folder_url);
  if (!outFolder.exists) outFolder.create();

  for (var i = 0; i < names.length; i++) {
    for (var j = 0; j < exts.length; j++) {
      var f = new File(basePath + names[i] + exts[j]);
      if (f.exists) {
        try {
          var doc = open(f);
          saveDocAsPSD(doc, names[i], outFolder);
        } catch (e) {
          alert("خطأ: " + f.fsName + "\n" + e);
        }
        break;
      }
    }
  }
  for (var i = 0; i < names.length; i++) {
    try {
      open(new File(outFolder + "\\" + names[i] + ".psd"));
    } catch (e) {}
  }

  emptyDoc.close(SaveOptions.DONOTSAVECHANGES);

  try {
    var batFile = new File(
      Folder.current + "/../batch/run_detext-bb-by-json.bat"
    );
    if (batFile.exists) batFile.execute();
  } catch (e) {
    alert("Error running BAT: " + e);
  }

  try {
    app.purge(PurgeTarget.ALLCACHES);
  } catch (e) {}

  try {
    var tempPaths = ["C:/Windows/Temp", "C:/Users/abdoh/AppData/Local/Temp"];

    function deleteRecursive(folder) {
      if (!folder.exists) return;
      var items = folder.getFiles();
      for (var i = 0; i < items.length; i++) {
        try {
          if (items[i] instanceof File) {
            items[i].remove();
          } else if (items[i] instanceof Folder) {
            deleteRecursive(items[i]);
            items[i].remove();
          }
        } catch (err) {}
      }
    }

    for (var t = 0; t < tempPaths.length; t++) {
      var tempFolder = new Folder(tempPaths[t]);
      if (tempFolder.exists) {
        deleteRecursive(tempFolder);
      }
    }
  } catch (err) {
    alert("حصل خطأ أثناء مسح ملفات TEMP: " + err.message);
  }
  try {
    var batFile = new File(
      "C:\\Users\\abdoh\\Downloads\\testScript\\batch\\run_detext-bb-by-json.bat"
    );
    if (batFile.exists) {
      // شغل الباتش مباشرة
      batFile.execute();
    } else {
      alert("BAT file not found: " + batFile.fsName);
    }
  } catch (e) {
    alert("Error running BAT file: " + e);
  }

  // ======= Go to first document (first page) =======
  if (app.documents.length > 0) {
    app.activeDocument = app.documents[0];
  }
  if (app.documents.length > 0) app.activeDocument = app.documents[0];
})();
