// File utilities for Photoshop scripts
(function(){
    if (typeof IS_FILE_UTILS_LOADED !== 'undefined') return;
    
    // دالة محسنة لكتابة ملف لوج (أسرع)
    function writeLogFile(logPath, logs, errors) {
        try {
            var logFile = new File(logPath);
            if (logFile.open("w")) {
                // كتابة اللوجات في دفعة واحدة
                var logContent = "";
                for (var i = 0; i < logs.length; i++) {
                    logContent += logs[i] + "\n";
                }
                
                // كتابة الأخطاء إذا وجدت
                if (errors && errors.length > 0) {
                    logContent += "\n--- ERRORS ---\n";
                    for (var j = 0; j < errors.length; j++) {
                        logContent += errors[j] + "\n";
                    }
                }
                
                // كتابة كل المحتوى مرة واحدة
                logFile.write(logContent);
                logFile.close();
            }
        } catch (e) {
            // تجاهل أخطاء كتابة اللوج
        }
    }
    
    // تصدير الدوال كدوال عامة
    if (typeof writeLogFile === 'undefined') {
        writeLogFile = function(logPath, logs, errors) {
            try {
                var logFile = new File(logPath);
                if (logFile.open("w")) {
                    // كتابة اللوجات في دفعة واحدة
                    var logContent = "";
                    for (var i = 0; i < logs.length; i++) {
                        logContent += logs[i] + "\n";
                    }
                    
                    // كتابة الأخطاء إذا وجدت
                    if (errors && errors.length > 0) {
                        logContent += "\n--- ERRORS ---\n";
                        for (var j = 0; j < errors.length; j++) {
                            logContent += errors[j] + "\n";
                        }
                    }
                    
                    // كتابة كل المحتوى مرة واحدة
                    logFile.write(logContent);
                    logFile.close();
                }
            } catch (e) {
                // تجاهل أخطاء كتابة اللوج
            }
        };
    }
    
    IS_FILE_UTILS_LOADED = true;
})();
