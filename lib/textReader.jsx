(function(){
    if (typeof readMangaText !== 'undefined') return;

    function normalizeWholeText(content) {
        // استبدال :: أو :- في أول السطر
        content = content.replace(/^(\s*)(::|:-)\s*/gm, "$1<> ");

        // استبدال <>: في أول السطر
        content = content.replace(/^(\s*<>)\s*:/gm, "$1");

        // تحويل OT / ST في أول السطر
        content = content.replace(/^(\s*)ot\s*:?\s*/gim, "$1OT: ");
        content = content.replace(/^(\s*)st\s*:?\s*/gim, "$1ST: ");

        // توحيد علامات page
        content = content.replace(/^\s*(?:=+|#+)?\s*page\b/gi, "page");

        return content;
    }

    readMangaText = function(txtFile) {
        var pageStartIndices = [];
        var allLines = [];

        // قراءة النص
        txtFile.open("r");
        var original = txtFile.read() || "";
        txtFile.close();

        // تطبيع النص
        var normalized = normalizeWholeText(original);

        // كتابة الملف إذا تغير
        if (normalized !== original) {
            txtFile.open("w");
            txtFile.write(normalized);
            txtFile.close();
        }

        // تقسيم النص لأسطر
        var linesArr = normalized.split(/\r\n|\n|\r/);

        for (var i = 0; i < linesArr.length; i++) {
            var line = linesArr[i];
            if (!line) continue;

            line = line.replace(/^\s+|\s+$/g, ""); // trim

            if (!line) continue;

            // تجاهل السطور اللي بس فيها sfx
            if (/^sfx\b/i.test(line)) continue;

            // تجاهل السطور اللي عبارة عن ؟ أو ؟! أو ... أو “” …
            // if (/^[?…“”\s]+$/.test(line)) continue;
            if (/^[?\s…“”]+$/.test(line) && !/^!+$/.test(line)) continue;

            if (/^page\s*\d+/i.test(line)) {
                pageStartIndices.push(allLines.length);
                continue;
            }

            allLines.push(line);
        }   

        return { lines: allLines, pageStarts: pageStartIndices };
    };
})();
