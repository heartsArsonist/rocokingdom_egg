// ╔══════════════════════════════════════════════════════════════╗
// ║        二~五、数据加载、兼容性、计数器、进化链                    ║
// ╚══════════════════════════════════════════════════════════════╝

/** 两个蛋组数组是否有交集 */
function hasCommonGroup(g1, g2) {
    for (var i = 0; i < g1.length; i++) { if (g2.includes(g1[i])) return true; }
    return false;
}

/** 不可孵蛋：蛋组含"1"(未发现) 或 标签含"300"(不可孵蛋) */
function isNonBreedable(idx) {
    return eggGroups[idx].includes(1) || petTags[idx].includes(300);
}

/** 构建全局可交配关系图：两个精灵有任意共同蛋组即可交配 */
function buildCompatibilityMap() {
    compatibleMap.clear();
    var n = petIds.length;
    for (var i = 0; i < n; i++) compatibleMap.set(i, new Set());
    for (var i = 0; i < n; i++) {
        if (eggGroups[i].length === 0 || isNonBreedable(i)) continue;
        compatibleMap.get(i).add(i);
        for (var j = i + 1; j < n; j++) {
            if (eggGroups[j].length === 0 || isNonBreedable(j)) continue;
            if (hasCommonGroup(eggGroups[i], eggGroups[j])) {
                compatibleMap.get(i).add(j);
                compatibleMap.get(j).add(i);
            }
        }
    }
}

function resetCounters() {
    femaleInstances = [];
    maleInstances = [];
}

function buildDefaultData() {
    petIds = [3081, 3011, 3151];
    petNames = ['治愈兔', '恶魔狼', '多多'];
    eggGroups = [[6, 7], [6], [9]];
    evolvesFromId = [null, null, null];
    petTags = [[101], [100], [100]];
    groupNames = { 6: '动物组', 7: '妖精组', 9: '拟人组' };
    seasonNames = { 101: 'S1 暗夜拾光', 102: 'S2 狂欢怪谈' };
    specialTagNames = { ...seasonNames, 1001: '只有雄性', 1002: '只有雌性' };
    buildCompatibilityMap();
    resetCounters();
    refreshUI();
}

async function loadPetsJSON() {
    try {
        var resp = await fetch('./data/pets.json?t=' + Date.now());
        if (!resp.ok) throw new Error('pets.json 加载失败');
        var pets = await resp.json();
        petIds = pets.map(function (p) { return p.id; });
        petNames = pets.map(function (p) { return p.name; });
        eggGroups = pets.map(function (p) { return p.egg_groups || []; });
        evolvesFromId = pets.map(function (p) { return p.evolves_from_id ?? null; });
        petTags = pets.map(function (p) {
            var tags = [...(p.special_tags || [])];
            if (p.has_shiny !== null && typeof p.has_shiny === 'number') tags.push(p.has_shiny);
            return tags;
        });
        buildCompatibilityMap();
        resetCounters();
        await loadDefinitions();
        refreshUI();
        return true;
    } catch (err) {
        console.warn('加载 pets.json 失败，使用内置数据:', err);
        return false;
    }
}

async function loadDefinitions() {
    try {
        var resp = await fetch('./data/defines.json?t=' + Date.now());
        if (resp.ok) {
            var defs = await resp.json();
            if (defs.egg_groups) Object.assign(groupNames, defs.egg_groups);
            if (defs.season) { Object.assign(seasonNames, defs.season); Object.assign(specialTagNames, defs.season); }
            if (defs.special_tags) Object.assign(specialTagNames, defs.special_tags);
        }
    } catch (e) {
        for (var i = 1; i <= 15; i++) groupNames[i] = i;
    }
    if (!specialTagNames[1001]) specialTagNames[1001] = '只有雄性';
    if (!specialTagNames[1002]) specialTagNames[1002] = '只有雌性';

    try {
        var pResp = await fetch('./data/personalities.json?t=' + Date.now());
        if (pResp.ok) personalityData = await pResp.json();
    } catch (e) { console.warn('性格数据加载失败'); }

    try {
        var mResp = await fetch('./data/medals.json?t=' + Date.now());
        if (mResp.ok) medalData = await mResp.json();
    } catch (e) { console.warn('奖牌数据加载失败'); }

    fillFilterSelects();
}

