// Reads manga_text.txt and returns lines + page starts
(function(){
    if (typeof readMangaText !== 'undefined') return;
    readMangaText = function (txtFile) {
        var pageStartIndices = [];
        var currentPage = -1;
        var allLines = [];
        txtFile.open("r");
        while (!txtFile.eof) {
            var line = txtFile.readln() || "";
            line = trimString(line);
            var m = line.match(/(?:===\s*)?page\s*(\d+)/i);
            if (m) { currentPage++; pageStartIndices.push(allLines.length); continue; }
            if (/^sfx\b/i.test(line)) continue;
            if (line !== "") allLines.push(line);
        }
        txtFile.close();
        return { lines: allLines, pageStarts: pageStartIndices };
    };
})();


