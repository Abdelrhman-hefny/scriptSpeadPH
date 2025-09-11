// Split current Work Path's subPathItems into separate named pathItems
(function(){
    if (typeof splitWorkPathIntoNamedPaths !== 'undefined') return;
    splitWorkPathIntoNamedPaths = function (doc, baseName) {
        var src;
        try { src = doc.pathItems["Work Path"]; } catch (e) { return 0; }
        if (!src || !src.subPathItems || src.subPathItems.length === 0) return 0;

        // Find next available index to avoid name collisions
        function nextIndex(prefix){
            var idx = 1;
            while (true) {
                var n = prefix + idx;
                try { var _p = doc.pathItems.getByName(n); idx++; continue; } catch (e) { return idx; }
            }
        }
        var startIdx = nextIndex(baseName);

        // For each subpath, duplicate Work Path, remove others, and rename
        var created = 0;
        for (var i = 0; i < src.subPathItems.length; i++) {
            // Duplicate source path
            var dup = src.duplicate();
            // Remove all subpaths except i
            for (var j = dup.subPathItems.length - 1; j >= 0; j--) {
                if (j !== i) dup.subPathItems[j].remove();
            }
            dup.name = baseName + (startIdx + created);
            created++;
        }
        // Remove original Work Path
        try { src.remove(); } catch(_e) {}
        return created;
    };
})();

