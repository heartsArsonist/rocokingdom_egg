// ╔══════════════════════════════════════════════════════════════╗
// ║      六~八、UI 辅助、DOM引用、模态框、库存弹窗、窝弹窗           ║
// ╚══════════════════════════════════════════════════════════════╝

var CIRCLED_NUMS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

// ── DOM 引用 ──
var nestCountInput = document.getElementById('nestCount');
var femaleTotalBadge = document.getElementById('femaleTotalBadge');
var femaleLimitWarn = document.getElementById('femaleLimitWarn');
var maxFemaleDisplay = document.getElementById('maxFemaleDisplay');
var capacityHint = document.getElementById('capacityHint');
var globalMsg = document.getElementById('globalMsg');
var resultArea = document.getElementById('resultArea');
var nestVisualDiv = document.getElementById('nestVisual');
var maleDetailsDiv = document.getElementById('maleDetails');
var coverageSummaryDiv = document.getElementById('coverageSummary');
var generateBtn = document.getElementById('generateBtn');
var resetBtn = document.getElementById('resetBtn');
var exportBtn = document.getElementById('exportBtn');
var placementBtn = document.getElementById('placementBtn');
var placementArea = document.getElementById('placementArea');
var svgContainer = document.getElementById('svgContainer');
var exportPlacementBtn = document.getElementById('exportPlacementBtn');
var nestFemaleDisplay = document.getElementById('nestFemaleDisplay');
var openNestFemaleBtn = document.getElementById('openNestFemaleBtn');
var resultContent = document.getElementById('resultContent');

// 库存
var invCards = document.getElementById('invCards');
var invFemaleCount = document.getElementById('invFemaleCount');
var invMaleCount = document.getElementById('invMaleCount');

// 主模态弹窗（添加精灵用）
var modalOverlay = document.getElementById('modalOverlay');
var modalTitle = document.getElementById('modalTitle');
var modalCloseBtn = document.getElementById('modalCloseBtn');
var modalCancel = document.getElementById('modalCancel');
var modalConfirm = document.getElementById('modalConfirm');
var groupFilter = document.getElementById('groupFilter');
var seasonFilter = document.getElementById('seasonFilter');

// 替换弹窗
var replaceModalOverlay = document.getElementById('replaceModalOverlay');
var replaceModalTitle = document.getElementById('replaceModalTitle');
var replaceModalCurrent = document.getElementById('replaceModalCurrent');
var replaceSearchInput = document.getElementById('replaceSearchInput');
var replaceModalList = document.getElementById('replaceModalList');

// ── 工具函数 ──
function getNestTotal() { return Math.max(1, Math.min(10, parseInt(nestCountInput.value) || 10)); }
function getMaxFemales() { return Math.max(0, getNestTotal() - 1); }
function getFemaleTotal() { return nestFemales.length; }
function getMaleStockTotal() { return inventory.filter(function (inst) { return inst.gender === 'male'; }).length; }

function groupInstances(instances) {
    var groups = [];
    var seen = {};
    instances.forEach(function (inst, i) {
        var key = inst.species + '|' + (inst.shiny ? 1 : 0);
        if (!seen[key]) { seen[key] = { species: inst.species, shiny: inst.shiny, instances: [] }; groups.push(seen[key]); }
        seen[key].instances.push({ personality: inst.personality, medals: inst.medals || {}, idx: i });
    });
    return groups;
}

function getDisplayName(species, instanceIdx, totalSame) {
    if (totalSame > 1) {
        var num = instanceIdx < CIRCLED_NUMS.length ? CIRCLED_NUMS[instanceIdx] : '(' + (instanceIdx + 1) + ')';
        return petNames[species] + num;
    }
    return petNames[species];
}

function renderMedalTagsHtml(medals) {
    if (!medals) return '';
    var html = '';
    Object.keys(medals).forEach(function (sk) {
        var mid = medals[sk];
        if (mid) { var m = getMedalById(mid); if (m) html += '<span class="panel-tag-medal">' + (m.icon || '') + m.name + '</span>'; }
    });
    return html;
}

function medalsKey(medals) { return JSON.stringify(medals || {}); }

/**
 * 智能判断搜索范围：
 * - 全精灵模式（搜索或筛选弹出结果）——只返回满足条件的
 * - 库存模式 —— 返回库存中符合筛选的所有雌性
 */
function getNestModalSource(isInventoryMode, searchText, filters) {
    if (isInventoryMode) {
        // 库存雌性模式
        var females = inventory.filter(function (inst) { return inst.gender === 'female'; });
        if (searchText) {
            var ft = searchText.toLowerCase();
            females = females.filter(function (inst) { return petNames[inst.species].toLowerCase().includes(ft); });
        }
        return applyModalFilters(females, filters);
    }
    // 全精灵模式 — 必须搜索或筛选
    if (!searchText) return [];
    var ft = searchText.toLowerCase();
    var results = [];
    for (var i = 0; i < petIds.length; i++) {
        if (eggGroups[i].length === 0) continue;
        if (petTags[i].includes(1001)) continue; // 只有雄性
        if (petNames[i].toLowerCase().includes(ft)) results.push(i);
    }
    return results.map(function (idx) {
        return { species: idx, shiny: false, personality: null, medals: {}, gender: 'female' };
    });
}

function applyModalFilters(list, filters) {
    return list.filter(function (inst) {
        if (filters.shiny && !inst.shiny) return false;
        if (filters.personality && inst.personality !== filters.personality) return false;
        if (filters.medalBody && (!inst.medals || inst.medals.body !== filters.medalBody)) return false;
        if (filters.medalVoice && (!inst.medals || inst.medals.voice !== filters.medalVoice)) return false;
        return true;
    });
}

