#target photoshop

// ===== Helpers =====
function trimString(s) {  
    return s.replace(/^\uFEFF/, "").replace(/^\s+/, "").replace(/\s+$/, "");  
}
function toPx(v) { 
    try { return v.as("px"); } catch (e) { return Number(v); } 
}

// اجمع كل طبقات النص (Recursive)
function collectTextLayers(container, out) {
    for (var i = 0; i < container.layers.length; i++) {
        var lyr = container.layers[i];
        if (lyr.typename === "ArtLayer" && lyr.kind === LayerKind.TEXT) {
            out.push(lyr);
        } else if (lyr.typename === "LayerSet") {
            collectTextLayers(lyr, out);
        }
    }
}

// حساب السطوع من RGB
function luminance(r, g, b) {
    return 0.299*r + 0.587*g + 0.114*b;
}

// اخد عينة من بكسل معين
function samplePixel(doc, x, y) {
    var colorSampler = doc.colorSamplers.add([UnitValue(x,"px"), UnitValue(y,"px")]);
    var c = colorSampler.color.rgb;
    var rgb = [c.red, c.green, c.blue];
    colorSampler.remove();
    return rgb;
}

// ===== اختيار ملف النصوص =====
var file = File.openDialog("اختر ملف النصوص (TXT)");
if (!file) {
    alert(" لم يتم اختيار ملف النصوص!");
} else {
    // قراءة الأسطر
    var lines = [];
    file.open("r");
    while (!file.eof) {
        var raw = file.readln();
        var line = trimString(raw);
        if (line.length > 0) lines.push(line);
    }
    file.close();

    if (app.documents.length === 0) {
        alert(" مفيش مستند مفتوح في فوتوشوب.");
    } else {
        var doc = app.activeDocument;

        // جمع طبقات النص
        var textLayers = [];
        collectTextLayers(doc, textLayers);

        if (textLayers.length === 0) {
            alert("⚠ مفيش طبقات نص في الملف.");
        } else {
            // ترتيب بصري من أعلى لأسفل حسب bounds
            textLayers.sort(function(a, b) {
                var ay = toPx(a.bounds[1]); // top
                var by = toPx(b.bounds[1]);
                return ay - by; // الأصغر فوق
            });

            // توزيع النصوص
            var n = Math.min(textLayers.length, lines.length);
            for (var i = 0; i < n; i++) {
                var lyr = textLayers[i];
                lyr.textItem.contents = lines[i];
                try { lyr.name = lines[i]; } catch (e) {}

                // احسب مركز الطبقة
                var xMid = (toPx(lyr.bounds[0]) + toPx(lyr.bounds[2])) / 2;
                var yMid = (toPx(lyr.bounds[1]) + toPx(lyr.bounds[3])) / 2;

                // اخفي الطبقة مؤقت عشان نقرا الخلفية
                var wasVisible = lyr.visible;
                lyr.visible = false;

                // خد عينة لون من الخلفية
                var rgb = samplePixel(doc, xMid, yMid);

                // رجّع الطبقة زي ما كانت
                lyr.visible = wasVisible;

                var bright = luminance(rgb[0], rgb[1], rgb[2]);

                // غامق أو فاتح
                var c = new SolidColor();
                if (bright < 128) {
                    // خلفية غامقة → نص أبيض
                    c.rgb.red = 255; c.rgb.green = 255; c.rgb.blue = 255;
                } else {
                    // خلفية فاتحة → نص أسود
                    c.rgb.red = 0; c.rgb.green = 0; c.rgb.blue = 0;
                }
                lyr.textItem.color = c;
            }

            // تنبيه
            if (lines.length > textLayers.length) {
                alert("تم ملء " + n + " طبقة.\n⚠ عندك " + (lines.length - textLayers.length) + " سطر زيادة في TXT.");
            } else if (textLayers.length > lines.length) {
                alert("تم ملء " + n + " طبقة.\n⚠ عندك " + (textLayers.length - lines.length) + " طبقات نص زيادة بدون محتوى.");
            } else {
                alert(" تم توزيع النصوص + ضبط اللون حسب الخلفية على " + n + " طبقة.");
            }
        }
    }
}
