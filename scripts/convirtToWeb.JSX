// #target photoshop
app.bringToFront();

function main() {
  if (app.documents.length === 0) {
    alert("⚠️ No document is currently open in Photoshop.");
    return;
  }

  // Path of the current opened document
  var docPath = app.activeDocument.path.fsName;
  var currentFolderName = new Folder(docPath).name;
  var parentFolder = new Folder(docPath).fsName;
  var jpgFolderPath = parentFolder + "\\" + currentFolderName + "_JPG";
  var jpgFolder = new Folder(jpgFolderPath);

  if (!jpgFolder.exists) {
    alert("❌ Folder not found:\n" + jpgFolderPath);
    return;
  }

  // SmartStitch directory
  var smartStitchDir =
    "C:\\Users\\abdoh\\Downloads\\testScript\\SmartStitch-3.1";
  var ssFile = new File(smartStitchDir + "\\SmartStitchConsole.py");
  if (!ssFile.exists) {
    alert("❌ SmartStitchConsole.py not found:\n" + ssFile.fsName);
    return;
  }

  function norm(p) {
    return p.replace(/\\/g, "/");
  }

  var smartPath = norm(ssFile.fsName);
  var inputPath = norm(jpgFolderPath);
  var runDir = norm(smartStitchDir); // ✅ Run from SmartStitch folder

  // ✅ Added "-cw 800" to enforce width = 800 pixels
  var cmd =
    'cmd /c "cd /d ' +
    '"' +
    runDir +
    '"' +
    " && echo ================================" +
    " && echo 🚀 Starting SmartStitch..." +
    " && echo ================================" +
    ' && python "' +
    smartPath +
    '" -i "' +
    inputPath +
    '" -sh 14000 -cw 800 -t .webp -lq 95 -dt pixel -s 90 -ip 5 -sl 5 2>&1' +
    " && echo." +
    " && echo ✅ All images processed successfully." +
    " && echo CMD will close automatically in 10 seconds..." +
    " && timeout /t 1 /nobreak >nul" +
    ' && exit"';

  try {
    app.system(cmd);
  } catch (e) {
    alert("⚠️ Error while running Python:\n" + e);
  }
}

main();

$.evalFile("C:/Users/abdoh/Downloads/testScript/scripts/COMPOS2-ZIP.JSX");
