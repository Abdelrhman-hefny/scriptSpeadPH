// Font utilities for Photoshop scripts
(function(){
    if (typeof IS_FONT_UTILS_LOADED !== 'undefined') return;
    
    // دالة محسنة للتحقق من وجود خط بدون إنشاء مستندات مؤقتة
    function getValidFont(fontName, fallbackFont) {
        try {
            if (!fontName) return fallbackFont || "Arial";
            
            // استخدام app.fonts.getByName بدلاً من إنشاء مستند مؤقت
            var font = app.fonts.getByName(fontName);
            if (font) return fontName;
            
            // جرب الخط البديل
            if (fallbackFont) {
                font = app.fonts.getByName(fallbackFont);
                if (font) return fallbackFont;
            }
            
            // جرب الخطوط الشائعة
            var commonFonts = ["Arial", "Tahoma", "Verdana", "Times New Roman"];
            for (var i = 0; i < commonFonts.length; i++) {
                font = app.fonts.getByName(commonFonts[i]);
                if (font) return commonFonts[i];
            }
            
            return "Arial";
        } catch (e) {
            return fallbackFont || "Arial";
        }
    }
    
    // دالة بديلة للتحقق من الخط مع إنشاء مستند مؤقت (للتوافق مع الكود القديم)
    function getValidFontWithTestDoc(fontName, fallbackFont) {
        try {
            // إنشاء مستند مؤقت للاختبار
            var testDoc = app.documents.add(100, 100, 72, "Font Test", NewDocumentMode.RGB);
            var testLayer = testDoc.artLayers.add();
            testLayer.kind = LayerKind.TEXT;
            testLayer.textItem.contents = "Test";
            
            try {
                testLayer.textItem.font = fontName;
                // إذا وصلنا هنا بدون خطأ، فالخط موجود
                testDoc.close(SaveOptions.DONOTSAVECHANGES);
                return fontName;
            } catch (e) {
                // الخط غير موجود، جرب الخط البديل
                try {
                    testLayer.textItem.font = fallbackFont;
                    testDoc.close(SaveOptions.DONOTSAVECHANGES);
                    return fallbackFont;
                } catch (e2) {
                    testDoc.close(SaveOptions.DONOTSAVECHANGES);
                    return "Arial"; // خط افتراضي
                }
            }
        } catch (e) {
            return fallbackFont || "Arial";
        }
    }
    
    // دالة للتحقق من وجود خط بدون إنشاء مستندات
    function isFontAvailable(fontName) {
        try {
            return app.fonts.getByName(fontName) !== null;
        } catch (e) {
            return false;
        }
    }
    
    // دالة للحصول على أفضل خط متاح
    function getBestAvailableFont(preferredFonts) {
        for (var i = 0; i < preferredFonts.length; i++) {
            if (isFontAvailable(preferredFonts[i])) {
                return preferredFonts[i];
            }
        }
        return "Arial";
    }
    
    // تصدير الدوال كدوال عامة
    if (typeof getValidFont === 'undefined') {
        getValidFont = function(fontName, fallbackFont) {
            try {
                if (!fontName) return fallbackFont || "Arial";
                
                // استخدام app.fonts.getByName بدلاً من إنشاء مستند مؤقت
                var font = app.fonts.getByName(fontName);
                if (font) return fontName;
                
                // جرب الخط البديل
                if (fallbackFont) {
                    font = app.fonts.getByName(fallbackFont);
                    if (font) return fallbackFont;
                }
                
                // جرب الخطوط الشائعة
                var commonFonts = ["Arial", "Tahoma", "Verdana", "Times New Roman"];
                for (var i = 0; i < commonFonts.length; i++) {
                    font = app.fonts.getByName(commonFonts[i]);
                    if (font) return commonFonts[i];
                }
                
                return "Arial";
            } catch (e) {
                return fallbackFont || "Arial";
            }
        };
    }
    
    IS_FONT_UTILS_LOADED = true;
})();
