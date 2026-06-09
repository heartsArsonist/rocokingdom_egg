function exportConfig() {
    function eggGroupNames(groups) { return groups.map(function(g) { return groupNames[g] || String(g); }); }
    var config = { nestCount: getNestTotal(), inventory: [], nestFemales: [] };

    inventory.forEach(function(inst) {
        var entry = { id: petIds[inst.species], name: petNames[inst.species], egg_groups: eggGroupNames(eggGroups[inst.species]), gender: inst.gender, shiny: inst.shiny };
        if (inst.personality) entry.personality = inst.personality;
        if (inst.medals) { var hasAny = false; var mkeys = Object.keys(inst.medals); for (var mk = 0; mk < mkeys.length; mk++) { if (inst.medals[mkeys[mk]]) { hasAny = true; break; } } if (hasAny) entry.medals = inst.medals; }
        config.inventory.push(entry);
    });

    nestFemales.forEach(function(f) {
        var entry = { id: petIds[f.species], name: petNames[f.species], egg_groups: eggGroupNames(eggGroups[f.species]), shiny: f.shiny };
        if (f.personality) entry.personality = f.personality;
        if (f.medals) { var hasAny = false; var mkeys = Object.keys(f.medals); for (var mk = 0; mk < mkeys.length; mk++) { if (f.medals[mkeys[mk]]) { hasAny = true; break; } } if (hasAny) entry.medals = f.medals; }
        config.nestFemales.push(entry);
    });

    var blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.download = '配窝配置.json'; a.href = URL.createObjectURL(blob); a.click();
}

function importConfig(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var config = JSON.parse(e.target.result);
            inventory = []; nestFemales = [];
            if (config.nestCount) nestCountInput.value = config.nestCount;

            function resolvePetIndex(entry) {
                var idx = petIds.indexOf(entry.id); if (idx !== -1) return idx;
                idx = petNames.indexOf(entry.name); if (idx !== -1) return idx;
                if (entry.egg_groups && entry.egg_groups.length > 0) { var entryGroups = new Set(entry.egg_groups); for (var i = 0; i < petNames.length; i++) { if (petNames[i] !== entry.name) continue; var petGroups = eggGroups[i].map(function(g) { return groupNames[g] || String(g); }); if (petGroups.some(function(g) { return entryGroups.has(g); })) return i; } }
                return -1;
            }

            function normalizeMedals(entry) {
                if (entry.medals && typeof entry.medals === 'object') return entry.medals;
                if (entry.medal) { var seriesKeys = getMedalSeriesKeys(); if (seriesKeys.length === 0) return {}; var n = {}; n[seriesKeys[0]] = entry.medal; return n; }
                return {};
            }

            // 新版格式
            if (config.inventory) {
                config.inventory.forEach(function(inst) {
                    var idx = resolvePetIndex(inst); if (idx === -1) return;
                    inventory.push({ species: idx, gender: inst.gender || 'male', shiny: inst.shiny || false, personality: inst.personality || null, medals: normalizeMedals(inst) });
                });
            }
            if (config.nestFemales) {
                config.nestFemales.forEach(function(f) {
                    var idx = resolvePetIndex(f); if (idx === -1) return;
                    nestFemales.push({ species: idx, shiny: f.shiny || false, personality: f.personality || null, medals: normalizeMedals(f) });
                });
            }

            // 兼容旧版格式
            if (!config.inventory && (config.females || config.males)) {
                if (config.females) { config.females.forEach(function(f) { var idx = resolvePetIndex(f); if (idx !== -1) { for (var c = 0; c < (f.count || 1); c++) { inventory.push({ species: idx, gender: 'female', shiny: f.shiny || false, personality: f.personality || null, medals: normalizeMedals(f) }); } } }); }
                if (config.males) { config.males.forEach(function(m) { var idx = resolvePetIndex(m); if (idx !== -1) { for (var c = 0; c < (m.count || 1); c++) { inventory.push({ species: idx, gender: 'male', shiny: m.shiny || false, personality: m.personality || null, medals: normalizeMedals(m) }); } } }); }
            }

            refreshUI();
        } catch (err) { alert('配置文件格式错误'); }
    };
    reader.readAsText(file);
}
