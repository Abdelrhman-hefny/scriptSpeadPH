#target photoshop

// تأكد إن فيه طبقة نصية محددة
function requireActiveTextLayer() {
    try {
        var doc = app.activeDocument;
        var layer = doc.activeLayer;
        if (layer.typename != "ArtLayer" || layer.kind != LayerKind.TEXT) {
            alert(" اختار طبقة نصية أولًا.");
            return null;
        }
        return layer;
    } catch (e) {
        alert(" افتح ملف واختار طبقة نصية.");
        return null;
    }
}

// فتح Color Picker مباشرة وإرجاع اللون اللي المستخدم اختاره
function quickPickColor() {
    if (app.showColorPicker()) {
        var c = app.foregroundColor.rgb;
        return [Math.round(c.red), Math.round(c.green), Math.round(c.blue)];
    }
    // لو المستخدم قفل الـ picker، نرجع اللون الحالي بدل ما نرمي خطأ
    var c = app.foregroundColor.rgb;
    return [Math.round(c.red), Math.round(c.green), Math.round(c.blue)];
}

// تطبيق Color Overlay وStroke على الطبقة
function applyColorOverlayAndStroke(layer, overlayRGB, strokeRGB, strokeSize) {
    var idsetd = charIDToTypeID("setd");
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("Lefx"));
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    desc.putReference(charIDToTypeID("null"), ref);

    var fxDesc = new ActionDescriptor();

    // ===== Color Overlay =====
    var overlay = charIDToTypeID("SoFi");
    var overlayDesc = new ActionDescriptor();
    overlayDesc.putBoolean(charIDToTypeID("enab"), true);
    overlayDesc.putEnumerated(charIDToTypeID("Md  "), charIDToTypeID("BlnM"), charIDToTypeID("Nrml"));
    overlayDesc.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), 100);

    var colorDesc = new ActionDescriptor();
    colorDesc.putDouble(charIDToTypeID("Rd  "), overlayRGB[0]);
    colorDesc.putDouble(charIDToTypeID("Grn "), overlayRGB[1]);
    colorDesc.putDouble(charIDToTypeID("Bl  "), overlayRGB[2]);
    overlayDesc.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), colorDesc);
    fxDesc.putObject(overlay, overlay, overlayDesc);

    // ===== Stroke ===== (3px أبيض تلقائي)
    var stroke = charIDToTypeID("FrFX");
    var strokeDesc = new ActionDescriptor();
    strokeDesc.putBoolean(charIDToTypeID("enab"), true);
    strokeDesc.putUnitDouble(charIDToTypeID("Sz  "), charIDToTypeID("#Pxl"), strokeSize);

    var strokeColorDesc = new ActionDescriptor();
    strokeColorDesc.putDouble(charIDToTypeID("Rd  "), strokeRGB[0]);
    strokeColorDesc.putDouble(charIDToTypeID("Grn "), strokeRGB[1]);
    strokeColorDesc.putDouble(charIDToTypeID("Bl  "), strokeRGB[2]);
    strokeDesc.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), strokeColorDesc);

    strokeDesc.putEnumerated(charIDToTypeID("Styl"), charIDToTypeID("FStl"), charIDToTypeID("OutF"));
    strokeDesc.putEnumerated(charIDToTypeID("Md  "), charIDToTypeID("BlnM"), charIDToTypeID("Nrml"));
    fxDesc.putObject(stroke, stroke, strokeDesc);

    desc.putObject(charIDToTypeID("T   "), charIDToTypeID("Lefx"), fxDesc);
    executeAction(idsetd, desc, DialogModes.NO);
}

// ===== Main =====
function main() {
    var lyr = requireActiveTextLayer();
    if (!lyr) return;

    // يفتح نافذة واحدة لاختيار لون النص فقط
    var overlayColor = quickPickColor();

    // الستروك أبيض وحجمه 3 بكسل تلقائيًا
    var strokeColor = [255, 255, 255];
    var strokeSize = 3;

    applyColorOverlayAndStroke(lyr, overlayColor, strokeColor, strokeSize);
}

main();