function getEvolutionChain(indices) {
    var resultSet = new Set();
    for (var ii = 0; ii < indices.length; ii++) {
        var idx = indices[ii];
        if (eggGroups[idx].length === 0) continue;
        if (evolutionChainCache.has(idx)) {
            var cached = evolutionChainCache.get(idx);
            cached.forEach(function (i) { resultSet.add(i); });
        } else {
            var chain = new Set();
            var current = idx;
            while (current !== null && current !== undefined) {
                chain.add(current);
                var parentId = evolvesFromId[current];
                if (parentId === null) break;
                current = petIds.indexOf(parentId);
                if (current === -1) break;
            }
            var toProcess = Array.from(chain);
            var processed = new Set(chain);
            while (toProcess.length > 0) {
                var cur = toProcess.pop();
                var curId = petIds[cur];
                for (var i = 0; i < petIds.length; i++) {
                    if (processed.has(i)) continue;
                    if (evolvesFromId[i] === curId) {
                        chain.add(i); processed.add(i); toProcess.push(i);
                    }
                }
            }
            evolutionChainCache.set(idx, chain);
            chain.forEach(function (i) { resultSet.add(i); });
        }
    }
    return Array.from(resultSet).filter(function (i) { return eggGroups[i].length > 0; });
}

function getPersonalityByName(name) {
    if (!name || !personalityData) return null;
    for (var boost in personalityData) {
        for (var i = 0; i < personalityData[boost].length; i++) {
            if (personalityData[boost][i].name === name) return { boost: boost, name: name, decrease: personalityData[boost][i].decrease };
        }
    }
    return null;
}

function getMedalById(id) {
    if (!id || !medalData) return null;
    var seriesKeys = Object.keys(medalData);
    for (var s = 0; s < seriesKeys.length; s++) {
        var series = medalData[seriesKeys[s]];
        for (var i = 0; i < series.length; i++) {
            if (series[i].id === id) return series[i];
        }
    }
    return null;
}

function getMedalSeriesKeys() {
    if (!medalData) return [];
    return Object.keys(medalData);
}

/** 填充筛选下拉框选项 */
function fillFilterSelects() {
    // 性格列表
    var persList = document.getElementById('filterPersonalityList');
    var persAll = [];
    for (var boost in personalityData) {
        personalityData[boost].forEach(function (p) { persAll.push({ boost: boost, name: p.name, decrease: p.decrease }); });
    }
    persAll.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh'); });
    persList.innerHTML = '<div class="combo-option" data-value="">无要求</div>';
    persList.querySelector('.combo-option[data-value=""]').addEventListener('mousedown', function (e) {
        e.preventDefault();
        selectPersonality('', '性格：无要求');
    });

    persAll.forEach(function (item) {
        var div = document.createElement('div');
        div.className = 'combo-option'; div.dataset.value = item.name;
        div.innerHTML = '🎭 ' + item.name + ' <span class="combo-stat">+' + item.boost + ' / -' + item.decrease + '</span>';
        div.addEventListener('mousedown', function (e) { e.preventDefault(); selectPersonality(item.name, '🎭 ' + item.name); });
        persList.appendChild(div);
    });

    // ── 奖牌列表：每个系列独立 combo ──
    var combosContainer = document.getElementById('filterMedalCombos');
    combosContainer.innerHTML = '';
    var seriesKeys = getMedalSeriesKeys();

    for (var sk = 0; sk < seriesKeys.length; sk++) {
        var skey = seriesKeys[sk];
        var comboId = 'filterMedalCombo_' + skey;
        var triggerId = 'filterMedalTrigger_' + skey;
        var searchId = 'filterMedalSearch_' + skey;
        var listId = 'filterMedalList_' + skey;

        // 确保 filterMedals 中有这个 key
        if (!(skey in filterMedals)) filterMedals[skey] = '';

        var combo = document.createElement('div');
        combo.className = 'filter-combo';
        combo.id = comboId;
        combo.innerHTML = '<div class="combo-trigger" id="' + triggerId + '">🏅 ' + skey + '：无要求</div>' +
            '<div class="combo-dropdown" style="display:none;">' +
            '<input class="combo-search" id="' + searchId + '" placeholder="搜索…" autocomplete="off">' +
            '<div class="combo-list" id="' + listId + '"></div></div>';
        combosContainer.appendChild(combo);

        // 填充该系列奖牌列表
        var list = document.getElementById(listId);
        list.innerHTML = '<div class="combo-option" data-value="">无要求</div>';
        (function (capturedSkey) {
            list.querySelector('.combo-option[data-value=""]').addEventListener('mousedown', function (e) {
                e.preventDefault();
                selectMedalForSeries(capturedSkey, '', '无要求');
            });
        })(skey);


        (medalData[skey] || []).forEach(function (m) {
            (function (capturedSkey, capturedM) {
                var div = document.createElement('div');
                div.className = 'combo-option'; div.dataset.value = capturedM.id;
                div.innerHTML = (capturedM.icon || '') + ' ' + capturedM.name;
                div.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    selectMedalForSeries(capturedSkey, capturedM.id, (capturedM.icon || '') + ' ' + capturedM.name);
                });
                list.appendChild(div);
            })(skey, m);
        });

    }

    initFilterCombos();
}

