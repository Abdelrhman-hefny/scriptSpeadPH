// Reshape current text into hourglass lines (short-long-short ...), then center in selection
// Usage: 
// 1) Make a selection around the speech bubble
// 2) Select a text layer with the bubble text
// 3) Run this script

#include "../lib/speadUtils.jsx"
#include "../lib/bubble_text_centering_solution.jsx"

(function(){
  try {
    if (!documents.length) {
      alert("No open document found");
      return;
    }

    // Ensure a text layer is selected
    if (app.activeDocument.activeLayer.kind !== LayerKind.TEXT) {
      alert("Please select a text layer");
      return;
    }

    // Use existing selection checker from the centering helper
    var selectionBounds = _checkSelection();
    if (selectionBounds && selectionBounds.error) {
      if (selectionBounds.error === "noSelection") {
        alert("Please select the bubble area first");
      } else if (selectionBounds.error === "smallSelection") {
        alert("The selected area is too small");
      }
      return;
    }

    var textLayer = app.activeDocument.activeLayer;
    var textItem = textLayer.textItem;

    // Source text and parameters
    var originalText = String(textItem.contents || "");
    if (!originalText) {
      alert("The selected text layer has no content");
      return;
    }

    // Font size to guide shaping; fallback to 24 if unset
    var fontSize = Number(textItem.size) || 24;

    // Compute target box from selection
    var boxWidth = Math.max(10, selectionBounds.width - 8);
    var boxHeight = Math.max(10, selectionBounds.height - 8);

    // Shape into hourglass lines using helper from speadUtils.jsx
    var shaped = (typeof shapeTextForBubble === 'function')
      ? shapeTextForBubble(originalText, boxWidth, boxHeight, fontSize)
      : originalText;

    // Apply shaped text and reasonable formatting
    textItem.contents = shaped;
    textItem.justification = Justification.CENTER;
    // Keep leading comfortable relative to font size
    try { textItem.leading = Math.round(fontSize * 1.15); } catch(_e) {}

    // Finally, center inside the bubble (tail-aware)
    try {
      centerTextInBubbleWithTail();
    } catch(_e2) {
      // fallback to simple center if tail-aware fails
      try { centerTextInBubble(); } catch(_e3) {}
    }

  } catch (e) {
    alert("Error: " + e);
  }
})();


