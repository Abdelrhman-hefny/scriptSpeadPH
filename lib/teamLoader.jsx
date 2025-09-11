// Loads teams.json and exposes helpers
(function(){
    if (typeof loadTeams !== 'undefined') return;
    loadTeams = function (jsonFile) {
        if (!jsonFile.exists) throw new Error("ملف الفرق غير موجود: " + jsonFile.fsName);
        jsonFile.open("r");
        var jsonStr = jsonFile.read();
        jsonFile.close();
        if (!jsonStr) throw new Error("ملف JSON فارغ!");
        var teams;
        try { teams = JSON.parse(jsonStr); } catch (e) { throw new Error("خطأ في قراءة JSON: " + e); }
        if (!teams || typeof teams !== 'object' || isArray(teams)) throw new Error("الـ JSON غير صالح ككائن: تحقق من teams.json");
        return teams;
    };
    getTeamNames = function (teams) { return getObjectKeys(teams); };
})();

