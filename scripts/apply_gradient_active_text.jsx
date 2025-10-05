// #target photoshop

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

function applyGradientAndStroke(layer, topRGB, bottomRGB) {
  var idsetd = charIDToTypeID("setd");
  var desc = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("Lefx"));
  ref.putEnumerated(
    charIDToTypeID("Lyr "),
    charIDToTypeID("Ordn"),
    charIDToTypeID("Trgt")
  );
  desc.putReference(charIDToTypeID("null"), ref);

  var fxDesc = new ActionDescriptor();

  // ===== Gradient Overlay =====
  var grFl = charIDToTypeID("GrFl");
  var grFlDesc = new ActionDescriptor();
  grFlDesc.putBoolean(charIDToTypeID("enab"), true);
  grFlDesc.putEnumerated(
    charIDToTypeID("Md  "),
    charIDToTypeID("BlnM"),
    charIDToTypeID("Nrml")
  );
  grFlDesc.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), 100);
  grFlDesc.putUnitDouble(charIDToTypeID("Angl"), charIDToTypeID("#Ang"), 90);
  grFlDesc.putEnumerated(
    charIDToTypeID("Type"),
    charIDToTypeID("GrdT"),
    charIDToTypeID("Lnr ")
  );

  var grad = new ActionDescriptor();
  grad.putString(charIDToTypeID("Nm  "), "Custom");
  grad.putEnumerated(
    charIDToTypeID("GrdF"),
    charIDToTypeID("GrdF"),
    charIDToTypeID("CstS")
  );

  var colors = new ActionList();
  function makeGradientStop(colorRGB, loc) {
    var stop = new ActionDescriptor();
    var stopClr = new ActionDescriptor();
    stopClr.putDouble(charIDToTypeID("Rd  "), colorRGB[0]);
    stopClr.putDouble(charIDToTypeID("Grn "), colorRGB[1]);
    stopClr.putDouble(charIDToTypeID("Bl  "), colorRGB[2]);
    stop.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), stopClr);
    stop.putEnumerated(
      charIDToTypeID("Type"),
      charIDToTypeID("Clry"),
      charIDToTypeID("UsrS")
    );
    stop.putInteger(charIDToTypeID("Lctn"), loc);
    stop.putInteger(charIDToTypeID("Mdpn"), 50);
    return stop;
  }
  colors.putObject(charIDToTypeID("Clrt"), makeGradientStop(bottomRGB, 0));
  colors.putObject(charIDToTypeID("Clrt"), makeGradientStop(topRGB, 4096));
  grad.putList(charIDToTypeID("Clrs"), colors);

  grFlDesc.putObject(charIDToTypeID("Grad"), charIDToTypeID("Grdn"), grad);
  fxDesc.putObject(grFl, grFl, grFlDesc);

  // ===== Stroke خارجي =====
  var stroke = charIDToTypeID("FrFX");
  var strokeDesc = new ActionDescriptor();
  strokeDesc.putBoolean(charIDToTypeID("enab"), true);
  strokeDesc.putUnitDouble(charIDToTypeID("Sz  "), charIDToTypeID("#Pxl"), 3);

  var colorDesc = new ActionDescriptor();
  colorDesc.putDouble(charIDToTypeID("Rd  "), 255);
  colorDesc.putDouble(charIDToTypeID("Grn "), 255);
  colorDesc.putDouble(charIDToTypeID("Bl  "), 255);
  strokeDesc.putObject(
    charIDToTypeID("Clr "),
    charIDToTypeID("RGBC"),
    colorDesc
  );

  strokeDesc.putEnumerated(
    charIDToTypeID("Styl"),
    charIDToTypeID("FStl"),
    charIDToTypeID("OutF")
  );
  strokeDesc.putEnumerated(
    charIDToTypeID("Md  "),
    charIDToTypeID("BlnM"),
    charIDToTypeID("Nrml")
  );
  fxDesc.putObject(stroke, stroke, strokeDesc);

  desc.putObject(charIDToTypeID("T   "), charIDToTypeID("Lefx"), fxDesc);
  executeAction(idsetd, desc, DialogModes.NO);
}

function main() {
  var lyr = requireActiveTextLayer();
  if (!lyr) return;

  try {
    var topRGB = pickColorWithDialog("Pick TOP color (upper part of text)");
    var bottomRGB = pickColorWithDialog(
      "Pick BOTTOM color (lower part of text)"
    );
    app.activeDocument.activeLayer = lyr;

    // نطبق الجريدينت + ستروك خارجي مباشرة على النص بدون Rasterize
    applyGradientAndStroke(lyr, topRGB, bottomRGB);
  } catch (e) {
    alert("Cancelled or error: " + e);
  }
}

main();
