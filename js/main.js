// ╔══════════════════════════════════════════════════════════════╗
// ║          九~廿一、事件绑定与初始化（重写版v3）                   ║
// ╚══════════════════════════════════════════════════════════════╝

// ============================================================
//  辅助：创建 combo
//  返回 { combo, trigger, dropdown, list, resetFn }
//  列表第一项固定为"无要求"（灰色），点击时调用 onReset
// ============================================================
function buildCombo(containerId, triggerId, listId, label, items, onSelect, onReset) {
    var combo = document.getElementById(containerId);
    if (!combo) return null;
    var trigger = document.getElementById(triggerId);
    var list = document.getElementById(listId);
    var dropdown = combo.querySelector('.combo-dropdown');
    var search = combo.querySelector('.combo-search');

    // 第一项：无要求
    list.innerHTML = '<div class="combo-option" data-value="">无要求</div>';
    items.forEach(function (item) {
        var d = document.createElement('div');
        d.className = 'combo-option';
        d.textContent = item.label;
        d.addEventListener('mousedown', function (e) {
            e.preventDefault();
            onSelect(item.value, item.label);
            trigger.textContent = label + ':' + item.label;
            dropdown.style.display = 'none';
        });
        list.appendChild(d);
    });

    // 点击"无要求"→重置
    list.querySelector('.combo-option[data-value=""]').addEventListener('mousedown', function (e) {
        e.preventDefault();
        trigger.textContent = label;
        dropdown.style.display = 'none';
        if (onReset) onReset();
    });

    trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var region = combo.closest('.stock-filter-row') || combo.closest('#invModalFilters') || combo.closest('#nestModalFilters') || document.body;
        region.querySelectorAll('.combo-dropdown').forEach(function (dd) {
            if (dd !== dropdown) dd.style.display = 'none';
        });
        var isOpen = dropdown.style.display === 'block';
        dropdown.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) { search.value = ''; search.focus(); }
    });

    search.addEventListener('input', function () {
        var ft = this.value.toLowerCase();
        list.querySelectorAll('.combo-option').forEach(function (o) {
            o.style.display = (o.dataset.value === '' || o.textContent.toLowerCase().includes(ft)) ? '' : 'none';
        });
    });
    search.addEventListener('click', function (e) { e.stopPropagation(); });

    function resetFn() {
        trigger.textContent = label;
        if (onReset) onReset();
    }

    return { combo: combo, trigger: trigger, dropdown: dropdown, list: list, reset: resetFn };
}

// 全局点击关闭
document.addEventListener('click', function (e) {
    document.querySelectorAll('.combo-dropdown').forEach(function (dd) {
        var region = dd.closest('#invFilterRow') || dd.closest('#invModalFilters') || dd.closest('#nestModalFilters');
        if (region && !region.contains(e.target)) dd.style.display = 'none';
    });
});

// ============================================================
//  创建一组（性格+body+voice）共用的重置按钮
// ============================================================
function addComboGroupReset(containerSelector, combos, resetAllFn) {
    var container = document.querySelector(containerSelector);
    if (!container) return;
    var btn = document.createElement('button');
    btn.className = 'filter-reset-btn';
    btn.textContent = '↺ 重置';
    btn.title = '重置筛选';
    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        resetAllFn();
        combos.forEach(function (c) { if (c && c.reset) c.reset(); });
    });
    container.appendChild(btn);
}

