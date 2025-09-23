// Fixing text centering issue in manga bubbles
// Based on TyperTools 1.4.6 and optimized for general use

// Global variables
var charID = {
  Back: 1113678699,
  Background: 1113811815,
  Bottom: 1114926957,
  By: 1115234336,
  Channel: 1130917484,
  Contract: 1131312227,
  Document: 1147366766,
  Expand: 1165521006,
  FrameSelect: 1718838636,
  Horizontal: 1215461998,
  Layer: 1283027488,
  Left: 1281713780,
  Move: 1836021349,
  None: 1315925605,
  Null: 1853189228,
  Offset: 1332114292,
  Ordinal: 1332896878,
  PixelUnit: 592476268,
  Point: 1349415968,
  Property: 1349677170,
  Right: 1382508660,
  Select: 1936483188,
  Set: 1936028772,
  Size: 1400512544,
  Target: 1416783732,
  Text: 1417180192,
  TextLayer: 1417170034,
  TextShapeType: 1413830740,
  TextStyle: 1417180243,
  TextStyleRange: 1417180276,
  To: 1411391520,
  Top: 1416589344,
  Vertical: 1450341475,
};

// Helper functions
function _createCurrent(e, a) {
  var t = new ActionReference();
  if (a > 0) t.putProperty(charID.Property, a);
  t.putEnumerated(e, charID.Ordinal, charID.Target);
  return t;
}

function _getCurrent(e, a) {
  return executeActionGet(_createCurrent(e, a));
}

function _getBoundsFromDescriptor(e) {
  var a = e.getInteger(charID.Top);
  var t = e.getInteger(charID.Left);
  var r = e.getInteger(charID.Right);
  var n = e.getInteger(charID.Bottom);
  return {
    top: a,
    left: t,
    right: r,
    bottom: n,
    width: r - t,
    height: n - a,
    xMid: (t + r) / 2,
    yMid: (a + n) / 2,
  };
}

function _getCurrentSelectionBounds() {
  var e = _getCurrent(charID.Document, charID.FrameSelect);
  if (e.hasKey(charID.FrameSelect)) {
    var a = e.getObjectValue(charID.FrameSelect);
    return _getBoundsFromDescriptor(a);
  }
}

function _getCurrentTextLayerBounds() {
  var e = stringIDToTypeID("bounds");
  var a = _getCurrent(charID.Layer, e).getObjectValue(e);
  return _getBoundsFromDescriptor(a);
}

function _moveLayer(e, a) {
  var t = new ActionDescriptor();
  t.putUnitDouble(charID.Horizontal, charID.PixelUnit, e);
  t.putUnitDouble(charID.Vertical, charID.PixelUnit, a);
  var r = new ActionDescriptor();
  r.putReference(charID.Null, _createCurrent(charID.Layer));
  r.putObject(charID.To, charID.Offset, t);
  executeAction(charID.Move, r, DialogModes.NO);
}

function _deselect() {
  var e = new ActionReference();
  e.putProperty(charID.Channel, charID.FrameSelect);
  var a = new ActionDescriptor();
  a.putReference(charID.Null, e);
  a.putEnumerated(charID.To, charID.Ordinal, charID.None);
  executeAction(charID.Set, a, DialogModes.NO);
}

function _layerIsTextLayer() {
  var e = _getCurrent(charID.Layer, charID.Text);
  return e.hasKey(charID.Text);
}

function _modifySelectionBounds(e) {
  if (e == 0) return;
  var a = new ActionDescriptor();
  a.putUnitDouble(charID.By, charID.PixelUnit, Math.abs(e));
  executeAction(e > 0 ? charID.Expand : charID.Contract, a, DialogModes.NO);
}

function _checkSelection() {
  var e = _getCurrentSelectionBounds();
  if (e === undefined) {
    return { error: "noSelection" };
  }
  _modifySelectionBounds(-10);
  e = _getCurrentSelectionBounds();
  if (e === undefined || e.width * e.height < 200) {
    return { error: "smallSelection" };
  }
  return e;
}

// Main function to fix text centering
function centerTextInBubble() {
  if (!documents.length) {
    alert("No open document found");
    return false;
  }

  if (!_layerIsTextLayer()) {
    alert("The selected layer is not a text layer");
    return false;
  }

  var selectionBounds = _checkSelection();
  if (selectionBounds.error) {
    if (selectionBounds.error === "noSelection") {
      alert("Please select the bubble area first");
    } else if (selectionBounds.error === "smallSelection") {
      // alert("The selected area is too small");
    }
    return false;
  }

  // Get current text layer bounds
  var textBounds = _getCurrentTextLayerBounds();

  // Calculate position difference for centering
  var deltaX = selectionBounds.xMid - textBounds.xMid;
  var deltaY = selectionBounds.yMid - textBounds.yMid;

  // Move text to center
  _moveLayer(deltaX, deltaY);

  // Deselect
  _deselect();

  return true;
}

// Improved centering function with tail consideration
function centerTextInBubbleWithTail() {
  if (!documents.length) {
    alert("No open document found");
    return false;
  }

  if (!_layerIsTextLayer()) {
    alert("The selected layer is not a text layer");
    return false;
  }

  var selectionBounds = _checkSelection();
  if (selectionBounds.error) {
    if (selectionBounds.error === "noSelection") {
      alert("Please select the bubble area first");
    } else if (selectionBounds.error === "smallSelection") {
      // alert("The selected area is too small");
    }
    return false;
  }

  // Get current text layer bounds
  var textBounds = _getCurrentTextLayerBounds();

  // Calculate improved center for bubbles with tails
  var centerX = selectionBounds.xMid;
  var centerY = selectionBounds.yMid;

  // If the tail is at the bottom, move text slightly up
  if (selectionBounds.height > selectionBounds.width * 1.5) {
    centerY = centerY - selectionBounds.height * 0.1;
  }

  // Calculate position difference for centering
  var deltaX = centerX - textBounds.xMid;
  var deltaY = centerY - textBounds.yMid;

  // Move text to center
  _moveLayer(deltaX, deltaY);

  // Deselect
  _deselect();

  return true;
}

// Function to create text in bubble with auto-centering
function createTextInBubble(text, fontSize, fontFamily) {
  if (!documents.length) {
    alert("No open document found");
    return false;
  }

  var selectionBounds = _checkSelection();
  if (selectionBounds.error) {
    if (selectionBounds.error === "noSelection") {
      alert("Please select the bubble area first");
    } else if (selectionBounds.error === "smallSelection") {
      // alert("The selected area is too small");
    }
    return false;
  }

  // Create new text layer
  var textLayer = activeDocument.artLayers.add();
  textLayer.kind = LayerKind.TEXT;
  textLayer.textItem.contents = text;

  if (fontSize) {
    textLayer.textItem.size = fontSize;
  }

  if (fontFamily) {
    textLayer.textItem.font = fontFamily;
  }

  // Center the text inside the bubble
  return centerTextInBubbleWithTail();
}

// Run the main function
try {
  // centerTextInBubbleWithTail();
} catch (e) {
  alert("An error occurred: " + e.message);
}
