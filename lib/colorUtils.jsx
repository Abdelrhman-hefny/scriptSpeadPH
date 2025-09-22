// Color utilities for Photoshop scripts
(function(){
    if (typeof IS_COLOR_UTILS_LOADED !== 'undefined') return;
    
    // حساب السطوع من RGB
    function luminance(r, g, b) {
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }
    
    // اخد عينة من بكسل معين - محسن
    function samplePixel(doc, x, y) {
        try {
            // مسح ColorSamplers الموجودة أولاً
            while (doc.colorSamplers.length > 0) {
                doc.colorSamplers[0].remove();
            }
            
            var colorSampler = doc.colorSamplers.add([UnitValue(x, "px"), UnitValue(y, "px")]);
            var c = colorSampler.color.rgb;
            var rgb = [c.red, c.green, c.blue];
            colorSampler.remove();
            return rgb;
        } catch (e) {
            return [128, 128, 128]; // رمادي متوسط
        }
    }
    
    // دالة بديلة لـ samplePixel (للتوافق مع الكود القديم)
    function samplePixelLegacy(doc, x, y) {
        try {
            while (doc.colorSamplers.length > 0) {
                doc.colorSamplers[0].remove();
            }
            var colorSampler = doc.colorSamplers.add([UnitValue(x, "px"), UnitValue(y, "px")]);
            var c = colorSampler.color.rgb;
            var rgb = [c.red, c.green, c.blue];
            colorSampler.remove();
            return rgb;
        } catch (e) {
            return [128, 128, 128];
        }
    }
    
    // دالة محسنة لاختيار لون النص بناءً على الخلفية
    function getOptimalTextColor(doc, centerX, centerY) {
        try {
            var centerRgb = samplePixel(doc, centerX, centerY);
            var centerBright = luminance(centerRgb[0], centerRgb[1], centerRgb[2]);
            var textColor = new SolidColor();
            
            if (centerBright < 128) {
                // خلفية غامقة → نص أبيض
                textColor.rgb.red = 255;
                textColor.rgb.green = 255;
                textColor.rgb.blue = 255;
            } else {
                // خلفية فاتحة → نص أسود
                textColor.rgb.red = 0;
                textColor.rgb.green = 0;
                textColor.rgb.blue = 0;
            }
            
            return textColor;
        } catch (e) {
            // لون افتراضي
            var defaultColor = new SolidColor();
            defaultColor.rgb.red = 0;
            defaultColor.rgb.green = 0;
            defaultColor.rgb.blue = 0;
            return defaultColor;
        }
    }
    
    // تصدير الدوال كدوال عامة
    if (typeof luminance === 'undefined') {
        luminance = function(r, g, b) {
            return 0.299 * r + 0.587 * g + 0.114 * b;
        };
    }
    
    if (typeof samplePixel === 'undefined') {
        samplePixel = function(doc, x, y) {
            try {
                // مسح ColorSamplers الموجودة أولاً
                while (doc.colorSamplers.length > 0) {
                    doc.colorSamplers[0].remove();
                }
                
                var colorSampler = doc.colorSamplers.add([UnitValue(x, "px"), UnitValue(y, "px")]);
                var c = colorSampler.color.rgb;
                var rgb = [c.red, c.green, c.blue];
                colorSampler.remove();
                return rgb;
            } catch (e) {
                return [128, 128, 128]; // رمادي متوسط
            }
        };
    }
    
    IS_COLOR_UTILS_LOADED = true;
})();