// ============================================================
//  填充所有 combo 数据
// ============================================================
function fillAllCombos() {
    var persItems = [];
    for (var boost in personalityData) {
        personalityData[boost].forEach(function (p) {
            persItems.push({ value: p.name, label: p.name + ' (+' + boost + '/-' + p.decrease + ')' });
        });
    }

    persItems.sort(function (a, b) { return a.label.localeCompare(b.label, 'zh'); });

    var bodyItems = (medalData.body || []).map(function (m) { return { value: m.id, label: (m.icon || '') + m.name }; });
    var voiceItems = (medalData.voice || []).map(function (m) { return { value: m.id, label: (m.icon || '') + m.name }; });

    // ── 展窗筛选 ──
    var stockPers = buildCombo('stockPersCombo', 'stockPersTrigger', 'stockPersList', '🎭性格', persItems,
        function (val) { invFilterPers = val; renderInventoryCards(); },
        function () { invFilterPers = ''; renderInventoryCards(); }
    );
    var stockBody = buildCombo('stockBodyCombo', 'stockBodyTrigger', 'stockBodyList', '🏅body', bodyItems,
        function (val) { invFilterMedalBody = val; renderInventoryCards(); },
        function () { invFilterMedalBody = ''; renderInventoryCards(); }
    );
    var stockVoice = buildCombo('stockVoiceCombo', 'stockVoiceTrigger', 'stockVoiceList', '🏅voice', voiceItems,
        function (val) { invFilterMedalVoice = val; renderInventoryCards(); },
        function () { invFilterMedalVoice = ''; renderInventoryCards(); }
    );
    addComboGroupReset('#invFilterRow', [stockPers, stockBody, stockVoice], function () {
        invFilterPers = ''; invFilterMedalBody = ''; invFilterMedalVoice = '';
        renderInventoryCards();
    });

    // ── 仓库弹窗 ──
    var invPers = buildCombo('invModalPersCombo', 'invModalPersTrigger', 'invModalPersList', '🎭性格', persItems,
        function (val) { invModalFilterPers = val; renderInvModalList(); },
        function () { invModalFilterPers = ''; renderInvModalList(); }
    );
    var invBody = buildCombo('invModalBodyCombo', 'invModalBodyTrigger', 'invModalBodyList', '🏅body', bodyItems,
        function (val) { invModalFilterMedalBody = val; renderInvModalList(); },
        function () { invModalFilterMedalBody = ''; renderInvModalList(); }
    );
    var invVoice = buildCombo('invModalVoiceCombo', 'invModalVoiceTrigger', 'invModalVoiceList', '🏅voice', voiceItems,
        function (val) { invModalFilterMedalVoice = val; renderInvModalList(); },
        function () { invModalFilterMedalVoice = ''; renderInvModalList(); }
    );
    addComboGroupReset('#invModalFilters', [invPers, invBody, invVoice], function () {
        invModalFilterPers = ''; invModalFilterMedalBody = ''; invModalFilterMedalVoice = '';
        renderInvModalList();
    });

    // ── 窝弹窗 ──
    var nestPers = buildCombo('nestModalPersCombo', 'nestModalPersTrigger', 'nestModalPersList', '🎭性格', persItems,
        function (val) { nestModalFilters.personality = val; performNestSearch(); },
        function () { nestModalFilters.personality = ''; performNestSearch(); }
    );
    var nestBody = buildCombo('nestModalBodyCombo', 'nestModalBodyTrigger', 'nestModalBodyList', '🏅body', bodyItems,
        function (val) { nestModalFilters.medalBody = val; performNestSearch(); },
        function () { nestModalFilters.medalBody = ''; performNestSearch(); }
    );
    var nestVoice = buildCombo('nestModalVoiceCombo', 'nestModalVoiceTrigger', 'nestModalVoiceList', '🏅voice', voiceItems,
        function (val) { nestModalFilters.medalVoice = val; performNestSearch(); },
        function () { nestModalFilters.medalVoice = ''; performNestSearch(); }
    );
    addComboGroupReset('#nestModalFilters', [nestPers, nestBody, nestVoice], function () {
        nestModalFilters.personality = ''; nestModalFilters.medalBody = ''; nestModalFilters.medalVoice = '';
        performNestSearch();
    });
        // 填充窝弹窗蛋组/赛季下拉
    var eggSel = document.getElementById('nestEggGroupFilter');
    if (eggSel) {
        for (var gid in groupNames) {
            var opt = document.createElement('option');
            opt.value = gid; opt.textContent = groupNames[gid];
            eggSel.appendChild(opt);
        }
    }
    var seasonSel = document.getElementById('nestSeasonFilter');
    if (seasonSel) {
        for (var sid in seasonNames) {
            var opt = document.createElement('option');
            opt.value = sid; opt.textContent = seasonNames[sid];
            seasonSel.appendChild(opt);
        }
    }

}

// ============================================================
//  事件绑定
// ============================================================

// ── 主模态弹窗（添加精灵）──
modalCloseBtn.addEventListener('click', cancelModal);
modalCancel.addEventListener('click', cancelModal);
modalConfirm.addEventListener('click', function () { closeModal(true); });
modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) cancelModal(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modalOverlay.style.display === 'flex') cancelModal(); });

groupFilter.addEventListener('change', function () { performFilteredSearch(document.getElementById('petSearchInput').value); });
seasonFilter.addEventListener('change', function () { performFilteredSearch(document.getElementById('petSearchInput').value); });
document.getElementById('resetFiltersBtn').addEventListener('click', function () { groupFilter.value = ''; seasonFilter.value = ''; document.getElementById('petSearchInput').value = ''; performFilteredSearch(''); });
document.getElementById('searchBtn').addEventListener('click', function () { performFilteredSearch(document.getElementById('petSearchInput').value); });
document.getElementById('petSearchInput').addEventListener('keypress', function (e) { if (e.key === 'Enter') performFilteredSearch(e.target.value); });

// ── 管理仓库弹窗 ──
document.getElementById('openInventoryBtn').addEventListener('click', openInventoryModal);
document.getElementById('invModalCloseBtn').addEventListener('click', closeInventoryModal);
document.getElementById('invModalCancelBtn').addEventListener('click', closeInventoryModal);
document.getElementById('invModalOverlay').addEventListener('click', function (e) { if (e.target === this) closeInventoryModal(); });
document.getElementById('invAddMaleBtn').addEventListener('click', function () { openModal('male'); });
document.getElementById('invAddFemaleBtn').addEventListener('click', function () { openModal('female'); });

