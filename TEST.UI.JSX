    #target photoshop
    // Path Editor UI for Photoshop - edit_paths_ui.jsx
    // Usage: run from File > Scripts > Browse...
    // Features: select path, preview, separate scale X/Y, separate tighten/expand X/Y, handle scale, apply/reset, apply to all

    app.bringToFront();
    var prevRulerUnits = null;
    try { prevRulerUnits = app.preferences.rulerUnits; app.preferences.rulerUnits = Units.PIXELS; } catch(e){}

    function L(s){ $.writeln(s); }

    // ------------------ helpers ------------------
    function getPathsList(doc){
        var arr = [];
        for (var i=0;i<doc.pathItems.length;i++){
            var p = doc.pathItems[i];
            // skip work path if you want:
            if (p.name === "Work Path") continue;
            arr.push(p);
        }
        return arr;
    }

    function clonePathPoints(pathItem){
        // returns array of subpaths; each subpath is array of points {anchor:[x,y], left:[x,y], right:[x,y], kind:PointKind}
        var result = [];
        for (var si = 0; si < pathItem.subPathItems.length; si++){
            var sp = pathItem.subPathItems[si];
            var pts = [];
            for (var pi = 0; pi < sp.pathPoints.length; pi++){
                var pp = sp.pathPoints[pi];
                pts.push({
                    anchor: [pp.anchor[0], pp.anchor[1]],
                    left: [pp.leftDirection[0], pp.leftDirection[1]],
                    right: [pp.rightDirection[0], pp.rightDirection[1]],
                    kind: pp.kind
                });
            }
            result.push(pts);
        }
        return result;
    }

    function createPathFromPoints(doc, subpathsPoints, pathName){
        // remove existing path with same name if present
        try {
            for (var i = doc.pathItems.length-1; i >=0; i--){
                if (doc.pathItems[i].name === pathName) doc.pathItems[i].remove();
            }
        } catch(e){}
        var allSubPathInfos = [];
        for (var s = 0; s < subpathsPoints.length; s++){
            var pts = subpathsPoints[s];
            var subPathArray = [];
            for (var k = 0; k < pts.length; k++){
                var pinfo = new PathPointInfo();
                pinfo.kind = pts[k].kind;
                pinfo.anchor = [pts[k].anchor[0], pts[k].anchor[1]];
                pinfo.leftDirection = [pts[k].left[0], pts[k].left[1]];
                pinfo.rightDirection = [pts[k].right[0], pts[k].right[1]];
                subPathArray.push(pinfo);
            }
            var spi = new SubPathInfo();
            spi.closed = true;
            spi.operation = ShapeOperation.SHAPEXOR;
            spi.entireSubPath = subPathArray;
            allSubPathInfos.push(spi);
        }
        // create a single pathItem that contains all subpaths by adding them as separate pathItems then renaming/merging? 
        // Photoshop pathItems.add accepts array of SubPathInfo but historically only one subpath — we'll add by passing array
        return doc.pathItems.add(pathName, allSubPathInfos);
    }

    function computeCentroid(subpaths){
        var sumX=0,sumY=0, count=0;
        for (var s=0;s<subpaths.length;s++){
            for (var p=0;p<subpaths[s].length;p++){
                sumX += subpaths[s][p].anchor[0];
                sumY += subpaths[s][p].anchor[1];
                count++;
            }
        }
        if (count === 0) return [0,0];
        return [sumX/count, sumY/count];
    }

    function deepCopySubpaths(subpaths){
        var out = [];
        for (var s=0;s<subpaths.length;s++){
            var pts = subpaths[s];
            var arr = [];
            for (var i=0;i<pts.length;i++){
                var p = pts[i];
                arr.push({
                    anchor: [p.anchor[0], p.anchor[1]],
                    left: [p.left[0], p.left[1]],
                    right: [p.right[0], p.right[1]],
                    kind: p.kind
                });
            }
            out.push(arr);
        }
        return out;
    }

    // ------------------ transform functions ------------------
    function transformSubpaths(subpaths, options){
        // options: {scaleX, scaleY, translateX, translateY, tightenX (-1..1), tightenY (-1..1), handleScale (0..2), centroid (optional)}
        var cp = options.centroid || computeCentroid(subpaths);
        var cx = cp[0], cy = cp[1];
        var out = deepCopySubpaths(subpaths);
        for (var s=0;s<out.length;s++){
            for (var i=0;i<out[s].length;i++){
                var pt = out[s][i];
                // vector from centroid to anchor
                var dx = pt.anchor[0] - cx;
                var dy = pt.anchor[1] - cy;
                // scale and translate
                var newAx = cx + dx * options.scaleX + options.translateX;
                var newAy = cy + dy * options.scaleY + options.translateY;

                // tighten/expand: move anchor toward/away from centroid by tightenX/Y factor (positive: tighten inward, negative: expand outward)
                if (options.tightenX !== 0 || options.tightenY !== 0){
                    // vector from new anchor to centroid (inward)
                    var vx = cx - newAx;
                    var vy = cy - newAy;
                    newAx = newAx + vx * options.tightenX;
                    newAy = newAy + vy * options.tightenY;
                }

                // update anchor
                var oldAx = pt.anchor[0], oldAy = pt.anchor[1];
                pt.anchor[0] = newAx;
                pt.anchor[1] = newAy;

                // update left/right directions:
                // compute old handle vectors relative to old anchor, then scale by handleScale and also scale for anchor movement
                var ldvx = pt.left[0] - oldAx, ldvy = pt.left[1] - oldAy;
                var rdvx = pt.right[0] - oldAx, rdvy = pt.right[1] - oldAy;

                // apply handle scale
                var hs = options.handleScale;
                pt.left[0] = newAx + ldvx * hs;
                pt.left[1] = newAy + ldvy * hs;
                pt.right[0] = newAx + rdvx * hs;
                pt.right[1] = newAy + rdvy * hs;
            }
        }
        return out;
    }

    // ---------- overlay / preview ----------
    function ensureOverlayLayer(doc){
        var name = "_paths_overlay_for_editor";
        try {
            var l = null;
            for (var i=0;i<doc.artLayers.length;i++){
                if (doc.artLayers[i].name === name){ l = doc.artLayers[i]; break; }
            }
            if (!l) { l = doc.artLayers.add(); l.name = name; l.opacity = 85; l.blendMode = BlendMode.NORMAL; }
            return l;
        } catch(e){
            return doc.artLayers.add();
        }
    }

    function clearOverlayLayer(doc){
        var name = "_paths_overlay_for_editor";
        try {
            for (var i=doc.artLayers.length-1;i>=0;i--){
                if (doc.artLayers[i].name === name){
                    // clear pixels
                    app.activeDocument = doc;
                    doc.activeLayer = doc.artLayers[i];
                    doc.selection.selectAll();
                    doc.selection.clear();
                    doc.selection.deselect();
                    return;
                }
            }
        } catch(e){}
    }

    function drawPreviewFromSubpaths(doc, subpaths, colorRGB, strokePx){
        // create a temp path, make selection, stroke onto overlay, then remove temp path
        var tempName = "__preview_path_temp";
        // remove existing temp if exists
        try { for (var i=doc.pathItems.length-1;i>=0;i--){ if (doc.pathItems[i].name === tempName) doc.pathItems[i].remove(); } } catch(e){}
        var tempPath = createPathFromPoints(doc, subpaths, tempName);
        try {
            // make selection and stroke on overlay
            var overlay = ensureOverlayLayer(doc);
            doc.activeLayer = overlay;
            tempPath.makeSelection(0, true); // anti-aliased true
            var c = new SolidColor(); c.rgb.red = colorRGB[0]; c.rgb.green = colorRGB[1]; c.rgb.blue = colorRGB[2];
            doc.selection.stroke(c, strokePx, StrokeLocation.CENTER);
            doc.selection.deselect();
        } catch(e){}
        // remove temp path
        try { tempPath.remove(); } catch(e){}
    }

    // ---------- UI ----------
    var win = new Window("dialog", "Path Editor");
    win.orientation = "column";
    win.alignChildren = ["fill","top"];
    win.spacing = 8;
    win.margins = 12;

    // document & path selection
    var topG = win.add("group");
    topG.orientation = "row";
    topG.alignChildren = ["left","center"];
    topG.add("statictext", undefined, "Document:");
    var docList = topG.add("dropdownlist", undefined, []);
    for (var di=0; di<app.documents.length; di++){
        docList.add("item", app.documents[di].name);
    }
    if (docList.items.length>0) docList.selection = docList.items[0];

    topG.add("statictext", undefined, "   Path:");
    var pathList = topG.add("dropdownlist", undefined, []);
    function refreshPathList(){
        pathList.removeAll();
        if (!docList.selection) return;
        var doc = app.documents[docList.selection.index];
        var paths = getPathsList(doc);
        for (var i=0;i<paths.length;i++) pathList.add("item", paths[i].name);
        if (pathList.items.length>0) pathList.selection = pathList.items[0];
    }
    refreshPathList();

    docList.onChange = function(){ refreshPathList(); }

    // controls: scaleX, scaleY, translateX, translateY, tightenX, tightenY, handleScale
    var grp = win.add("panel", undefined, "Transform");
    grp.orientation = "column"; grp.alignChildren = ["fill","center"]; grp.margins=10;

    var row1x = grp.add("group"); row1x.add("statictext", undefined, "Scale X:");
    var scaleXSlider = row1x.add("slider", undefined, 100, 10, 300); // maps to 0.1..3.0
    scaleXSlider.preferredSize = [220,20];
    var scaleXValue = row1x.add("statictext", undefined, "100%");

    var row1y = grp.add("group"); row1y.add("statictext", undefined, "Scale Y:");
    var scaleYSlider = row1y.add("slider", undefined, 100, 10, 300);
    scaleYSlider.preferredSize = [220,20];
    var scaleYValue = row1y.add("statictext", undefined, "100%");

    var row2 = grp.add("group");
    row2.add("statictext", undefined, "Translate X:");
    var txSlider = row2.add("slider", undefined, 0, -500, 500); txSlider.preferredSize=[220,20];
    var txVal = row2.add("statictext", undefined, "0 px");

    var row3 = grp.add("group");
    row3.add("statictext", undefined, "Translate Y:");
    var tySlider = row3.add("slider", undefined, 0, -500, 500); tySlider.preferredSize=[220,20];
    var tyVal = row3.add("statictext", undefined, "0 px");

    var row4x = grp.add("group");
    row4x.add("statictext", undefined, "Tighten/Expand X:");
    var tightXSlider = row4x.add("slider", undefined, 0, -100, 100); tightXSlider.preferredSize=[220,20];
    var tightXVal = row4x.add("statictext", undefined, "0%");

    var row4y = grp.add("group");
    row4y.add("statictext", undefined, "Tighten/Expand Y:");
    var tightYSlider = row4y.add("slider", undefined, 0, -100, 100); tightYSlider.preferredSize=[220,20];
    var tightYVal = row4y.add("statictext", undefined, "0%");

    var row5 = grp.add("group");
    row5.add("statictext", undefined, "Handle Scale:");
    var handleSlider = row5.add("slider", undefined, 100, 0, 200); handleSlider.preferredSize=[220,20];
    var handleVal = row5.add("statictext", undefined, "100%");

    // apply to all checkbox
    var applyAllChk = win.add("checkbox", undefined, "Apply transformation to ALL paths in document");
    applyAllChk.value = false;

    // preview color and stroke
    var prefG = win.add("group"); prefG.orientation = "row";
    prefG.add("statictext", undefined, "Preview color:");
    var colorInput = prefG.add("edittext", undefined, "255,0,0"); colorInput.characters = 12;
    prefG.add("statictext", undefined, "Stroke px:");
    var strokeInput = prefG.add("edittext", undefined, "4"); strokeInput.characters = 4;

    // buttons: preview/apply/reset/close
    var btnG = win.add("group"); btnG.alignment = "right";
    var previewBtn = btnG.add("button", undefined, "Preview");
    var applyBtn = btnG.add("button", undefined, "Apply");
    var resetBtn = btnG.add("button", undefined, "Reset");
    var closeBtn = btnG.add("button", undefined, "Close");

    // live value update
    scaleXSlider.onChanging = function(){ scaleXValue.text = Math.round(scaleXSlider.value) + "%"; }
    scaleYSlider.onChanging = function(){ scaleYValue.text = Math.round(scaleYSlider.value) + "%"; }
    txSlider.onChanging = function(){ txVal.text = Math.round(txSlider.value) + " px"; }
    tySlider.onChanging = function(){ tyVal.text = Math.round(tySlider.value) + " px"; }
    tightXSlider.onChanging = function(){ tightXVal.text = Math.round(tightXSlider.value) + "%"; }
    tightYSlider.onChanging = function(){ tightYVal.text = Math.round(tightYSlider.value) + "%"; }
    handleSlider.onChanging = function(){ handleVal.text = Math.round(handleSlider.value) + "%"; }

    var backupStore = {}; // store original subpaths per path name for reset

    // utility to parse color string "r,g,b"
    function parseColorString(s){
        try{
            var arr = String(s).split(",");
            return [parseInt(arr[0],10)||0, parseInt(arr[1],10)||0, parseInt(arr[2],10)||0];
        } catch(e){ return [255,0,0]; }
    }

    function getCurrentDocAndPaths(){
        if (!docList.selection) return null;
        var doc = app.documents[docList.selection.index];
        var paths = getPathsList(doc);
        return {doc: doc, paths: paths};
    }

    // do preview: build transformed subpaths and draw on overlay layer
    previewBtn.onClick = function(){
        var info = getCurrentDocAndPaths();
        if (!info) return alert("No document selected");
        var doc = info.doc;
        if (!pathList.selection && !applyAllChk.value) return alert("No path selected");
        var color = parseColorString(colorInput.text);
        var strokePx = parseInt(strokeInput.text,10) || 3;

        if (applyAllChk.value){
            clearOverlayLayer(doc);
            for (var i=0;i<info.paths.length;i++){
                var pi = info.paths[i];
                var name = pi.name;
                var orig = clonePathPoints(pi);
                // backup single time
                if (!backupStore[doc.name + "::" + name]) backupStore[doc.name + "::" + name] = orig;
                var centroid = computeCentroid(orig);
                var opts = {
                    scaleX: scaleXSlider.value/100,
                    scaleY: scaleYSlider.value/100,
                    translateX: Math.round(txSlider.value),
                    translateY: Math.round(tySlider.value),
                    tightenX: tightXSlider.value/100,
                    tightenY: tightYSlider.value/100,
                    handleScale: handleSlider.value/100,
                    centroid: centroid
                };
                var modified = transformSubpaths(orig, opts);
                drawPreviewFromSubpaths(doc, modified, color, strokePx);
            }
            alert("Preview drawn for all paths (overlay). Check layer *_paths_overlay_for_editor*");
        } else {
            var selName = pathList.selection.text;
            var pathItem = null;
            for (var i=0;i<info.paths.length;i++){ if (info.paths[i].name === selName) { pathItem = info.paths[i]; break; } }
            if (!pathItem) return alert("Selected path not found");
            var orig = clonePathPoints(pathItem);
            if (!backupStore[doc.name + "::" + selName]) backupStore[doc.name + "::" + selName] = orig;
            var centroid = computeCentroid(orig);
            var opts = {
                scaleX: scaleXSlider.value/100,
                scaleY: scaleYSlider.value/100,
                translateX: Math.round(txSlider.value),
                translateY: Math.round(tySlider.value),
                tightenX: tightXSlider.value/100,
                tightenY: tightYSlider.value/100,
                handleScale: handleSlider.value/100,
                centroid: centroid
            };
            clearOverlayLayer(doc);
            var modified = transformSubpaths(orig, opts);
            drawPreviewFromSubpaths(doc, modified, color, strokePx);
            alert("Preview drawn for path: " + selName);
        }
    };

    // apply: replace path(s) with modified version(s)
    applyBtn.onClick = function(){
        var info = getCurrentDocAndPaths();
        if (!info) return alert("No document selected");
        var doc = info.doc;
        if (applyAllChk.value){
            for (var i=0;i<info.paths.length;i++){
                var pi = info.paths[i];
                var name = pi.name;
                var orig = backupStore[doc.name + "::" + name] || clonePathPoints(pi);
                var centroid = computeCentroid(orig);
                var opts = {
                    scaleX: scaleXSlider.value/100,
                    scaleY: scaleYSlider.value/100,
                    translateX: Math.round(txSlider.value),
                    translateY: Math.round(tySlider.value),
                    tightenX: tightXSlider.value/100,
                    tightenY: tightYSlider.value/100,
                    handleScale: handleSlider.value/100,
                    centroid: centroid
                };
                var modified = transformSubpaths(orig, opts);
                // create new path using same name: remove old first then add
                try { pi.remove(); } catch(e){}
                createPathFromPoints(doc, modified, name);
            }
            clearOverlayLayer(doc);
            alert("Applied changes to ALL paths in document: " + doc.name);
        } else {
            var selName = pathList.selection ? pathList.selection.text : null;
            if (!selName) return alert("No path selected");
            var pathItem = null;
            for (var i=0;i<info.paths.length;i++){ if (info.paths[i].name === selName) { pathItem = info.paths[i]; break; } }
            if (!pathItem) return alert("Selected path not found");
            var orig = backupStore[doc.name + "::" + selName] || clonePathPoints(pathItem);
            var centroid = computeCentroid(orig);
            var opts = {
                scaleX: scaleXSlider.value/100,
                scaleY: scaleYSlider.value/100,
                translateX: Math.round(txSlider.value),
                translateY: Math.round(tySlider.value),
                tightenX: tightXSlider.value/100,
                tightenY: tightYSlider.value/100,
                handleScale: handleSlider.value/100,
                centroid: centroid
            };
            var modified = transformSubpaths(orig, opts);
            try { pathItem.remove(); } catch(e){}
            createPathFromPoints(doc, modified, selName);
            clearOverlayLayer(doc);
        }
    };

    // reset: restore backups if exist
    resetBtn.onClick = function(){
        var info = getCurrentDocAndPaths();
        if (!info) return alert("No document selected");
        var doc = info.doc;
        if (applyAllChk.value){
            var count = 0;
            for (var i=0;i<info.paths.length;i++){
                var pi = info.paths[i];
                var name = pi.name;
                var key = doc.name + "::" + name;
                if (backupStore[key]){
                    try { pi.remove(); } catch(e){}
                    createPathFromPoints(doc, backupStore[key], name);
                    count++;
                }
            }
            clearOverlayLayer(doc);
            alert("Reset " + count + " paths (restored backups).");
        } else {
            var selName = pathList.selection ? pathList.selection.text : null;
            if (!selName) return alert("No path selected");
            var key = doc.name + "::" + selName;
            var pathItem = null;
            for (var i=0;i<info.paths.length;i++){ if (info.paths[i].name === selName) { pathItem = info.paths[i]; break; } }
            if (!pathItem) return alert("Selected path not found");
            if (backupStore[key]){
                try { pathItem.remove(); } catch(e){}
                createPathFromPoints(doc, backupStore[key], selName);
                clearOverlayLayer(doc);
                alert("Reset path: " + selName);
            } else alert("No backup found for: " + selName);
        }
    };

    closeBtn.onClick = function(){ win.close(); };

    // show
    win.center(); win.show();

    // cleanup: restore ruler units
    try { app.preferences.rulerUnits = prevRulerUnits; } catch(e){}