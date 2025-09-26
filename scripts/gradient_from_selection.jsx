#target photoshop

function isNearWhiteOrGray(r, g, b, threshold) {
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    var nearWhite = (r > 255 - threshold && g > 255 - threshold && b > 255 - threshold);
    var isGray = Math.abs(r - g) < threshold && Math.abs(r - b) < threshold && Math.abs(g - b) < threshold;
    var nearGrayOrWhite = (luminance > 200 && isGray) || nearWhite;
    return nearGrayOrWhite;
}

function sampleRowAverage(doc, yPx, sampleCount, ignoreThreshold) {
    var w = doc.width.as('px');
    var xStep = Math.max(1, Math.floor(w / (sampleCount + 1)));
    var sumR = 0, sumG = 0, sumB = 0, kept = 0;
    for (var i = 1; i <= sampleCount; i++) {
        var x = i * xStep;
        var c = doc.colorSamplers.add([x, yPx]).color.rgb;
        var r = Math.round(c.red), g = Math.round(c.green), b = Math.round(c.blue);
        doc.colorSamplers[doc.colorSamplers.length - 1].remove();
        if (isNearWhiteOrGray(r, g, b, ignoreThreshold)) continue;
        sumR += r; sumG += g; sumB += b; kept++;
    }
    if (kept === 0) return [128, 128, 128];
    return [Math.round(sumR / kept), Math.round(sumG / kept), Math.round(sumB / kept)];
}

function getSelectionBoundsPx(doc) {
    var b = doc.selection.bounds; // UnitValue array: left, top, right, bottom
    return {
        left: b[0].as('px'),
        top: b[1].as('px'),
        right: b[2].as('px'),
        bottom: b[3].as('px')
    };
}