function selectPersonality(value, display) {
    filterPersonality = value;
    document.getElementById('filterPersonalityTrigger').textContent = display || '性格：无要求';
    closeComboDropdown('filterPersonalityCombo');
}

function selectMedalForSeries(seriesKey, value, display) {
    filterMedals[seriesKey] = value;
    document.getElementById('filterMedalTrigger_' + seriesKey).textContent = '🏅 ' + seriesKey + '：' + (display || '无要求');
    closeComboDropdown('filterMedalCombo_' + seriesKey);
}

function selectMedal(value, display) {
    // 保留兼容（筛选栏重置时调用）
    filterMedal = value;
}

function initFilterCombos() {
    // 性格 combo
    var persCombo = document.getElementById('filterPersonalityCombo');
    var persTrigger = document.getElementById('filterPersonalityTrigger');
    var persSearch = document.getElementById('filterPersonalitySearch');
    var persList = document.getElementById('filterPersonalityList');

    persTrigger.addEventListener('click', function (e) { e.stopPropagation(); toggleCombo(persCombo); });
    persSearch.addEventListener('input', function () {
        var ft = this.value.toLowerCase();
        persList.querySelectorAll('.combo-option').forEach(function (opt) {
            if (opt.dataset.value === '' || opt.textContent.toLowerCase().includes(ft)) opt.style.display = '';
            else opt.style.display = 'none';
        });
    });
    persSearch.addEventListener('click', function (e) { e.stopPropagation(); });

    // 每个奖牌系列 combo
    var seriesKeys = getMedalSeriesKeys();
    for (var sk = 0; sk < seriesKeys.length; sk++) {
        var skey = seriesKeys[sk];
        var comboEl = document.getElementById('filterMedalCombo_' + skey);
        var triggerEl = document.getElementById('filterMedalTrigger_' + skey);
        var searchEl = document.getElementById('filterMedalSearch_' + skey);
        var listEl = document.getElementById('filterMedalList_' + skey);

        triggerEl.addEventListener('click', function (combo, search) {
            return function (e) { e.stopPropagation(); toggleCombo(combo); };
        }(comboEl, searchEl));

        searchEl.addEventListener('input', function (list) {
            return function () {
                var ft = this.value.toLowerCase();
                list.querySelectorAll('.combo-option').forEach(function (opt) {
                    if (opt.dataset.value === '' || opt.textContent.toLowerCase().includes(ft)) opt.style.display = '';
                    else opt.style.display = 'none';
                });
            };
        }(listEl));

        searchEl.addEventListener('click', function (e) { e.stopPropagation(); });
    }

    document.addEventListener('click', function () {
        closeComboDropdown('filterPersonalityCombo');
        var allKeys = getMedalSeriesKeys();
        for (var sk2 = 0; sk2 < allKeys.length; sk2++) {
            closeComboDropdown('filterMedalCombo_' + allKeys[sk2]);
        }
    });
}

function toggleCombo(comboEl) {
    var dropdown = comboEl.querySelector('.combo-dropdown');
    var search = comboEl.querySelector('.combo-search');
    var isOpen = dropdown.style.display === 'block';
    // 关闭所有 combo
    closeComboDropdown('filterPersonalityCombo');
    var allKeys = getMedalSeriesKeys();
    for (var sk = 0; sk < allKeys.length; sk++) {
        closeComboDropdown('filterMedalCombo_' + allKeys[sk]);
    }
    if (!isOpen) { dropdown.style.display = 'block'; if (search) { search.value = ''; search.focus(); search.dispatchEvent(new Event('input')); } }
}

function closeComboDropdown(comboId) {
    var combo = document.getElementById(comboId);
    if (!combo) return;
    var dd = combo.querySelector('.combo-dropdown');
    if (dd) dd.style.display = 'none';
}
