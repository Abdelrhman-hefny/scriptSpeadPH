// Text utilities for Photoshop scripts
(function(){
    if (typeof IS_TEXT_UTILS_LOADED !== 'undefined') return;
    
     function parseStrokeTag(line) {
        try {
            var m = String(line).match(/^\s*(?:NA:\s*|\*\*:\s*|SFX:\s*|ST:\s*|Ot:\s*|OT:\s*|#\s*)([\s\S]*)$/);
            if (m) { return { needed: true, text: trimString(m[1]) }; }
        } catch (_e) {}
        return { needed: false, text: line };
    }
    
    // دالة بديلة لـ parseStrokeTag (للتوافق مع الكود القديم)
    function parseStrokeTagLegacy(line) {
        try {
            var m = String(line).match(/^\s*(?:NA:\s*|\*\*:\s*|SFX:\s*|ST:\s*|Ot:\s*|OT:\s*|#\s*)([\s\S]*)$/);
            if (m) { return { needed: true, text: trimString(m[1]) }; }
        } catch (_e) {}
        return { needed: false, text: line };
    }
    
    // دالة محسنة لحساب حجم الخط المناسب (أسرع)
    function calculateOptimalFontSize(text, font, maxSize, availableWidth, availableHeight) {
        var textLength = text.length;
        var minDimension = Math.min(availableWidth, availableHeight);
        
        // حساب أولي سريع
        var baseSize = Math.min(maxSize, Math.max(8, Math.floor(minDimension / textLength * 1.8)));
        
        // تعديلات سريعة بناءً على طول النص
        if (textLength > 50) baseSize = Math.floor(baseSize * 0.8);
        else if (textLength > 30) baseSize = Math.floor(baseSize * 0.9);
        else if (textLength < 10) baseSize = Math.floor(baseSize * 1.2);
        
        return Math.max(6, Math.min(maxSize, baseSize));
    }
    
    // دالة محسنة لتطبيق تنسيق النص (أسرع)
    function applyTextFormatting(textLayer, font, fontSize, isBracketTag, isOTTag, inheritPrevFont, lastWasBracketTag) {
        var textItem = textLayer.textItem;
        
        // تطبيق الإعدادات الأساسية
        textItem.font = font;
        textItem.size = fontSize;
        textItem.justification = Justification.CENTER;
        textItem.antiAliasMethod = AntiAlias.SMOOTH;
        textItem.autoKerning = AutoKernType.METRICS;
        
        // تطبيق تنسيق خاص لسطور []: أو لأسطر // التي ترث من سطر []: سابق
        if (isBracketTag || (inheritPrevFont && lastWasBracketTag)) {
            textItem.tracking = 0;
            textItem.leading = Math.round(fontSize * 1.00);
            textItem.fauxBold = true;
            textItem.capitalization = TextCase.ALLCAPS;
        }
        
        // تطبيق تأثير ALL CAPS على سطور OT: أو Ot:
        if (isOTTag) {
            textItem.capitalization = TextCase.ALLCAPS;
        }
    }
    
    // دالة محسنة لتحديد نوع النص (أسرع)
    function analyzeTextType(lineText) {
        var result = {
            isBracketTag: false,
            isOTTag: false,
            inheritPrevFont: false,
            cleanText: lineText
        };
        
        // توريث خط الفقاعة السابقة لأسطر // أو //:
        if (lineText.indexOf("//") === 0) {
            result.inheritPrevFont = true;
            result.cleanText = lineText.substring(2).trim();
        }
        
         if (lineText.indexOf("[]") === 0) {
            result.isBracketTag = true;
        }
        
        // خصائص خاصة لسطور تبدأ بـ OT: أو Ot:
        if (lineText.indexOf("OT:") === 0 || lineText.indexOf("Ot:") === 0) {
            result.isOTTag = true;
        }
        
        return result;
    }
    
    // تصدير الدوال كدوال عامة
    if (typeof parseStrokeTag === 'undefined') {
        parseStrokeTag = function(line) {
            try {
                var m = String(line).match(/^\s*(?:NA:\s*|\*\*:\s*|SFX:\s*|ST:\s*|Ot:\s*|OT:\s*|#\s*)([\s\S]*)$/);
                if (m) { return { needed: true, text: trimString(m[1]) }; }
            } catch (_e) {}
            return { needed: false, text: line };
        };
    }
    
    IS_TEXT_UTILS_LOADED = true;
})();
