//#target photoshop

app.bringToFront();

// تحميل JSON parser إن لزم
try {
    $.evalFile("C:/Users/abdoh/Downloads/testScript/json2.js");
} catch (e) {}

(function () {
    if (typeof app === 'undefined' || !app) {
        alert('يجب تشغيل السكريبت داخل Photoshop');
        return;
    }

    var baseFolder = Folder("C:/Users/abdoh/Downloads/testScript");
    var teamsFile = File(baseFolder.fsName + "/teams.json");
    if (!teamsFile.exists) {
        alert('لم يتم العثور على teams.json');
        return;
    }

    function readTextFile(f) {
        f.open('r');
        var s = f.read();
        f.close();
        return s;
    }

    function writeTextFile(f, s) {
        f.open('w');
        f.write(s);
        f.close();
    }

    function tryGetFont(name) {
        try {
            if (!name) return null;
            var f = app.fonts.getByName(name);
            return f ? name : null;
        } catch (e) {
            return null;
        }
    }

    // بدائل ويندوز الشائعة
    var COMMON_FALLBACKS = [
        'Tahoma',
        'Arial',
        'Segoe UI',
        'Verdana',
        'Georgia',
        'Times New Roman',
        'Impact',
        'Comic Sans MS'
    ];

    function pickFallback() {
        for (var i = 0; i < COMMON_FALLBACKS.length; i++) {
            var cf = tryGetFont(COMMON_FALLBACKS[i]);
            if (cf) return cf;
        }
        return 'Arial';
    }

    var raw = readTextFile(teamsFile);
    var data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        alert('خطأ في قراءة JSON: ' + e);
        return;
    }

    var missing = [];
    var fixed = {};
    var teamsCount = 0;

    for (var teamName in data) {
        if (!data.hasOwnProperty(teamName)) continue;
        teamsCount++;
        var team = data[teamName];
        var newTeam = JSON.parse(JSON.stringify(team));

        // defaultFont
        if (team.defaultFont && !tryGetFont(team.defaultFont)) {
            missing.push(teamName + '::defaultFont => ' + team.defaultFont);
            newTeam.defaultFont = pickFallback();
        }

        // fontMap
        if (team.fontMap) {
            var newMap = {};
            for (var key in team.fontMap) {
                if (!team.fontMap.hasOwnProperty(key)) continue;
                var fname = team.fontMap[key];
                if (!tryGetFont(fname)) {
                    missing.push(teamName + '::fontMap["' + key + '"] => ' + fname);
                    newMap[key] = pickFallback();
                } else {
                    newMap[key] = fname;
                }
            }
            newTeam.fontMap = newMap;
        }

        fixed[teamName] = newTeam;
    }

    // كتابة النتائج
    var outFixed = File(baseFolder.fsName + '/teams_resolved.json');
    writeTextFile(outFixed, JSON.stringify(fixed, null, 2));

    var report = File(baseFolder.fsName + '/missing_fonts_report.txt');
    var lines = [];
    lines.push('Teams scanned: ' + teamsCount);
    lines.push('Missing font references: ' + missing.length);
    lines.push('Fallback used (first available): ' + pickFallback());
    lines.push('-------------------------------------------');
    for (var i2 = 0; i2 < missing.length; i2++) lines.push(missing[i2]);
    writeTextFile(report, lines.join('\n'));

    alert('تم إنشاء teams_resolved.json + missing_fonts_report.txt في نفس المجلد');
})();