// ── 主面板刷新 ──
function refreshUI() {
    var maxF = getMaxFemales();
    var fTotal = nestFemales.length;
    var invF = inventory.filter(function (inst) { return inst.gender === 'female'; }).length;
    var invM = inventory.filter(function (inst) { return inst.gender === 'male'; }).length;

    capacityHint.textContent = maxF > 0 ? '最多放' + maxF + '只雌性·至少1个雄性窝' : '需至少2个窝';
    femaleTotalBadge.textContent = '入窝: ' + fTotal + ' / ' + maxF;
    invFemaleCount.textContent = '♀ ' + invF;
    invMaleCount.textContent = '♂ ' + invM;

    if (fTotal > maxF) { femaleLimitWarn.textContent = '⚠️ 超出上限！请减少至' + maxF + '只'; femaleTotalBadge.classList.add('warn'); }
    else { femaleLimitWarn.textContent = ''; femaleTotalBadge.classList.remove('warn'); }

    renderInventoryCards();
    renderNestFemaleTags();
}

// ── 库存展示面板（只读）──
var invFilterGender = '';
var invFilterShiny = false;
var invFilterPers = '';
var invFilterMedalBody = '';
var invFilterMedalVoice = '';

function renderInventoryCards() {
    invCards.innerHTML = '';
    var filtered = inventory.filter(function (inst) {
        if (invFilterGender && inst.gender !== invFilterGender) return false;
        if (invFilterShiny && !inst.shiny) return false;
        if (invFilterPers && inst.personality !== invFilterPers) return false;
        if (invFilterMedalBody) { var m = inst.medals || {}; if (m.body !== invFilterMedalBody) return false; }
        if (invFilterMedalVoice) { var m2 = inst.medals || {}; if (m2.voice !== invFilterMedalVoice) return false; }
        return true;
    });

    if (filtered.length === 0) { invCards.innerHTML = '<span class="empty-hint">暂未录入</span>'; return; }
    filtered.forEach(function (inst) {
        var card = document.createElement('div');
        card.className = 'stock-card';
        card.innerHTML = renderInvCardContent(inst);
        invCards.appendChild(card);
    });
}

function renderInvCardContent(inst) {
    var star = inst.shiny ? '⭐' : '';
    var icon = inst.gender === 'female' ? '♀️' : '♂️';
    var groups = (eggGroups[inst.species] || []).map(function (g) { return groupNames[g] || g; }).join('/');
    var attrHtml = '';
    if (inst.personality) { var p = getPersonalityByName(inst.personality); if (p) attrHtml += '<span class="panel-tag-pers">🎭' + p.name + '</span>'; }
    attrHtml += renderMedalTagsHtml(inst.medals);
    return '<div class="stock-card-top">' + icon + ' ' + petNames[inst.species] + ' ' + star + ' <span class="stock-card-groups">' + groups + '</span></div>' +
        '<div class="stock-card-bottom">' + (attrHtml || '&nbsp;') + '</div>';
}


// ── 精灵窝雌性标签（只读）──
function renderNestFemaleTags() {
    nestFemaleDisplay.innerHTML = '';
    if (nestFemales.length === 0) { nestFemaleDisplay.innerHTML = '<span class="empty-hint">暂未放入雌性</span>'; return; }

    var groups = groupInstances(nestFemales);
    groups.forEach(function (g) {
        var subGroups = [];
        g.instances.forEach(function (inst) {
            var subKey = (inst.personality || '') + '|' + medalsKey(inst.medals);
            var found = false;
            for (var s = 0; s < subGroups.length; s++) { if (subGroups[s].key === subKey) { subGroups[s].count++; found = true; break; } }
            if (!found) subGroups.push({ key: subKey, personality: inst.personality, medals: inst.medals, count: 1 });
        });
        subGroups.forEach(function (sg) {
            var tag = document.createElement('span');
            tag.className = 'pet-tag female-tag';
            var attrHtml = '';
            if (sg.personality) { var p = getPersonalityByName(sg.personality); if (p) attrHtml += '<span class="panel-tag-pers">🎭' + p.name + '</span>'; }
            attrHtml += renderMedalTagsHtml(sg.medals);
            tag.innerHTML = '<span>♀️ ' + petNames[g.species] + '</span>' + attrHtml + '<span class="tag-qty">×' + sg.count + '</span><button class="tag-remove" data-species="' + g.species + '" data-shiny="' + g.shiny + '" data-personality="' + (sg.personality || '') + '" data-medals="' + encodeURIComponent(medalsKey(sg.medals)) + '">✕</button>';
            tag.querySelector('.tag-remove').addEventListener('click', function (e) {
                e.stopPropagation();
                var sp = parseInt(this.dataset.species);
                var shiny = this.dataset.shiny === 'true';
                var pers = this.dataset.personality || null; if (pers === '') pers = null;
                var meds = {}; try { meds = JSON.parse(decodeURIComponent(this.dataset.medals || '{}')); } catch (ex) { }
                for (var i = nestFemales.length - 1; i >= 0; i--) {
                    var fi = nestFemales[i];
                    if (fi.species === sp && fi.shiny === shiny && fi.personality === pers && medalsKey(fi.medals) === medalsKey(meds)) {
                        nestFemales.splice(i, 1); break;
                    }
                }
                refreshUI();
            });
            nestFemaleDisplay.appendChild(tag);
        });
    });
}

// ═══════════════════════════════════════════════════════════
//  管理仓库弹窗
// ═══════════════════════════════════════════════════════════

var invModalFilterGender = '';
var invModalFilterShiny = false;
var invModalFilterPers = '';
var invModalFilterMedalBody = '';
var invModalFilterMedalVoice = '';

function openInventoryModal() {
    invModalFilterGender = ''; invModalFilterShiny = false;
    invModalFilterPers = ''; invModalFilterMedalBody = ''; invModalFilterMedalVoice = '';
    document.getElementById('invModalSearch').value = '';
    updateInvModalFilterUI();
    renderInvModalList();
    document.getElementById('invModalOverlay').style.display = 'flex';
}

function closeInventoryModal() {
    document.getElementById('invModalOverlay').style.display = 'none';
    refreshUI();
}

