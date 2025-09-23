// Spead helpers extracted from scriptSPead.jsx
(function(){
  if (typeof shapeTextForBubble === 'undefined') {
    shapeTextForBubble = function (rawText, boxWidth, boxHeight, fontSize) {
      try {
        var text = String(rawText || "");
        if (!text) return text;
        text = text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
        var avgCharPx = 0.6 * fontSize;
        var lineHeightPx = Math.max(fontSize * 1.15, fontSize + 4);
        var maxLinesByHeight = Math.max(1, Math.floor(boxHeight / lineHeightPx));
        var midChars = Math.max(1, Math.floor(boxWidth / Math.max(1, avgCharPx)));
        var words = text.split(/\s+/);
        if (words.length <= 1) return text;
        var totalChars = text.length;
        var estLines = Math.max(1, Math.round(totalChars / Math.max(1, Math.floor(midChars * 0.9))));
        var linesCount = Math.max(2, Math.min(8, estLines));
        linesCount = Math.min(linesCount, maxLinesByHeight);
        var ratios = [];
        for (var i = 0; i < linesCount; i++) {
          var t = (i + 0.5) / linesCount;
          var x = Math.abs(2 * t - 1);
          ratios.push(0.6 + (1 - x) * 0.4);
        }
        var targets = [];
        for (var r = 0; r < ratios.length; r++) {
          targets.push(Math.max(3, Math.floor(midChars * ratios[r])));
        }
        var lines = [], current = "";
        var targetIdx = 0, currentLimit = targets[targetIdx];
        function pushLine() {
          if (current.replace(/^\s+|\s+$/g, "").length === 0 && lines.length > 0) return;
          lines.push(current.replace(/^\s+|\s+$/g, ""));
          current = "";
          targetIdx = Math.min(targetIdx + 1, targets.length - 1);
          currentLimit = targets[targetIdx];
        }
        for (var w = 0; w < words.length; w++) {
          var word = words[w];
          var sep = current ? " " : "";
          var proposed = current + sep + word;
          if (proposed.length <= currentLimit) {
            current = proposed;
          } else {
            if (current.length > 0) pushLine();
            current = word;
            if (lines.length >= linesCount - 1) {
              var rest = words.slice(w + 1).join(" ");
              if (rest) current = current + " " + rest;
              break;
            }
          }
        }
        if (current.length > 0) pushLine();
        if (lines.length < linesCount && lines.length >= 2) {
          linesCount = lines.length;
        }
        return lines.join("\r");
      } catch (_e) {
        return rawText;
      }
    };
  }

  if (typeof openNotepad === 'undefined') {
    openNotepad = function () {
      try {
        var txtFilePath = "C:/Users/abdoh/Downloads/testScript/manga_text.txt";
        var txtFile = new File(txtFilePath);
        if (!txtFile.exists) {
          txtFile.open("w");
          txtFile.writeln("// الصق النص هنا، استخدم 'page 1' لتحديد بداية الصفحة الأولى");
          txtFile.writeln("// مثال:");
          txtFile.writeln("page 1");
          txtFile.writeln("Hello, world!");
          txtFile.writeln("st:Action text");
          txtFile.writeln("page 2");
          txtFile.writeln("SFX:Boom!");
          txtFile.close();
        }
        txtFile.execute();
      } catch (e) {
        alert("خطأ أثناء فتح Notepad: " + e);
      }
    };
  }
})();