function applyGradientAndStroke(colorTop, colorBottom) {
    var idsetd = charIDToTypeID('setd');
    var idnull = charIDToTypeID('null');
    var idPrpr = charIDToTypeID('Prpr');
    var idLefx = charIDToTypeID('Lefx');
    var idLyr = charIDToTypeID('Lyr ');
    var idOrdn = charIDToTypeID('Ordn');
    var idTrgt = charIDToTypeID('Trgt');
    var idT = charIDToTypeID('T   ');

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putProperty(idPrpr, idLefx);
    ref.putEnumerated(idLyr, idOrdn, idTrgt);
    desc.putReference(idnull, ref);

    var fxDesc = new ActionDescriptor();

    // Gradient Overlay (GrFl)
    var grFl = charIDToTypeID('GrFl');
    var grFlDesc = new ActionDescriptor();
    grFlDesc.putBoolean(charIDToTypeID('enab'), true);
    grFlDesc.putEnumerated(charIDToTypeID('Md  '), charIDToTypeID('BlnM'), charIDToTypeID('Nrml'));
    grFlDesc.putUnitDouble(charIDToTypeID('Opct'), charIDToTypeID('#Prc'), 100);

    var grad = new ActionDescriptor();
    grad.putString(charIDToTypeID('Nm  '), 'FromSelection');
    grad.putEnumerated(charIDToTypeID('GrdF'), charIDToTypeID('GrdF'), charIDToTypeID('CstS'));
    grad.putDouble(charIDToTypeID('Intr'), 4096.0);

    var colors = new ActionList();
    var stopBottom = new ActionDescriptor();
    var stopBottomClr = new ActionDescriptor();
    stopBottomClr.putDouble(charIDToTypeID('Rd  '), colorBottom[0]);
    stopBottomClr.putDouble(charIDToTypeID('Grn '), colorBottom[1]);
    stopBottomClr.putDouble(charIDToTypeID('Bl  '), colorBottom[2]);
    stopBottom.putObject(charIDToTypeID('Clr '), charIDToTypeID('RGBC'), stopBottomClr);
    stopBottom.putEnumerated(charIDToTypeID('Type'), charIDToTypeID('Clry'), charIDToTypeID('UsrS'));
    stopBottom.putInteger(charIDToTypeID('Lctn'), 0);
    stopBottom.putInteger(charIDToTypeID('Mdpn'), 50);
    colors.putObject(charIDToTypeID('Clrt'), stopBottom);

    var stopTop = new ActionDescriptor();
    var stopTopClr = new ActionDescriptor();
    stopTopClr.putDouble(charIDToTypeID('Rd  '), colorTop[0]);
    stopTopClr.putDouble(charIDToTypeID('Grn '), colorTop[1]);
    stopTopClr.putDouble(charIDToTypeID('Bl  '), colorTop[2]);
    stopTop.putObject(charIDToTypeID('Clr '), charIDToTypeID('RGBC'), stopTopClr);
    stopTop.putEnumerated(charIDToTypeID('Type'), charIDToTypeID('Clry'), charIDToTypeID('UsrS'));
    stopTop.putInteger(charIDToTypeID('Lctn'), 4096);
    stopTop.putInteger(charIDToTypeID('Mdpn'), 50);
    colors.putObject(charIDToTypeID('Clrt'), stopTop);

    grad.putList(charIDToTypeID('Clrs'), colors);

    var trans = new ActionList();
    var t0 = new ActionDescriptor();
    t0.putUnitDouble(charIDToTypeID('Opct'), charIDToTypeID('#Prc'), 100);
    t0.putInteger(charIDToTypeID('Lctn'), 0);
    t0.putInteger(charIDToTypeID('Mdpn'), 50);
    trans.putObject(charIDToTypeID('TrnS'), t0);
    var t1 = new ActionDescriptor();
    t1.putUnitDouble(charIDToTypeID('Opct'), charIDToTypeID('#Prc'), 100);
    t1.putInteger(charIDToTypeID('Lctn'), 4096);
    t1.putInteger(charIDToTypeID('Mdpn'), 50);
    trans.putObject(charIDToTypeID('TrnS'), t1);
    grad.putList(charIDToTypeID('Trns'), trans);

    grFlDesc.putObject(charIDToTypeID('Grad'), charIDToTypeID('Grdn'), grad);
    grFlDesc.putUnitDouble(charIDToTypeID('Angl'), charIDToTypeID('#Ang'), 90);
    grFlDesc.putEnumerated(charIDToTypeID('Type'), charIDToTypeID('GrdT'), charIDToTypeID('Lnr '));
    grFlDesc.putBoolean(charIDToTypeID('Algn'), true);
    grFlDesc.putUnitDouble(charIDToTypeID('Scl '), charIDToTypeID('#Prc'), 100);
    fxDesc.putObject(grFl, grFl, grFlDesc);

    desc.putObject(idT, idLefx, fxDesc);
    executeAction(idsetd, desc, DialogModes.NO);
}

function main() {
    if (app.documents.length === 0) {
        alert('Open a document first.');
        return;
    }
    var doc = app.activeDocument;
    if (!doc.selection) {
        alert('Make a selection on the image area first.');
        return;
    }
    try {
        var b = getSelectionBoundsPx(doc);
        var height = b.bottom - b.top;
        var offset = Math.min(10, Math.round(height * 0.1)); // إزاحة داخلية بنسبة 10% أو 10 بكسل كحد أقصى
        var topY = Math.max(1, Math.round(b.top + offset)); // ابدأ من داخل النص
        var bottomY = Math.max(1, Math.round(b.bottom - offset)); // انتهي من داخل النص
        var ignoreThreshold = 20;
        var samplesPerRow = 9;

        var topRGB = sampleRowAverage(doc, topY, samplesPerRow, ignoreThreshold);
        var bottomRGB = sampleRowAverage(doc, bottomY, samplesPerRow, ignoreThreshold);

        if (app.activeDocument.activeLayer.kind != LayerKind.TEXT) {
            alert('Select a text layer to apply the gradient.');
            return;
        }
        applyGradientAndStroke(topRGB, bottomRGB);
    } catch (e) {
        alert('Error: ' + e);
    }
}

main();