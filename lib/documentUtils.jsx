// Document utilities for Photoshop scripts
(function(){
    if (typeof IS_DOCUMENT_UTILS_LOADED !== 'undefined') return;
    
    // دالة لاستخراج رقم الصفحة من اسم المستند
    function getPageNumberFromDocName(docName) {
        try {
            var match = docName.match(/^(\d+)\.psd$/i);
            if (match && match[1]) {
                return parseInt(match[1], 10);
            }
            return null;
        } catch (e) {
            return null;
        }
    }
    
    // دالة لترتيب المستندات حسب رقم الصفحة
    function sortDocumentsByPageNumber(documents) {
        var documentsArray = [];
        for (var d = 0; d < documents.length; d++) {
            documentsArray.push(documents[d]);
        }
        documentsArray.sort(function(a, b) {
            var pageA = getPageNumberFromDocName(a.name) || 999999;
            var pageB = getPageNumberFromDocName(b.name) || 999999;
            return pageA - pageB;
        });
        return documentsArray;
    }
    
    // دالة محسنة لترتيب المستندات مع معالجة أفضل للأخطاء
    function getSortedDocuments() {
        try {
            var documentsArray = [];
            for (var d = 0; d < app.documents.length; d++) {
                documentsArray.push(app.documents[d]);
            }
            return sortDocumentsByPageNumber(documentsArray);
        } catch (e) {
            return [];
        }
    }
    
    // دالة لحفظ المستند بشكل محسن
    function saveDocumentOptimized(doc) {
        try {
            if (doc.saved) return true;
            
            // محاولة الحفظ العادي أولاً
            try { 
                doc.save(); 
                return true; 
            } catch (e) {
                // إذا فشل، جرب الحفظ بـ PSD options
                try {
                    var targetFile = doc.fullName;
                    if (targetFile) {
                        var psdOptions = new PhotoshopSaveOptions();
                        psdOptions.embedColorProfile = true;
                        psdOptions.alphaChannels = true;
                        psdOptions.layers = true;
                        doc.saveAs(targetFile, psdOptions, true, Extension.LOWERCASE);
                        return true;
                    }
                } catch (e2) {
                    return false;
                }
            }
        } catch (e) {
            return false;
        }
    }
    
    // تصدير الدوال كدوال عامة
    if (typeof getPageNumberFromDocName === 'undefined') {
        getPageNumberFromDocName = function(docName) {
            try {
                var match = docName.match(/^(\d+)\.psd$/i);
                if (match && match[1]) {
                    return parseInt(match[1], 10);
                }
                return null;
            } catch (e) {
                return null;
            }
        };
    }
    
    if (typeof getSortedDocuments === 'undefined') {
        getSortedDocuments = function() {
            try {
                var documentsArray = [];
                for (var d = 0; d < app.documents.length; d++) {
                    documentsArray.push(app.documents[d]);
                }
                documentsArray.sort(function(a, b) {
                    var pageA = getPageNumberFromDocName(a.name) || 999999;
                    var pageB = getPageNumberFromDocName(b.name) || 999999;
                    return pageA - pageB;
                });
                return documentsArray;
            } catch (e) {
                return [];
            }
        };
    }
    
    if (typeof saveDocumentOptimized === 'undefined') {
        saveDocumentOptimized = function(doc) {
            try {
                if (doc.saved) return true;
                
                // محاولة الحفظ العادي أولاً
                try { 
                    doc.save(); 
                    return true; 
                } catch (e) {
                    // إذا فشل، جرب الحفظ بـ PSD options
                    try {
                        var targetFile = doc.fullName;
                        if (targetFile) {
                            var psdOptions = new PhotoshopSaveOptions();
                            psdOptions.embedColorProfile = true;
                            psdOptions.alphaChannels = true;
                            psdOptions.layers = true;
                            doc.saveAs(targetFile, psdOptions, true, Extension.LOWERCASE);
                            return true;
                        }
                    } catch (e2) {
                        return false;
                    }
                }
            } catch (e) {
                return false;
            }
        };
    }
    
    IS_DOCUMENT_UTILS_LOADED = true;
})();
