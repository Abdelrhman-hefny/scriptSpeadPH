//@target photoshop
app.bringToFront();

function getAverageColor(yPos, height) {
    var doc = app.activeDocument;
    var b = doc.selection.bounds; // [left, top, right, bottom]

    var left = b[0].as("px");
    var right = b[2].as("px");
    var width = right - left;

    // نحدد شريط أفقي
    doc.selection.select([
        [left, yPos],
        [right, yPos],
        [right, yPos + height],
        [left, yPos + height]
    ]);

    // ننسخ من جميع الطبقات المرئية (Copy Merged) حتى لو كنا واقفين على طبقة نص
    doc.selection.copy(true);
    var tempDoc = app.documents.add(width, height, doc.resolution, "temp", NewDocumentMode.RGB);
    tempDoc.paste();

    // نصغر لـ 1×1 pixel لأخذ المتوسط
    tempDoc.resizeImage(UnitValue(1, "px"), UnitValue(1, "px"), null, ResampleMethod.BICUBIC);
    var sampleColor = tempDoc.colorSamplers.add([0.5, 0.5]).color;

    tempDoc.close(SaveOptions.DONOTSAVECHANGES);
    return sampleColor;
}

// يطبق Gradient Overlay كـ Layer Style على الطبقة النشطة (يفضل طبقة نص)
function applyGradientOverlayToActiveLayer(topColor, bottomColor) {
  function rgbToColorDesc(c) {
    var d = new ActionDescriptor();
    d.putDouble(charIDToTypeID('Rd  '), c.rgb.red);
    d.putDouble(charIDToTypeID('Grn '), c.rgb.green);
    d.putDouble(charIDToTypeID('Bl  '), c.rgb.blue);
    return d;
  }

  var desc = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
  desc.putReference(charIDToTypeID('null'), ref);

  var lefx = new ActionDescriptor();
  lefx.putUnitDouble(charIDToTypeID('Scl '), charIDToTypeID('#Prc'), 100.0);

  var grFl = new ActionDescriptor();
  grFl.putBoolean(charIDToTypeID('enab'), true);
  grFl.putEnumerated(charIDToTypeID('Md  '), charIDToTypeID('BlnM'), charIDToTypeID('Nrml'));
  grFl.putUnitDouble(charIDToTypeID('Opct'), charIDToTypeID('#Prc'), 100.0);
  grFl.putEnumerated(charIDToTypeID('Type'), charIDToTypeID('GrdT'), charIDToTypeID('Lnr '));
  grFl.putBoolean(charIDToTypeID('Rvrs'), false);
  grFl.putBoolean(charIDToTypeID('Algn'), true);
  grFl.putUnitDouble(charIDToTypeID('Angl'), charIDToTypeID('#Ang'), 90.0);
  grFl.putUnitDouble(charIDToTypeID('Scl '), charIDToTypeID('#Prc'), 100.0);

  var grdn = new ActionDescriptor();
  grdn.putString(charIDToTypeID('Nm  '), 'SelectionTopBottom');
  grdn.putEnumerated(charIDToTypeID('GrdF'), charIDToTypeID('GrdF'), charIDToTypeID('CstS'));

  var clrs = new ActionList();
  var st0 = new ActionDescriptor();
  st0.putInteger(charIDToTypeID('Lctn'), 0);
  st0.putInteger(charIDToTypeID('Mdpn'), 50);
  st0.putObject(charIDToTypeID('Clr '), charIDToTypeID('RGBC'), rgbToColorDesc(topColor));
  clrs.putObject(charIDToTypeID('Clrt'), st0);

  var st1 = new ActionDescriptor();
  st1.putInteger(charIDToTypeID('Lctn'), 4096);
  st1.putInteger(charIDToTypeID('Mdpn'), 50);
  st1.putObject(charIDToTypeID('Clr '), charIDToTypeID('RGBC'), rgbToColorDesc(bottomColor));
  clrs.putObject(charIDToTypeID('Clrt'), st1);
  grdn.putList(charIDToTypeID('Clrs'), clrs);

  var trns = new ActionList();
  function addTr(loc) {
    var t = new ActionDescriptor();
    t.putInteger(charIDToTypeID('Lctn'), loc);
    t.putInteger(charIDToTypeID('Mdpn'), 50);
    var op = new ActionDescriptor();
    op.putUnitDouble(charIDToTypeID('Opct'), charIDToTypeID('#Prc'), 100.0);
    t.putObject(charIDToTypeID('Opct'), charIDToTypeID('Opct'), op);
    trns.putObject(charIDToTypeID('TrnS'), t);
  }
  addTr(0);
  addTr(4096);
  grdn.putList(charIDToTypeID('Trns'), trns);

  grFl.putObject(charIDToTypeID('Grad'), charIDToTypeID('Grdn'), grdn);
  lefx.putObject(charIDToTypeID('GrFl'), charIDToTypeID('GrFl'), grFl);
  desc.putObject(charIDToTypeID('T   '), charIDToTypeID('Lefx'), lefx);

  executeAction(charIDToTypeID('setd'), desc, DialogModes.NO);
}

