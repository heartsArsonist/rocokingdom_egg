// ╔══════════════════════════════════════════════════════════════╗
// ║           替换雄性弹窗逻辑                                    ║
// ╚══════════════════════════════════════════════════════════════╝

var replaceFilterShiny = false;
var replaceFilterPersonality = '';
var replaceFilterMedals = {};

function openReplaceModal(slotIndex) {
    if (!lastResultData || lastResultData.error) return;
    var res = lastResultData;
    var maleSlot = res.allMaleSlots[slotIndex];
    if (!maleSlot) return;

    replaceTargetIndex = slotIndex;
    var currentSpecies = maleSlot.species;
    var currentName = petNames[currentSpecies];
    var currentGroups = (eggGroups[currentSpecies] || []).map(function(g) { return groupNames[g] || g; }).join('/');
    var currentStar = maleSlot.isShiny ? '⭐' : '';

    replaceModalTitle.innerHTML = '🔄 替换雄性';
    var curPers = maleSlot.personality ? getPersonalityByName(maleSlot.personality) : null;
    var curAttrHtml = '';
    if (curPers) curAttrHtml += '<span class="nest-tag-pers">' + curPers.name + '</span> ';
    if (maleSlot.medals) {
        var mkeys = Object.keys(maleSlot.medals);
        for (var mk = 0; mk < mkeys.length; mk++) {
            var curMedal = getMedalById(maleSlot.medals[mkeys[mk]]);
            if (curMedal) curAttrHtml += '<span class="nest-tag-medal">' + (curMedal.icon || '') + curMedal.name + '</span> ';
        }
    }
    replaceModalCurrent.innerHTML = '<strong>当前：</strong>♂ ' + currentName + currentStar + ' ' + curAttrHtml + '<span class="sub-modal-muted">(' + currentGroups + ')</span>';
    replaceSearchInput.value = '';

    replaceFilterShiny = false; replaceFilterPersonality = ''; replaceFilterMedals = {};
    var seriesKeys = getMedalSeriesKeys();
    for (var sk = 0; sk < seriesKeys.length; sk++) { replaceFilterMedals[seriesKeys[sk]] = ''; }
    buildReplaceFilterRow(seriesKeys);

        var coveredFemales = (res.maleCoverDetails[slotIndex].coveredIds || []);


    // 扣除方案中其他槽位 + 当前槽位已占用的雄性（从 inventory 中）
    var remainingInstances = inventory.filter(function(inst) { return inst.gender === 'male'; });
    res.allMaleSlots.forEach(function(slot, idx) {
        for (var i = remainingInstances.length - 1; i >= 0; i--) {
            var inst = remainingInstances[i];
            if (inst.species === slot.species && inst.shiny === slot.isShiny &&
                (inst.personality || null) === (slot.personality || null) &&
                JSON.stringify(inst.medals || {}) === JSON.stringify(slot.medals || {})) {
                remainingInstances.splice(i, 1); break;
            }
        }
    });

        // 候选判定：能覆盖原雄性覆盖的所有雌性即可
    var coveredFemaleSpecies = coveredFemales.map(function(cf) { return cf.id; });

    var availMap = {};
    remainingInstances.forEach(function(inst) {
        var sp = inst.species;
        // 直接检查候选雄性是否与每个被覆盖雌性兼容
        var matches = true;
        for (var cfi = 0; cfi < coveredFemaleSpecies.length; cfi++) {
            if (!compatibleMap.get(sp).has(coveredFemaleSpecies[cfi])) { matches = false; break; }
        }
        if (!matches) return;

        var key = sp + '|' + (inst.personality || '') + '|' + JSON.stringify(inst.medals || {}) + '|' + (inst.shiny ? 1 : 0);
        if (!availMap[key]) availMap[key] = { species: sp, personality: inst.personality, medals: inst.medals || {}, shiny: inst.shiny, count: 0 };
        availMap[key].count++;
    });

    var candidates = [];
    Object.values(availMap).forEach(function(c) {
        var groups = eggGroups[c.species].map(function(g) { return groupNames[g] || g; }).join('/');
        var attrStr = '';
        if (c.personality) { var p = getPersonalityByName(c.personality); if (p) attrStr += '<span class="nest-tag-pers">' + p.name + '</span> '; }
        if (c.medals) { var mk = Object.keys(c.medals); for (var mi = 0; mi < mk.length; mi++) { var m = getMedalById(c.medals[mk[mi]]); if (m) attrStr += '<span class="nest-tag-medal">' + (m.icon || '') + m.name + '</span> '; } }
        candidates.push({ species: c.species, name: petNames[c.species], groups: groups, remaining: c.count, isShiny: c.shiny, personality: c.personality, medals: c.medals, attrHtml: attrStr });
    });
    candidates.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh'); });

    function applyFiltersAndRender() {
        var searchFt = (replaceSearchInput.value || '').toLowerCase();
        var filtered = candidates.filter(function(c) {
            if (searchFt && !c.name.toLowerCase().includes(searchFt) && !c.groups.toLowerCase().includes(searchFt)) return false;
            if (replaceFilterShiny && !c.isShiny) return false;
            if (replaceFilterPersonality && c.personality !== replaceFilterPersonality) return false;
            var medalKeys = Object.keys(replaceFilterMedals);
            for (var fk = 0; fk < medalKeys.length; fk++) { var fkey = medalKeys[fk], fval = replaceFilterMedals[fkey]; if (fval) { var cmedals = c.medals || {}; if (cmedals[fkey] !== fval) return false; } }
            return true;
        });
        replaceModalList.innerHTML = '';
        if (filtered.length === 0) { replaceModalList.innerHTML = '<div class="sub-modal-empty">无匹配的可替换雄性</div>'; return; }
        filtered.forEach(function(c) {
            var card = document.createElement('div'); card.className = 'replace-candidate';
            var starIcons = c.isShiny ? '⭐' : '';
            card.innerHTML = '<div class="cand-name">♂ ' + c.name + ' ' + starIcons + '</div>' + (c.attrHtml ? '<div class="cand-attr">' + c.attrHtml + '</div>' : '') + '<div class="cand-stock">库存剩余: ' + c.remaining + ' 只</div>';
            card.addEventListener('click', function() { doReplaceMale(slotIndex, c.species, c.isShiny, c.personality, c.medals); });
            replaceModalList.appendChild(card);
        });
    }

    replaceSearchInput.oninput = applyFiltersAndRender;
    applyFiltersAndRender();
    replaceModalOverlay.style.display = 'flex';
    replaceSearchInput.focus();
}