function updateInvModalFilterUI() {
    var btns = document.querySelectorAll('#invModalFilters .stock-fbtn[data-mfilter="gender"]');
    btns.forEach(function (b) { b.classList.toggle('active', b.dataset.val === invModalFilterGender); });
    var shinyBtn = document.getElementById('invModalFilterShiny');
    shinyBtn.classList.toggle('active', invModalFilterShiny);
}

function renderInvModalList() {
    var container = document.getElementById('invModalList');
    var searchText = (document.getElementById('invModalSearch').value || '').toLowerCase();
    var filtered = inventory.filter(function (inst) {
        if (invModalFilterGender && inst.gender !== invModalFilterGender) return false;
        if (invModalFilterShiny && !inst.shiny) return false;
        if (invModalFilterPers && inst.personality !== invModalFilterPers) return false;
        if (invModalFilterMedalBody) { var m = inst.medals || {}; if (m.body !== invModalFilterMedalBody) return false; }
        if (invModalFilterMedalVoice) { var m2 = inst.medals || {}; if (m2.voice !== invModalFilterMedalVoice) return false; }
        if (searchText && !petNames[inst.species].toLowerCase().includes(searchText)) return false;
        return true;
    });

    container.innerHTML = '';
    if (filtered.length === 0) { container.innerHTML = '<div class="sub-modal-empty">暂无匹配精灵</div>'; return; }

    // 分组显示
    var grouped = {};
    filtered.forEach(function (inst, idx) {
        var key = inst.species + '|' + inst.gender + '|' + inst.shiny + '|' + (inst.personality || '') + '|' + medalsKey(inst.medals);
        if (!grouped[key]) grouped[key] = { species: inst.species, gender: inst.gender, shiny: inst.shiny, personality: inst.personality, medals: inst.medals, indices: [] };
        grouped[key].indices.push(idx);
    });

    Object.values(grouped).forEach(function (g) {
        var card = document.createElement('div');
        card.className = 'inv-modal-card';
        card.innerHTML = renderInvCardContent(g);
        var countBadge = document.createElement('span');
        countBadge.className = 'stock-card-count'; countBadge.textContent = '×' + g.indices.length;
        card.appendChild(countBadge);

        card.addEventListener('click', function () {
            openInvEditPopup(g.species, g.gender, g.shiny, g.personality, g.medals, g.indices.length);
        });
        container.appendChild(card);
    });
}

// ── 库存编辑小弹窗 ──
var editingKey = null;

function openInvEditPopup(species, gender, shiny, personality, medals, count) {
    editingKey = { species: species, gender: gender, shiny: shiny, personality: personality, medals: medals };
    document.getElementById('invEditTitle').textContent = (gender === 'female' ? '♀️' : '♂️') + ' ' + petNames[species];
    document.getElementById('invEditQty').value = count;

    // 填充性格下拉
    var persSelect = document.getElementById('invEditPers');
    persSelect.innerHTML = '<option value="">无</option>';
    var persAll = [];
    for (var boost in personalityData) {
        personalityData[boost].forEach(function (p) {
            persAll.push({ name: p.name, decrease: p.decrease, boost: boost });
        });
    }
    persAll.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh'); });
    persAll.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name + ' (+' + p.boost + '/-' + p.decrease + ')';
        if (p.name === personality) opt.selected = true;
        persSelect.appendChild(opt);
    });


    // body 奖牌
    var bodySelect = document.getElementById('invEditBody');
    bodySelect.innerHTML = '<option value="">无</option>';
    (medalData.body || []).forEach(function (m) {
        var opt = document.createElement('option'); opt.value = m.id; opt.textContent = m.name;
        if (medals && medals.body === m.id) opt.selected = true;
        bodySelect.appendChild(opt);
    });

    // voice 奖牌
    var voiceSelect = document.getElementById('invEditVoice');
    voiceSelect.innerHTML = '<option value="">无</option>';
    (medalData.voice || []).forEach(function (m) {
        var opt = document.createElement('option'); opt.value = m.id; opt.textContent = m.name;
        if (medals && medals.voice === m.id) opt.selected = true;
        voiceSelect.appendChild(opt);
    });

    document.getElementById('invEditOverlay').style.display = 'flex';
}

function saveInvEdit() {
    var newQty = Math.max(0, parseInt(document.getElementById('invEditQty').value) || 0);
    var newPers = document.getElementById('invEditPers').value || null;
    var newBody = document.getElementById('invEditBody').value || null;
    var newVoice = document.getElementById('invEditVoice').value || null;
    var newMedals = {};
    if (newBody) newMedals.body = newBody;
    if (newVoice) newMedals.voice = newVoice;

    if (newQty === 0) {
        if (!confirm('数量为 0，将删除所有匹配的精灵。确定吗？')) return;
    }

    var ek = editingKey;
    for (var i = inventory.length - 1; i >= 0; i--) {
        var inst = inventory[i];
        if (inst.species === ek.species && inst.gender === ek.gender && inst.shiny === ek.shiny &&
            inst.personality === ek.personality && medalsKey(inst.medals) === medalsKey(ek.medals)) {
            inventory.splice(i, 1);
        }
    }

    for (var j = 0; j < newQty; j++) {
        inventory.push({ species: ek.species, gender: ek.gender, shiny: ek.shiny, personality: newPers, medals: JSON.parse(JSON.stringify(newMedals)) });
    }

    closeInvEdit();
    renderInvModalList();
    refreshUI();
}

function deleteInvEditEntry() {
    if (!confirm('确定删除该组精灵吗？此操作不可恢复。')) return;
    var ek = editingKey;
    for (var i = inventory.length - 1; i >= 0; i--) {
        var inst = inventory[i];
        if (inst.species === ek.species && inst.gender === ek.gender && inst.shiny === ek.shiny &&
            inst.personality === ek.personality && medalsKey(inst.medals) === medalsKey(ek.medals)) {
            inventory.splice(i, 1);
        }
    }
    closeInvEdit();
    renderInvModalList();
    refreshUI();
}

