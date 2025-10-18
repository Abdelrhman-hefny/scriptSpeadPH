/** =====================================================================
 * File: ps/apply_overlay_from_json.jsx
 * Purpose: تطبيق Gradient/Stroke/Glow/Shadow على طبقات النص مباشرةً من JSON
 * Compat: Photoshop CC 2019 (ES3). لا دوال ES5. لا إنشاء طبقات.
 * ===================================================================== */
// #target photoshop
app.bringToFront();

(function () {
  if (!documents.length) { alert("افتح PSD أولاً."); return; }
  var doc = app.activeDocument;
  var oldUnits = app.preferences.rulerUnits; app.preferences.rulerUnits = Units.PIXELS;

  // -------- Utils (ES3-safe) --------
  function toRGB(hex){ hex=String(hex||""); if(hex.length<7) return [255,255,255];
    return [parseInt(hex.substr(1,2),16), parseInt(hex.substr(3,2),16), parseInt(hex.substr(5,2),16)];
  }
  function boundsOf(layer){ var b=layer.bounds; return {x:b[0].value,y:b[1].value,w:b[2].value-b[0].value,h:b[3].value-b[1].value}; }
  function rectArea(r){ return Math.max(0,r.w)*Math.max(0,r.h); }
  function interArea(a,b){ var x1=Math.max(a.x,b.x),y1=Math.max(a.y,b.y),x2=Math.min(a.x+a.w,b.x+b.w),y2=Math.min(a.y+a.h,b.y+b.h); return Math.max(0,x2-x1)*Math.max(0,y2-y1); }
  function findAllTextLayers(p, out){ out=out||[]; for(var i=0;i<p.layers.length;i++){ var L=p.layers[i]; if(L.typename==="ArtLayer" && L.kind===LayerKind.TEXT) out.push(L); else if(L.typename==="LayerSet") findAllTextLayers(L,out); } return out; }
  function selectLayerById(id){ var d=new ActionDescriptor(), r=new ActionReference(); r.putIdentifier(charIDToTypeID('Lyr '), id); d.putReference(charIDToTypeID('null'), r); d.putBoolean(charIDToTypeID('MkVs'), false); executeAction(charIDToTypeID('slct'), d, DialogModes.NO); }

  // -------- Build Gradient Stops List (only first and last for two colors) --------
  function buildGradientStopsList(stops){
    if(!stops || stops.length<1) stops = [{pos:0,rgb:[255,255,255]},{pos:1,rgb:[0,0,0]}];
    var firstStop = stops[0], lastStop = stops[stops.length-1];
    var colors = new ActionList();
    var firstRGB = (firstStop.rgb && firstStop.rgb.length===3)? firstStop.rgb : toRGB(firstStop.color);
    var lastRGB = (lastStop.rgb && lastStop.rgb.length===3)? lastStop.rgb : toRGB(lastStop.color);
    // First stop at 0
    var stop1 = new ActionDescriptor();
    var stopClr1 = new ActionDescriptor();
    stopClr1.putDouble(charIDToTypeID("Rd  "), firstRGB[0]);
    stopClr1.putDouble(charIDToTypeID("Grn "), firstRGB[1]);
    stopClr1.putDouble(charIDToTypeID("Bl  "), firstRGB[2]);
    stop1.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), stopClr1);
    stop1.putEnumerated(charIDToTypeID("Type"), charIDToTypeID("Clry"), charIDToTypeID("UsrS"));
    stop1.putInteger(charIDToTypeID("Lctn"), 0);
    stop1.putInteger(charIDToTypeID("Mdpn"), 2048);
    colors.putObject(charIDToTypeID("Clrt"), stop1);
    // Last stop at 4096
    var stop2 = new ActionDescriptor();
    var stopClr2 = new ActionDescriptor();
    stopClr2.putDouble(charIDToTypeID("Rd  "), lastRGB[0]);
    stopClr2.putDouble(charIDToTypeID("Grn "), lastRGB[1]);
    stopClr2.putDouble(charIDToTypeID("Bl  "), lastRGB[2]);
    stop2.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), stopClr2);
    stop2.putEnumerated(charIDToTypeID("Type"), charIDToTypeID("Clry"), charIDToTypeID("UsrS"));
    stop2.putInteger(charIDToTypeID("Lctn"), 4096);
    stop2.putInteger(charIDToTypeID("Mdpn"), 2048);
    colors.putObject(charIDToTypeID("Clrt"), stop2);
    return colors;
  }

  function applyGradientOverlay(layer, angleDeg, stops){
    try { selectLayerById(layer.id); } catch(e){}
    var idsetd = charIDToTypeID("setd");
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("Lefx"));
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    desc.putReference(charIDToTypeID("null"), ref);

    var fxDesc = new ActionDescriptor();
    fxDesc.putUnitDouble(charIDToTypeID("Scl "), charIDToTypeID("#Prc"), 100.0); // مهم لنجاح set

    // Gradient Overlay
    var grFl = charIDToTypeID("GrFl");
    var grFlDesc = new ActionDescriptor();
    grFlDesc.putBoolean(charIDToTypeID("enab"), true);
    grFlDesc.putEnumerated(charIDToTypeID("Md  "), charIDToTypeID("BlnM"), charIDToTypeID("Nrml"));
    grFlDesc.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), 100);
    grFlDesc.putUnitDouble(charIDToTypeID("Angl"), charIDToTypeID("#Ang"), angleDeg||0);
    grFlDesc.putEnumerated(charIDToTypeID("Type"), charIDToTypeID("GrdT"), charIDToTypeID("Lnr "));
    grFlDesc.putBoolean(charIDToTypeID("Algn"), true);
    grFlDesc.putUnitDouble(charIDToTypeID("Scl "), charIDToTypeID("#Prc"), 100.0);
    grFlDesc.putBoolean(charIDToTypeID("Rvrs"), false);
    grFlDesc.putBoolean(charIDToTypeID("Dthr"), true);

    var grad = new ActionDescriptor();
    grad.putString(charIDToTypeID("Nm  "), "Auto");
    grad.putEnumerated(charIDToTypeID("GrdF"), charIDToTypeID("GrdF"), charIDToTypeID("CstS"));
    grad.putList(charIDToTypeID("Clrs"), buildGradientStopsList(stops));
    // شفافية 100% عند كل stop
    var trns = new ActionList();
    for (var j=0;j<stops.length;j++){
      var ts = new ActionDescriptor();
      var loc2 = Math.max(0, Math.min(4096, Math.round(((stops[j].pos!=null?stops[j].pos:0))*4096)));
      ts.putInteger(charIDToTypeID("Lctn"), loc2);
      ts.putInteger(charIDToTypeID("Mdpn"), 2048);
      ts.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), 100.0);
      trns.putObject(charIDToTypeID("TrnS"), ts);
    }
    grad.putList(charIDToTypeID("Trns"), trns);

    grFlDesc.putObject(charIDToTypeID("Grad"), charIDToTypeID("Grdn"), grad);
    fxDesc.putObject(grFl, grFl, grFlDesc);

    desc.putObject(charIDToTypeID("T   "), charIDToTypeID("Lefx"), fxDesc);
    executeAction(idsetd, desc, DialogModes.NO);
  }

  function applyStroke(layer, stroke){
    if(!stroke||!stroke.present) return;
    try { selectLayerById(layer.id); } catch(e){}
    var d=new ActionDescriptor(), r=new ActionReference();
    r.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("Lefx"));
    r.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    d.putReference(charIDToTypeID("null"), r);

    var fx=new ActionDescriptor(); fx.putUnitDouble(charIDToTypeID("Scl "), charIDToTypeID("#Prc"), 100.0);
    var fr=new ActionDescriptor();
    fr.putBoolean(charIDToTypeID("enab"), true);
    fr.putEnumerated(charIDToTypeID("Styl"), charIDToTypeID("FStl"), charIDToTypeID("OutF"));
    fr.putEnumerated(charIDToTypeID("PntT"), charIDToTypeID("FrFl"), charIDToTypeID("SClr"));
    fr.putEnumerated(charIDToTypeID("Md  "), charIDToTypeID("BlnM"), charIDToTypeID("Nrml"));
    fr.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), Math.min(100, Math.max(0,(stroke.opacity||1)*100)));
    fr.putUnitDouble(charIDToTypeID("Sz  "), charIDToTypeID("#Pxl"), stroke.width_px||2);
    var col=toRGB(stroke.color); var c=new ActionDescriptor();
    c.putDouble(charIDToTypeID("Rd  "), col[0]); c.putDouble(charIDToTypeID("Grn "), col[1]); c.putDouble(charIDToTypeID("Bl  "), col[2]);
    fr.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), c);
    fx.putObject(charIDToTypeID("FrFX"), charIDToTypeID("FrFX"), fr);
    d.putObject(charIDToTypeID("T   "), charIDToTypeID("Lefx"), fx);
    executeAction(charIDToTypeID("setd"), d, DialogModes.NO);
  }

  function applyOuterGlow(layer, glow){
    if(!glow||!glow.present) return;
    try { selectLayerById(layer.id); } catch(e){}
    var d=new ActionDescriptor(), r=new ActionReference();
    r.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("Lefx"));
    r.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    d.putReference(charIDToTypeID("null"), r);

    var fx=new ActionDescriptor(); fx.putUnitDouble(charIDToTypeID("Scl "), charIDToTypeID("#Prc"), 100.0);
    var og=new ActionDescriptor();
    og.putBoolean(charIDToTypeID("enab"), true);
    og.putEnumerated(charIDToTypeID("Md  "), charIDToTypeID("BlnM"), charIDToTypeID("Scrn"));
    og.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), Math.min(100, Math.max(0,(glow.opacity||0.5)*100)));
    var col=toRGB(glow.color); var c=new ActionDescriptor();
    c.putDouble(charIDToTypeID("Rd  "), col[0]); c.putDouble(charIDToTypeID("Grn "), col[1]); c.putDouble(charIDToTypeID("Bl  "), col[2]);
    og.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), c);
    og.putUnitDouble(charIDToTypeID("Ckmt"), charIDToTypeID("#Pxl"), 0);
    og.putUnitDouble(charIDToTypeID("blur"), charIDToTypeID("#Pxl"), glow.size_px||6);
    fx.putObject(charIDToTypeID("Ogln"), charIDToTypeID("Ogln"), og);
    d.putObject(charIDToTypeID("T   "), charIDToTypeID("Lefx"), fx);
    executeAction(charIDToTypeID("setd"), d, DialogModes.NO);
  }

  function applyDropShadow(layer, sh){
    if(!sh||!sh.present) return;
    try { selectLayerById(layer.id); } catch(e){}
    var d=new ActionDescriptor(), r=new ActionReference();
    r.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("Lefx"));
    r.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    d.putReference(charIDToTypeID("null"), r);

    var fx=new ActionDescriptor(); fx.putUnitDouble(charIDToTypeID("Scl "), charIDToTypeID("#Prc"), 100.0);
    var ds=new ActionDescriptor();
    ds.putBoolean(charIDToTypeID("enab"), true);
    ds.putEnumerated(charIDToTypeID("Md  "), charIDToTypeID("BlnM"), charIDToTypeID("Mltp"));
    ds.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), Math.min(100, Math.max(0,(sh.opacity||0.5)*100)));
    ds.putUnitDouble(charIDToTypeID("lagl"), charIDToTypeID("#Ang"), (sh.angle!=null?sh.angle:135));
    ds.putUnitDouble(charIDToTypeID("Dstn"), charIDToTypeID("#Pxl"), sh.distance_px||4);
    ds.putUnitDouble(charIDToTypeID("blur"), charIDToTypeID("#Pxl"), sh.size_px||4);
    ds.putUnitDouble(charIDToTypeID("Ckmt"), charIDToTypeID("#Pxl"), 0);
    var col=toRGB(sh.color); var c=new ActionDescriptor();
    c.putDouble(charIDToTypeID("Rd  "), col[0]); c.putDouble(charIDToTypeID("Grn "), col[1]); c.putDouble(charIDToTypeID("Bl  "), col[2]);
    ds.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), c);
    fx.putObject(charIDToTypeID("DrSh"), charIDToTypeID("DrSh"), ds);
    d.putObject(charIDToTypeID("T   "), charIDToTypeID("Lefx"), fx);
    executeAction(charIDToTypeID("setd"), d, DialogModes.NO);
  }

  // -------- Load JSON --------
  var jf = File.openDialog("اختر analyzed_styles.json", "*.json");
  if (!jf){ app.preferences.rulerUnits = oldUnits; return; }
  jf.encoding="UTF8"; jf.open("r"); var raw=jf.read(); jf.close();
  var data = (typeof JSON!=="undefined" && JSON.parse)? JSON.parse(raw) : eval("("+raw+")");

  // -------- Flatten bubbles --------
  var allBubbles=[], items=data.items||[];
  for (var p=0;p<items.length;p++){
    var page=items[p], label=page.page_label, bubbles=page.bubbles||[];
    for (var i=0;i<bubbles.length;i++){
      var b=bubbles[i];
      allBubbles.push({
        page: label,
        id: b.id,
        rect: {x:b.bubble_rect.x, y:b.bubble_rect.y, w:b.bubble_rect.w, h:b.bubble_rect.h},
        gradient: b.gradient, stroke: b.stroke, outer_glow: b.outer_glow, drop_shadow: b.drop_shadow,
        used:false
      });
    }
  }
  if (!allBubbles.length){ app.preferences.rulerUnits = oldUnits; alert("لا توجد فقاعات."); return; }

  // -------- Collect text layers --------
  var texts = findAllTextLayers(doc, []);
  if (!texts.length){ app.preferences.rulerUnits = oldUnits; alert("لا توجد طبقات نص."); return; }

  // -------- Apply --------
  var applied=0, unmatched=0;
  for (var t=0; t<texts.length; t++){
    var TL = texts[t];
    try { if (TL.allLocked||TL.visible===false) continue; } catch(e){}
    var tb = boundsOf(TL), best=-1, bestA=0;
    for (var k=0; k<allBubbles.length; k++){
      if (allBubbles[k].used) continue;
      var a = interArea(tb, allBubbles[k].rect);
      if (a>bestA){ bestA=a; best=k; }
    }
    if (best<0){ unmatched++; continue; }

    var target = allBubbles[best];
    var minA = Math.max(1, Math.min(rectArea(tb), rectArea(target.rect)) * 0.01);
    if (bestA < minA){ unmatched++; continue; }

    var angle = (target.gradient && target.gradient.angle!=null)? target.gradient.angle : 0.0;
    var stops = (target.gradient && target.gradient.stops)? target.gradient.stops : [{pos:0,color:"#FFFFFF"},{pos:1,color:"#000000"}];

    try { applyGradientOverlay(TL, angle, stops); } catch(e){}
    try { applyStroke(TL, target.stroke); } catch(e){}
    try { applyOuterGlow(TL, target.outer_glow); } catch(e){}
    try { applyDropShadow(TL, target.drop_shadow); } catch(e){}

    target.used = true;
    applied++;
  }

  app.preferences.rulerUnits = oldUnits;
  alert("Done.\nText layers: "+texts.length+"\nApplied: "+applied+"\nUnmatched: "+unmatched);
})();