// -----------------------------------

if (app.documents.length === 0) {
    alert("⚠️ افتح ملف واعمل Selection الأول");
} else {
    var doc = app.activeDocument;
    var b = doc.selection.bounds;
    var baseTextLayer = doc.activeLayer;

    var topY = b[1].as("px");
    var bottomY = b[3].as("px");

    var topColor = getAverageColor(topY, 5);
    var bottomColor = getAverageColor(bottomY - 5, 5);

    var layer = doc.activeLayer;
    if (layer.kind == LayerKind.TEXT) {
        // أولاً نحاول تطبيق Layer Style مباشرةً على طبقة النص
        var __appliedStyle = false;
        try {
            applyGradientOverlayToActiveLayer(topColor, bottomColor);
            __appliedStyle = true;
        } catch (_styErr) {
            __appliedStyle = false;
        }
        if (__appliedStyle) {
            alert('✅ تم تطبيق Gradient Overlay مباشرة على طبقة النص');
        } else {
        // بديل متوافق 100%: نصنع تدرجاً كصورة ثم ندمجه مع طبقة النص للحفاظ على طبقة واحدة
        var selLeft = b[0].as('px');
        var selTop = b[1].as('px');
        var selRight = b[2].as('px');
        var selBottom = b[3].as('px');
        var selW = Math.max(2, selRight - selLeft);
        var selH = Math.max(2, selBottom - selTop);

        var prevDoc = app.activeDocument;
        // نصنع صورة صغيرة جداً 2px ارتفاع: صف علوي بلون الأعلى وصف سفلي بلون الأسفل
        var tmp = app.documents.add(2, 2, prevDoc.resolution, 'tmpGradient', NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
        var sc = new SolidColor();
        // الصف العلوي
        sc.rgb.red = topColor.rgb.red; sc.rgb.green = topColor.rgb.green; sc.rgb.blue = topColor.rgb.blue;
        app.foregroundColor = sc;
        tmp.selection.select([[0, 0], [2, 0], [2, 1], [0, 1]]);
        tmp.selection.fill(app.foregroundColor, ColorBlendMode.NORMAL, 100, false);
        // الصف السفلي
        sc.rgb.red = bottomColor.rgb.red; sc.rgb.green = bottomColor.rgb.green; sc.rgb.blue = bottomColor.rgb.blue;
        app.foregroundColor = sc;
        tmp.selection.select([[0, 1], [2, 1], [2, 2], [0, 2]]);
        tmp.selection.fill(app.foregroundColor, ColorBlendMode.NORMAL, 100, false);
        tmp.selection.deselect();
        // نمد الصورة رأسياً لارتفاع التحديد وبعرض صغير (10px) مع BICUBIC لصناعة التدرج بسرعة
        tmp.resizeImage(UnitValue(10, 'px'), UnitValue(Math.max(2, Math.round(selH)), 'px'), null, ResampleMethod.BICUBIC);
        tmp.selection.selectAll();
        tmp.selection.copy();
        app.activeDocument = prevDoc;
        prevDoc.paste();

        var pasted = prevDoc.activeLayer;
        // مقاس الطبقة الحالية
        var lb = pasted.bounds; var l = lb[0].as('px'), t2 = lb[1].as('px'), r = lb[2].as('px'), btm = lb[3].as('px');
        var curW = Math.max(1, r - l); var curH = Math.max(1, btm - t2);
        var scaleX = (selW / curW) * 100.0; var scaleY = (selH / curH) * 100.0;
        pasted.resize(scaleX, scaleY, AnchorPosition.MIDDLECENTER);

        // حرّك لمركز التحديد
        lb = pasted.bounds; l = lb[0].as('px'); t2 = lb[1].as('px'); r = lb[2].as('px'); btm = lb[3].as('px');
        var cx = (l + r) / 2; var cy = (t2 + btm) / 2;
        var selCx = (selLeft + selRight) / 2; var selCy = (selTop + selBottom) / 2;
        pasted.translate(selCx - cx, selCy - cy);

        // امسك الطبقة على طبقة النص
        try { pasted.grouped = true; } catch (_eg) {}
        // اخفِ تعبئة طبقة النص ليظهر التدرج داخل النص
        try { if (baseTextLayer && baseTextLayer.kind == LayerKind.TEXT) { baseTextLayer.fillOpacity = 0; } } catch (_eo) {}
        // ادمج لطبقة واحدة (سيتم رسترة النص)
        try { app.activeDocument.activeLayer = pasted; pasted.merge(); } catch (_em) {}

        // نظف
        try { tmp.close(SaveOptions.DONOTSAVECHANGES); } catch (_ec) {}

        alert('✅ تم تطبيق التدرج على نفس طبقة النص (مع رسترة في حال عدم دعم الستايل).');
        }
    } else {
        alert("⚠️ لازم تكون واقف على طبقة نص!");
    }
}
