/* batchChangeFontSize_withUI.jsx
   يغير حجم الخط لكل طبقات النص في كل المستندات المفتوحة
   مع نافذة GUI أنيقة وذاكرة آخر قيمة مستخدمة
*/

// #target photoshop
app.bringToFront();

var memoryFile = new File(Folder.userData + "/ps_fontSizeMemory.txt");

// دالة قراءة آخر قيمة
function loadLastValue() {
  if (memoryFile.exists) {
    try {
      memoryFile.open("r");
      var val = memoryFile.read();
      memoryFile.close();
      if (!isNaN(parseFloat(val))) {
        return parseFloat(val);
      }
    } catch (e) {}
  }
  return 14; // القيمة الافتراضية
}

// دالة حفظ القيمة
function saveLastValue(val) {
  try {
    memoryFile.open("w");
    memoryFile.write(val);
    memoryFile.close();
  } catch (e) {}
}

// -------- واجهة المستخدم --------
var lastVal = loadLastValue();

var win = new Window("dialog", "تغيير حجم الخط");
win.orientation = "column";
win.alignChildren = "fill";

// العنوان
var info = win.add("statictext", undefined, "ادخل حجم الخط الجديد (pt):");
info.alignment = "left";

// مربع إدخال
var input = win.add("edittext", undefined, lastVal.toString());
input.characters = 10;

// الأزرار
var btnGroup = win.add("group");
btnGroup.alignment = "center";
var okBtn = btnGroup.add("button", undefined, "تشغيل");
var cancelBtn = btnGroup.add("button", undefined, "إلغاء", { name: "cancel" });

// -------- الأكشن --------
okBtn.onClick = function () {
  var newSize = parseFloat(input.text);
  if (isNaN(newSize) || newSize <= 0) {
    alert("من فضلك ادخل رقم صحيح أكبر من صفر.");
    return;
  }

  saveLastValue(newSize);

  var totalChanged = 0;
  
  // قيمة الإزاحة لتعويض ارتفاع صندوق النص
  var verticalOffset = 40; 

  function processLayers(layers) {
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      if (layer.typename === "ArtLayer" && layer.kind == LayerKind.TEXT) {
        try {
          // 1. تغيير حجم الخط
          layer.textItem.size = newSize;

          // 2. تعديل الموقع لتعويض التغير في الحجم (التحريك لأسفل)
          var currentPosition = layer.textItem.position;
          var newY = currentPosition[1] + verticalOffset; // إضافة 40 بكسل إلى الإحداثي Y
          layer.textItem.position = [currentPosition[0], newY]; // تطبيق الموقع الجديد
          
          totalChanged++;
        } catch (e) {}
      } else if (layer.typename === "LayerSet") {
        processLayers(layer.layers);
      }
    }
  }

  for (var d = 0; d < app.documents.length; d++) {
    var doc = app.documents[d];
    app.activeDocument = doc;
    processLayers(doc.layers);
  }

  alert("تم تغيير حجم الخط لـ " + totalChanged + " طبقة نص.");
  win.close();
};

cancelBtn.onClick = function () {
  win.close();
};

// إظهار النافذة
win.center();
win.show();