var batchFilePath = "C:/Users/abdoh/Downloads/testScript/watch_clean.bat";
if (File(batchFilePath).exists) {
    // يستخدم start /wait وينتظر انتهاء الباتش
    system.callSystem('cmd /c start /wait "" "' + batchFilePath + '"');
} else {
    alert("Batch file not found: " + batchFilePath);
}
