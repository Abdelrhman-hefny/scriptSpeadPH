// #target photoshop
app.bringToFront();

/* ============================================================
 * Count ALL paths vs. text lines per page (OPEN docs only)
 * Match by page number regardless of open order
 * Output: opens a plain CMD window and ECHOs the report (ASCII)
 * Photoshop CC 2019 (ExtendScript / ES3)
 * ============================================================ */

(function () {
  // -------- Config --------
  var BASE_DIR = "C:/Users/abdoh/Downloads/testScript";
  var TMP_DIR  = BASE_DIR + "/reports";
  var KEEP_OPEN = true; // true = leave CMD open (cmd /k). false = close after printing.

  // -------- Utils --------
  function trim(s){ return String(s||"").replace(/^\s+|\s+$/g,""); }
  function toInt(s){ var n=parseInt(s,10); return isNaN(n)?null:n; }
  function ensureFolder(p){ var f=new Folder(p); if(!f.exists) f.create(); return f; }
  function readJSON(file){
    if(!file||!file.exists) return null;
    try{
      file.encoding="UTF8"; file.open("r");
      var txt=file.read(); file.close();
      if(typeof JSON!=="undefined" && JSON.parse) return JSON.parse(txt);
      return eval("("+txt+")");
    }catch(e){ return null; }
  }
  function batchEchoEscape(s){
    s = String(s==null?"":s);
    if(!s) return "echo.";
    s = s.replace(/%/g,"%%").replace(/\^/g,"^^").replace(/&/g,"^&")
         .replace(/\|/g,"^|").replace(/</g,"^<").replace(/>/g,"^>");
    return "echo " + s;
  }
  function runInCmd(lines){
    ensureFolder(TMP_DIR);
    var bat = new File(TMP_DIR + "/__show_report.cmd");
    try{ if(bat.exists) bat.remove(); }catch(_e){}
    bat.encoding = "UTF8";
    if(!bat.open("w")) return;

    bat.writeln("@echo off");
    bat.writeln("setlocal EnableExtensions");
    for (var i=0; i<lines.length; i++) bat.writeln(batchEchoEscape(lines[i]));
    bat.writeln("echo.");
    if (KEEP_OPEN) bat.writeln("cmd /d /k");
    bat.close();

    try { bat.execute(); } catch(e) {}
  }
  function getPageNumberFromDocName(name){
    try{ var m=String(name).match(/^(\d+)/); return m?toInt(m[1]):null; }
    catch(e){ return null; }
  }

  // ---- Resolve text file (no opening/closing PSDs) ----
  function resolveTxtFile(){
    var fallback = File(BASE_DIR + "/manga_text.txt");
    try{
      var cfg   = readJSON(File(BASE_DIR + "/config/temp-title.json"));
      var folds = readJSON(File(BASE_DIR + "/config/folders.json"));
      if(cfg && folds && folds.folders && folds.folders.length){
        var title=String(cfg.title||"");
        for(var i=0;i<folds.folders.length;i++){
          var it=folds.folders[i];
          if(String(it.id||"")===title && it.path && it.txt_file){
            var parent=Folder(it.path).parent;
            if(parent){
              var f=File(parent.fsName + "/" + it.txt_file);
              if(f.exists) return f;
            }
          }
        }
      }
    }catch(_e){}
    return fallback;
  }

  // ---- Parse text file into pages map (skip sfx) ----
  function parseTextFileToPages(txtFile){
    var pages={}, currentPage=null;
    if(!txtFile||!txtFile.exists) return pages;
    try{
      txtFile.encoding="UTF8"; txtFile.open("r");
      var raw=txtFile.read(); txtFile.close();
      var lines=String(raw||"").split(/\r\n|\n|\r/);
      for(var i=0;i<lines.length;i++){
        var ln=String(lines[i]||"");
        var hdr=ln.match(/^\s*page\s+(\d+)\b/i);
        if(hdr){
          currentPage=toInt(hdr[1]);
          if(currentPage!==null && !pages[currentPage]) pages[currentPage]=[];
          continue;
        }
        if(currentPage===null) continue;
        var t=trim(ln);
        if(!t) continue;
        if(/^\s*sfx\s*:?/i.test(t)) continue;
        if(!pages[currentPage]) pages[currentPage]=[];
        pages[currentPage].push(t);
      }
    }catch(_e){}
    return pages;
  }

  // ---- Count valid paths in an OPEN doc (activate-only, no edits) ----
  function countAllValidPathsInDoc(doc){
    var prev = null;
    try{
      try{ prev = app.activeDocument; }catch(_ePrev){}
      try{ app.activeDocument = doc; }catch(_eAct){}
      var items = doc.pathItems;
      if(!items||!items.length) return 0;
      var count=0;
      for(var i=0;i<items.length;i++){
        var pi=items[i]; if(!pi) continue;
        try{
          var nm=String(pi.name||"");
          if(nm==="Work Path") continue;
          try{
            if(pi.kind && (pi.kind===PathKind.WORKPATH || pi.kind===PathKind.CLIPPINGPATH)) continue;
          }catch(_ek){}
          if(pi.subPathItems && pi.subPathItems.length>0){
            var sp=pi.subPathItems[0];
            if(sp && sp.pathPoints && sp.pathPoints.length>1) count++;
          }
        }catch(_e1){}
      }
      return count;
    }catch(_e){ return 0; }
    finally{
      try{ if(prev) app.activeDocument = prev; }catch(_eRestore){}
    }
  }

  // -------- Main (OPEN docs only, match by page number) --------
  var txtFile  = resolveTxtFile();
  var pagesMap = parseTextFileToPages(txtFile);

  var out=[];
  out.push("TXT: " + (txtFile && txtFile.exists ? txtFile.fsName : "[NOT FOUND]"));
  out.push("MODE: OPEN_DOCUMENTS_ONLY - MATCH BY PAGE NUMBER");
  out.push("----------------------------------------");

  if(!app.documents.length){
    out.push("No open documents. Open PSD pages first.");
    runInCmd(out);
    return;
  }

  // 1) Build map: page# -> [docs]
  var docsByPage = {};            // { pageNumber: [Document, ...] }
  var docsNoPage = [];            // docs with no leading page number
  var allDocs    = [];

  for(var d=0; d<app.documents.length; d++){
    var doc = app.documents[d];
    allDocs.push(doc);
    var pn = getPageNumberFromDocName(doc.name);
    if(pn===null){
      docsNoPage.push(doc);
    } else {
      if(!docsByPage[pn]) docsByPage[pn] = [];
      docsByPage[pn].push(doc);
    }
  }

  // 2) Iterate text pages in numeric order; compare to corresponding open doc(s)
  var pageNums = [];
  for(var k in pagesMap){ if(pagesMap.hasOwnProperty(k)) pageNums.push(toInt(k)); }
  pageNums.sort(function(a,b){ return a-b; });

  var mismatches = 0;

  for(var i=0;i<pageNums.length;i++){
    var pn = pageNums[i];
    var lineCount = (pagesMap[pn] ? pagesMap[pn].length : 0);

    if(docsByPage[pn] && docsByPage[pn].length){
      // If more than one doc has the same page number, sum paths and warn
      var docsArr = docsByPage[pn];
      var totalPaths = 0;
      for(var j=0;j<docsArr.length;j++){
        totalPaths += countAllValidPathsInDoc(docsArr[j]);
      }
      var delta  = totalPaths - lineCount;
      var status = (delta===0) ? "OK" : ("MISMATCH (" + (delta>0?("+"+delta):delta) + ")");
      if(delta!==0) mismatches++;
      if(docsArr.length===1){
        out.push("page " + pn + " - " + totalPaths + " paths / " + lineCount + " lines - " + status);
      } else {
        out.push("page " + pn + " - " + totalPaths + " paths (from " + docsArr.length + " docs) / " + lineCount + " lines - " + status);
      }
    } else {
      // Page exists in text but no open doc with that page number
      mismatches++;
      out.push("page " + pn + " - [NO OPEN DOC] / " + lineCount + " lines - MISMATCH (-" + lineCount + ")");
    }
  }

  // 3) Any extra open docs whose page# not present in text?
  var extras = [];
  for(var pnStr in docsByPage){
    if(!docsByPage.hasOwnProperty(pnStr)) continue;
    var pn = toInt(pnStr);
    if(!pagesMap[pn]){
      for(var j=0;j<docsByPage[pn].length;j++){
        extras.push({ pn: pn, name: docsByPage[pn][j].name });
      }
    }
  }
  if(extras.length){
    out.push("----------------------------------------");
    out.push("EXTRA DOCS (open but not in text):");
    for(var e=0;e<extras.length;e++){
      out.push("doc \"" + extras[e].name + "\" - page " + extras[e].pn + " - no matching text page");
    }
  }

  if(mismatches>0){
    out.push("----------------------------------------");
    out.push("Total mismatches: " + mismatches);
  }

  runInCmd(out);
})();