document.querySelectorAll('#invModalFilters .inv-fbtn[data-mfilter="gender"]').forEach(function (b) {
    b.addEventListener('click', function () {
        invModalFilterGender = this.dataset.val;
        document.querySelectorAll('#invModalFilters .inv-fbtn[data-mfilter="gender"]').forEach(function (x) { x.classList.remove('active'); });
        this.classList.add('active');
        renderInvModalList();
    });
});
document.getElementById('invModalFilterShiny').addEventListener('click', function () {
    invModalFilterShiny = !invModalFilterShiny; this.classList.toggle('active', invModalFilterShiny); renderInvModalList();
});
document.getElementById('invModalSearch').addEventListener('input', function () { renderInvModalList(); });

// ── 库存编辑小弹窗 ──
document.getElementById('invEditCancel').addEventListener('click', closeInvEdit);
document.getElementById('invEditSave').addEventListener('click', saveInvEdit);
document.getElementById('invEditDelete').addEventListener('click', deleteInvEditEntry);
document.getElementById('invEditOverlay').addEventListener('click', function (e) { if (e.target === this) closeInvEdit(); });

// ── 展窗筛选 ──
document.querySelectorAll('#invFilterRow .stock-fbtn[data-filter="gender"]').forEach(function (b) {
    b.addEventListener('click', function () {
        invFilterGender = this.dataset.val;
        document.querySelectorAll('#invFilterRow .stock-fbtn[data-filter="gender"]').forEach(function (x) { x.classList.remove('active'); });
        this.classList.add('active');
        renderInventoryCards();
    });
});
document.getElementById('invFilterShiny').addEventListener('click', function () {
    invFilterShiny = !invFilterShiny; this.classList.toggle('active', invFilterShiny); renderInventoryCards();
});

// ── 窝弹窗 ──
openNestFemaleBtn.addEventListener('click', openNestFemaleModal);
document.getElementById('nestFemaleModalCloseBtn').addEventListener('click', function () { document.getElementById('nestFemaleModalOverlay').style.display = 'none'; refreshUI(); });
document.getElementById('nestFemaleModalCancel').addEventListener('click', function () { document.getElementById('nestFemaleModalOverlay').style.display = 'none'; refreshUI(); });
document.getElementById('nestFemaleModalConfirm').addEventListener('click', confirmNestFemales);
document.getElementById('nestFemaleModalOverlay').addEventListener('click', function (e) { if (e.target === this) { this.style.display = 'none'; refreshUI(); } });
document.getElementById('nestModeToggle').addEventListener('click', toggleNestMode);
document.getElementById('nestFemaleSearch').addEventListener('input', performNestSearch);
document.getElementById('nestModalFilterShiny').addEventListener('click', function () {
    nestModalFilters.shiny = !nestModalFilters.shiny; this.classList.toggle('active', nestModalFilters.shiny); performNestSearch();
});
document.getElementById('nestEggGroupFilter').addEventListener('change', performNestSearch);
document.getElementById('nestSeasonFilter').addEventListener('change', performNestSearch);


// ── 替换弹窗 ──
document.getElementById('replaceModalCloseBtn').addEventListener('click', closeReplaceModal);
document.getElementById('replaceModalCancel').addEventListener('click', closeReplaceModal);
replaceModalOverlay.addEventListener('click', function (e) { if (e.target === replaceModalOverlay) closeReplaceModal(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && replaceModalOverlay.style.display === 'flex') closeReplaceModal(); });

// ── 雄性筛选 ──
document.getElementById('filterShinyBtn').addEventListener('click', function () {
    filterOnlyShiny = !filterOnlyShiny;
    if (filterOnlyShiny) this.classList.add('active'); else this.classList.remove('active');
});
document.getElementById('filterResetBtn').addEventListener('click', function () {
    filterOnlyShiny = false; filterPersonality = '';
    document.getElementById('filterShinyBtn').classList.remove('active');
    selectPersonality('', '性格：无要求');
    var resetKeys = getMedalSeriesKeys();
    for (var rk = 0; rk < resetKeys.length; rk++) {
        filterMedals[resetKeys[rk]] = '';
        selectMedalForSeries(resetKeys[rk], '', '无要求');
    }
});

// ── 按钮事件 ──
generateBtn.addEventListener('click', doGenerate);
resetBtn.addEventListener('click', function () {
    nestFemales = []; nestCountInput.value = 10;
    resultArea.style.display = 'none'; placementArea.style.display = 'none'; placementBtn.style.display = 'none';
    globalMsg.innerHTML = ''; lastResultData = null;
    if (modalOverlay.style.display === 'flex') { modalOverlay.style.display = 'none'; document.body.style.overflow = ''; }
    refreshUI();
});

exportBtn.addEventListener('click', exportToImage);
placementBtn.addEventListener('click', generatePlacement);
exportPlacementBtn.addEventListener('click', exportPlacementImage);
nestCountInput.addEventListener('input', refreshUI);
nestCountInput.addEventListener('change', refreshUI);

document.getElementById('exportConfigBtn').addEventListener('click', exportConfig);
document.getElementById('importConfigBtn').addEventListener('click', function () {
    var input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.addEventListener('change', function (e) { if (e.target.files[0]) importConfig(e.target.files[0]); });
    input.click();
});

// ============================================================
//  初始化
// ============================================================
loadPetsJSON().then(function (ok) {
    if (!ok) buildDefaultData();
    fillAllCombos();
});