function closeInvEdit() {
    document.getElementById('invEditOverlay').style.display = 'none';
    editingKey = null;
}


// ═══════════════════════════════════════════════════════════
//  添加雌性入窝弹窗
// ═══════════════════════════════════════════════════════════

var nestModalIsInvMode = false;
var nestModalSelected = [];          // [{ species, shiny, personality, medals }]
var nestModalFilters = { shiny: false, personality: '', medalBody: '', medalVoice: '' };

function openNestFemaleModal() {
    nestModalIsInvMode = false;
    nestModalSelected = nestFemales.map(function (f) { return { species: f.species, shiny: f.shiny, personality: f.personality, medals: f.medals ? JSON.parse(JSON.stringify(f.medals)) : {} }; });
    nestModalFilters = { shiny: false, personality: '', medalBody: '', medalVoice: '' };
    document.getElementById('nestFemaleSearch').value = '';
    document.getElementById('nestEggGroupFilter').value = '';
    document.getElementById('nestSeasonFilter').value = '';
    document.getElementById('nestModeToggle').textContent = '📋 从库存雌性中选取';
    document.getElementById('nestModeLabel').textContent = '当前：全部精灵（搜索后显示）';
    document.getElementById('nestModalFilters').style.display = 'none';
    document.getElementById('nestEggGroupFilter').style.display = 'inline-block';
    document.getElementById('nestSeasonFilter').style.display = 'inline-block';
    document.getElementById('nestFemaleResults').innerHTML = '<div class="sub-modal-empty">请输入关键词搜索</div>';
    renderNestModalSelected();
    // 预填 nestAttr 弹窗的性格/奖牌下拉
    if (!document.getElementById('nestAttrPers').dataset.filled) {
        var persSel = document.getElementById('nestAttrPers');
        var allP = []; for (var boost in personalityData) { personalityData[boost].forEach(function (p) { allP.push({ name: p.name, boost: boost, decrease: p.decrease }); }); }
        allP.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh'); });
        allP.forEach(function (p) { var o = document.createElement('option'); o.value = p.name; o.textContent = p.name + ' (+' + p.boost + '/-' + p.decrease + ')'; persSel.appendChild(o); });
        ['Body', 'Voice'].forEach(function (sk) { var lk = sk.toLowerCase(); var sel = document.getElementById('nestAttr' + sk); (medalData[lk] || []).forEach(function (m) { var o = document.createElement('option'); o.value = m.id; o.textContent = (m.icon || '') + ' ' + m.name; sel.appendChild(o); }); });
        document.getElementById('nestAttrPers').dataset.filled = '1';
    }

    document.getElementById('nestFemaleModalOverlay').style.display = 'flex';
}


function toggleNestMode() {
    nestModalIsInvMode = !nestModalIsInvMode;
    document.getElementById('nestModeToggle').textContent = nestModalIsInvMode ? '🌐 从全部精灵搜索' : '📋 从库存雌性中选取';
    document.getElementById('nestModeLabel').textContent = nestModalIsInvMode ? '当前：库存雌性（全部显示）' : '当前：全部精灵（搜索后显示）';
    // 两种模式都显示筛选
    document.getElementById('nestModalFilters').style.display = nestModalIsInvMode ? 'flex' : 'none';
    document.getElementById('nestEggGroupFilter').style.display = nestModalIsInvMode ? 'none' : 'inline-block';
    document.getElementById('nestSeasonFilter').style.display = nestModalIsInvMode ? 'none' : 'inline-block';
    document.getElementById('nestFemaleSearch').value = '';
    performNestSearch();
}



function performNestSearch() {
    var searchText = (document.getElementById('nestFemaleSearch').value || '').trim();
    var eggGroupVal = parseInt(document.getElementById('nestEggGroupFilter').value) || 0;
    var seasonVal = parseInt(document.getElementById('nestSeasonFilter').value) || 0;
    var sources;

    if (nestModalIsInvMode) {
        sources = inventory.filter(function (inst) { return inst.gender === 'female'; });
        sources = applyModalFilters(sources, nestModalFilters);
        if (searchText) {
            var ft = searchText.toLowerCase();
            sources = sources.filter(function (inst) { return petNames[inst.species].toLowerCase().includes(ft); });
        }
    } else {
        if (!searchText && !eggGroupVal && !seasonVal) {
            document.getElementById('nestFemaleResults').innerHTML = '<div class="sub-modal-empty">请输入关键词或选择蛋组/赛季</div>';
            return;
        }
        var ft = searchText.toLowerCase();
        var indices = [];
        for (var i = 0; i < petIds.length; i++) {
            if (eggGroups[i].length === 0) continue;
            if (petTags[i].includes(1001)) continue;
            if (eggGroupVal && !eggGroups[i].includes(eggGroupVal)) continue;
            if (seasonVal && !petTags[i].includes(seasonVal)) continue;
            if (ft && !petNames[i].toLowerCase().includes(ft)) continue;
            indices.push(i);
        }
        sources = indices.map(function (idx) {
            return {
                species: idx,
                shiny: nestModalFilters.shiny,
                personality: nestModalFilters.personality || null,
                medals: JSON.parse(JSON.stringify({ body: nestModalFilters.medalBody || null, voice: nestModalFilters.medalVoice || null })),
                gender: 'female'
            };
        });
    }

    var container = document.getElementById('nestFemaleResults');
    container.innerHTML = '';
    if (sources.length === 0) { container.innerHTML = '<div class="sub-modal-empty">无匹配结果</div>'; return; }

    var grouped = {};
    sources.forEach(function (src) {
        var key = src.species + '|' + (src.shiny ? 1 : 0) + '|' + (src.personality || '') + '|' + medalsKey(src.medals);
        if (grouped[key]) grouped[key].count++;
        else grouped[key] = { species: src.species, shiny: src.shiny, personality: src.personality, medals: src.medals || {}, count: 1 };
    });

    Object.values(grouped).forEach(function (g) {
        var card = document.createElement('div');
        card.className = 'nest-select-card';
        var star = g.shiny ? '⭐' : '';
        var groups = (eggGroups[g.species] || []).map(function (gg) { return groupNames[gg] || gg; }).join('/');
        var attrHtml = '';
        if (g.personality) { var p = getPersonalityByName(g.personality); if (p) attrHtml += '<span class="panel-tag-pers">🎭' + p.name + '</span>'; }
        attrHtml += renderMedalTagsHtml(g.medals);
        card.innerHTML = '<div class="stock-card-top">♀️ ' + petNames[g.species] + ' ' + star + ' <span class="stock-card-groups">' + groups + '</span></div><div class="stock-card-bottom">' + (attrHtml || '&nbsp;') + '</div>';

        var badge = document.createElement('span');
        badge.className = 'stock-card-count'; badge.textContent = '×' + g.count;
        card.appendChild(badge);

        (function (species, shiny, personality, medals) {
            card.addEventListener('click', function () {
                if (nestModalIsInvMode) {
                    // 库存模式：直接添加
                    addNestFemale(species, shiny, personality, medals);
                } else {
                    // 全部精灵模式：弹出属性选择
                    openNestAttrPopup(species);
                }
            });
        })(g.species, g.shiny, g.personality, g.medals);

        container.appendChild(card);
    });
}

