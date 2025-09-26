#target photoshop

function requireActiveTextLayer() {
    try {
        var doc = app.activeDocument;
        var layer = doc.activeLayer;
        if (layer.typename != "ArtLayer" || layer.kind != LayerKind.TEXT) {
             return null;
        }
        return layer;
    } catch (e) {
        alert("Open a document and select a text layer.");
        return null;
    }
}

function pickColorWithDialog(promptMessage) {
     var ok = app.showColorPicker();
    if (!ok) {
        throw new Error("Color picking cancelled.");
    }
    var c = app.foregroundColor.rgb;
    return [Math.round(c.red), Math.round(c.green), Math.round(c.blue)];
}

function applyGradientOverlayToActiveLayer(colorTop, colorBottom, angleDeg) {
    var idsetd = charIDToTypeID("setd");
    var idnull = charIDToTypeID("null");
    var idPrpr = charIDToTypeID("Prpr");
    var idLefx = charIDToTypeID("Lefx");
    var idLyr = charIDToTypeID("Lyr ");
    var idOrdn = charIDToTypeID("Ordn");
    var idTrgt = charIDToTypeID("Trgt");
    var idT = charIDToTypeID("T   ");

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putProperty(idPrpr, idLefx);
    ref.putEnumerated(idLyr, idOrdn, idTrgt);
    desc.putReference(idnull, ref);

    var fxDesc = new ActionDescriptor();

    var grFl = charIDToTypeID("GrFl");
    var grFlDesc = new ActionDescriptor();

    grFlDesc.putBoolean(charIDToTypeID("enab"), true);
    grFlDesc.putBoolean(stringIDToTypeID("present"), true);
    grFlDesc.putBoolean(stringIDToTypeID("showInDialog"), true);
    grFlDesc.putEnumerated(charIDToTypeID("Md  "), charIDToTypeID("BlnM"), charIDToTypeID("Nrml"));
    grFlDesc.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), 100);

    var grad = new ActionDescriptor();
    grad.putString(charIDToTypeID("Nm  "), "Custom");
    grad.putEnumerated(charIDToTypeID("GrdF"), charIDToTypeID("GrdF"), charIDToTypeID("CstS"));
    grad.putDouble(charIDToTypeID("Intr"), 4096.0);

    var colors = new ActionList();
    var stopBottom = new ActionDescriptor();
    var stopBottomClr = new ActionDescriptor();
    stopBottomClr.putDouble(charIDToTypeID("Rd  "), colorBottom[0]);
    stopBottomClr.putDouble(charIDToTypeID("Grn "), colorBottom[1]);
    stopBottomClr.putDouble(charIDToTypeID("Bl  "), colorBottom[2]);
    stopBottom.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), stopBottomClr);
    stopBottom.putEnumerated(charIDToTypeID("Type"), charIDToTypeID("Clry"), charIDToTypeID("UsrS"));
    stopBottom.putInteger(charIDToTypeID("Lctn"), 0);
    stopBottom.putInteger(charIDToTypeID("Mdpn"), 50);
    colors.putObject(charIDToTypeID("Clrt"), stopBottom);

    var stopTop = new ActionDescriptor();
    var stopTopClr = new ActionDescriptor();
    stopTopClr.putDouble(charIDToTypeID("Rd  "), colorTop[0]);
    stopTopClr.putDouble(charIDToTypeID("Grn "), colorTop[1]);
    stopTopClr.putDouble(charIDToTypeID("Bl  "), colorTop[2]);
    stopTop.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), stopTopClr);
    stopTop.putEnumerated(charIDToTypeID("Type"), charIDToTypeID("Clry"), charIDToTypeID("UsrS"));
    stopTop.putInteger(charIDToTypeID("Lctn"), 4096);
    stopTop.putInteger(charIDToTypeID("Mdpn"), 50);
    colors.putObject(charIDToTypeID("Clrt"), stopTop);

    grad.putList(charIDToTypeID("Clrs"), colors);

    var trans = new ActionList();
    var t0 = new ActionDescriptor();
    t0.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), 100);
    t0.putInteger(charIDToTypeID("Lctn"), 0);
    t0.putInteger(charIDToTypeID("Mdpn"), 50);
    trans.putObject(charIDToTypeID("TrnS"), t0);
    var t1 = new ActionDescriptor();
    t1.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), 100);
    t1.putInteger(charIDToTypeID("Lctn"), 4096);
    t1.putInteger(charIDToTypeID("Mdpn"), 50);
    trans.putObject(charIDToTypeID("TrnS"), t1);
    grad.putList(charIDToTypeID("Trns"), trans);

    grFlDesc.putObject(charIDToTypeID("Grad"), charIDToTypeID("Grdn"), grad);
    grFlDesc.putUnitDouble(charIDToTypeID("Angl"), charIDToTypeID("#Ang"), angleDeg);
    grFlDesc.putEnumerated(charIDToTypeID("Type"), charIDToTypeID("GrdT"), charIDToTypeID("Lnr "));
    grFlDesc.putBoolean(charIDToTypeID("Rvrs"), false);
    grFlDesc.putBoolean(charIDToTypeID("Dthr"), false);
    grFlDesc.putBoolean(charIDToTypeID("Algn"), true);
    grFlDesc.putUnitDouble(charIDToTypeID("Scl "), charIDToTypeID("#Prc"), 100);

    var ofst = new ActionDescriptor();
    ofst.putUnitDouble(charIDToTypeID("Hrzn"), charIDToTypeID("#Prc"), 0);
    ofst.putUnitDouble(charIDToTypeID("Vrtc"), charIDToTypeID("#Prc"), 0);
    grFlDesc.putObject(charIDToTypeID("Ofst"), charIDToTypeID("Pnt "), ofst);

    fxDesc.putObject(grFl, grFl, grFlDesc);
    desc.putObject(idT, idLefx, fxDesc);
    executeAction(idsetd, desc, DialogModes.NO);
}

function main() {
    var lyr = requireActiveTextLayer();
    if (!lyr) return;
    try {
        var topRGB = pickColorWithDialog("Pick TOP color (upper part of text)");
        var bottomRGB = pickColorWithDialog("Pick BOTTOM color (lower part of text)");
        app.activeDocument.activeLayer = lyr;
        applyGradientOverlayToActiveLayer(topRGB, bottomRGB, 90);
     } catch (e) {
        alert("Cancelled or error: " + e);
    }
}

main();

  

