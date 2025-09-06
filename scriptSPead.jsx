#target photoshop
app.bringToFront();

(function () {
    // اختيار ملف النص مع فلتر لامتداد TXT فقط
    var txtFile = File.openDialog(
        "اختر ملف النص (TXT)",
        "Text Files: *.txt"
    );
    if (!txtFile) {
        alert("لم يتم اختيار ملف نص.");
        return;
    }

    var pages = {};
    var currentPage = null;

    // قراءة النصوص وتقسيمها حسب "page X"
    txtFile.open("r");
    while (!txtFile.eof) {
        var line = txtFile.readln() || "";
        line = line.replace(/^\s+|\s+$/g, ""); // بديل trim()

        if (/^\s*page\s+\d+/i.test(line)) {
            var num = line.match(/\d+/)[0];
            if (num.length === 1) num = "0" + num;
            currentPage = "page_" + num;
            if (!pages[currentPage]) pages[currentPage] = [];
        } else if (line !== "" && currentPage) {
            pages[currentPage].push(line);
        }
    }
    txtFile.close();

    var docList = app.documents; // كل الملفات المفتوحة
    if (docList.length === 0) {
        alert("مفيش مستندات مفتوحة!");
        return;
    }

    var fontName = "ArialMT";
    var fontSize = 20;

    // دالة لتجاهل النصوص حسب الرموز
    function ignoreText(str) {
        return /“”.*[\?!]|[\?]{2}/.test(str);
    }

    var pageNames = Object.keys(pages).sort(); // page_01, page_02, ...
    var currentTextIndex = 0; // مؤشر للنصوص

    for (var d = 0; d < docList.length; d++) {
        var doc = docList[d];
        app.activeDocument = doc;

        var pageName = pageNames[d] || pageNames[pageNames.length-1]; // لو النصوص أكتر من الملفات
        var pageTexts = pages[pageName] || [];

        var paths = doc.pathItems;
        if (paths.length === 0) continue;

        // ترتيب paths حسب bubbleN
        var pagePaths = [];
        for (var j = 0; j < paths.length; j++) {
            if (paths[j].name.toLowerCase().indexOf(pageName) === 0) pagePaths.push(paths[j]);
        }

        pagePaths.sort(function(a, b) {
            function extractNum(item) {
                var m = item.name.match(/bubble(\d+)$/i);
                if (m && m[1]) return parseInt(m[1], 10);
                var mm = item.name.match(/(\d+)(?!.*\d)/);
                return mm ? parseInt(mm[1], 10) : 999999;
            }
            return extractNum(a) - extractNum(b);
        });

        for (var k = 0; k < pagePaths.length; k++) {
            if (currentTextIndex >= pageTexts.length) break;

            var txt = pageTexts[currentTextIndex];
            currentTextIndex++;

            if (ignoreText(txt)) {
                k--; // تجاهل الباث الحالي لأنه النص متجاهل
                continue;
            }

            try {
                var path = pagePaths[k];
                path.makeSelection();
                var bounds = doc.selection.bounds;

                var textLayer = doc.artLayers.add();
                textLayer.kind = LayerKind.TEXT;
                try { textLayer.textItem.kind = TextType.PARAGRAPHTEXT; } catch(e){}
                textLayer.textItem.contents = txt;
                textLayer.textItem.position = [bounds[0], bounds[1]];
                try { textLayer.textItem.width = bounds[2]-bounds[0]; } catch(e){}
                try { textLayer.textItem.height = bounds[3]-bounds[1]; } catch(e){}
                textLayer.textItem.size = fontSize;
                try { textLayer.textItem.font = fontName; } catch(e){}
                textLayer.textItem.justification = Justification.CENTER;

                doc.selection.deselect();
            } catch(e) {}
        }
    }

    alert("تم إدخال النصوص مع تجاهل النصوص المحددة ✅");

})();