// ── 全部精灵模式下选属性入窝的小弹窗 ──
var nestAttrSpecies = -1;

function openNestAttrPopup(species) {
    nestAttrSpecies = species;
    var overlay = document.getElementById('nestAttrOverlay');
    document.getElementById('nestAttrTitle').textContent = '♀️ ' + petNames[species];
    document.getElementById('nestAttrShiny').classList.remove('active');
    document.getElementById('nestAttrPers').value = '';
    document.getElementById('nestAttrBody').value = '';
    document.getElementById('nestAttrVoice').value = '';
    overlay.style.display = 'flex';
}

function confirmNestAttr() {
    var shiny = document.getElementById('nestAttrShiny').classList.contains('active');
    var pers = document.getElementById('nestAttrPers').value || null;
    var body = document.getElementById('nestAttrBody').value || null;
    var voice = document.getElementById('nestAttrVoice').value || null;
    var medals = {};
    if (body) medals.body = body;
    if (voice) medals.voice = voice;

    addNestFemale(nestAttrSpecies, shiny, pers, medals);
    document.getElementById('nestAttrOverlay').style.display = 'none';
    nestAttrSpecies = -1;
}

function cancelNestAttr() {
    document.getElementById('nestAttrOverlay').style.display = 'none';
    nestAttrSpecies = -1;
}

function addNestFemale(species, shiny, personality, medals) {
    if (nestModalSelected.length >= getMaxFemales()) { alert('已达雌性上限'); return; }
    nestModalSelected.push({ species: species, shiny: shiny, personality: personality, medals: medals ? JSON.parse(JSON.stringify(medals)) : {} });
    renderNestModalSelected();
}

function renderNestModalSelected() {
    var container = document.getElementById('nestFemaleSelected');
    container.innerHTML = '';
    nestModalSelected.forEach(function (f, i) {
        var tag = document.createElement('span');
        tag.className = 'pet-tag female-tag';
        var star = f.shiny ? '⭐' : '';
        var attrHtml = '';
        if (f.personality) { var p = getPersonalityByName(f.personality); if (p) attrHtml += '<span class="panel-tag-pers">🎭' + p.name + '</span>'; }
        attrHtml += renderMedalTagsHtml(f.medals);
        tag.innerHTML = '<span>♀️ ' + petNames[f.species] + ' ' + star + '</span>' + attrHtml + '<button class="tag-remove" data-i="' + i + '">✕</button>';
        tag.querySelector('.tag-remove').addEventListener('click', function (e) {
            e.stopPropagation(); nestModalSelected.splice(parseInt(this.dataset.i), 1); renderNestModalSelected();
        });
        container.appendChild(tag);
    });
}

function confirmNestFemales() {
    nestFemales = nestModalSelected.map(function (f) { return { species: f.species, shiny: f.shiny, personality: f.personality, medals: f.medals ? JSON.parse(JSON.stringify(f.medals)) : {} }; });
    document.getElementById('nestFemaleModalOverlay').style.display = 'none';
    refreshUI();
}

// ═══════════════════════════════════════════════════════════
//  旧版添加精灵弹窗（沿用，但存到 inventory）
// ═══════════════════════════════════════════════════════════

function populateFilters() {
    groupFilter.innerHTML = '<option value="">点击选择蛋组</option>';
    for (var id in groupNames) { var opt = document.createElement('option'); opt.value = id; opt.textContent = groupNames[id]; groupFilter.appendChild(opt); }
    seasonFilter.innerHTML = '<option value="">点击选择赛季异色</option>';
    for (var sid in seasonNames) { var opt = document.createElement('option'); opt.value = sid; opt.textContent = seasonNames[sid]; seasonFilter.appendChild(opt); }
}