function buildReplaceFilterRow(seriesKeys) {
    var row = document.getElementById('replaceFilterRow'); row.innerHTML = '';
    var shinyBtn = document.createElement('button'); shinyBtn.className = 'filter-shiny-btn'; shinyBtn.textContent = '⭐ 异色'; shinyBtn.title = '仅异色';
    shinyBtn.addEventListener('click', function() { replaceFilterShiny = !replaceFilterShiny; if (replaceFilterShiny) shinyBtn.classList.add('active'); else shinyBtn.classList.remove('active'); replaceSearchInput.oninput(); });
    row.appendChild(shinyBtn);

    var persCombo = createMiniCombo('性格', function() {
        var list = document.createElement('div'); list.innerHTML = '<div class="combo-option" data-value="">无要求</div>';
        var allPers = []; for (var boost in personalityData) { personalityData[boost].forEach(function(p) { allPers.push(p); }); }
        allPers.sort(function(a,b){return a.name.localeCompare(b.name,'zh');});
        allPers.forEach(function(p) { var opt = document.createElement('div'); opt.className = 'combo-option'; opt.dataset.value = p.name; opt.textContent = '🎭 ' + p.name; opt.addEventListener('mousedown', function(e){ e.preventDefault(); replaceFilterPersonality = p.name; persCombo.querySelector('.combo-trigger').textContent = '🎭 ' + p.name; persCombo.querySelector('.combo-dropdown').style.display = 'none'; replaceSearchInput.oninput(); }); list.appendChild(opt); });
        return list;
    });
    row.appendChild(persCombo);

    for (var sk = 0; sk < seriesKeys.length; sk++) {
        (function(skey) {
            var medalCombo = createMiniCombo('🏅' + skey, function() {
                var list = document.createElement('div'); list.innerHTML = '<div class="combo-option" data-value="">无要求</div>';
                (medalData[skey] || []).forEach(function(m) { var opt = document.createElement('div'); opt.className = 'combo-option'; opt.dataset.value = m.id; opt.textContent = (m.icon||'') + ' ' + m.name; opt.addEventListener('mousedown', function(e){ e.preventDefault(); replaceFilterMedals[skey] = m.id; medalCombo.querySelector('.combo-trigger').textContent = '🏅' + skey + ':' + m.name; medalCombo.querySelector('.combo-dropdown').style.display = 'none'; replaceSearchInput.oninput(); }); list.appendChild(opt); });
                return list;
            });
            row.appendChild(medalCombo);
        })(seriesKeys[sk]);
    }

    var resetBtn = document.createElement('button'); resetBtn.className = 'filter-reset-btn'; resetBtn.textContent = '↺'; resetBtn.title = '重置筛选';
    resetBtn.addEventListener('click', function() { replaceFilterShiny = false; replaceFilterPersonality = ''; var skeys = getMedalSeriesKeys(); for (var rk = 0; rk < skeys.length; rk++) { replaceFilterMedals[skeys[rk]] = ''; } buildReplaceFilterRow(skeys); replaceSearchInput.oninput(); });
    row.appendChild(resetBtn);
}

