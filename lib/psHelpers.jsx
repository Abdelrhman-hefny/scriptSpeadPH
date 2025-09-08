// Photoshop helper utilities (arrays, keys, numbers, strings, fonts)
(function(){
    if (app && app.name && typeof IS_UTILS_LOADED === 'undefined') {
        if (typeof isArray === 'undefined') {
            isArray = function (obj) { return Object.prototype.toString.call(obj) === '[object Array]'; };
        }
        if (typeof getObjectKeys === 'undefined') {
            getObjectKeys = function (obj) {
                var keys = [];
                for (var key in obj) {
                    if (obj.hasOwnProperty && obj.hasOwnProperty(key)) keys.push(key);
                    else if (obj[key] !== undefined) keys.push(key);
                }
                return keys;
            };
        }
        if (typeof toNum === 'undefined') {
            toNum = function (unitVal) { try { return parseFloat(String(unitVal)); } catch (e) { return NaN; } };
        }
        if (typeof toPx === 'undefined') {
            toPx = function (v) { try { return v.as("px"); } catch (e) { return Number(v); } };
        }
        if (typeof trimString === 'undefined') {
            trimString = function (str) { return String(str).replace(/^\s+|\s+$/g, ""); };
        }
        if (typeof tryGetFont === 'undefined') {
            tryGetFont = function (name) {
                try { if (!name) return null; var f = app.fonts.getByName(name); return f ? name : null; } catch (e) { return null; }
            };
        }
        if (typeof pickFont === 'undefined') {
            pickFont = function (preferred, fallback) {
                var p = tryGetFont(preferred); if (p) return p;
                var f = tryGetFont(fallback); if (f) return f;
                var commonFallbacks = ["Tahoma","Arial","SegoeUI","SegoeUI-Regular","Segoe UI","Verdana","Georgia","TimesNewRomanPSMT","Times New Roman","Impact","ComicSansMS","Comic Sans MS"];
                for (var i = 0; i < commonFallbacks.length; i++) { var cf = tryGetFont(commonFallbacks[i]); if (cf) return cf; }
                try { if (app.fonts.length > 0) return app.fonts[0].postScriptName; } catch (e) {}
                return "Arial";
            };
        }
        if (typeof optimizeFontSettings === 'undefined') {
            optimizeFontSettings = function (textLayer, fontName, fontSize) {
                try {
                    var fontLower = String(fontName||"").toLowerCase();
                    if (fontLower.indexOf("comic") !== -1 || fontLower.indexOf("manga") !== -1) { textLayer.textItem.tracking = 10; textLayer.textItem.leading = fontSize * 1.15; }
                    else if (fontLower.indexOf("arial") !== -1 || fontLower.indexOf("helvetica") !== -1) { textLayer.textItem.tracking = 0; textLayer.textItem.leading = fontSize * 1.1; }
                    else if (fontLower.indexOf("times") !== -1 || fontLower.indexOf("serif") !== -1) { textLayer.textItem.tracking = -5; textLayer.textItem.leading = fontSize * 1.05; }
                    textLayer.textItem.antiAliasMethod = AntiAlias.SMOOTH;
                    textLayer.textItem.autoKerning = AutoKernType.METRICS;
                } catch (e) {}
            };
        }
        IS_UTILS_LOADED = true;
    }
})();