function renderSearchResults(results) {
    var container = document.getElementById('searchResults');
    container.innerHTML = '';
    if (results.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#999;">无匹配精灵</div>';
        return;
    }
    results.sort(function (a, b) { return petIds[a] - petIds[b]; });
    var seriesKeys = getMedalSeriesKeys();
    var maxLimit = modalType === 'female' ? modalMaxFemales : 99;

    for (var ri = 0; ri < results.length; ri++) {
        var idx = results[ri];
        var div = document.createElement('div');
        div.className = 'search-result-item';
        div.setAttribute('data-species', idx);

        var isHatchable = !isNonBreedable(idx);
        var seasonTags = petTags[idx].filter(function (t) { return seasonNames[t]; });
        var qtyVal = modalTempCounts[idx] || 0;
        var shinyVal = modalTempShinyCounts[idx] || 0;
        var totalInst = qtyVal + shinyVal;
        var persArr = modalTempPersonalities[idx] || [];
        var medalArr = modalTempMedals[idx] || [];

        var html = '';

        // 名称行
        html += '<div class="left-info">';
        html += '<span class="pet-name">' + petNames[idx] + '</span>';
        if (petTags[idx].includes(1001)) html += '<span style="color:#2c3e50;font-size:0.65rem;background:#dce6f5;border-radius:8px;padding:1px 6px;margin-left:6px;">仅雄性</span>';
        if (petTags[idx].includes(1002)) html += '<span style="color:#2c3e50;font-size:0.65rem;background:#fde8e8;border-radius:8px;padding:1px 6px;margin-left:6px;">仅雌性</span>';
        if (!isHatchable) html += '<span style="color:#d9534f;font-size:0.8rem;margin-left:6px;">🚫不可孵蛋</span>';

        // 普通数量行
        html += '<div style="display:flex;align-items:center;gap:12px;margin-top:8px;">';
        html += '<div class="qty-ctrl">';
        html += '<button ' + (isHatchable ? 'onclick="modalQtyChange(' + idx + ',-1)"' : 'disabled') + '>−</button>';
        html += '<input type="number" id="qtyInput_' + idx + '" value="' + qtyVal + '" min="0" max="' + maxLimit + '" onchange="modalQtySet(' + idx + ',this.value)" ' + (isHatchable ? '' : 'disabled') + '>';
        html += '<button ' + (isHatchable ? 'onclick="modalQtyChange(' + idx + ',1)"' : 'disabled') + '>+</button>';
        html += '</div>';

        // 异色行
        if (seasonTags.length > 0) {
            html += '<div style="border:2px solid #e6a317;border-radius:10px;padding:4px 8px;display:flex;flex-direction:column;align-items:center;background:#fffdf5;">';
            html += '<div class="qty-ctrl">';
            html += '<button onclick="modalShinyChange(' + idx + ',-1)">−</button>';
            html += '<input type="number" id="shinyInput_' + idx + '" value="' + shinyVal + '" min="0" max="' + maxLimit + '" onchange="modalShinySet(' + idx + ',this.value)">';
            html += '<button onclick="modalShinyChange(' + idx + ',1)">+</button>';
            html += '</div>';
            html += '<span style="font-size:0.6rem;color:#b06030;margin-top:2px;">' + seasonTags.map(function (t) { return seasonNames[t]; }).join('/') + '</span>';
            html += '</div>';
        }
        html += '</div>';

        // 实例属性行
        if (totalInst > 0) {
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">';
            var normalCount = qtyVal;
            for (var ii = 0; ii < totalInst; ii++) {
                var isShinyInst = ii >= normalCount;
                var instPers = persArr[ii] || null;
                var instMedals = medalArr[ii] || {};

                html += '<div class="inst-attr-box' + (isShinyInst ? ' inst-shiny' : '') + '" data-species="' + idx + '" data-i="' + ii + '">';
                // 性格
                html += '<div class="inst-attr-btn pers-btn" onclick="openPersonalityModal(' + idx + ',' + ii + ')" style="' + (instPers ? 'background:#e8f5e8;border-color:#5a8a5a;' : '') + '">';
                html += '<span class="inst-attr-icon">🎭</span><span class="inst-attr-label">' + (instPers || '性格') + '</span>';
                html += '</div>';
                // 奖牌
                for (var mk = 0; mk < seriesKeys.length; mk++) {
                    var sk = seriesKeys[mk];
                    var instMedalId = instMedals[sk] || null;
                    var mObj = instMedalId ? getMedalById(instMedalId) : null;
                    html += '<div class="inst-attr-btn medal-btn" onclick="openMedalModal(' + idx + ',' + ii + ',\'' + sk + '\')" style="' + (mObj ? 'background:#fffde8;border-color:#d4a017;' : '') + '">';
                    html += '<span class="inst-attr-icon">🏅</span><span class="inst-attr-label">' + sk + ':' + (mObj ? mObj.name : '无') + '</span>';
                    html += '</div>';
                }
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>'; // .left-info

        // 蛋组
        html += '<div class="groups">';
        for (var gi = 0; gi < eggGroups[idx].length; gi++) {
            html += '<span class="group-badge">' + (groupNames[eggGroups[idx][gi]] || eggGroups[idx][gi]) + '</span>';
        }
        html += '</div>';

        div.innerHTML = html;
        container.appendChild(div);
    }
}

// ── 全局数量变更函数 ──
function modalQtyChange(species, delta) {
    var val = Math.max(0, (modalTempCounts[species] || 0) + delta);
    modalQtySet(species, val);
}

function modalQtySet(species, newVal) {
    var val = Math.max(0, parseInt(newVal) || 0);
    if (modalType === 'female') {
        var total = 0;
        for (var i = 0; i < petIds.length; i++) {
            total += (modalTempCounts[i] || 0) + (modalTempShinyCounts[i] || 0);
        }
        var other = total - (modalTempCounts[species] || 0) - (modalTempShinyCounts[species] || 0);
        val = Math.min(val, modalMaxFemales - other);
    }
    var oldCount = modalTempCounts[species] || 0;
    modalTempCounts[species] = val;
    var input = document.getElementById('qtyInput_' + species);
    if (input) input.value = val;
    syncInstanceArrays(species, oldCount, modalTempShinyCounts[species] || 0);
    performFilteredSearch(document.getElementById('petSearchInput').value);
}

function modalShinyChange(species, delta) {
    var val = Math.max(0, (modalTempShinyCounts[species] || 0) + delta);
    modalShinySet(species, val);
}

function modalShinySet(species, newVal) {
    var val = Math.max(0, parseInt(newVal) || 0);
    if (modalType === 'female') {
        var total = 0;
        for (var i = 0; i < petIds.length; i++) {
            total += (modalTempCounts[i] || 0) + (modalTempShinyCounts[i] || 0);
        }
        var other = total - (modalTempCounts[species] || 0) - (modalTempShinyCounts[species] || 0);
        val = Math.min(val, modalMaxFemales - other);
    }
    var oldShiny = modalTempShinyCounts[species] || 0;
    modalTempShinyCounts[species] = val;
    var input = document.getElementById('shinyInput_' + species);
    if (input) input.value = val;
    syncInstanceArrays(species, modalTempCounts[species] || 0, oldShiny);
    performFilteredSearch(document.getElementById('petSearchInput').value);
}


function performFilteredSearch(keyword) {
    var groupVal = groupFilter.value ? parseInt(groupFilter.value) : null;
    var seasonVal = seasonFilter.value ? parseInt(seasonFilter.value) : null;
    var lowerKeyword = keyword.trim().toLowerCase();
    var candidates = [];
    for (var i = 0; i < petIds.length; i++) {
        if (eggGroups[i].length === 0) continue;
        if (modalType === 'female' && petTags[i].includes(1001)) continue;
        if (modalType === 'male' && petTags[i].includes(1002)) continue;
        if (groupVal !== null && !eggGroups[i].includes(groupVal)) continue;
        if (seasonVal !== null && !petTags[i].includes(seasonVal)) continue;
        if (lowerKeyword && !petNames[i].toLowerCase().includes(lowerKeyword)) continue;
        candidates.push(i);
    }
    if (groupVal === null && seasonVal === null && !lowerKeyword) { document.getElementById('searchResults').innerHTML = ''; modalSearchResults = []; return; }
    var chainIndices = getEvolutionChain(candidates);
    var filtered = chainIndices.filter(function (i) {
        if (eggGroups[i].length === 0) return false;
        if (modalType === 'female' && petTags[i].includes(1001)) return false;
        if (modalType === 'male' && petTags[i].includes(1002)) return false;
        if (groupVal !== null && !eggGroups[i].includes(groupVal)) return false;
        if (seasonVal !== null && !petTags[i].includes(seasonVal)) return false;
        return true;
    });
    modalSearchResults = filtered; renderSearchResults(filtered);
}

function openModal(type) {
    modalType = type; modalMaxFemales = 99;
    var n = petIds.length;
    modalTempCounts = new Array(n).fill(0);
    modalTempShinyCounts = new Array(n).fill(0);
    modalTempPersonalities = []; modalTempMedals = [];
    for (var i = 0; i < n; i++) { modalTempPersonalities[i] = []; modalTempMedals[i] = []; }
    modalSavedInventory = inventory.slice();
    modalTitle.innerHTML = type === 'female' ? '🌸 选择雌性精灵' : '♂️ 选择雄性精灵';
    document.getElementById('petSearchInput').value = ''; document.getElementById('searchResults').innerHTML = ''; modalSearchResults = [];
    populateFilters(); groupFilter.value = ''; seasonFilter.value = '';
    modalOverlay.style.display = 'flex';
    modalOverlay.style.zIndex = '3000';
    document.body.style.overflow = 'hidden';

}

function closeModal(confirmed) {
    if (confirmed && modalType) {
        inventory = modalSavedInventory.slice();
        for (var i = 0; i < petIds.length; i++) {
            var addNormal = modalTempCounts[i] || 0;
            var addShiny = modalTempShinyCounts[i] || 0;
            if (addNormal + addShiny === 0) continue;
            var persArr = modalTempPersonalities[i] || [];
            var medalArr = modalTempMedals[i] || [];
            var instIdx = 0;
            for (var j = 0; j < addNormal; j++) {
                inventory.push({ species: i, gender: modalType, shiny: false, personality: persArr[instIdx] || null, medals: medalArr[instIdx] ? JSON.parse(JSON.stringify(medalArr[instIdx])) : {} });
                instIdx++;
            }
            for (var j = 0; j < addShiny; j++) {
                inventory.push({ species: i, gender: modalType, shiny: true, personality: persArr[instIdx] || null, medals: medalArr[instIdx] ? JSON.parse(JSON.stringify(medalArr[instIdx])) : {} });
                instIdx++;
            }
        }
    }
    modalType = null; modalTempCounts = null; modalTempShinyCounts = null;
    modalTempPersonalities = null; modalTempMedals = null;
    modalOverlay.style.display = 'none'; document.body.style.overflow = '';
    refreshUI();
    // 如果仓库弹窗开着，同步刷新
    if (document.getElementById('invModalOverlay').style.display === 'flex') {
        renderInvModalList();
    }

}

function cancelModal() { closeModal(false); }

function syncInstanceArrays(species, newNormalCount, newShinyCount) {
    var total = newNormalCount + newShinyCount;
    if (!modalTempPersonalities[species]) modalTempPersonalities[species] = [];
    if (!modalTempMedals[species]) modalTempMedals[species] = [];
    while (modalTempPersonalities[species].length < total) modalTempPersonalities[species].push(null);
    while (modalTempPersonalities[species].length > total) modalTempPersonalities[species].pop();
    while (modalTempMedals[species].length < total) modalTempMedals[species].push({});
    while (modalTempMedals[species].length > total) modalTempMedals[species].pop();
}

// ── 性格/奖牌弹窗（不变）──
var personalityModalSpecies = -1, personalityModalInst = -1;
var medalModalSpecies = -1, medalModalInst = -1, medalModalSeries = '';

function openPersonalityModal(species, instIdx) {
    personalityModalSpecies = species; personalityModalInst = instIdx;
    var name = petNames[species];
    var persArr = modalTempPersonalities[species] || [];
    var curName = persArr[instIdx] || null;
    var cur = curName ? getPersonalityByName(curName) : null;
    document.getElementById('personalityModalInfo').innerHTML = '<strong>精灵：</strong>' + name + ' ' + CIRCLED_NUMS[instIdx] + (cur ? ' <span style="color:#5a8a5a;">当前：' + cur.name + '（+' + cur.boost + ' / -' + cur.decrease + '）</span>' : '');
    document.getElementById('personalityModalTitle').textContent = '🎭 选择性格';
    var filter = document.getElementById('personalityFilter');
    filter.innerHTML = '<option value="">全部增益</option>';
    Object.keys(personalityData).forEach(function (boost) { var opt = document.createElement('option'); opt.value = boost; opt.textContent = '+' + boost; filter.appendChild(opt); });
    filter.value = ''; renderPersonalityList('');
    filter.onchange = function () { renderPersonalityList(filter.value); };
    document.getElementById('personalityModalOverlay').style.display = 'flex';
}

function renderPersonalityList(filterBoost) {
    var list = document.getElementById('personalityModalList'); list.innerHTML = '';
    var allItems = [];
    Object.keys(personalityData).forEach(function (boost) { if (filterBoost && boost !== filterBoost) return; personalityData[boost].forEach(function (p) { allItems.push({ boost: boost, name: p.name, decrease: p.decrease }); }); });
    if (allItems.length === 0) { list.innerHTML = '<div style="text-align:center;color:#999;width:100%;padding:20px;">无匹配性格</div>'; return; }
    allItems.forEach(function (item) {
        var card = document.createElement('div'); card.className = 'attr-select-card';
        var persArr = modalTempPersonalities[personalityModalSpecies] || [];
        var isSelected = persArr[personalityModalInst] === item.name;
        if (isSelected) { card.style.border = '2px solid #5a8a5a'; card.style.background = '#e8f5e8'; }
        card.innerHTML = '<div class="attr-name">' + item.name + '</div><div style="font-size:0.72rem;"><span style="color:#2d6a4f;">+' + item.boost + '</span> <span style="color:#b34a4a;">-' + item.decrease + '</span></div>';
        card.addEventListener('click', function () { if (!modalTempPersonalities[personalityModalSpecies]) modalTempPersonalities[personalityModalSpecies] = []; modalTempPersonalities[personalityModalSpecies][personalityModalInst] = item.name; closePersonalityModal(); performFilteredSearch(document.getElementById('petSearchInput').value); });
        list.appendChild(card);
    });
}

function closePersonalityModal() { document.getElementById('personalityModalOverlay').style.display = 'none'; document.getElementById('personalityFilter').onchange = null; personalityModalSpecies = -1; personalityModalInst = -1; }

function openMedalModal(species, instIdx, seriesKey) {
    medalModalSpecies = species; medalModalInst = instIdx; medalModalSeries = seriesKey;
    var name = petNames[species];
    var medalArr = modalTempMedals[species] || [];
    var medalsObj = medalArr[instIdx] || {};
    var curId = medalsObj[seriesKey] || null;
    var cur = curId ? getMedalById(curId) : null;
    document.getElementById('medalModalInfo').innerHTML = '<strong>精灵：</strong>' + name + ' ' + CIRCLED_NUMS[instIdx] + ' <span style="color:#888;">系列：' + seriesKey + '</span>' + (cur ? ' <span style="color:#b06030;">当前：' + (cur.icon || '') + ' ' + cur.name + '</span>' : '');
    document.getElementById('medalModalTitle').textContent = '🏅 选择奖牌 - ' + seriesKey;
    var list = document.getElementById('medalModalList'); list.innerHTML = '';
    var seriesData = medalData[seriesKey] || [];
    seriesData.forEach(function (m) {
        var card = document.createElement('div'); card.className = 'attr-select-card';
        var marr = modalTempMedals[medalModalSpecies] || [];
        var mobj = marr[medalModalInst] || {};
        var isSelected = mobj[medalModalSeries] === m.id;
        if (isSelected) { card.style.border = '2px solid #e6a317'; card.style.background = '#fffde8'; }
        card.innerHTML = '<div class="attr-name">' + (m.icon || '') + ' ' + m.name + '</div>';
        card.addEventListener('click', function () { if (!modalTempMedals[medalModalSpecies]) modalTempMedals[medalModalSpecies] = []; if (!modalTempMedals[medalModalSpecies][medalModalInst]) modalTempMedals[medalModalSpecies][medalModalInst] = {}; modalTempMedals[medalModalSpecies][medalModalInst][medalModalSeries] = m.id; closeMedalModal(); performFilteredSearch(document.getElementById('petSearchInput').value); });
        list.appendChild(card);
    });
    document.getElementById('medalModalOverlay').style.display = 'flex';
}

function closeMedalModal() { document.getElementById('medalModalOverlay').style.display = 'none'; medalModalSpecies = -1; medalModalInst = -1; medalModalSeries = ''; }

// 性格弹窗事件
document.getElementById('personalityModalCloseBtn').addEventListener('click', closePersonalityModal);
document.getElementById('personalityModalCancel').addEventListener('click', closePersonalityModal);
document.getElementById('personalityModalClear').addEventListener('click', function () { if (personalityModalSpecies >= 0 && modalTempPersonalities[personalityModalSpecies]) modalTempPersonalities[personalityModalSpecies][personalityModalInst] = null; closePersonalityModal(); performFilteredSearch(document.getElementById('petSearchInput').value); });
document.getElementById('personalityModalOverlay').addEventListener('click', function (e) { if (e.target === document.getElementById('personalityModalOverlay')) closePersonalityModal(); });
document.getElementById('medalModalCloseBtn').addEventListener('click', closeMedalModal);
document.getElementById('medalModalCancel').addEventListener('click', closeMedalModal);
document.getElementById('medalModalClear').addEventListener('click', function () { if (medalModalSpecies >= 0 && modalTempMedals[medalModalSpecies] && modalTempMedals[medalModalSpecies][medalModalInst]) modalTempMedals[medalModalSpecies][medalModalInst][medalModalSeries] = null; closeMedalModal(); performFilteredSearch(document.getElementById('petSearchInput').value); });
document.getElementById('medalModalOverlay').addEventListener('click', function (e) { if (e.target === document.getElementById('medalModalOverlay')) closeMedalModal(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (document.getElementById('personalityModalOverlay').style.display === 'flex') closePersonalityModal(); if (document.getElementById('medalModalOverlay').style.display === 'flex') closeMedalModal(); } });