function createMiniCombo(defaultLabel, buildListFn) {
    var combo = document.createElement('div'); combo.className = 'filter-combo';
    var trigger = document.createElement('div'); trigger.className = 'combo-trigger'; trigger.textContent = defaultLabel;
    var dropdown = document.createElement('div'); dropdown.className = 'combo-dropdown'; dropdown.style.display = 'none';
    var searchInput = document.createElement('input'); searchInput.className = 'combo-search'; searchInput.placeholder = '搜索…'; searchInput.autocomplete = 'off';
    searchInput.addEventListener('click', function(e){ e.stopPropagation(); });
    searchInput.addEventListener('input', function(){ var ft = this.value.toLowerCase(); dropdown.querySelectorAll('.combo-option').forEach(function(opt){ if(opt.dataset.value==='' || opt.textContent.toLowerCase().includes(ft)) opt.style.display=''; else opt.style.display='none'; }); });
    dropdown.appendChild(searchInput);
    var listContainer = buildListFn(); listContainer.className = 'combo-list'; dropdown.appendChild(listContainer);
    combo.appendChild(trigger); combo.appendChild(dropdown);
    trigger.addEventListener('click', function(e){ e.stopPropagation(); var allDds = document.querySelectorAll('#replaceFilterRow .combo-dropdown'); for(var i=0;i<allDds.length;i++){ if(allDds[i]!==dropdown) allDds[i].style.display='none'; } var isOpen = dropdown.style.display==='block'; dropdown.style.display = isOpen?'none':'block'; if(!isOpen){ searchInput.value=''; searchInput.focus(); } });
    document.addEventListener('click', function handler(e){ if(!combo.contains(e.target)) dropdown.style.display='none'; });
    return combo;
}

function doReplaceMale(slotIndex, newSpecies, preferShiny, personality, medals) {
    if (!lastResultData || lastResultData.error) return;
    var res = lastResultData;
    var oldSlot = res.allMaleSlots[slotIndex]; if (!oldSlot) return;
    oldSlot.species = newSpecies; oldSlot.isShiny = preferShiny; oldSlot.locked = false;
    oldSlot.personality = personality || null; oldSlot.medals = medals || {};
    var maleSpCounter = {};
    res.allMaleSlots.forEach(function(m) { if(!maleSpCounter[m.species]) maleSpCounter[m.species]=0; m._displayIdx = maleSpCounter[m.species]++; });
    res.allMaleSlots.forEach(function(m) { m._displayTotal = maleSpCounter[m.species] || 1; });
    calcUniquePairs(res.femaleInstances, res.allMaleSlots);
    var coveredFemaleIds = new Set();
    res.allMaleSlots.forEach(function(m) { var comp = compatibleMap.get(m.species); res.femaleInstances.forEach(function(f) { if(comp.has(f.species)) coveredFemaleIds.add(f.id); }); });
    res.uncoveredFemales = res.femaleInstances.filter(function(f) { return !coveredFemaleIds.has(f.id); });
    res.maleCoverDetails = res.allMaleSlots.map(function(m) { var comp = compatibleMap.get(m.species); var covered = res.femaleInstances.filter(function(f) { return comp.has(f.species); }); return { species: m.species, locked: m.locked, lockedForIds: m.lockedForIds || [], isShiny: m.isShiny, personality: m.personality, medals: m.medals, _displayIdx: m._displayIdx, _displayTotal: m._displayTotal, coveredNames: covered.map(function(f) { return petNames[f.species]; }), coveredIds: covered.map(function(f) { return { id: f.species, isShiny: f.isShiny, instanceId: f.id, _displayIdx: f._displayIdx, _displayTotal: f._displayTotal, personality: f.personality, medals: f.medals }; }) }; });
    res.emptySlots = (getNestTotal() - res.femaleInstances.length) - res.allMaleSlots.length;
    closeReplaceModal(); renderResult(res); placementArea.style.display = 'none';
}

function closeReplaceModal() { replaceModalOverlay.style.display = 'none'; replaceTargetIndex = -1; replaceSearchInput.oninput = null; }
