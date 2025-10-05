// #target photoshop
app.bringToFront();

var url = "https://coda.io/d/Work_dhT8XA1rThZ/rezo_supN5Ws5#_luDJkH25";
//var chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
var chrome =
  '"C:\\Users\\abdoh\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"';

var f = new File(Folder.temp + "/o.bat");
f.open("w");
f.writeln("@echo off");
f.writeln(chrome + ' "' + url + '"');
f.writeln('del "%~f0"');
f.close();
f.execute();

if (app.documents.length === 0) {
  alert("لا يوجد مستند مفتوح في الفوتوشوب.");
} else {
  var docPath = app.activeDocument.path.fsName;
  var currentFolderName = new Folder(docPath).name;
  var parentFolder = new Folder(docPath).fsName;

  // افتح 00.psd إن وجد ولم يكن مفتوحًا
  try {
    var zeroPsd = new File(parentFolder + "\\00.psd");
    if (zeroPsd.exists) {
      var isZeroOpen = false;
      try {
        for (var zi = 0; zi < app.documents.length; zi++) {
          try {
            var zdoc = app.documents[zi];
            if (zdoc && zdoc.fullName && zdoc.fullName.fsName) {
              if (
                String(zdoc.fullName.fsName).toLowerCase() ===
                String(zeroPsd.fsName).toLowerCase()
              ) {
                isZeroOpen = true;
                break;
              }
            } else if (zdoc && zdoc.name && /\.psd$/i.test(zdoc.name)) {
              if (String(zdoc.name).toLowerCase() === "00.psd") {
                isZeroOpen = true;
                break;
              }
            }
          } catch (_ze) {}
        }
      } catch (_zl) {}
      if (!isZeroOpen) {
        try {
          app.open(zeroPsd);
        } catch (_zo) {}
      }
    }
  } catch (_zerr) {}

  var targetFolder = parentFolder + "\\" + currentFolderName + "_JPG";
  var jpgFolder = new Folder(targetFolder);
  if (!jpgFolder.exists) jpgFolder.create();

  var jpgOptions = new JPEGSaveOptions();
  jpgOptions.quality = 12;

  for (var i = 0; i < app.documents.length; i++) {
    var doc = app.documents[i];
    app.activeDocument = doc; //  لازم تخليه Active قبل الحفظ

    var fileName = doc.name.replace(/\.[^\.]+$/, "") + ".jpg";
    var saveFile = new File(jpgFolder.fsName + "\\" + fileName);

    doc.saveAs(saveFile, jpgOptions, true, Extension.LOWERCASE);
  }
}
try {
  // مسارات الملفات المؤقتة
  var tempPaths = ["C:/Windows/Temp", "C:/Users/abdoh/AppData/Local/Temp"];

  function deleteRecursive(folder) {
    if (!folder.exists) return;
    var items = folder.getFiles();
    for (var i = 0; i < items.length; i++) {
      try {
        if (items[i] instanceof File) {
          items[i].remove(); // حذف ملف
        } else if (items[i] instanceof Folder) {
          deleteRecursive(items[i]); // حذف محتويات المجلد أولاً
          items[i].remove(); // بعدين المجلد نفسه
        }
      } catch (e) {
        // تجاهل الملفات/المجلدات المقفولة أو المحمية
      }
    }
  }

  for (var t = 0; t < tempPaths.length; t++) {
    var tempFolder = new Folder(tempPaths[t]);
    if (tempFolder.exists) {
      deleteRecursive(tempFolder);
    }
  }
} catch (err) {
  alert("حصل خطأ أثناء تنظيف ملفات Temp: " + err.message);
}
