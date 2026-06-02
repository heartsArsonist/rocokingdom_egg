(async function () {
    // ╔══════════════════════════════════════════════════════════════╗
    // ║              一、全局数据容器                                  ║
    // ╚══════════════════════════════════════════════════════════════╝
    let petIds = [];
    let petNames = [];
    let eggGroups = [];
    let evolvesFromId = [];
    let petTags = [];
    let femaleNormal = [];
    let femaleShiny = [];
    let maleNormal = [];
    let maleShiny = [];
    let femaleCheckboxStates = [];
    let maleCheckboxStates = [];
    let compatibleMap = new Map();       // Map<speciesIndex, Set<speciesIndex>>  可交配关系图
    let groupNames = {};                 // 蛋组ID → 名称
    let specialTagNames = {};            // 特殊标签ID → 名称
    let seasonNames = {};                // 赛季异色ID → 名称
    let petsData = [];                   // 原始精灵数据，供智能公精灵推荐使用

    // 模态框临时状态
    let modalType = null;
    let modalTempCounts = null;
    let modalTempShinyCounts = null;
    let modalSavedCounts = null;
    let modalSavedShinyCounts = null;
    let modalSavedCheckboxStates = null;
    let modalMaxFemales = 0;
    let modalSearchResults = [];
    const evolutionChainCache = new Map();

    // ╔══════════════════════════════════════════════════════════════╗
    // ║              二、数据加载层                                    ║
    // ╚══════════════════════════════════════════════════════════════╝

    /** 从 pets.json 加载全部精灵数据，构建兼容表 */
    async function loadPetsJSON() {
        try {
            const resp = await fetch('./data/pets.json?t=' + Date.now());
            if (!resp.ok) throw new Error('pets.json 加载失败');
            const pets = await resp.json();
            petsData = pets;
            petIds = pets.map(p => p.id);
            petNames = pets.map(p => p.name);
            eggGroups = pets.map(p => p.egg_groups || []);
            evolvesFromId = pets.map(p => p.evolves_from_id ?? null);
            petTags = pets.map(p => {
                const tags = [...(p.special_tags || [])];
                if (p.has_shiny !== null && typeof p.has_shiny === 'number') {
                    tags.push(p.has_shiny);
                }
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

    /** 加载蛋组/赛季等文本定义 */
    async function loadDefinitions() {
        try {
            const resp = await fetch('./data/defines.json?t=' + Date.now());
            if (resp.ok) {
                const defs = await resp.json();
                if (defs.egg_groups) Object.assign(groupNames, defs.egg_groups);
                if (defs.season) {
                    Object.assign(seasonNames, defs.season);
                    Object.assign(specialTagNames, defs.season);
                }
                if (defs.special_tags) Object.assign(specialTagNames, defs.special_tags);
            }
        } catch (e) {
            for (let i = 1; i <= 15; i++) groupNames[i] = i;
        }
        if (!specialTagNames[1001]) specialTagNames[1001] = '只有雄性';
        if (!specialTagNames[1002]) specialTagNames[1002] = '只有雌性';
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║              三、兼容性系统                                    ║
    // ╚══════════════════════════════════════════════════════════════╝

    /** 构建全局可交配关系图：两个精灵有任意共同蛋组即可交配 */
    function buildCompatibilityMap() {
        compatibleMap.clear();
        const n = petIds.length;
        for (let i = 0; i < n; i++) compatibleMap.set(i, new Set());
        for (let i = 0; i < n; i++) {
            if (eggGroups[i].length === 0 || isNonBreedable(i)) continue;
            compatibleMap.get(i).add(i);
            for (let j = i + 1; j < n; j++) {
                if (eggGroups[j].length === 0 || isNonBreedable(j)) continue;
                if (hasCommonGroup(eggGroups[i], eggGroups[j])) {
                    compatibleMap.get(i).add(j);
                    compatibleMap.get(j).add(i);
                }
            }
        }
    }

    /** 两个蛋组数组是否有交集 */
    function hasCommonGroup(g1, g2) {
        for (const g of g1) if (g2.includes(g)) return true;
        return false;
    }

    /** 不可孵蛋：蛋组含"1"(未发现) 或 标签含"300"(不可孵蛋) */
    function isNonBreedable(idx) {
        return eggGroups[idx].includes(1) || petTags[idx].includes(300);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║              四、计数器与默认数据                              ║
    // ╚══════════════════════════════════════════════════════════════╝

    /** 清空所有雌性/雄性计数器及勾选框 */
    function resetCounters() {
        const n = petIds.length;
        femaleNormal = new Array(n).fill(0);
        femaleShiny = new Array(n).fill(0);
        maleNormal = new Array(n).fill(0);
        maleShiny = new Array(n).fill(0);
        femaleCheckboxStates = new Array(n).fill(false);
        maleCheckboxStates = new Array(n).fill(false);
    }

    /** 内置兜底数据 */
    function buildDefaultData() {
        petIds = [3081, 3011, 3151];
        petNames = ['治愈兔', '恶魔狼', '多多'];
        eggGroups = [[6, 7], [6], [9]];
        evolvesFromId = [null, null, null];
        petTags = [[101], [100], [100]];
        groupNames = { 6: '动物组', 7: '妖精组', 9: '拟人组' };
        seasonNames = { 101: 'S1 暗夜拾光', 102: 'S2 狂欢怪谈' };
        specialTagNames = { ...seasonNames, 1001: '只有雄性', 1002: '只有雌性' };
        petsData = petIds.map((id, idx) => ({
            id,
            name: petNames[idx],
            egg_groups: eggGroups[idx],
            special_tags: petTags[idx]
        }));
        buildCompatibilityMap();
        resetCounters();
        refreshUI();
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║              五、进化链查找                                    ║
    // ╚══════════════════════════════════════════════════════════════╝

    /** 查询指定精灵索引的完整进化链（祖先 + 后代） */
    function getEvolutionChain(indices) {
        const resultSet = new Set();
        for (const idx of indices) {
            if (eggGroups[idx].length === 0) continue;
            if (evolutionChainCache.has(idx)) {
                for (const i of evolutionChainCache.get(idx)) resultSet.add(i);
            } else {
                const chain = new Set();
                let current = idx;
                while (current !== null && current !== undefined) {
                    chain.add(current);
                    const parentId = evolvesFromId[current];
                    if (parentId === null) break;
                    current = petIds.indexOf(parentId);
                    if (current === -1) break;
                }
                const toProcess = [...chain];
                const processed = new Set(chain);
                while (toProcess.length > 0) {
                    const cur = toProcess.pop();
                    const curId = petIds[cur];
                    for (let i = 0; i < petIds.length; i++) {
                        if (processed.has(i)) continue;
                        if (evolvesFromId[i] === curId) {
                            chain.add(i);
                            processed.add(i);
                            toProcess.push(i);
                        }
                    }
                }
                evolutionChainCache.set(idx, chain);
                for (const i of chain) resultSet.add(i);
            }
        }
        return Array.from(resultSet).filter(i => eggGroups[i].length > 0);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║              六、UI 辅助工具                                   ║
    // ╚══════════════════════════════════════════════════════════════╝

    const CIRCLED_NUMS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

    /** 获取带编号的精灵显示名（同种多只时加序号） */
    function getDisplayName(species, instanceIdx, totalSame) {
        if (totalSame > 1) {
            const num = instanceIdx < CIRCLED_NUMS.length ? CIRCLED_NUMS[instanceIdx] : `(${instanceIdx + 1})`;
            return `${petNames[species]}${num}`;
        }
        return petNames[species];
    }

    function getNestTotal() { return Math.max(1, Math.min(10, parseInt(nestCountInput.value) || 10)); }
    function getMaxFemales() { return Math.max(0, getNestTotal() - 1); }
    function getFemaleTotal() { return femaleNormal.reduce((a, b) => a + b, 0) + femaleShiny.reduce((a, b) => a + b, 0); }
    function getMaleStockTotal() { return maleNormal.reduce((a, b) => a + b, 0) + maleShiny.reduce((a, b) => a + b, 0); }

    /** 刷新状态栏（上限/总量/超限警告） */
    function refreshUI() {
        if (maleRecommendationFemaleSignature
            && maleRecommendationFemaleSignature !== getFemaleRecommendationSignature()) {
            clearMaleRecommendationPlans();
        }
        const maxF = getMaxFemales();
        const fTotal = getFemaleTotal();
        const mTotal = getMaleStockTotal();
        maxFemaleDisplay.textContent = maxF;
        capacityHint.textContent = maxF > 0 ? `最多放${maxF}只雌性·至少1个雄性窝` : '需至少2个窝';
        femaleTotalBadge.textContent = `总数: ${fTotal} / ${maxF}`;
        maleTotalBadge.textContent = `库存: ${mTotal} 只`;
        if (fTotal > maxF) {
            femaleLimitWarn.textContent = `⚠️ 超出上限！请减少至${maxF}只`;
            femaleTotalBadge.classList.add('warn');
        } else {
            femaleLimitWarn.textContent = '';
            femaleTotalBadge.classList.remove('warn');
        }
        updateSelectedDisplays();
    }

    /** 刷新已选雌性/雄性的标签展示区 */
    function updateSelectedDisplays() {
        femaleSelectedDisplay.innerHTML = '';
        let hasFemale = false;
        petNames.forEach((_, idx) => {
            if (femaleNormal[idx] > 0) {
                hasFemale = true;
                const tag = createPetTag(idx, 'female', false, femaleNormal[idx]);
                femaleSelectedDisplay.appendChild(tag);
            }
            if (femaleShiny[idx] > 0) {
                hasFemale = true;
                const tag = createPetTag(idx, 'female', true, femaleShiny[idx]);
                femaleSelectedDisplay.appendChild(tag);
            }
        });
        if (!hasFemale) femaleSelectedDisplay.innerHTML = '<span class="empty-hint">暂未选择</span>';

        maleSelectedDisplay.innerHTML = '';
        let hasMale = false;
        petNames.forEach((_, idx) => {
            if (maleNormal[idx] > 0) {
                hasMale = true;
                const tag = createPetTag(idx, 'male', false, maleNormal[idx]);
                maleSelectedDisplay.appendChild(tag);
            }
            if (maleShiny[idx] > 0) {
                hasMale = true;
                const tag = createPetTag(idx, 'male', true, maleShiny[idx]);
                maleSelectedDisplay.appendChild(tag);
            }
        });
        if (!hasMale) maleSelectedDisplay.innerHTML = '<span class="empty-hint">暂未选择</span>';

        document.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.petIndex);
                const isShiny = btn.dataset.shiny === 'true';
                if (btn.dataset.type === 'female') {
                    if (isShiny) {
                        femaleShiny[idx] = 0;
                    } else {
                        femaleNormal[idx] = 0;
                    }
                    femaleCheckboxStates[idx] = (femaleNormal[idx] + femaleShiny[idx] > 0);
                } else {
                    if (isShiny) {
                        maleShiny[idx] = 0;
                    } else {
                        maleNormal[idx] = 0;
                    }
                    maleCheckboxStates[idx] = (maleNormal[idx] + maleShiny[idx] > 0);
                }
                refreshUI();
            });
        });
    }

    /** 创建精灵标签 DOM（带移除按钮和点击编辑） */
    function createPetTag(idx, type, isShiny, qty) {
        const tag = document.createElement('span');
        tag.className = 'pet-tag ' + (type === 'female' ? 'female-tag' : 'male-tag');
        let prefix = type === 'female' ? '♀' : '♂';
        if (isShiny) prefix = '⭐ ' + prefix;
        tag.innerHTML = `<span>${prefix} ${petNames[idx]}</span><span class="tag-qty">×${qty}</span><button class="tag-remove" data-pet-index="${idx}" data-type="${type}" data-shiny="${isShiny}">✕</button>`;
        tag.addEventListener('click', (e) => {
            if (e.target.closest('.tag-remove')) return;
            startInlineEdit(tag, idx, type, isShiny);
        });
        return tag;
    }

    /** 点击标签触发内联数量编辑 */
    function startInlineEdit(tag, idx, type, isShiny) {
        const qtySpan = tag.querySelector('.tag-qty');
        if (!qtySpan) return;
        const currentVal = type === 'female'
            ? (isShiny ? femaleShiny[idx] : femaleNormal[idx])
            : (isShiny ? maleShiny[idx] : maleNormal[idx]);
        const input = document.createElement('input');
        input.type = 'number';
        input.min = 0;
        input.max = 99;
        input.value = currentVal;
        input.className = 'qty-edit-input';
        qtySpan.replaceWith(input);
        input.focus();
        input.select();

        const finish = () => {
            let newVal = Math.max(0, parseInt(input.value) || 0);
            if (type === 'female') {
                const maxF = getMaxFemales();
                const currentTotal = getFemaleTotal();
                const other = currentTotal - currentVal;
                newVal = Math.min(newVal, maxF - other);
                if (isShiny) {
                    femaleShiny[idx] = newVal;
                } else {
                    femaleNormal[idx] = newVal;
                }
                femaleCheckboxStates[idx] = (femaleNormal[idx] + femaleShiny[idx] > 0);
            } else {
                if (isShiny) {
                    maleShiny[idx] = newVal;
                } else {
                    maleNormal[idx] = newVal;
                }
                maleCheckboxStates[idx] = (maleNormal[idx] + maleShiny[idx] > 0);
            }
            refreshUI();
        };

        input.addEventListener('blur', finish);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            }
        });
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║              七、DOM 元素引用                                 ║
    // ╚══════════════════════════════════════════════════════════════╝
    const nestCountInput = document.getElementById('nestCount');
    const femaleTotalBadge = document.getElementById('femaleTotalBadge');
    const maleTotalBadge = document.getElementById('maleTotalBadge');
    const maleRecommendationArea = document.getElementById('maleRecommendationArea');
    const femaleLimitWarn = document.getElementById('femaleLimitWarn');
    const maxFemaleDisplay = document.getElementById('maxFemaleDisplay');
    const capacityHint = document.getElementById('capacityHint');
    const globalMsg = document.getElementById('globalMsg');
    const resultArea = document.getElementById('resultArea');
    const nestVisualDiv = document.getElementById('nestVisual');
    const maleDetailsDiv = document.getElementById('maleDetails');
    const coverageSummaryDiv = document.getElementById('coverageSummary');
    const generateBtn = document.getElementById('generateBtn');
    const resetBtn = document.getElementById('resetBtn');
    const exportBtn = document.getElementById('exportBtn');
    const placementBtn = document.getElementById('placementBtn');
    const placementArea = document.getElementById('placementArea');
    const svgContainer = document.getElementById('svgContainer');
    const exportPlacementBtn = document.getElementById('exportPlacementBtn');
    const femaleSelectedDisplay = document.getElementById('femaleSelectedDisplay');
    const maleSelectedDisplay = document.getElementById('maleSelectedDisplay');
    const openFemaleModalBtn = document.getElementById('openFemaleModalBtn');
    const openMaleModalBtn = document.getElementById('openMaleModalBtn');
    const recommendMaleBtn = document.getElementById('recommendMaleBtn');
    const clearFemaleBtn = document.getElementById('clearFemaleBtn');
    const clearMaleBtn = document.getElementById('clearMaleBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalCancel = document.getElementById('modalCancel');
    const modalConfirm = document.getElementById('modalConfirm');
    const searchBox = document.getElementById('searchBox');
    const groupFilter = document.getElementById('groupFilter');
    const seasonFilter = document.getElementById('seasonFilter');
    let maleRecommendationFemaleSignature = '';

    // ╔══════════════════════════════════════════════════════════════╗
    // ║              八、模态框与搜索                                  ║
    // ╚══════════════════════════════════════════════════════════════╝

    /** 填充蛋组/赛季下拉框 */
    function populateFilters() {
        groupFilter.innerHTML = '<option value="">点击选择蛋组</option>';
        for (const [id, name] of Object.entries(groupNames)) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            groupFilter.appendChild(option);
        }
        seasonFilter.innerHTML = '<option value="">点击选择赛季异色</option>';
        for (const [id, name] of Object.entries(seasonNames)) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            seasonFilter.appendChild(option);
        }
    }

    /** 在搜索结果面板中渲染精灵列表 */
    function renderSearchResults(results) {
        const container = document.getElementById('searchResults');
        container.innerHTML = '';
        if (results.length === 0) {
            container.innerHTML = '<div style="text-align:center;color:#999;">无匹配精灵</div>';
            return;
        }
        results.sort((a, b) => petIds[a] - petIds[b]);
        for (const idx of results) {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            const isHatchable = !isNonBreedable(idx);
            const left = document.createElement('div');
            left.className = 'left-info';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'pet-name';
            nameSpan.textContent = petNames[idx];
            left.appendChild(nameSpan);

            if (petTags[idx].includes(1001)) {
                const tag = document.createElement('span');
                tag.style.cssText = 'color:#2c3e50; font-size:0.65rem; background:#dce6f5; border-radius:8px; padding:1px 6px; margin-left:6px;';
                tag.textContent = '仅雄性';
                left.appendChild(tag);
            }
            if (petTags[idx].includes(1002)) {
                const tag = document.createElement('span');
                tag.style.cssText = 'color:#2c3e50; font-size:0.65rem; background:#fde8e8; border-radius:8px; padding:1px 6px; margin-left:6px;';
                tag.textContent = '仅雌性';
                left.appendChild(tag);
            }

            if (!isHatchable) {
                const badSpan = document.createElement('span');
                badSpan.style.cssText = 'color:#d9534f; font-size:0.8rem; margin-left:6px;';
                badSpan.textContent = '🚫不可孵蛋';
                left.appendChild(badSpan);
            }

            const qtyRow = document.createElement('div');
            qtyRow.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-top: 8px;';

            const maxLimit = modalType === 'female' ? modalMaxFemales : 99;
            const seasonTags = petTags[idx].filter(t => seasonNames[t]);

            // 普通数量控件
            const normalDiv = document.createElement('div');
            normalDiv.className = 'qty-ctrl';
            const btnMinus = document.createElement('button'); btnMinus.textContent = '−';
            const qtyInput = document.createElement('input'); qtyInput.type = 'number';
            qtyInput.min = 0; qtyInput.max = maxLimit; qtyInput.step = 1;
            qtyInput.value = modalTempCounts[idx] || 0;
            if (!isHatchable) { qtyInput.disabled = true; btnMinus.disabled = true; }
            const btnPlus = document.createElement('button'); btnPlus.textContent = '+';
            if (!isHatchable) btnPlus.disabled = true;

            const updateQty = (newVal) => {
                if (!isHatchable) return;
                let val = Math.max(0, parseInt(newVal) || 0);
                if (modalType === 'female') {
                    const currentTotal = Object.values(modalTempCounts).reduce((s, v) => s + v, 0)
                        + Object.values(modalTempShinyCounts).reduce((s, v) => s + v, 0);
                    const other = currentTotal - (modalTempCounts[idx] || 0) - (modalTempShinyCounts[idx] || 0);
                    val = Math.min(val, modalMaxFemales - other);
                }
                modalTempCounts[idx] = val;
                qtyInput.value = val;
            };
            btnMinus.addEventListener('click', () => updateQty((modalTempCounts[idx] || 0) - 1));
            btnPlus.addEventListener('click', () => updateQty((modalTempCounts[idx] || 0) + 1));
            qtyInput.addEventListener('change', () => updateQty(parseInt(qtyInput.value) || 0));
            normalDiv.appendChild(btnMinus);
            normalDiv.appendChild(qtyInput);
            normalDiv.appendChild(btnPlus);
            qtyRow.appendChild(normalDiv);

            // 异色数量控件（有赛季标签时显示）
            if (seasonTags.length > 0) {
                const shinyBox = document.createElement('div');
                shinyBox.style.cssText = 'border: 2px solid #e6a317; border-radius: 10px; padding: 4px 8px; display: flex; flex-direction: column; align-items: center; background: #fffdf5;';

                const shinyDiv = document.createElement('div');
                shinyDiv.className = 'qty-ctrl';
                const sMinus = document.createElement('button'); sMinus.textContent = '−';
                const sInput = document.createElement('input'); sInput.type = 'number';
                sInput.min = 0; sInput.max = maxLimit; sInput.step = 1;
                sInput.value = modalTempShinyCounts[idx] || 0;
                if (!isHatchable) { sInput.disabled = true; sMinus.disabled = true; }
                const sPlus = document.createElement('button'); sPlus.textContent = '+';
                if (!isHatchable) sPlus.disabled = true;

                const updateShiny = (newVal) => {
                    if (!isHatchable) return;
                    let val = Math.max(0, parseInt(newVal) || 0);
                    if (modalType === 'female') {
                        const currentTotal = Object.values(modalTempCounts).reduce((s, v) => s + v, 0)
                            + Object.values(modalTempShinyCounts).reduce((s, v) => s + v, 0);
                        const other = currentTotal - (modalTempCounts[idx] || 0) - (modalTempShinyCounts[idx] || 0);
                        val = Math.min(val, modalMaxFemales - other);
                    }
                    modalTempShinyCounts[idx] = val;
                    sInput.value = val;
                };
                sMinus.addEventListener('click', () => updateShiny((modalTempShinyCounts[idx] || 0) - 1));
                sPlus.addEventListener('click', () => updateShiny((modalTempShinyCounts[idx] || 0) + 1));
                sInput.addEventListener('change', () => updateShiny(parseInt(sInput.value) || 0));
                shinyDiv.appendChild(sMinus);
                shinyDiv.appendChild(sInput);
                shinyDiv.appendChild(sPlus);
                shinyBox.appendChild(shinyDiv);

                const seasonBadge = document.createElement('span');
                seasonBadge.style.cssText = 'font-size:0.6rem; color:#b06030; margin-top:2px;';
                seasonBadge.textContent = seasonTags.map(t => seasonNames[t]).join('/');
                shinyBox.appendChild(seasonBadge);

                qtyRow.appendChild(shinyBox);
            }

            left.appendChild(qtyRow);
            div.appendChild(left);

            const groupsDiv = document.createElement('div');
            groupsDiv.className = 'groups';
            for (const g of eggGroups[idx]) {
                const badge = document.createElement('span');
                badge.className = 'group-badge';
                badge.textContent = groupNames[g] || g;
                groupsDiv.appendChild(badge);
            }
            div.appendChild(groupsDiv);
            container.appendChild(div);
        }
    }

    /** 按蛋组/赛季/关键词筛选搜索结果（联动进化链） */
    function performFilteredSearch(keyword) {
        const groupVal = groupFilter.value ? parseInt(groupFilter.value) : null;
        const seasonVal = seasonFilter.value ? parseInt(seasonFilter.value) : null;
        const lowerKeyword = keyword.trim().toLowerCase();

        const candidates = [];
        for (let i = 0; i < petIds.length; i++) {
            if (eggGroups[i].length === 0) continue;
            if (modalType === 'female' && petTags[i].includes(1001)) continue;
            if (modalType === 'male' && petTags[i].includes(1002)) continue;
            if (groupVal !== null && !eggGroups[i].includes(groupVal)) continue;
            if (seasonVal !== null && !petTags[i].includes(seasonVal)) continue;
            if (lowerKeyword && !petNames[i].toLowerCase().includes(lowerKeyword)) continue;
            candidates.push(i);
        }

        if (groupVal === null && seasonVal === null && !lowerKeyword) {
            document.getElementById('searchResults').innerHTML = '';
            modalSearchResults = [];
            return;
        }

        const chainIndices = getEvolutionChain(candidates);
        const filtered = chainIndices.filter(i => {
            if (eggGroups[i].length === 0) return false;
            if (modalType === 'female' && petTags[i].includes(1001)) return false;
            if (modalType === 'male' && petTags[i].includes(1002)) return false;
            if (groupVal !== null && !eggGroups[i].includes(groupVal)) return false;
            if (seasonVal !== null && !petTags[i].includes(seasonVal)) return false;
            return true;
        });

        modalSearchResults = filtered;
        renderSearchResults(filtered);
    }

    /** 打开选择模态框 */
    function openModal(type) {
        modalType = type;
        modalMaxFemales = getMaxFemales();
        const n = petIds.length;
        if (type === 'female') {
            modalSavedCounts = [...femaleNormal];
            modalSavedShinyCounts = [...femaleShiny];
            modalSavedCheckboxStates = [...femaleCheckboxStates];
            modalTempCounts = [...femaleNormal];
            modalTempShinyCounts = new Array(n).fill(0);
            for (let i = 0; i < n; i++) modalTempShinyCounts[i] = femaleShiny[i];
        } else {
            modalSavedCounts = [...maleNormal];
            modalSavedShinyCounts = [...maleShiny];
            modalSavedCheckboxStates = [...maleCheckboxStates];
            modalTempCounts = [...maleNormal];
            modalTempShinyCounts = new Array(n).fill(0);
            for (let i = 0; i < n; i++) modalTempShinyCounts[i] = maleShiny[i];
        }
        modalTitle.innerHTML = type === 'female'
            ? `🌸 选择雌性精灵 <span style="font-size:0.8rem;">(上限${modalMaxFemales}只)</span>`
            : '♂️ 选择雄性精灵（库存）';
        document.getElementById('petSearchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
        modalSearchResults = [];

        populateFilters();
        groupFilter.value = '';
        seasonFilter.value = '';

        modalOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        nestCountInput.disabled = true;
    }

    /** 关闭模态框，若确认则提交修改 */
    function closeModal(confirmed) {
        if (confirmed && modalType) {
            const n = petIds.length;
            if (modalType === 'female') {
                for (let i = 0; i < n; i++) {
                    femaleNormal[i] = modalTempCounts[i] || 0;
                    femaleShiny[i] = modalTempShinyCounts[i] || 0;
                    femaleCheckboxStates[i] = (femaleNormal[i] + femaleShiny[i] > 0);
                }
            } else {
                for (let i = 0; i < n; i++) {
                    maleNormal[i] = modalTempCounts[i] || 0;
                    maleShiny[i] = modalTempShinyCounts[i] || 0;
                    maleCheckboxStates[i] = (maleNormal[i] + maleShiny[i] > 0);
                }
            }
        }
        modalType = null;
        modalTempCounts = null;
        modalTempShinyCounts = null;
        modalOverlay.style.display = 'none';
        document.body.style.overflow = '';
        nestCountInput.disabled = false;
        searchBox.style.display = 'flex';
        refreshUI();
    }

    function cancelModal() { closeModal(false); }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║              九、事件绑定（模态框/清空/搜索）                   ║
    // ╚══════════════════════════════════════════════════════════════╝
    clearFemaleBtn.addEventListener('click', () => {
        femaleNormal.fill(0); femaleShiny.fill(0);
        femaleCheckboxStates.fill(false);
        refreshUI();
    });
    clearMaleBtn.addEventListener('click', () => {
        maleNormal.fill(0); maleShiny.fill(0);
        maleCheckboxStates.fill(false);
        refreshUI();
    });

    function getSelectedFemaleIds() {
        const femaleIds = [];
        for (let index = 0; index < petIds.length; index++) {
            if (femaleNormal[index] + femaleShiny[index] > 0) femaleIds.push(petIds[index]);
        }
        return femaleIds;
    }

    function getFemaleRecommendationSignature() {
        return getSelectedFemaleIds().join(',');
    }

    function clearMaleRecommendationPlans() {
        maleRecommendationArea.innerHTML = '';
        maleRecommendationArea.style.display = 'none';
        maleRecommendationFemaleSignature = '';
    }

    function applyMaleRecommendation(plan) {
        maleNormal.fill(0); maleShiny.fill(0); maleCheckboxStates.fill(false);
        for (const male of plan.males) {
            const index = petIds.indexOf(male.id);
            if (index === -1) continue;
            maleNormal[index] = 1;
            maleCheckboxStates[index] = true;
        }
        refreshUI();
        const maleNames = plan.males.map(male => male.name).join('、') || '无';
        globalMsg.innerHTML = `<div class="success">✅ 已采用方案 ${plan.rank}：${maleNames}。你仍可手工调整库存。</div>`;
    }

    function renderMaleRecommendationPlans(plans) {
        maleRecommendationArea.innerHTML = '<div class="recommendation-title">🧠 公精灵推荐方案</div>';
        for (const plan of plans) {
            const card = document.createElement('div');
            card.className = 'recommendation-card';
            const maleTags = plan.males.map(male => {
                const groups = male.egg_groups.map(group => groupNames[group] || group).join('/');
                return `<span class="recommendation-male">♂ ${male.name}<small>${groups}</small></span>`;
            }).join('');
            const uncoveredNames = plan.uncoveredFemaleIds
                .map(id => petNames[petIds.indexOf(id)] || id)
                .join('、');
            card.innerHTML = `
                <div class="recommendation-card-header">
                    <strong>方案 ${plan.rank}${plan.isOptimal ? ' · 最少公精灵' : ' · 备选'}</strong>
                    <span>${plan.coveredFemaleIds.length}/${plan.coveredFemaleIds.length + plan.uncoveredFemaleIds.length} 覆盖</span>
                </div>
                <div class="recommendation-males">${maleTags || '<span>无可用公精灵</span>'}</div>
                ${uncoveredNames ? `<div class="recommendation-warning">无法匹配：${uncoveredNames}</div>` : ''}
                <button type="button" class="btn btn-outline recommendation-apply">采用此方案</button>
            `;
            card.querySelector('.recommendation-apply').addEventListener('click', () => applyMaleRecommendation(plan));
            maleRecommendationArea.appendChild(card);
        }
        maleRecommendationArea.style.display = 'grid';
    }

    recommendMaleBtn.addEventListener('click', () => {
        const femaleIds = getSelectedFemaleIds();
        if (femaleIds.length === 0) {
            globalMsg.innerHTML = '<div class="warning">🌸 请先选择需要匹配的雌性精灵。</div>';
            return;
        }
        const plans = MaleRecommender.recommendMalePlans(petsData, femaleIds, { maxPlans: 5 });
        maleRecommendationFemaleSignature = getFemaleRecommendationSignature();
        renderMaleRecommendationPlans(plans);
        globalMsg.innerHTML = `<div class="success">🧠 已生成 ${plans.length} 套公精灵方案。请选择一套采用。</div>`;
    });
    modalCloseBtn.addEventListener('click', cancelModal);
    modalCancel.addEventListener('click', cancelModal);
    modalConfirm.addEventListener('click', () => closeModal(true));
    modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) cancelModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalOverlay.style.display === 'flex') cancelModal(); });
    openFemaleModalBtn.addEventListener('click', () => openModal('female'));
    openMaleModalBtn.addEventListener('click', () => openModal('male'));

    groupFilter.addEventListener('change', () => performFilteredSearch(document.getElementById('petSearchInput').value));
    seasonFilter.addEventListener('change', () => performFilteredSearch(document.getElementById('petSearchInput').value));

    document.getElementById('resetFiltersBtn').addEventListener('click', () => {
        groupFilter.value = '';
        seasonFilter.value = '';
        document.getElementById('petSearchInput').value = '';
        performFilteredSearch('');
    });

    document.getElementById('searchBtn').addEventListener('click', () => performFilteredSearch(document.getElementById('petSearchInput').value));
    document.getElementById('petSearchInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') performFilteredSearch(e.target.value); });

    // ╔══════════════════════════════════════════════════════════════╗
    // ║              十、配窝推荐算法                                  ║
    // ╚══════════════════════════════════════════════════════════════╝
    let lastResultData = null;
    const GRID_SIZE = 7;                    // 整数网格 7×7
    const FINE_GRID = GRID_SIZE * 2;        // 细网格 14×14（半格精度）
    let currentPlacement = { maleCoords: [], femaleCoords: [], maleSlots: [], femaleInstances: [] };
    let originalPlacement = null;

    /** 计算唯一依赖：每个雄性被几只雌性视为唯一可交配对象 */
    function calcUniquePairs(femaleInstances, maleSlots) {
        maleSlots.forEach(m => { m.lockedForIds = []; m.locked = false; });
        femaleInstances.forEach(fi => {
            const compatibleMaleIndices = [];
            maleSlots.forEach((m, idx) => { if (compatibleMap.get(m.species).has(fi.species)) compatibleMaleIndices.push(idx); });
            if (compatibleMaleIndices.length === 1) {
                const maleIdx = compatibleMaleIndices[0];
                maleSlots[maleIdx].lockedForIds.push(fi.id);
                maleSlots[maleIdx].locked = true;
            }
        });
    }

    /** 配窝推荐计算主入口：贪心 + Hall 条件优化 */
    function computeRecommendation() {
        const nestTotal = getNestTotal();
        const femaleInstances = [];
        femaleNormal.forEach((cnt, sp) => {
            for (let i = 0; i < cnt; i++) femaleInstances.push({ species: sp, id: `f-${sp}-${i}`, isShiny: false });
        });
        femaleShiny.forEach((cnt, sp) => {
            for (let i = 0; i < cnt; i++) femaleInstances.push({ species: sp, id: `fs-${sp}-${i}`, isShiny: true });
        });

        const requiredMales = nestTotal - femaleInstances.length;
        if (requiredMales <= 0) return { error: '雌性已占满所有窝，请留至少一个雄性窝。' };

        const stockNormal = new Map();
        const stockShiny = new Map();
        maleNormal.forEach((cnt, idx) => { if (cnt > 0) stockNormal.set(idx, cnt); });
        maleShiny.forEach((cnt, idx) => { if (cnt > 0) stockShiny.set(idx, cnt); });

        const totalStock = new Map();
        stockNormal.forEach((cnt, idx) => totalStock.set(idx, (totalStock.get(idx) || 0) + cnt));
        stockShiny.forEach((cnt, idx) => totalStock.set(idx, (totalStock.get(idx) || 0) + cnt));
        if (totalStock.size === 0) return { error: '雄性库存为空。' };

        const consumeMale = (species) => {
            if (stockNormal.get(species) > 0) {
                stockNormal.set(species, stockNormal.get(species) - 1);
                totalStock.set(species, totalStock.get(species) - 1);
                return { species, isShiny: false };
            } else if (stockShiny.get(species) > 0) {
                stockShiny.set(species, stockShiny.get(species) - 1);
                totalStock.set(species, totalStock.get(species) - 1);
                return { species, isShiny: true };
            }
            return null;
        };

        const maleLimit = new Map();
        for (const [mSp] of totalStock) {
            maleLimit.set(mSp, femaleInstances.filter(f => compatibleMap.get(mSp).has(f.species)).length);
        }

        const femaleDeps = femaleInstances.map(f => {
            const possible = [];
            for (const [mSp, cnt] of totalStock) {
                if (compatibleMap.get(mSp).has(f.species) && cnt > 0) possible.push(mSp);
            }
            return { female: f, possible };
        });

        // 第一步：保留唯一配对（只存一并且雌性只依赖它）
        const reservedPairs = [], reservedMales = new Set(), lockedFemaleIds = new Set();
        const uniqueDeps = femaleDeps.filter(d => d.possible.length === 1 && totalStock.get(d.possible[0]) === 1);
        const usedUnique = new Set();
        for (const dep of uniqueDeps) {
            const mSp = dep.possible[0];
            if (usedUnique.has(mSp)) continue;
            if (totalStock.get(mSp) >= 1) {
                const male = consumeMale(mSp);
                if (!male) continue;
                reservedPairs.push({ femaleId: dep.female.id, maleSpecies: mSp, isShiny: male.isShiny });
                reservedMales.add(mSp);
                usedUnique.add(mSp);
                lockedFemaleIds.add(dep.female.id);
            }
        }

        // 唯一配对超额时按覆盖能力排序剔除
        if (reservedPairs.length > requiredMales) {
            const maleCoverCount = new Map();
            for (const [mSp] of totalStock) {
                maleCoverCount.set(mSp, femaleInstances.filter(f => compatibleMap.get(mSp).has(f.species)).length);
            }
            reservedPairs.sort((a, b) => (maleCoverCount.get(a.maleSpecies) || 0) - (maleCoverCount.get(b.maleSpecies) || 0));
            const removedPairs = reservedPairs.splice(requiredMales);
            for (const rp of removedPairs) {
                lockedFemaleIds.delete(rp.femaleId);
                reservedMales.delete(rp.maleSpecies);
                if (rp.isShiny) {
                    stockShiny.set(rp.maleSpecies, (stockShiny.get(rp.maleSpecies) || 0) + 1);
                } else {
                    stockNormal.set(rp.maleSpecies, (stockNormal.get(rp.maleSpecies) || 0) + 1);
                }
                totalStock.set(rp.maleSpecies, (totalStock.get(rp.maleSpecies) || 0) + 1);
            }
        }

        // 第二步：贪心补充剩余雄性（优先选未覆盖雌性数最多的）
        const remainingSlots = requiredMales - reservedPairs.length;
        const selectedExtra = [];
        const uncoveredFemaleIds = new Set(femaleInstances.map(f => f.id));
        reservedPairs.forEach(rp => {
            const comp = compatibleMap.get(rp.maleSpecies);
            femaleInstances.forEach(f => { if (comp.has(f.species)) uncoveredFemaleIds.delete(f.id); });
        });

        for (let i = 0; i < remainingSlots; i++) {
            let bestSp = -1, bestNew = -1, bestTotal = -1;
            for (const [mSp, cnt] of totalStock) {
                if (cnt <= 0) continue;
                const curCnt = reservedPairs.filter(r => r.maleSpecies === mSp).length + selectedExtra.filter(s => s.species === mSp).length;
                if (curCnt >= (maleLimit.get(mSp) || 0)) continue;
                const comp = compatibleMap.get(mSp);
                let newC = 0, total = 0;
                femaleInstances.forEach(f => { if (comp.has(f.species)) { total++; if (uncoveredFemaleIds.has(f.id)) newC++; } });
                if (newC > bestNew || (newC === bestNew && total > bestTotal)) { bestNew = newC; bestTotal = total; bestSp = mSp; }
            }
            if (bestSp === -1) break;
            const male = consumeMale(bestSp);
            if (!male) break;
            selectedExtra.push(male);
            const cov = compatibleMap.get(bestSp);
            femaleInstances.forEach(f => { if (cov.has(f.species)) uncoveredFemaleIds.delete(f.id); });
        }

        // 第三步：补充剩余空位
        while (selectedExtra.length < remainingSlots && totalStock.size > 0) {
            let bestSp = -1, bestTotal = -1;
            for (const [mSp, cnt] of totalStock) {
                if (cnt <= 0) continue;
                const curCnt = reservedPairs.filter(r => r.maleSpecies === mSp).length + selectedExtra.filter(s => s.species === mSp).length;
                if (curCnt >= (maleLimit.get(mSp) || 0)) continue;
                let total = 0;
                const comp = compatibleMap.get(mSp);
                femaleInstances.forEach(f => { if (comp.has(f.species)) total++; });
                if (total > bestTotal) { bestTotal = total; bestSp = mSp; }
            }
            if (bestSp === -1) break;
            const male = consumeMale(bestSp);
            if (!male) break;
            selectedExtra.push(male);
        }

        let allMaleSlots = reservedPairs.map(rp => ({ species: rp.maleSpecies, locked: true, lockedForIds: [], isShiny: rp.isShiny }));
        selectedExtra.forEach(m => allMaleSlots.push({ species: m.species, locked: false, lockedForIds: [], isShiny: m.isShiny }));

        // Hall 条件：移除冗余雄性保证所有雄性都能独立覆盖至少一只雌性
        const optimized = ensureHallCondition(femaleInstances, allMaleSlots);
        const finalMaleSlots = optimized.map(m => ({ ...m, lockedForIds: [] }));
        const emptySlots = requiredMales - finalMaleSlots.length;

        calcUniquePairs(femaleInstances, finalMaleSlots);

        const coveredFemaleIds = new Set();
        finalMaleSlots.forEach(m => {
            const comp = compatibleMap.get(m.species);
            femaleInstances.forEach(f => { if (comp.has(f.species)) coveredFemaleIds.add(f.id); });
        });
        const uncoveredFemales = femaleInstances.filter(f => !coveredFemaleIds.has(f.id));

        const maleCoverDetails = finalMaleSlots.map(m => {
            const comp = compatibleMap.get(m.species);
            const covered = femaleInstances.filter(f => comp.has(f.species));
            return {
                species: m.species,
                locked: m.locked,
                lockedForIds: m.lockedForIds,
                isShiny: m.isShiny,
                coveredNames: covered.map(f => petNames[f.species]),
                coveredIds: covered.map(f => ({ id: f.species, isShiny: f.isShiny }))
            };
        });

        return { femaleInstances, allMaleSlots: finalMaleSlots, emptySlots, uncoveredFemales, maleCoverDetails };
    }

    /** 二分图最大匹配（Hungarian/DFS），用于 Hall 条件检查 */
    function maxMatching(females, maleList) {
        const n = maleList.length;
        const adj = Array.from({ length: n }, () => []);
        maleList.forEach((m, i) => {
            const comp = compatibleMap.get(m.species);
            females.forEach((f, j) => { if (comp.has(f.species)) adj[i].push(j); });
        });
        const matchR = Array(females.length).fill(-1);
        let result = 0;
        const seen = new Array(females.length);
        function dfs(u) {
            for (const v of adj[u]) {
                if (seen[v]) continue;
                seen[v] = true;
                if (matchR[v] === -1 || dfs(matchR[v])) { matchR[v] = u; return true; }
            }
            return false;
        }
        for (let u = 0; u < n; u++) { seen.fill(false); if (dfs(u)) result++; }
        return result;
    }

    /** Hall 条件优化：贪婪移除覆盖能力最弱的冗余雄性 */
    function ensureHallCondition(females, maleSlots) {
        const males = maleSlots.map((m, i) => ({ ...m, origIdx: i }));
        while (males.length > 0) {
            if (maxMatching(females, males) === males.length) break;
            let worstIdx = -1, worstCover = Infinity;
            for (let i = 0; i < males.length; i++) {
                if (males[i].locked) continue;
                const cover = females.filter(f => compatibleMap.get(males[i].species).has(f.species)).length;
                if (cover < worstCover) { worstCover = cover; worstIdx = i; }
            }
            if (worstIdx === -1) worstIdx = males.length - 1;
            males.splice(worstIdx, 1);
        }
        return males;
    }

    /** 渲染配窝推荐结果到 DOM */
    function renderResult(result) {
        if (result.error) {
            globalMsg.innerHTML = `<div class="warning">${result.error}</div>`;
            resultArea.style.display = 'none';
            placementArea.style.display = 'none';
            placementBtn.style.display = 'none';
            return;
        }
        globalMsg.innerHTML = '';
        resultArea.style.display = 'block';
        placementBtn.style.display = 'inline-flex';
        const { femaleInstances, allMaleSlots, emptySlots, uncoveredFemales, maleCoverDetails } = result;
        const femaleSpeciesIdx = {};
        femaleInstances.forEach(f => {
            if (!femaleSpeciesIdx[f.species]) femaleSpeciesIdx[f.species] = [];
            femaleSpeciesIdx[f.species].push(f);
        });
        const maleSpeciesIdx = {};
        allMaleSlots.forEach((m, i) => {
            if (!maleSpeciesIdx[m.species]) maleSpeciesIdx[m.species] = [];
            maleSpeciesIdx[m.species].push({ ...m, inst: i });
        });
        nestVisualDiv.innerHTML = '';
        const uncoveredIds = new Set(uncoveredFemales.map(f => f.id));

        femaleInstances.forEach(f => {
            const total = femaleSpeciesIdx[f.species].length,
                idx = femaleSpeciesIdx[f.species].indexOf(f);
            const div = document.createElement('div');
            div.className = 'nest-item female';
            div.style.position = 'relative';
            div.innerHTML = `<span class="icon">♀️</span><span>${getDisplayName(f.species, idx, total)}</span>`;

            if (f.isShiny) {
                const star = document.createElement('span');
                star.style.cssText = 'position:absolute; top:-4px; right:2px; font-size:1.2rem; color:#e6a317; text-shadow:0 0 4px gold;';
                star.textContent = '⭐';
                div.appendChild(star);
            }

            if (uncoveredIds.has(f.id)) {
                const overlay = document.createElement('span');
                overlay.style.cssText = 'position:absolute; top:0; left:0; right:0; bottom:0; display:flex; align-items:center; justify-content:center; background: rgba(255,100,100,0.35); border-radius: 20px; z-index:1;';
                const icon = document.createElement('span');
                icon.style.cssText = 'font-size:2.5rem; font-weight:bold; color: rgba(221, 21, 204, 0.45); text-shadow: 0 0 8px white; line-height:1; transform: translateY(-12px);';
                icon.textContent = '⚠️';
                overlay.appendChild(icon);
                div.appendChild(overlay);
            }

            nestVisualDiv.appendChild(div);
        });

        allMaleSlots.forEach((m, i) => {
            const total = maleSpeciesIdx[m.species].length,
                info = maleSpeciesIdx[m.species].find(x => x.inst === i);
            const idx = info ? maleSpeciesIdx[m.species].indexOf(info) : 0;
            const div = document.createElement('div');
            div.className = 'nest-item male';
            div.style.position = 'relative';
            div.innerHTML = `<span class="icon">${m.locked ? '🔒♂️' : '♂️'}</span><span>${getDisplayName(m.species, idx, total)}</span>`;

            if (m.isShiny) {
                const star = document.createElement('span');
                star.style.cssText = 'position:absolute; top:-4px; right:2px; font-size:1.2rem; color:#e6a317; text-shadow:0 0 4px gold;';
                star.textContent = '⭐';
                div.appendChild(star);
            }

            nestVisualDiv.appendChild(div);
        });

        for (let i = 0; i < emptySlots; i++) {
            const div = document.createElement('div'); div.className = 'nest-item male'; div.style.opacity = '0.5';
            div.innerHTML = '<span class="icon">♂️</span><span>(空窝)</span>';
            nestVisualDiv.appendChild(div);
        }

        maleDetailsDiv.innerHTML = '';
        maleCoverDetails.forEach((md, i) => {
            const total = maleSpeciesIdx[md.species].length,
                info = maleSpeciesIdx[md.species].find(x => x.inst === i);
            const idx = info ? maleSpeciesIdx[md.species].indexOf(info) : 0;
            const card = document.createElement('div'); card.className = 'male-card';
            const lockedNames = (md.lockedForIds || []).map(id => petNames[parseInt(id.split('-')[1])]).join('、');
            const lockBadge = lockedNames ? `<span style="color:#b06030;font-weight:700;">🔒 唯一依赖·专属配对：${lockedNames}</span>` : '';

            const coveredEntries = (md.coveredIds || []).map(c => {
                const name = petNames[c.id] || `?`;
                return { name, isShiny: c.isShiny };
            });
            const tags = coveredEntries.map(e => `<span class="tag">${e.name}${e.isShiny ? '⭐' : ''}</span>`).join(' ');
            const groups = eggGroups[md.species].map(g => groupNames[g] || g).join('/');
            const maleStar = md.isShiny ? '⭐' : '';

            card.innerHTML = `
                <div class="card-header">
                    <strong>♂ ${getDisplayName(md.species, idx, total)}${maleStar}</strong>
                    <span class="egg-groups">${groups}</span>
                </div>
                <div>(窝${femaleInstances.length + i + 1}) ${lockBadge}</div>
                <div style="font-size:0.8rem;">可配雌性：${tags || '<span style="color:#999;">无</span>'}</div>
            `;
            maleDetailsDiv.appendChild(card);
        });

        let summary = '';
        if (uncoveredFemales.length > 0) summary += `<span style="color:#b34a4a;">⚠️ 以下雌性无法被覆盖：${uncoveredFemales.map(f => petNames[f.species]).join('、')}</span><br>`;
        else summary += `<span style="color:#2d5a27;">✅ 所有雌性均已覆盖！</span><br>`;
        if (emptySlots > 0) summary += `<span style="color:#ab6d2a;">📌 为防止雄性闲置，自动少放${emptySlots}只雄性。</span><br>`;
        coverageSummaryDiv.innerHTML = summary;
    }

    /** 生成按钮点击 */
    function doGenerate() {
        if (getFemaleTotal() === 0) { globalMsg.innerHTML = '<div class="warning">🌸 请至少选择一只雌性。</div>'; return; }
        if (getFemaleTotal() > getMaxFemales()) { globalMsg.innerHTML = '<div class="warning">雌性数量超过上限。</div>'; return; }
        if (getMaleStockTotal() === 0) { globalMsg.innerHTML = '<div class="warning">♂️ 请至少添加雄性。</div>'; return; }
        const result = computeRecommendation();
        lastResultData = result;
        renderResult(result);
        placementArea.style.display = 'none';
    }

    function exportToImage() {
        if (resultArea.style.display === 'none') return;
        html2canvas(resultContent, { backgroundColor: '#faf3e8', scale: 2 }).then(canvas => {
            const a = document.createElement('a'); a.download = '配窝方案.png'; a.href = canvas.toDataURL(); a.click();
        });
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║          十一、精灵窝位置图 —— 蛋组工具函数                     ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * 计算雄性在给定雌性集合下的「有效蛋组」：
     * 1) 某蛋组无对应雌性 → 排除
     * 2) 某蛋组的所有对应雌性与该雄性蛋组完全一致 → 也排除
     * （例如治愈兔有动物组+妖精组，但所有动物组雌性同时也是妖精组 → 动物组视为冗余剔除）
     */
    function calcEffectiveEggGroups(maleSpecies, femaleInstances) {
        const groups = eggGroups[maleSpecies];
        if (groups.length <= 1) return [...groups];
        const maleSet = new Set(groups);
        function femaleHasSameGroups(fi) {
            const fg = eggGroups[fi.species] || [];
            if (fg.length !== maleSet.size) return false;
            return fg.every(g => maleSet.has(g));
        }
        const active = [];
        for (const g of groups) {
            for (const fi of femaleInstances) {
                const fg = eggGroups[fi.species];
                if (fg && fg.includes(g) && !femaleHasSameGroups(fi)) {
                    active.push(g);
                    break;
                }
            }
        }
        return active.length > 0 ? active : [...groups];
    }

    /** 蛋组数组转排序字符串 key */
    function eggGroupKey(groups) {
        return [...groups].sort((a, b) => a - b).join(',');
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║          十二、网格封锁工具函数                                ║
    // ╚══════════════════════════════════════════════════════════════╝

    /** 非聚合模式：将半格坐标的聚类转为子问题需避开的整数格子（仅封锁偶数交点） */
    function clusterToBlockedIntCells(clusterCoords) {
        const blocked = new Set();
        for (const c of clusterCoords) {
            const fx = Math.round(c.x * 2), fy = Math.round(c.y * 2);
            for (let dfx = -1; dfx <= 1; dfx++) {
                for (let dfy = -1; dfy <= 1; dfy++) {
                    const nfx = fx + dfx, nfy = fy + dfy;
                    if (nfx % 2 === 0 && nfy % 2 === 0) {
                        const ix = nfx / 2, iy = nfy / 2;
                        if (ix >= 0 && ix < GRID_SIZE && iy >= 0 && iy < GRID_SIZE) {
                            blocked.add(iy * GRID_SIZE + ix);
                        }
                    }
                }
            }
        }
        return blocked;
    }

    /** 聚合模式：将聚合坐标周围 3×3 细格全部标记为占用 */
    function clusterToBlockedFineCells(clusterCoords) {
        const blocked = new Set();
        for (const c of clusterCoords) {
            const fx = Math.round(c.x * 2), fy = Math.round(c.y * 2);
            for (let dfx = -1; dfx <= 1; dfx++) {
                for (let dfy = -1; dfy <= 1; dfy++) {
                    const nfx = fx + dfx, nfy = fy + dfy;
                    if (nfx >= 0 && nfx <= FINE_GRID && nfy >= 0 && nfy <= FINE_GRID) {
                        blocked.add(nfy * (FINE_GRID + 1) + nfx);
                    }
                }
            }
        }
        return blocked;
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║          十三、精灵窝位置图生成主函数                           ║
    // ╚══════════════════════════════════════════════════════════════╝

    function generatePlacement() {
        if (!lastResultData || lastResultData.error) return;
        const res = lastResultData;
        const originalFemaleInstances = res.femaleInstances;
        const uncoveredFemales = res.uncoveredFemales;

        const uncoveredIds = new Set(uncoveredFemales.map(f => f.id));
        const coveredFemaleInstances = originalFemaleInstances.filter(f => !uncoveredIds.has(f.id));

        if (coveredFemaleInstances.length === 0) {
            globalMsg.innerHTML = '<div class="warning">没有雌性可被覆盖，无法生成位置图。</div>';
            return;
        }

        const maleSlots = res.allMaleSlots;
        const males = maleSlots.map((sm, idx) => ({ id: `m-${idx}`, species: sm.species, idx }));

        // 统计每个雄性的可交配雌性数
        const maleCompatCount = new Array(males.length).fill(0);
        coveredFemaleInstances.forEach(fi => {
            males.forEach(m => {
                if (compatibleMap.get(m.species).has(fi.species)) maleCompatCount[m.idx]++;
            });
        });

        // 统计每个雄性被多少雌性视为唯一可交配对象
        const maleUniqueCount = new Array(males.length).fill(0);
        coveredFemaleInstances.forEach(fi => {
            const compatibleMaleIndices = [];
            males.forEach(m => {
                if (compatibleMap.get(m.species).has(fi.species)) compatibleMaleIndices.push(m.idx);
            });
            if (compatibleMaleIndices.length === 1) maleUniqueCount[compatibleMaleIndices[0]]++;
        });

        // ═══════════════════════════════════════════════════════════
        //  聚类检测：按有效蛋组分组
        // ═══════════════════════════════════════════════════════════
        const maleEffGroups = maleSlots.map(sm => calcEffectiveEggGroups(sm.species, coveredFemaleInstances));
        maleSlots.forEach((sm, i) => { sm.effGroupCount = maleEffGroups[i].length; });

        const groupToMales = new Map();
        maleSlots.forEach((_, mi) => {
            const key = eggGroupKey(maleEffGroups[mi]);
            if (!groupToMales.has(key)) groupToMales.set(key, []);
            groupToMales.get(key).push(mi);
        });

        let clusterMaleSet = null, clusterFemaleSet = null;
        let clusterMaleCoords = null, clusterFemalePositions = null;

        // ── 第一轮：优先单蛋组（原始蛋组数少的先聚类） ──
        const sortedGroupEntries = [...groupToMales].sort(([, malesA], [, malesB]) => {
            const avgA = malesA.reduce((s, mi) => s + maleSlots[mi].effGroupCount, 0) / malesA.length;
            const avgB = malesB.reduce((s, mi) => s + maleSlots[mi].effGroupCount, 0) / malesB.length;
            return avgA - avgB;
        });
        for (const [key, maleIndices] of sortedGroupEntries) {
            const n = maleIndices.length;
            if (n !== 2 && n !== 3) continue;
            const compFemSet = new Set();
            for (const mi of maleIndices) {
                const comp = compatibleMap.get(maleSlots[mi].species);
                coveredFemaleInstances.forEach((fi, fiIdx) => {
                    if (comp.has(fi.species)) compFemSet.add(fiIdx);
                });
            }
            const compCnt = compFemSet.size;
            if (n === 2 && compCnt >= 4) {
                clusterMaleSet = new Set(maleIndices);
                clusterFemaleSet = compFemSet;
                clusterMaleCoords = [{ x: 0.5, y: 0 }, { x: -0.5, y: 0 }];
                clusterFemalePositions = [
                    { x: 1, y: -1 }, { x: 1.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
                    { x: -1, y: 1 }, { x: -1.5, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 },
                ];
                break;
            } else if (n === 3 && compCnt >= 4) {
                clusterMaleSet = new Set(maleIndices);
                clusterFemaleSet = compFemSet;
                clusterMaleCoords = [{ x: 0.5, y: 0 }, { x: -0.5, y: 0 }, { x: 0, y: -1 }];
                clusterFemalePositions = [
                    { x: 1.5, y: 0 }, { x: 1, y: -1 }, { x: -1, y: -1 },
                    { x: -1.5, y: 0 }, { x: 0, y: -2 }, { x: -0.5, y: 1 }, { x: 0.5, y: 1 },
                ];
                break;
            }
        }

        // ── 第二轮：孤独高覆盖雄性搜索（第一个聚类没命中时） ──
        if (clusterMaleSet === null) {
            for (let mi = 0; mi < maleSlots.length; mi++) {
                if (maleCompatCount[mi] < 4) continue;
                if (maleUniqueCount[mi] > 0) continue;
                const myKey = eggGroupKey(maleEffGroups[mi]);
                const peers = groupToMales.get(myKey) || [];
                if (peers.length > 1) continue;

                const candidates = [];
                for (let mj = 0; mj < maleSlots.length; mj++) {
                    if (mj === mi) continue;
                    if (maleUniqueCount[mj] > 0) continue;
                    if (!hasCommonGroup(maleEffGroups[mi], maleEffGroups[mj])) continue;
                    candidates.push(mj);
                }

                if (candidates.length >= 2) {
                    const threeMales = [mi, candidates[0], candidates[1]];
                    const compFemSet = new Set();
                    for (const mIdx of threeMales) {
                        const comp = compatibleMap.get(maleSlots[mIdx].species);
                        coveredFemaleInstances.forEach((fi, fiIdx) => {
                            if (comp.has(fi.species)) compFemSet.add(fiIdx);
                        });
                    }
                    if (compFemSet.size >= 4) {
                        clusterMaleSet = new Set(threeMales); clusterFemaleSet = compFemSet;
                        clusterMaleCoords = [{ x: 0.5, y: 0 }, { x: -0.5, y: 0 }, { x: 0, y: -1 }];
                        clusterFemalePositions = [
                            { x: 1.5, y: 0 }, { x: 1, y: -1 }, { x: -1, y: -1 },
                            { x: -1.5, y: 0 }, { x: 0, y: -2 }, { x: -0.5, y: 1 }, { x: 0.5, y: 1 },
                        ];
                        break;
                    }
                }

                if (candidates.length >= 1) {
                    const twoMales = [mi, candidates[0]];
                    const compFemSet = new Set();
                    for (const mIdx of twoMales) {
                        const comp = compatibleMap.get(maleSlots[mIdx].species);
                        coveredFemaleInstances.forEach((fi, fiIdx) => {
                            if (comp.has(fi.species)) compFemSet.add(fiIdx);
                        });
                    }
                    if (compFemSet.size >= 7) {
                        clusterMaleSet = new Set(twoMales); clusterFemaleSet = compFemSet;
                        clusterMaleCoords = [{ x: 0.5, y: 0 }, { x: -0.5, y: 0 }];
                        clusterFemalePositions = [
                            { x: 1, y: -1 }, { x: 1.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
                            { x: -1, y: 1 }, { x: -1.5, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 },
                        ];

                        break;
                    } else if (compFemSet.size <= 6) {
                        if (candidates.length >= 2) {
                            const threeMales = [mi, candidates[0], candidates[1]];
                            const comp3 = new Set();
                            for (const mIdx of threeMales) {
                                const comp = compatibleMap.get(maleSlots[mIdx].species);
                                coveredFemaleInstances.forEach((fi, fiIdx) => {
                                    if (comp.has(fi.species)) comp3.add(fiIdx);
                                });
                            }
                            if (comp3.size >= 4) {
                                clusterMaleSet = new Set(threeMales); clusterFemaleSet = comp3;
                                clusterMaleCoords = [{ x: 0.5, y: 0 }, { x: -0.5, y: 0 }, { x: 0, y: -1 }];
                                clusterFemalePositions = [
                                    { x: 1.5, y: 0 }, { x: 1, y: -1 }, { x: -1, y: -1 },
                                    { x: -1.5, y: 0 }, { x: 0, y: -2 }, { x: -0.5, y: 1 }, { x: 0.5, y: 1 },
                                ];
                                break;
                            }
                        }
                        clusterMaleSet = new Set(twoMales); clusterFemaleSet = compFemSet;
                        clusterMaleCoords = [{ x: 0.5, y: 0 }, { x: -0.5, y: 0 }];
                        clusterFemalePositions = [
                            { x: 1, y: -1 }, { x: 1.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
                            { x: -1, y: 1 }, { x: -1.5, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 },
                        ];

                        break;
                    }
                }
            }
        }

        const isCluster = clusterMaleSet !== null;

        // ═══════════════════════════════════════════════════════════
        //  阶段一：聚合坐标固化
        //  将预设的聚合坐标平移到非负区域，封锁周围 3×3 细格
        //  提取聚合雄性/雌性的真实坐标和细网格坐标
        // ═══════════════════════════════════════════════════════════
        let clusterShiftX = 0, clusterShiftY = 0, fixedFemalesFine = null;
        let preOccupiedFine = null;           // 细网格预占用集合
        let clusterFixedMales = null;         // 聚合雄性坐标（真实 + 细网格）

        if (isCluster) {
            const clusterFemArr = [...clusterFemaleSet];
            const clusterAllCoords = [...clusterMaleCoords];
            for (let i = 0; i < Math.min(clusterFemArr.length, clusterFemalePositions.length); i++) {
                clusterAllCoords.push(clusterFemalePositions[i]);
            }
            const cMinX = Math.min(...clusterAllCoords.map(c => c.x));
            const cMinY = Math.min(...clusterAllCoords.map(c => c.y));
            clusterShiftX = cMinX < 0 ? Math.ceil(-cMinX) : 0;
            clusterShiftY = cMinY < 0 ? Math.ceil(-cMinY) : 0;
            const shiftedAll = clusterAllCoords.map(c => ({ x: c.x + clusterShiftX, y: c.y + clusterShiftY }));

            // 细网格 3×3 封锁（保证其他精灵窝不侵入聚合区域）
            preOccupiedFine = clusterToBlockedFineCells(shiftedAll);

            // 提取聚合雄性坐标（同时记录真实坐标和细网格坐标）
            const cmArr = [...clusterMaleSet];
            clusterFixedMales = cmArr.map((cmi, i) => ({
                idx: cmi,
                species: maleSlots[cmi].species,
                fineX: Math.round((clusterMaleCoords[i].x + clusterShiftX) * 2),
                fineY: Math.round((clusterMaleCoords[i].y + clusterShiftY) * 2),
                realX: clusterMaleCoords[i].x + clusterShiftX,
                realY: clusterMaleCoords[i].y + clusterShiftY
            }));

            // 提取聚合雌性的细网格坐标（供子雄性采样倾向用）
            fixedFemalesFine = [];
            for (let i = 0; i < Math.min(clusterFemArr.length, clusterFemalePositions.length); i++) {
                fixedFemalesFine.push({
                    species: coveredFemaleInstances[clusterFemArr[i]].species,
                    fineX: Math.round((clusterFemalePositions[i].x + clusterShiftX) * 2),
                    fineY: Math.round((clusterFemalePositions[i].y + clusterShiftY) * 2)
                });
            }
        }

        // ═══════════════════════════════════════════════════════════
        //  构建子问题：剥离聚合成员，剩余精灵参与第二阶段求解
        // ═══════════════════════════════════════════════════════════
        const subMales = isCluster
            ? males.filter(m => !clusterMaleSet.has(m.idx))
            : males;
        const subFemales = isCluster
            ? coveredFemaleInstances.filter((_, fi) => !clusterFemaleSet.has(fi))
            : coveredFemaleInstances;

        const subMaleCompatCount = new Array(subMales.length).fill(0);
        subFemales.forEach(fi => {
            subMales.forEach(m => {
                if (compatibleMap.get(m.species).has(fi.species)) subMaleCompatCount[m.idx]++;
            });
        });
        const subMaleUniqueCount = new Array(subMales.length).fill(0);
        subFemales.forEach(fi => {
            const compatMales = [];
            subMales.forEach(m => {
                if (compatibleMap.get(m.species).has(fi.species)) compatMales.push(m.idx);
            });
            if (compatMales.length === 1) subMaleUniqueCount[compatMales[0]]++;
        });

        const buildNearbyTargets = (level, compatArr) =>
            subMales.map((_, mi) => compatArr[mi] >= 4 ? Math.min(level, compatArr[mi]) : 0);

        // ═══════════════════════════════════════════════════════════
        //  确定性放置函数（两雄性聚类 / 三雄性聚类）
        // ═══════════════════════════════════════════════════════════

        /** 三雄性聚合：剩余精灵放入 (-0.5,1)(0.5,1)(-1.5,-1)，与聚合雌性有共同蛋组的雄性优先 (-0.5,1) */
        function tryDeterministicPlacement3Male() {
            if (!isCluster || clusterMaleSet.size !== 3) return null;
            const totalRemaining = subMales.length + subFemales.length;
            if (totalRemaining === 0) return { maleCoords: [], femaleCoords: [] };
            if (totalRemaining > 3) return null;

            const shiftX = clusterShiftX, shiftY = clusterShiftY;
            const clusterFemSpecies = new Set();
            for (const fi of clusterFemaleSet) {
                clusterFemSpecies.add(coveredFemaleInstances[fi].species);
            }
            function hasCommonWithClusterFemales(mSpecies) {
                for (const fs of clusterFemSpecies) {
                    if (compatibleMap.get(mSpecies).has(fs)) return true;
                }
                return false;
            }

            const mCoords = new Array(subMales.length);
            const fCoords = new Array(subFemales.length);

            // 雄性排序：与聚合雌性有共同蛋组的排前面
            const maleIdxs = [...Array(subMales.length).keys()].sort((a, b) => {
                const aCommon = hasCommonWithClusterFemales(subMales[a].species) ? 0 : 1;
                const bCommon = hasCommonWithClusterFemales(subMales[b].species) ? 0 : 1;
                return aCommon - bCommon;
            });

            const allSlots = [
                { x: -0.5, y: 1 },  // 优先给与聚合雌性有共同蛋组的雄性
                { x: 0.5, y: 1 },   // 第二雄性
                { x: 0, y: 2 }  // 剩余位置
            ];
            const used = [false, false, false];

            for (let i = 0; i < maleIdxs.length; i++) {
                const slotIdx = i;
                if (slotIdx < 2) {
                    mCoords[maleIdxs[i]] = { x: allSlots[slotIdx].x + shiftX, y: allSlots[slotIdx].y + shiftY };
                    used[slotIdx] = true;
                }
            }

            let fi = 0;
            for (let s = 0; s < allSlots.length && fi < subFemales.length; s++) {
                if (!used[s]) {
                    fCoords[fi] = { x: allSlots[s].x + shiftX, y: allSlots[s].y + shiftY };
                    used[s] = true;
                    fi++;
                }
            }

            return { maleCoords: mCoords, femaleCoords: fCoords };
        }

        /**
         * 两雄性聚合：按三种情况放置剩余精灵窝
         * 情况1：有唯一依赖雄性 + 与聚合雌性无共同蛋组 → 雄性(0,-1)，依赖雌性(-1,-1)(0,-2)
         * 情况2：有唯一依赖雄性 + 与聚合雌性有共同蛋组 → 雄性(-0.5,-1)，依赖雌性(-1.5,-1)(-0.5,-2)
         * 情况3：无唯一依赖雄性 → 雄性优先 (-0.5,-1)(-1.5,-1)，雌性 (-1.5,0)(-1,1)
         */
        function tryDeterministicPlacement2Male() {
            if (!isCluster || clusterMaleSet.size !== 2) return null;
            if (subMales.length === 0 && subFemales.length === 0) return { maleCoords: [], femaleCoords: [] };

            const shiftX = clusterShiftX, shiftY = clusterShiftY;

            const clusterFemSpecies = new Set();
            for (const fi of clusterFemaleSet) {
                clusterFemSpecies.add(coveredFemaleInstances[fi].species);
            }
            function hasCommonWithClusterFemales(mSpecies) {
                for (const fs of clusterFemSpecies) {
                    if (compatibleMap.get(mSpecies).has(fs)) return true;
                }
                return false;
            }

            // 找出唯一依赖雄性（按依赖雌性数量降序）
            const uniqueDepMales = [];
            subMales.forEach((m, mi) => {
                if (subMaleUniqueCount[mi] > 0) uniqueDepMales.push({ mi, count: subMaleUniqueCount[mi], species: m.species });
            });
            uniqueDepMales.sort((a, b) => b.count - a.count);

            if (uniqueDepMales.length > 0) {
                const udm = uniqueDepMales[0];
                const maleHasCommon = hasCommonWithClusterFemales(udm.species);

                const depFemales = [];
                const otherFemales = [];
                subFemales.forEach((fi, fiIdx) => {
                    const compatSubMales = [];
                    subMales.forEach((m, mi) => {
                        if (compatibleMap.get(m.species).has(fi.species)) compatSubMales.push(mi);
                    });
                    if (compatSubMales.length === 1 && compatSubMales[0] === udm.mi) {
                        depFemales.push(fiIdx);
                    } else {
                        otherFemales.push(fiIdx);
                    }
                });

                const otherMales = [];
                subMales.forEach((m, mi) => {
                    if (mi !== udm.mi) otherMales.push(mi);
                });

                const depCount = depFemales.length;
                if (depCount >= 1 && depCount <= 2) {
                    if (otherMales.length > 0) return null;
                    if (otherFemales.length > 2) return null;

                    const mCoords = new Array(subMales.length);
                    const fCoords = new Array(subFemales.length);

                    if (maleHasCommon) {
                        mCoords[udm.mi] = { x: -0.5 + shiftX, y: -1 + shiftY };
                        const slots = [{ x: -1.5, y: -1 }, { x: -0.5, y: -2 }];
                        for (let i = 0; i < depCount; i++) {
                            fCoords[depFemales[i]] = { x: slots[i].x + shiftX, y: slots[i].y + shiftY };
                        }
                    } else {
                        mCoords[udm.mi] = { x: 0 + shiftX, y: -1 + shiftY };
                        const slots = [{ x: -1, y: -1 }, { x: 0, y: -2 }];
                        for (let i = 0; i < depCount; i++) {
                            fCoords[depFemales[i]] = { x: slots[i].x + shiftX, y: slots[i].y + shiftY };
                        }
                    }
                    const otherSlots = [{ x: -1, y: 1 }, { x: -1.5, y: 0 }];
                    for (let i = 0; i < otherFemales.length; i++) {
                        fCoords[otherFemales[i]] = { x: otherSlots[i].x + shiftX, y: otherSlots[i].y + shiftY };
                    }
                    return { maleCoords: mCoords, femaleCoords: fCoords };
                }

                if (depCount === 3) {
                    if (otherMales.length > 0) return null;
                    if (otherFemales.length > 0) return null;

                    const mCoords = new Array(subMales.length);
                    const fCoords = new Array(subFemales.length);
                    mCoords[udm.mi] = { x: -1.5 + shiftX, y: 0 + shiftY };
                    const slots = [{ x: -1.5, y: -1 }, { x: -2.5, y: 0 }, { x: -1.5, y: 1 }];
                    for (let i = 0; i < 3; i++) {
                        fCoords[depFemales[i]] = { x: slots[i].x + shiftX, y: slots[i].y + shiftY };
                    }
                    return { maleCoords: mCoords, femaleCoords: fCoords };
                }

                return null;
            }

            // 情况4：只剩一个雄性、没有雌性 → 放在 (0, 2)
            if (subMales.length === 1 && subFemales.length === 0) {
                const mCoords = new Array(1);
                mCoords[0] = { x: 0 + shiftX, y: 2 + shiftY };
                return { maleCoords: mCoords, femaleCoords: [] };
            }

            // 情况3：无唯一依赖雄性，剩余 ≤ 4 个
            if (subMales.length + subFemales.length > 4) return null;


            const mCoords = new Array(subMales.length);
            const fCoords = new Array(subFemales.length);

            const sortedMaleIdxs = [...Array(subMales.length).keys()].sort((a, b) => {
                const aCommon = hasCommonWithClusterFemales(subMales[a].species) ? 0 : 1;
                const bCommon = hasCommonWithClusterFemales(subMales[b].species) ? 0 : 1;
                return aCommon - bCommon;
            });
            const malePlaceSlots = [{ x: -0.5, y: -1 }, { x: -1.5, y: -1 }];
            for (let i = 0; i < sortedMaleIdxs.length; i++) {
                mCoords[sortedMaleIdxs[i]] = { x: malePlaceSlots[i].x + shiftX, y: malePlaceSlots[i].y + shiftY };
            }
            const femalePlaceSlots = [{ x: -1.5, y: 0 }, { x: -1, y: 1 }];
            for (let i = 0; i < subFemales.length; i++) {
                fCoords[i] = { x: femalePlaceSlots[i].x + shiftX, y: femalePlaceSlots[i].y + shiftY };
            }
            return { maleCoords: mCoords, femaleCoords: fCoords };
        }

        // ═══════════════════════════════════════════════════════════
        //  阶段二：根据是否聚合走不同求解器
        // ═══════════════════════════════════════════════════════════
        let best = null, bestArea = Infinity, found = 0;
        const strategyList = [{ strict: true, level: 3 }, { strict: true, level: 2 }, { strict: false, level: 3 }, { strict: false, level: 2 }];
        const solveAttempts = (subMales.length + subFemales.length) > 7 ? 3 : 1;

        if (isCluster) {
            // ── 聚合模式 ──

            // 优先尝试确定性固定位置放置（2雄性 / 3雄性）
            if (clusterMaleSet.size === 2) {
                const detPl = tryDeterministicPlacement2Male();
                if (detPl) { best = detPl; bestArea = 0; found = 999; }
            }
            if (!best && clusterMaleSet.size === 3) {
                const detPl = tryDeterministicPlacement3Male();
                if (detPl) { best = detPl; bestArea = 0; found = 999; }
            }

            // 确定性失败 → 回退到细网格随机求解
            if (!best) {
                // 预计算每个子雄性是否有唯一依赖雌性
                const maleHasUniqueDep = new Array(subMales.length).fill(false);
                subFemales.forEach(fi => {
                    const fMales = [];
                    subMales.forEach(m => {
                        if (compatibleMap.get(m.species).has(fi.species)) fMales.push(m.idx);
                    });
                    if (fMales.length === 1) maleHasUniqueDep[fMales[0]] = true;
                });

                /** 聚合模式：为每个子雌性构建约束（细网格单位） */
                const createFemalesSubFine = (strictMode, femList, compatArr, uniqueArr) =>
                    femList.map((fi, idx) => {
                        const fMales = [];
                        subMales.forEach(m => {
                            if (compatibleMap.get(m.species).has(fi.species)) fMales.push(m.idx);
                        });
                        if (fMales.length === 0) return null;
                        const stepLimit = Math.min(fMales.length, 2);
                        const isUniqueDep = (fMales.length === 1);
                        const constraints = fMales.map(mi => {
                            let minDist = 2;
                            let maxDist, maxDistLoose;
                            if (isUniqueDep) {
                                // 唯依：曼哈顿 ≤ 1格（Chebyshev = 1）
                                maxDist = 2; maxDistLoose = undefined;
                            } else if (maleHasUniqueDep[mi]) {
                                // 该雄性有唯一依赖雌性 → 不收紧
                                maxDist = 4; maxDistLoose = undefined;
                            } else {
                                // 无唯一依赖：优先曼哈顿 ≤ 1格，不行放宽到 ≤ 2格
                                maxDist = 2; maxDistLoose = 4;
                            }
                            if (compatArr[mi] >= 4) {
                                maxDist = Math.max(maxDist, 8);
                                if (maxDistLoose !== undefined) maxDistLoose = Math.max(maxDistLoose, 8);
                            }
                            if (uniqueArr[mi] > 0 && !isUniqueDep) {
                                minDist = Math.max(minDist, 4);
                            }
                            const c = { maleIdx: mi, minDist, maxDist, isFixed: false };
                            if (maxDistLoose !== undefined) c.maxDistLoose = maxDistLoose;
                            return c;
                        });
                        // 追加对聚合雄性的约束（如果兼容）：曼哈顿 ≤ 4格
                        if (clusterFixedMales) {
                            for (const fm of clusterFixedMales) {
                                if (compatibleMap.get(fm.species).has(fi.species)) {
                                    constraints.push({
                                        isFixed: true,
                                        fixedX: fm.fineX, fixedY: fm.fineY,
                                        minDist: 2, maxDist: 8
                                    });
                                }
                            }
                        }
                        return { id: fi.id, species: fi.species, males: fMales, stepLimit, constraints, idx, isShiny: fi.isShiny };
                    }).filter(f => f !== null);

                // 多策略尝试
                for (const strategy of strategyList) {
                    const targets = buildNearbyTargets(strategy.level, subMaleCompatCount);
                    const fem = createFemalesSubFine(strategy.strict, subFemales, subMaleCompatCount, subMaleUniqueCount);
                    for (let t = 0; t < 200 && found < solveAttempts; t++) {
                        let pl = solvePlacementFine(fem, subMales, targets, subMaleCompatCount, subMaleUniqueCount, preOccupiedFine, fixedFemalesFine);
                        if (pl) {
                            found++;
                            let minX = GRID_SIZE, maxX = 0, minY = GRID_SIZE, maxY = 0;
                            pl.maleCoords.forEach(c => { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y); });
                            pl.femaleCoords.forEach(c => { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y); });
                            const area = (maxX - minX + 1) * (maxY - minY + 1);
                            if (area < bestArea) { bestArea = area; best = pl; }
                        }
                    }
                    if (best) break;
                }

                // 聚合 fallback：仅封锁聚合坐标自身 3×3 细格（最小封锁）
                if (!best && preOccupiedFine) {
                    const minimalOccupied = new Set();
                    for (const fm of clusterFixedMales) {
                        for (let dfx = -1; dfx <= 1; dfx++) {
                            for (let dfy = -1; dfy <= 1; dfy++) {
                                const nfx = fm.fineX + dfx, nfy = fm.fineY + dfy;
                                if (nfx >= 0 && nfx <= FINE_GRID && nfy >= 0 && nfy <= FINE_GRID) {
                                    minimalOccupied.add(nfy * (FINE_GRID + 1) + nfx);
                                }
                            }
                        }
                    }
                    if (fixedFemalesFine) {
                        for (const ff of fixedFemalesFine) {
                            for (let dfx = -1; dfx <= 1; dfx++) {
                                for (let dfy = -1; dfy <= 1; dfy++) {
                                    const nfx = ff.fineX + dfx, nfy = ff.fineY + dfy;
                                    if (nfx >= 0 && nfx <= FINE_GRID && nfy >= 0 && nfy <= FINE_GRID) {
                                        minimalOccupied.add(nfy * (FINE_GRID + 1) + nfx);
                                    }
                                }
                            }
                        }
                    }
                    for (const strategy of strategyList) {
                        const targets = buildNearbyTargets(strategy.level, subMaleCompatCount);
                        const fem = createFemalesSubFine(strategy.strict, subFemales, subMaleCompatCount, subMaleUniqueCount);
                        for (let t = 0; t < 200 && found < solveAttempts; t++) {
                            let pl = solvePlacementFine(fem, subMales, targets, subMaleCompatCount, subMaleUniqueCount, minimalOccupied, fixedFemalesFine);
                            if (pl) {
                                found++;
                                let minX = GRID_SIZE, maxX = 0, minY = GRID_SIZE, maxY = 0;
                                pl.maleCoords.forEach(c => { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y); });
                                pl.femaleCoords.forEach(c => { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y); });
                                const area = (maxX - minX + 1) * (maxY - minY + 1);
                                if (area < bestArea) { bestArea = area; best = pl; }
                            }
                        }
                        if (best) break;
                    }
                }
            }
        } else {
            // ── 非聚合模式：原有整数格求解器 ──
            const createFemalesSub = (strictMode, femList, compatArr, uniqueArr) =>
                femList.map((fi, idx) => {
                    const fMales = [];
                    subMales.forEach(m => {
                        if (compatibleMap.get(m.species).has(fi.species)) fMales.push(m.idx);
                    });
                    if (fMales.length === 0) return null;
                    const stepLimit = Math.min(fMales.length, 2);
                    const constraints = fMales.map(mi => {
                        let minDist = 1, maxDist = stepLimit;
                        const isUniqueDep = (fMales.length === 1 && fMales[0] === mi);
                        if (isUniqueDep) {
                            maxDist = Math.max(maxDist, 2);
                        } else if (compatArr[mi] >= 4) {
                            maxDist = Math.max(maxDist, 4);

                        }
                        if (uniqueArr[mi] > 0 && !isUniqueDep) minDist = Math.max(minDist, 2);
                        return { maleIdx: mi, minDist, maxDist };
                    });
                    return { id: fi.id, species: fi.species, males: fMales, stepLimit, constraints, idx, isShiny: fi.isShiny };
                }).filter(f => f !== null);

            for (const strategy of strategyList) {
                const targets = buildNearbyTargets(strategy.level, subMaleCompatCount);
                const fem = createFemalesSub(strategy.strict, subFemales, subMaleCompatCount, subMaleUniqueCount);
                for (let t = 0; t < 200 && found < solveAttempts; t++) {
                    let pl = solvePlacement(fem, subMales, targets, subMaleCompatCount, subMaleUniqueCount, null);
                    if (pl) {
                        pl = compactPlacement(pl); found++;
                        let minX = GRID_SIZE, maxX = 0, minY = GRID_SIZE, maxY = 0;
                        pl.maleCoords.forEach(c => { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y); });
                        pl.femaleCoords.forEach(c => { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y); });
                        const area = (maxX - minX + 1) * (maxY - minY + 1);
                        if (area < bestArea) { bestArea = area; best = pl; }
                    }
                }
                if (best) break;
            }
        }

        // ── 空结果处理 ──
        if (!best && subMales.length + subFemales.length === 0) {
            best = { maleCoords: [], femaleCoords: [] };
        } else if (!best) return;

        // ═══════════════════════════════════════════════════════════
        //  合并聚合坐标与子问题坐标
        // ═══════════════════════════════════════════════════════════
        if (isCluster) {
            const mergedMaleCoords = new Array(males.length);
            subMales.forEach((m, i) => { mergedMaleCoords[m.idx] = best.maleCoords[i]; });
            clusterFixedMales.forEach(fm => {
                mergedMaleCoords[fm.idx] = { x: fm.realX, y: fm.realY };
            });

            const mergedFemaleCoords = new Array(coveredFemaleInstances.length);
            subFemales.forEach((_, i) => {
                const origIdx = coveredFemaleInstances.indexOf(subFemales[i]);
                mergedFemaleCoords[origIdx] = best.femaleCoords[i];
            });
            const clusterFemArr = [...clusterFemaleSet];
            clusterFemArr.forEach((fi, i) => {
                if (i < clusterFemalePositions.length) {
                    mergedFemaleCoords[fi] = {
                        x: clusterFemalePositions[i].x + clusterShiftX,
                        y: clusterFemalePositions[i].y + clusterShiftY
                    };
                }
            });

            best = compactPlacement({ maleCoords: mergedMaleCoords, femaleCoords: mergedFemaleCoords });
        }

        best = centerPlacement(best);
        currentPlacement = {
            maleCoords: best.maleCoords,
            femaleCoords: best.femaleCoords,
            maleSlots: maleSlots,
            femaleInstances: coveredFemaleInstances
        };
        originalPlacement = {
            maleCoords: best.maleCoords.map(c => ({ ...c })),
            femaleCoords: best.femaleCoords.map(c => ({ ...c }))
        };
        placementArea.style.display = 'block';
        renderSVG();
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║          十四、位图后处理工具                                  ║
    // ╚══════════════════════════════════════════════════════════════╝

    /** 将所有坐标平移至原点 */
    function compactPlacement(pl) {
        if (!pl || (pl.maleCoords.length === 0 && pl.femaleCoords.length === 0)) return pl;
        const all = [...pl.maleCoords, ...pl.femaleCoords];
        const minX = Math.min(...all.map(c => c.x)), minY = Math.min(...all.map(c => c.y));
        return { maleCoords: pl.maleCoords.map(c => ({ x: c.x - minX, y: c.y - minY })), femaleCoords: pl.femaleCoords.map(c => ({ x: c.x - minX, y: c.y - minY })) };
    }

    /** 将所有坐标平移到网格居中位置 */
    function centerPlacement(pl) {
        if (!pl || (pl.maleCoords.length === 0 && pl.femaleCoords.length === 0)) return pl;
        const all = [...pl.maleCoords, ...pl.femaleCoords];
        const minX = Math.min(...all.map(c => c.x)), maxX = Math.max(...all.map(c => c.x));
        const minY = Math.min(...all.map(c => c.y)), maxY = Math.max(...all.map(c => c.y));
        const w = maxX - minX + 1, h = maxY - minY + 1;
        const offX = Math.round((GRID_SIZE - w + 1) / 2) - minX, offY = Math.round((GRID_SIZE - h + 1) / 2) - minY;
        return { maleCoords: pl.maleCoords.map(c => ({ x: c.x + offX, y: c.y + offY })), femaleCoords: pl.femaleCoords.map(c => ({ x: c.x + offX, y: c.y + offY })) };
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║          十五、非聚合模式求解器（整数网格）                     ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * 整数网格求解器：
     * - 雄性随机采样（优先中心位置）
     * - 雌性通过 tryPlace 深度优先搜索满足距离约束的候选
     * - 使用 canStillMeetTargets 剪枝
     */
    function solvePlacement(females, males, maleNearbyTargets, maleCompatCount, maleUniqueCount, preOccupied = null) {
        const M = males.length;
        const GRID_SIZE = 7;

        function canStillMeetTargets(placedFemales, remainingFemales, maleCoords, malesArr, targets) {
            for (let mi = 0; mi < malesArr.length; mi++) {
                const target = targets[mi];
                if (target > 0) {
                    let currentNearby = 0;
                    for (const fi of placedFemales) {
                        const dist = Math.abs(fi.coord.x - maleCoords[mi].x) + Math.abs(fi.coord.y - maleCoords[mi].y);
                        if (dist <= 2 && compatibleMap.get(malesArr[mi].species).has(fi.species)) currentNearby++;
                    }
                    let potentialMax = 0;
                    for (const fi of remainingFemales) if (compatibleMap.get(malesArr[mi].species).has(fi.species)) potentialMax++;
                    if (currentNearby + potentialMax < target) return false;
                }
            }
            return true;
        }

        function tryPlace(sorted, start, occupied, maleCoords) {
            if (start >= sorted.length) return true;
            const f = sorted[start];
            const cand = [];
            for (let y = 0; y < GRID_SIZE; y++) {
                for (let x = 0; x < GRID_SIZE; x++) {
                    const key = y * GRID_SIZE + x;
                    if (occupied.has(key)) continue;
                    let ok = true;
                    for (const c of f.constraints) {
                        const mx = maleCoords[c.maleIdx].x, my = maleCoords[c.maleIdx].y;
                        const dist = Math.abs(x - mx) + Math.abs(y - my);
                        if (dist < c.minDist || dist > c.maxDist) { ok = false; break; }
                    }
                    if (ok) cand.push({ x, y });
                }
            }
            if (cand.length === 0) return false;
            cand.sort((a, b) => {
                const dA = f.constraints.reduce((s, c) => s + Math.abs(a.x - maleCoords[c.maleIdx].x) + Math.abs(a.y - maleCoords[c.maleIdx].y), 0);
                const dB = f.constraints.reduce((s, c) => s + Math.abs(b.x - maleCoords[c.maleIdx].x) + Math.abs(b.y - maleCoords[c.maleIdx].y), 0);
                return dA - dB;
            });
            for (const p of cand) {
                const key = p.y * GRID_SIZE + p.x;
                occupied.add(key);
                f.coord = p;
                const placed = sorted.slice(0, start + 1);
                const remaining = sorted.slice(start + 1);
                if (canStillMeetTargets(placed, remaining, maleCoords, males, maleNearbyTargets) && tryPlace(sorted, start + 1, occupied, maleCoords)) {
                    return true;
                }
                occupied.delete(key);
            }
            return false;
        }

        const useCenterBias = (M <= 2);
        const centerPositions = [];
        for (let y = 2; y <= 4; y++) {
            for (let x = 2; x <= 4; x++) {
                centerPositions.push({ x, y });
            }
        }

        for (let att = 0; att < 3000; att++) {
            const maleCoords = new Array(M);
            const occupied = preOccupied ? new Set(preOccupied) : new Set();
            let fail = false;

            const indices = [...Array(M).keys()].sort((a, b) => {
                const aU = maleUniqueCount[a] > 0, bU = maleUniqueCount[b] > 0;
                if (aU !== bU) return aU ? 1 : -1;
                if (aU) return maleCompatCount[b] - maleCompatCount[a];
                return maleCompatCount[a] - maleCompatCount[b];
            });

            for (const mi of indices) {
                let x, y;
                let tries = 0;
                if (useCenterBias && (maleUniqueCount[mi] > 0 || maleCompatCount[mi] >= 4)) {
                    const availableCenters = centerPositions.filter(p => !occupied.has(p.y * GRID_SIZE + p.x));
                    if (availableCenters.length > 0) {
                        const rand = Math.floor(Math.random() * availableCenters.length);
                        x = availableCenters[rand].x;
                        y = availableCenters[rand].y;
                    } else {
                        do { x = Math.floor(Math.random() * GRID_SIZE); y = Math.floor(Math.random() * GRID_SIZE); tries++; } while (occupied.has(y * GRID_SIZE + x) && tries < 100);
                    }
                } else {
                    do { x = Math.floor(Math.random() * GRID_SIZE); y = Math.floor(Math.random() * GRID_SIZE); tries++; } while (occupied.has(y * GRID_SIZE + x) && tries < 100);
                }
                if (tries >= 100) { fail = true; break; }
                occupied.add(y * GRID_SIZE + x);
                maleCoords[mi] = { x, y };
            }
            if (fail) continue;

            const malePositionOrder = new Array(M);
            indices.forEach((mi, pos) => { malePositionOrder[mi] = pos; });
            const sorted = [...females].sort((a, b) => {
                const aU = a.males.length === 1, bU = b.males.length === 1;
                if (aU !== bU) return aU ? 1 : -1;
                if (aU) return malePositionOrder[a.males[0]] - malePositionOrder[b.males[0]];
                if (a.stepLimit !== b.stepLimit) return a.stepLimit - b.stepLimit;
                if (a.males.length !== b.males.length) return a.males.length - b.males.length;
                const minA = Math.min(...a.males.map(mi => maleCompatCount[mi]));
                const minB = Math.min(...b.males.map(mi => maleCompatCount[mi]));
                return minA - minB;
            });

            const occCopy = new Set(occupied);
            if (tryPlace(sorted, 0, occCopy, maleCoords)) {
                sorted.forEach(f => {
                    const orig = females.find(e => e.id === f.id);
                    if (orig) orig.coord = f.coord;
                });
                return { maleCoords, femaleCoords: females.map(f => f.coord) };
            }
        }
        return null;
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║          十六、聚合模式求解器（细网格 / 半格精度）               ║
    // ╚══════════════════════════════════════════════════════════════╝

    /**
     * 细网格求解器（独立于 solvePlacement）：
     * - 所有坐标在 FINE_GRID（14×14）细网格上采样
     * - 雄性放置后封锁 3×3 细格（保证 Chebyshev ≥ 1 格）
     * - 子雄性和聚合雌性兼容时，强制在聚合雌性曼哈顿 ≤ 4 细格内采样
     * - 雌性支持 tight → loose 约束回退
     */
    function solvePlacementFine(females, freeMales, maleNearbyTargets, maleCompatCount, maleUniqueCount, preOccupied, fixedFemalesFine) {
        const M = freeMales.length;
        const GRID = FINE_GRID;
        const gridMin = 1;
        const gridMax = FINE_GRID - 1;
        const keyStride = FINE_GRID + 1;
        const nearbyRange = 4;       // 曼哈顿 ≤ 4 细格 = 2 格
        const chebyshevBlockR = 1;   // 封锁 Chebyshev ≤ 1 细格 → 真实 Chebyshev ≥ 1

        function isOccupied(occupied, gx, gy) {
            return occupied.has(gy * keyStride + gx);
        }
        function blockChebyshev(occupied, gx, gy, r) {
            for (let dfx = -r; dfx <= r; dfx++) {
                for (let dfy = -r; dfy <= r; dfy++) {
                    const nx = gx + dfx, ny = gy + dfy;
                    if (nx >= gridMin && nx <= gridMax && ny >= gridMin && ny <= gridMax) {
                        occupied.add(ny * keyStride + nx);
                    }
                }
            }
        }
        function unblockChebyshev(occupied, gx, gy, r) {
            for (let dfx = -r; dfx <= r; dfx++) {
                for (let dfy = -r; dfy <= r; dfy++) {
                    const nx = gx + dfx, ny = gy + dfy;
                    if (nx >= gridMin && nx <= gridMax && ny >= gridMin && ny <= gridMax) {
                        occupied.delete(ny * keyStride + nx);
                    }
                }
            }
        }

        /** 获取聚合雌性周围曼哈顿 ≤ range 细格的可用候选（去重） */
        function getFixedFemaleCandidates(occupied, mSpecies, range) {
            if (!fixedFemalesFine || fixedFemalesFine.length === 0) return null;
            const candidates = [];
            for (const ff of fixedFemalesFine) {
                if (!compatibleMap.get(mSpecies).has(ff.species)) continue;
                for (let dfx = -range; dfx <= range; dfx++) {
                    const remain = range - Math.abs(dfx);
                    for (let dfy = -remain; dfy <= remain; dfy++) {
                        const nx = ff.fineX + dfx, ny = ff.fineY + dfy;
                        if (nx >= gridMin && nx <= gridMax && ny >= gridMin && ny <= gridMax) {
                            if (!isOccupied(occupied, nx, ny)) {
                                candidates.push({ x: nx, y: ny });
                            }
                        }
                    }
                }
            }
            return candidates.length > 0 ? candidates : null;
        }

        function canStillMeetTargets(placedFemales, remainingFemales, maleCoords, malesArr, targets) {
            for (let mi = 0; mi < malesArr.length; mi++) {
                const target = targets[mi];
                if (target > 0) {
                    let currentNearby = 0;
                    for (const fi of placedFemales) {
                        const dist = Math.abs(fi.coord.x - maleCoords[mi].x) + Math.abs(fi.coord.y - maleCoords[mi].y);
                        if (dist <= nearbyRange && compatibleMap.get(malesArr[mi].species).has(fi.species)) currentNearby++;
                    }
                    let potentialMax = 0;
                    for (const fi of remainingFemales) if (compatibleMap.get(malesArr[mi].species).has(fi.species)) potentialMax++;
                    if (currentNearby + potentialMax < target) return false;
                }
            }
            return true;
        }

        /** 生成雌性的候选位置（支持 tight / loose 约束） */
        function getCandidatesForFemale(f, maleCoords, occupied, useLoose) {
            const cand = [];
            for (let gy = gridMin; gy <= gridMax; gy++) {
                for (let gx = gridMin; gx <= gridMax; gx++) {
                    if (isOccupied(occupied, gx, gy)) continue;
                    let ok = true;
                    for (const c of f.constraints) {
                        let mx, my;
                        if (c.isFixed) {
                            mx = c.fixedX; my = c.fixedY;
                        } else {
                            mx = maleCoords[c.maleIdx].x; my = maleCoords[c.maleIdx].y;
                        }
                        const dist = Math.abs(gx - mx) + Math.abs(gy - my);
                        const maxD = (useLoose && c.maxDistLoose !== undefined) ? c.maxDistLoose : c.maxDist;
                        if (dist < c.minDist || dist > maxD) { ok = false; break; }
                    }
                    if (ok) cand.push({ x: gx, y: gy });
                }
            }
            return cand;
        }

        function tryPlace(sorted, start, occupied, maleCoords) {
            if (start >= sorted.length) return true;
            const f = sorted[start];

            let cand = getCandidatesForFemale(f, maleCoords, occupied, false);
            if (cand.length === 0 && f.constraints.some(c => c.maxDistLoose !== undefined)) {
                cand = getCandidatesForFemale(f, maleCoords, occupied, true);
            }

            if (cand.length === 0) return false;

            cand.sort((a, b) => {
                const dA = f.constraints.reduce((s, c) => {
                    const mx = c.isFixed ? c.fixedX : maleCoords[c.maleIdx].x;
                    const my = c.isFixed ? c.fixedY : maleCoords[c.maleIdx].y;
                    return s + Math.abs(a.x - mx) + Math.abs(a.y - my);
                }, 0);
                const dB = f.constraints.reduce((s, c) => {
                    const mx = c.isFixed ? c.fixedX : maleCoords[c.maleIdx].x;
                    const my = c.isFixed ? c.fixedY : maleCoords[c.maleIdx].y;
                    return s + Math.abs(b.x - mx) + Math.abs(b.y - my);
                }, 0);
                return dA - dB;
            });

            for (const p of cand) {
                blockChebyshev(occupied, p.x, p.y, chebyshevBlockR);
                f.coord = p;
                const placed = sorted.slice(0, start + 1);
                const remaining = sorted.slice(start + 1);
                if (canStillMeetTargets(placed, remaining, maleCoords, freeMales, maleNearbyTargets)
                    && tryPlace(sorted, start + 1, occupied, maleCoords)) {
                    return true;
                }
                unblockChebyshev(occupied, p.x, p.y, chebyshevBlockR);
            }
            return false;
        }

        const useCenterBias = (M <= 2);
        const centerPositions = [];
        for (let gy = 2; gy <= FINE_GRID - 2; gy++) {
            for (let gx = 2; gx <= FINE_GRID - 2; gx++) {
                centerPositions.push({ x: gx, y: gy });
            }
        }

        for (let att = 0; att < 3000; att++) {
            const maleCoords = new Array(M);
            const occupied = preOccupied ? new Set(preOccupied) : new Set();
            let fail = false;

            const indices = [...Array(M).keys()].sort((a, b) => {
                const aU = maleUniqueCount[a] > 0, bU = maleUniqueCount[b] > 0;
                if (aU !== bU) return aU ? 1 : -1;
                if (aU) return maleCompatCount[b] - maleCompatCount[a];
                return maleCompatCount[a] - maleCompatCount[b];
            });

            for (const mi of indices) {
                const mSpecies = freeMales[mi].species;
                let gx, gy;
                let tries = 0;
                let placed = false;

                // 检查是否和聚合雌性兼容 → 强制就近采样
                const hasCompatFixedFemale = fixedFemalesFine && fixedFemalesFine.some(ff => compatibleMap.get(mSpecies).has(ff.species));

                if (hasCompatFixedFemale) {
                    let range = 4;
                    while (range <= 6 && !placed) {
                        const biasCands = getFixedFemaleCandidates(occupied, mSpecies, range);
                        if (biasCands && biasCands.length > 0) {
                            const dedup = new Map();
                            for (const c of biasCands) dedup.set(c.y * keyStride + c.x, c);
                            const uniq = [...dedup.values()];
                            const rand = Math.floor(Math.random() * Math.min(uniq.length, 30));
                            gx = uniq[rand].x;
                            gy = uniq[rand].y;
                            placed = true;
                        } else {
                            range += 2; // 4 → 6 再试
                        }
                    }
                    if (!placed) {
                        // 聚合雌性周围被占满，本次尝试失败
                        fail = true; break;
                    }
                } else if (useCenterBias && (maleUniqueCount[mi] > 0 || maleCompatCount[mi] >= 4)) {
                    // 无兼容聚合雌性 → 中心偏向
                    const availableCenters = centerPositions.filter(p => !isOccupied(occupied, p.x, p.y));
                    if (availableCenters.length > 0) {
                        const rand = Math.floor(Math.random() * availableCenters.length);
                        gx = availableCenters[rand].x;
                        gy = availableCenters[rand].y;
                        placed = true;
                    }
                }

                if (!placed) {
                    // 纯随机采样（跳过已占用格子）
                    do {
                        gx = 1 + Math.floor(Math.random() * (FINE_GRID - 1));
                        gy = 1 + Math.floor(Math.random() * (FINE_GRID - 1));
                        tries++;
                    } while (isOccupied(occupied, gx, gy) && tries < 200);
                    if (tries >= 200) { fail = true; break; }
                }

                // 雄性放置后封锁 Chebyshev ≤ 1 细格（保证雄性之间不重叠）
                blockChebyshev(occupied, gx, gy, chebyshevBlockR);
                maleCoords[mi] = { x: gx, y: gy };
            }
            if (fail) continue;

            // 雄性放置顺序记录（用于雌性排序）
            const malePositionOrder = new Array(M);
            indices.forEach((mi, pos) => { malePositionOrder[mi] = pos; });
            const sorted = [...females].sort((a, b) => {
                const aU = a.males.length === 1, bU = b.males.length === 1;
                if (aU !== bU) return aU ? 1 : -1;
                if (aU) return malePositionOrder[a.males[0]] - malePositionOrder[b.males[0]];
                if (a.stepLimit !== b.stepLimit) return a.stepLimit - b.stepLimit;
                if (a.males.length !== b.males.length) return a.males.length - b.males.length;
                const minA = Math.min(...a.males.map(mi => maleCompatCount[mi]));
                const minB = Math.min(...b.males.map(mi => maleCompatCount[mi]));
                return minA - minB;
            });

            const occCopy = new Set(occupied);
            if (tryPlace(sorted, 0, occCopy, maleCoords)) {
                sorted.forEach(f => {
                    const orig = females.find(e => e.id === f.id);
                    if (orig) orig.coord = f.coord;
                });
                // 细网格坐标 ÷2 → 真实半格坐标
                return {
                    maleCoords: maleCoords.map(c => ({ x: c.x / 2, y: c.y / 2 })),
                    femaleCoords: females.map(f => ({ x: f.coord.x / 2, y: f.coord.y / 2 }))
                };
            }
        }
        return null;
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║          十七、半格坐标的最近空闲搜索                            ║
    // ╚══════════════════════════════════════════════════════════════╝

    /** 在占用集合中找到离期望坐标曼哈顿最近的空闲细格交点（BFS） */
    function findNearestFreePositionHalf(desiredX, desiredY, occupiedSet) {
        const fineX = Math.round(desiredX * 2);
        const fineY = Math.round(desiredY * 2);
        const fineKey = fineY * (FINE_GRID + 1) + fineX;
        if (!occupiedSet.has(fineKey)) {
            return { x: fineX / 2, y: fineY / 2 };
        }
        const maxFineDist = 8;
        const queue = [{ fx: fineX, fy: fineY, dist: 0 }];
        const visited = new Set([fineKey]);
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (let head = 0; head < queue.length; head++) {
            const { fx, fy, dist } = queue[head];
            if (dist >= maxFineDist) continue;
            for (const [dx, dy] of dirs) {
                const nfx = fx + dx;
                const nfy = fy + dy;
                if (nfx < 1 || nfx > FINE_GRID - 1 || nfy < 1 || nfy > FINE_GRID - 1) continue;
                const nk = nfy * (FINE_GRID + 1) + nfx;
                if (visited.has(nk)) continue;
                visited.add(nk);
                if (!occupiedSet.has(nk)) {
                    return { x: nfx / 2, y: nfy / 2 };
                }
                queue.push({ fx: nfx, fy: nfy, dist: dist + 1 });
            }
        }
        return null;
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║          十八、SVG 渲染（位置图 + 连线 + 拖动）                  ║
    // ╚══════════════════════════════════════════════════════════════╝

    function renderSVG() {
        svgContainer.innerHTML = '';
        const scale = 60;
        const width = GRID_SIZE * scale;
        const height = GRID_SIZE * scale;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.style.width = '100%'; svg.style.height = 'auto';
        svg.style.touchAction = 'none'; svg.style.userSelect = 'none'; svg.style.webkitUserSelect = 'none';

        // 14×14 细网格线
        for (let i = 0; i <= FINE_GRID; i++) {
            const pos = i * (scale / 2);
            const lh = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            lh.setAttribute('x1', 0); lh.setAttribute('y1', pos);
            lh.setAttribute('x2', width); lh.setAttribute('y2', pos);
            lh.setAttribute('stroke', '#d4b68c'); lh.setAttribute('stroke-width', '1');
            svg.appendChild(lh);
            const lv = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            lv.setAttribute('x1', pos); lv.setAttribute('y1', 0);
            lv.setAttribute('x2', pos); lv.setAttribute('y2', height);
            lv.setAttribute('stroke', '#d4b68c'); lv.setAttribute('stroke-width', '1');
            svg.appendChild(lv);
        }

        const linesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        svg.appendChild(linesGroup);
        const squaresGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        svg.appendChild(squaresGroup);

        function toCenterX(x) { return x * scale; }
        function toCenterY(y) { return y * scale; }

        /** 连线绘制：曼哈顿 ≤ 2.5 且 切比雪夫 ≤ 2 的兼容雌雄之间画线 */
        function drawLines() {
            linesGroup.innerHTML = '';
            const { maleCoords, femaleCoords, maleSlots, femaleInstances } = currentPlacement;
            maleCoords.forEach((mc, mi) => {
                const comp = compatibleMap.get(maleSlots[mi].species);
                femaleCoords.forEach((fc, fi) => {
                    if (!comp.has(femaleInstances[fi].species)) return;
                    const dx = Math.abs(mc.x - fc.x);
                    const dy = Math.abs(mc.y - fc.y);
                    if (dx + dy > 2.5 || Math.max(dx, dy) > 2) return;
                    const from = maleCoords[mi], to = femaleCoords[fi];
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', toCenterX(from.x));
                    line.setAttribute('y1', toCenterY(from.y));
                    line.setAttribute('x2', toCenterX(to.x));
                    line.setAttribute('y2', toCenterY(to.y));
                    line.setAttribute('stroke', '#4a8');
                    line.setAttribute('stroke-width', '2.5');
                    line.setAttribute('opacity', '0.7');
                    linesGroup.appendChild(line);
                });
            });
        }

        /** 绘制精灵窝方块（雌性粉色、雄性蓝色）+ 名称标签 */
        function drawSquares() {
            squaresGroup.innerHTML = '';
            const { maleCoords, femaleCoords, maleSlots, femaleInstances } = currentPlacement;
            const rectWidth = scale - 4, rectHeight = scale - 4;

            femaleCoords.forEach((coord, i) => {
                const fi = femaleInstances[i];
                if (!fi) return;
                const cx = toCenterX(coord.x), cy = toCenterY(coord.y);
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', cx - rectWidth / 2);
                rect.setAttribute('y', cy - rectHeight / 2);
                rect.setAttribute('width', rectWidth);
                rect.setAttribute('height', rectHeight);
                rect.setAttribute('fill', 'rgba(248,200,200,0.8)');
                rect.setAttribute('stroke', '#d89b9b');
                rect.setAttribute('stroke-width', '2');
                rect.setAttribute('rx', '6');
                rect.classList.add('female-square');
                rect.dataset.type = 'female';
                rect.dataset.index = i;
                squaresGroup.appendChild(rect);

                const iconText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                iconText.setAttribute('x', cx); iconText.setAttribute('y', cy - 7);
                iconText.setAttribute('text-anchor', 'middle');
                iconText.setAttribute('fill', '#8b3a3a');
                iconText.setAttribute('font-size', '14');
                iconText.textContent = '♀️';
                iconText.setAttribute('pointer-events', 'none');
                iconText.style.userSelect = 'none';
                squaresGroup.appendChild(iconText);

                const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                nameText.setAttribute('x', cx); nameText.setAttribute('y', cy + 11);
                nameText.setAttribute('text-anchor', 'middle');
                nameText.setAttribute('fill', '#8b3a3a');
                nameText.setAttribute('font-size', '10');
                nameText.textContent = getDisplayName(fi.species, i, femaleInstances.filter(f => f.species === fi.species).length);
                nameText.setAttribute('pointer-events', 'none');
                nameText.style.userSelect = 'none';
                squaresGroup.appendChild(nameText);

                if (fi.isShiny) {
                    const star = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    star.setAttribute('x', cx + rectWidth / 2 - 8);
                    star.setAttribute('y', cy - rectHeight / 2 + 14);
                    star.setAttribute('text-anchor', 'middle');
                    star.setAttribute('fill', '#e6a317');
                    star.setAttribute('font-size', '14');
                    star.setAttribute('font-weight', 'bold');
                    star.textContent = '⭐';
                    star.setAttribute('pointer-events', 'none');
                    squaresGroup.appendChild(star);
                }
            });

            maleCoords.forEach((coord, i) => {
                const ms = maleSlots[i];
                if (!ms) return;
                const cx = toCenterX(coord.x), cy = toCenterY(coord.y);
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', cx - rectWidth / 2);
                rect.setAttribute('y', cy - rectHeight / 2);
                rect.setAttribute('width', rectWidth);
                rect.setAttribute('height', rectHeight);
                rect.setAttribute('fill', 'rgba(200,220,240,0.8)');
                rect.setAttribute('stroke', '#7a9bcb');
                rect.setAttribute('stroke-width', '2');
                rect.setAttribute('rx', '6');
                rect.classList.add('male-square');
                rect.dataset.type = 'male';
                rect.dataset.index = i;
                squaresGroup.appendChild(rect);

                const iconText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                iconText.setAttribute('x', cx); iconText.setAttribute('y', cy - 7);
                iconText.setAttribute('text-anchor', 'middle');
                iconText.setAttribute('fill', '#2c3e50');
                iconText.setAttribute('font-size', '14');
                iconText.textContent = ms.locked ? '🔒♂️' : '♂️';
                iconText.setAttribute('pointer-events', 'none');
                iconText.style.userSelect = 'none';
                squaresGroup.appendChild(iconText);

                const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                nameText.setAttribute('x', cx); nameText.setAttribute('y', cy + 11);
                nameText.setAttribute('text-anchor', 'middle');
                nameText.setAttribute('fill', '#2c3e50');
                nameText.setAttribute('font-size', '10');
                nameText.textContent = getDisplayName(ms.species, i, maleSlots.filter(m => m.species === ms.species).length);
                nameText.setAttribute('pointer-events', 'none');
                nameText.style.userSelect = 'none';
                squaresGroup.appendChild(nameText);

                if (ms.isShiny) {
                    const star = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    star.setAttribute('x', cx + rectWidth / 2 - 8);
                    star.setAttribute('y', cy - rectHeight / 2 + 14);
                    star.setAttribute('text-anchor', 'middle');
                    star.setAttribute('fill', '#e6a317');
                    star.setAttribute('font-size', '14');
                    star.setAttribute('font-weight', 'bold');
                    star.textContent = '⭐';
                    star.setAttribute('pointer-events', 'none');
                    squaresGroup.appendChild(star);
                }
            });

            attachDragEvents();
        }

        /** 拖动功能：半格吸附 + 距离约束（Chebyshev ≥ 1） */
        function attachDragEvents() {
            const draggableElements = svg.querySelectorAll('.female-square, .male-square');
            let dragTarget = null, originalCoord = null, startClientX = 0, startClientY = 0;

            function onStart(e, type, index) {
                e.preventDefault();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX,
                    clientY = e.touches ? e.touches[0].clientY : e.clientY;
                dragTarget = { type, index };
                const points = type === 'female' ? currentPlacement.femaleCoords : currentPlacement.maleCoords;
                originalCoord = { ...points[index] };
                startClientX = clientX; startClientY = clientY;
                svg.querySelectorAll('.female-square, .male-square').forEach(sq => sq.classList.remove('dragging'));
                const sel = type === 'female' ? `.female-square[data-index="${index}"]` : `.male-square[data-index="${index}"]`;
                const el = svg.querySelector(sel);
                if (el) el.classList.add('dragging');
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onEnd);
                window.addEventListener('touchmove', onMove, { passive: false });
                window.addEventListener('touchend', onEnd);
            }

            function onMove(e) {
                if (!dragTarget) return;
                e.preventDefault();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX,
                    clientY = e.touches ? e.touches[0].clientY : e.clientY;
                const svgRect = svg.getBoundingClientRect();
                const scaleX = svgRect.width / width, scaleY = svgRect.height / height;
                const dx = (clientX - startClientX) / (scale * scaleX),
                    dy = (clientY - startClientY) / (scale * scaleY);
                const gridDX = Math.round(dx * 2) / 2,
                    gridDY = Math.round(dy * 2) / 2;
                let desiredX = originalCoord.x + gridDX,
                    desiredY = originalCoord.y + gridDY;
                desiredX = Math.max(0.5, Math.min(GRID_SIZE - 0.5, desiredX));
                desiredY = Math.max(0.5, Math.min(GRID_SIZE - 0.5, desiredY));

                const allCoords = [...currentPlacement.maleCoords, ...currentPlacement.femaleCoords];
                const targetGlobalIndex = dragTarget.type === 'female'
                    ? currentPlacement.maleCoords.length + dragTarget.index : dragTarget.index;

                // 基础占用集合（其他精灵窝的细格坐标）
                const baseOccupied = new Set();
                allCoords.forEach((p, i) => {
                    if (i !== targetGlobalIndex) {
                        const fx = Math.round(p.x * 2), fy = Math.round(p.y * 2);
                        baseOccupied.add(fy * (FINE_GRID + 1) + fx);
                    }
                });

                // 扩张：标记 3×3 邻域为禁止（Chebyshev ≥ 1）
                const occupiedSet = new Set(baseOccupied);
                const NEIGHBORS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
                for (const key of baseOccupied) {
                    const fy = Math.floor(key / (FINE_GRID + 1)),
                        fx = key % (FINE_GRID + 1);
                    for (const [ndx, ndy] of NEIGHBORS) {
                        const nfx = fx + ndx, nfy = fy + ndy;
                        if (nfx >= 0 && nfx <= FINE_GRID && nfy >= 0 && nfy <= FINE_GRID) {
                            occupiedSet.add(nfy * (FINE_GRID + 1) + nfx);
                        }
                    }
                }

                const freePos = findNearestFreePositionHalf(desiredX, desiredY, occupiedSet);
                if (freePos) {
                    const points = dragTarget.type === 'female'
                        ? currentPlacement.femaleCoords : currentPlacement.maleCoords;
                    points[dragTarget.index] = { x: freePos.x, y: freePos.y };
                    if (freePos.x !== desiredX || freePos.y !== desiredY) {
                        originalCoord = { x: freePos.x, y: freePos.y };
                        startClientX = clientX; startClientY = clientY;
                    }
                    drawSquares(); drawLines();
                }
            }

            function onEnd() {
                if (dragTarget) svg.querySelectorAll('.female-square, .male-square').forEach(sq => sq.classList.remove('dragging'));
                dragTarget = null;
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onEnd);
                window.removeEventListener('touchmove', onMove);
                window.removeEventListener('touchend', onEnd);
            }

            draggableElements.forEach(el => {
                el.addEventListener('mousedown', e => onStart(e, el.dataset.type, parseInt(el.dataset.index)));
                el.addEventListener('touchstart', e => onStart(e, el.dataset.type, parseInt(el.dataset.index)), { passive: false });
            });
        }

        drawSquares(); drawLines();
        svgContainer.appendChild(svg);
    }

    /** 导出位置图为 PNG */
    function exportPlacementImage() {
        if (placementArea.style.display === 'none') return;
        html2canvas(svgContainer, { backgroundColor: '#faf3e8', scale: 2 }).then(canvas => {
            const a = document.createElement('a'); a.download = '配窝位置图.png'; a.href = canvas.toDataURL(); a.click();
        });
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║          十九、按钮事件绑定                                    ║
    // ╚══════════════════════════════════════════════════════════════╝
    generateBtn.addEventListener('click', doGenerate);
    resetBtn.addEventListener('click', () => {
        femaleNormal.fill(0); femaleShiny.fill(0);
        maleNormal.fill(0); maleShiny.fill(0);
        femaleCheckboxStates.fill(false); maleCheckboxStates.fill(false);
        nestCountInput.value = 10; nestCountInput.disabled = false;
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

    // ╔══════════════════════════════════════════════════════════════╗
    // ║          二十、配置导入/导出                                    ║
    // ╚══════════════════════════════════════════════════════════════╝

    /** 导出当前配置为 JSON */
    function exportConfig() {
        const config = {
            nestCount: getNestTotal(),
            females: [],
            males: []
        };
        /** 将蛋组 ID 数组转为名称数组（方便跨环境阅读） */
        function eggGroupNames(groups) {
            return groups.map(g => groupNames[g] || String(g));
        }
        for (let i = 0; i < petIds.length; i++) {
            const groups = eggGroupNames(eggGroups[i]);
            if (femaleNormal[i] > 0) config.females.push({ id: petIds[i], name: petNames[i], egg_groups: groups, count: femaleNormal[i], shiny: false });
            if (femaleShiny[i] > 0) config.females.push({ id: petIds[i], name: petNames[i], egg_groups: groups, count: femaleShiny[i], shiny: true });
            if (maleNormal[i] > 0) config.males.push({ id: petIds[i], name: petNames[i], egg_groups: groups, count: maleNormal[i], shiny: false });
            if (maleShiny[i] > 0) config.males.push({ id: petIds[i], name: petNames[i], egg_groups: groups, count: maleShiny[i], shiny: true });
        }

        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.download = '配窝配置.json'; a.href = URL.createObjectURL(blob); a.click();
    }

    /** 从 JSON 文件导入配置 */
    function importConfig(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                const n = petIds.length;
                femaleNormal.fill(0); femaleShiny.fill(0);
                maleNormal.fill(0); maleShiny.fill(0);
                if (config.nestCount) nestCountInput.value = config.nestCount;

                /** 根据 ID、名称、蛋组匹配精灵索引；当跨环境 ID 不一致时，用名称+蛋组模糊匹配 */
                function resolvePetIndex(entry) {
                    // 1) 精确 ID 匹配
                    let idx = petIds.indexOf(entry.id);
                    if (idx !== -1) return idx;
                    // 2) 名称匹配
                    idx = petNames.indexOf(entry.name);
                    if (idx !== -1) return idx;
                    // 3) 名称+蛋组模糊匹配（取第一个名称相同且有蛋组交集的）
                    if (entry.egg_groups && entry.egg_groups.length > 0) {
                        const entryGroups = new Set(entry.egg_groups);
                        for (let i = 0; i < petNames.length; i++) {
                            if (petNames[i] !== entry.name) continue;
                            const petGroups = eggGroups[i].map(g => groupNames[g] || String(g));
                            if (petGroups.some(g => entryGroups.has(g))) return i;
                        }
                    }
                    return -1;
                }

                if (config.females) {
                    config.females.forEach(f => {
                        const idx = resolvePetIndex(f);
                        if (idx !== -1) {
                            if (f.shiny) femaleShiny[idx] = (femaleShiny[idx] || 0) + f.count;
                            else femaleNormal[idx] = (femaleNormal[idx] || 0) + f.count;
                        } else {
                            console.warn(`导入失败：未找到雌性 "${f.name}"（ID:${f.id}, 蛋组:${f.egg_groups?.join(',')}）`);
                        }
                    });
                }
                if (config.males) {
                    config.males.forEach(m => {
                        const idx = resolvePetIndex(m);
                        if (idx !== -1) {
                            if (m.shiny) maleShiny[idx] = (maleShiny[idx] || 0) + m.count;
                            else maleNormal[idx] = (maleNormal[idx] || 0) + m.count;
                        } else {
                            console.warn(`导入失败：未找到雄性 "${m.name}"（ID:${m.id}, 蛋组:${m.egg_groups?.join(',')}）`);
                        }
                    });
                }

                refreshUI();
            } catch (err) {
                alert('配置文件格式错误');
            }
        };
        reader.readAsText(file);
    }

    document.getElementById('exportConfigBtn').addEventListener('click', exportConfig);
    document.getElementById('importConfigBtn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.addEventListener('change', (e) => { if (e.target.files[0]) importConfig(e.target.files[0]); });
        input.click();
    });

    // ╔══════════════════════════════════════════════════════════════╗
    // ║          廿一、初始化                                          ║
    // ╚══════════════════════════════════════════════════════════════╝
    loadPetsJSON().then(ok => { if (!ok) buildDefaultData(); });
})();

