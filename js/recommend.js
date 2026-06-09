// ╔══════════════════════════════════════════════════════════════╗
// ║              十、配窝推荐算法                                  ║
// ╚══════════════════════════════════════════════════════════════╝

function calcUniquePairs(femaleInstances, maleSlots) {
    maleSlots.forEach(function(m) { m.lockedForIds = []; m.locked = false; });
    femaleInstances.forEach(function(fi) {
        var compatibleMaleIndices = [];
        maleSlots.forEach(function(m, idx) { if (compatibleMap.get(m.species).has(fi.species)) compatibleMaleIndices.push(idx); });
        if (compatibleMaleIndices.length === 1) {
            var maleIdx = compatibleMaleIndices[0];
            maleSlots[maleIdx].lockedForIds.push(fi.id);
            maleSlots[maleIdx].locked = true;
        }
    });
}

function maxMatching(females, maleList) {
    var n = maleList.length;
    var adj = Array.from({ length: n }, function() { return []; });
    maleList.forEach(function(m, i) {
        var comp = compatibleMap.get(m.species);
        females.forEach(function(f, j) { if (comp.has(f.species)) adj[i].push(j); });
    });
    var matchR = Array(females.length).fill(-1);
    var result = 0;
    var seen = new Array(females.length);
    function dfs(u) {
        for (var ai = 0; ai < adj[u].length; ai++) {
            var v = adj[u][ai];
            if (seen[v]) continue;
            seen[v] = true;
            if (matchR[v] === -1 || dfs(matchR[v])) { matchR[v] = u; return true; }
        }
        return false;
    }
    for (var u = 0; u < n; u++) { seen.fill(false); if (dfs(u)) result++; }
    return result;
}

function computeRecommendation() {
    var nestTotal = getNestTotal();
    // nestFemales → algorithm female instances
    var femaleInstances = [];
    nestFemales.forEach(function(inst, i) {
        femaleInstances.push({ species: inst.species, id: 'f-' + inst.species + '-' + i, isShiny: inst.shiny, personality: inst.personality, medals: inst.medals || {} });
    });

    var femSpCounter = {};
    femaleInstances.forEach(function(f) {
        if (!femSpCounter[f.species]) femSpCounter[f.species] = 0;
        f._displayIdx = femSpCounter[f.species]++;
    });
    femaleInstances.forEach(function(f) { f._displayTotal = femSpCounter[f.species] || 1; });

    var requiredMales = nestTotal - femaleInstances.length;
    if (requiredMales <= 0) return { error: '雌性已占满所有窝，请留至少一个雄性窝。' };

    // 雄性库存来自 inventory
    var maleStockInstances = [];
    inventory.forEach(function(inst) {
        if (inst.gender !== 'male') return;
        if (filterOnlyShiny && !inst.shiny) return;
        if (filterPersonality && inst.personality !== filterPersonality) return;
        var filterKeys = Object.keys(filterMedals);
        var passMedal = true;
        for (var fk = 0; fk < filterKeys.length; fk++) {
            var fkey = filterKeys[fk], fval = filterMedals[fkey];
            if (fval) { var im = inst.medals || {}; if (im[fkey] !== fval) { passMedal = false; break; } }
        }
        if (!passMedal) return;
        maleStockInstances.push({ species: inst.species, isShiny: inst.shiny, personality: inst.personality, medals: inst.medals || {} });
    });

    function rebuildStockMaps() {
        var ts = new Map(), sn = new Map(), ss = new Map();
        maleStockInstances.forEach(function(inst) {
            ts.set(inst.species, (ts.get(inst.species) || 0) + 1);
            if (inst.shiny) ss.set(inst.species, (ss.get(inst.species) || 0) + 1);
            else sn.set(inst.species, (sn.get(inst.species) || 0) + 1);
        });
        return { totalStock: ts, stockNormal: sn, stockShiny: ss };
    }

    var _stock = rebuildStockMaps();
    var totalStock = _stock.totalStock;

    if (totalStock.size === 0) {
        if (filterOnlyShiny || filterPersonality || Object.values(filterMedals).some(function(v){return v;})) return { error: '没有符合条件的雄性精灵。' };
        return { error: '雄性库存为空。' };
    }

    var consumeMale = function(species) {
        for (var i = 0; i < maleStockInstances.length; i++) {
            if (maleStockInstances[i].species === species && !maleStockInstances[i].isShiny) {
                var inst = maleStockInstances.splice(i, 1)[0];
                var s = rebuildStockMaps(); totalStock = s.totalStock;
                return { species: inst.species, isShiny: inst.isShiny, personality: inst.personality, medals: inst.medals };
            }
        }
        for (var i = 0; i < maleStockInstances.length; i++) {
            if (maleStockInstances[i].species === species) {
                var inst = maleStockInstances.splice(i, 1)[0];
                var s = rebuildStockMaps(); totalStock = s.totalStock;
                return { species: inst.species, isShiny: inst.isShiny, personality: inst.personality, medals: inst.medals };
            }
        }
        return null;
    };

    var releaseMale = function(species, isShiny, personality, medals) {
        maleStockInstances.push({ species: species, isShiny: isShiny, personality: personality || null, medals: medals || {} });
        var s = rebuildStockMaps(); totalStock = s.totalStock;
    };

    var maleLimit = new Map();
    totalStock.forEach(function(_, mSp) { maleLimit.set(mSp, femaleInstances.filter(function(f) { return compatibleMap.get(mSp).has(f.species); }).length); });

    var femaleDeps = femaleInstances.map(function(f) {
        var possible = [];
        totalStock.forEach(function(cnt, mSp) { if (compatibleMap.get(mSp).has(f.species) && cnt > 0) possible.push(mSp); });
        return { female: f, possible: possible };
    });

    var reservedPairs = [], reservedMales = new Set(), lockedFemaleIds = new Set();
    var uniqueDeps = femaleDeps.filter(function(d) { return d.possible.length === 1 && totalStock.get(d.possible[0]) === 1; });
    var usedUnique = new Set();
    uniqueDeps.forEach(function(dep) {
        var mSp = dep.possible[0];
        if (usedUnique.has(mSp)) return;
        if (totalStock.get(mSp) >= 1) {
            var male = consumeMale(mSp); if (!male) return;
            reservedPairs.push({ femaleId: dep.female.id, maleSpecies: mSp, isShiny: male.isShiny, personality: male.personality, medals: male.medals });
            reservedMales.add(mSp); usedUnique.add(mSp); lockedFemaleIds.add(dep.female.id);
        }
    });

    if (reservedPairs.length > requiredMales) {
        var maleCoverCount = new Map();
        totalStock.forEach(function(_, mSp) { maleCoverCount.set(mSp, femaleInstances.filter(function(f) { return compatibleMap.get(mSp).has(f.species); }).length); });
        reservedPairs.sort(function(a, b) { return (maleCoverCount.get(a.maleSpecies) || 0) - (maleCoverCount.get(b.maleSpecies) || 0); });
        var removedPairs = reservedPairs.splice(requiredMales);
        removedPairs.forEach(function(rp) { lockedFemaleIds.delete(rp.femaleId); reservedMales.delete(rp.maleSpecies); releaseMale(rp.maleSpecies, rp.isShiny, rp.personality, rp.medals); });
    }

    var remainingSlots = requiredMales - reservedPairs.length;
    var selectedExtra = [];
    var uncoveredFemaleIds = new Set(femaleInstances.map(function(f) { return f.id; }));
    reservedPairs.forEach(function(rp) {
        var comp = compatibleMap.get(rp.maleSpecies);
        femaleInstances.forEach(function(f) { if (comp.has(f.species)) uncoveredFemaleIds.delete(f.id); });
    });

    function evaluateSolution(slots) {
        var matched = maxMatching(femaleInstances, slots);
        var covered = new Set();
        slots.forEach(function(s) { var comp = compatibleMap.get(s.species); femaleInstances.forEach(function(f) { if (comp.has(f.species)) covered.add(f.id); }); });
        return { matched: matched, covered: covered.size, score: matched * 10000 + covered.size };
    }

    for (var i = 0; i < remainingSlots; i++) {
        var bestSp = -1, bestNew = -1, bestTotal = -1;
        totalStock.forEach(function(cnt, mSp) {
            if (cnt <= 0) return;
            var curCnt = reservedPairs.filter(function(r) { return r.maleSpecies === mSp; }).length + selectedExtra.filter(function(s) { return s.species === mSp; }).length;
            if (curCnt >= (maleLimit.get(mSp) || 0)) return;
            var comp = compatibleMap.get(mSp);
            var newC = 0, total = 0;
            femaleInstances.forEach(function(f) { if (comp.has(f.species)) { total++; if (uncoveredFemaleIds.has(f.id)) newC++; } });
            if (newC > bestNew || (newC === bestNew && total > bestTotal)) { bestNew = newC; bestTotal = total; bestSp = mSp; }
        });
        if (bestSp === -1) break;
        var male = consumeMale(bestSp); if (!male) break;
        selectedExtra.push(male);
        var cov = compatibleMap.get(bestSp);
        femaleInstances.forEach(function(f) { if (cov.has(f.species)) uncoveredFemaleIds.delete(f.id); });
    }

    var allMaleSlots = reservedPairs.map(function(rp) { return { species: rp.maleSpecies, locked: true, lockedForIds: [], isShiny: rp.isShiny, personality: rp.personality, medals: rp.medals }; });
    selectedExtra.forEach(function(m) { allMaleSlots.push({ species: m.species, locked: false, lockedForIds: [], isShiny: m.isShiny, personality: m.personality, medals: m.medals }); });

    var maleSpCounter = {};
    allMaleSlots.forEach(function(m) { if (!maleSpCounter[m.species]) maleSpCounter[m.species] = 0; m._displayIdx = maleSpCounter[m.species]++; m._displayTotal = 0; });
    allMaleSlots.forEach(function(m) { m._displayTotal = maleSpCounter[m.species] || 1; });

    var currentSlots = allMaleSlots.map(function(m) { return { species: m.species, locked: m.locked, lockedForIds: [], isShiny: m.isShiny, personality: m.personality, medals: m.medals, _displayIdx: m._displayIdx, _displayTotal: m._displayTotal }; });
    var currentEval = evaluateSolution(currentSlots);
    var improved = true;

    while (improved) {
        improved = false;
        for (var si = 0; si < currentSlots.length; si++) {
            if (currentSlots[si].locked) continue;
            var oldSp = currentSlots[si].species, oldPersonality = currentSlots[si].personality, oldMedals = currentSlots[si].medals;
            var stockEntries = Array.from(totalStock);
            for (var ei = 0; ei < stockEntries.length; ei++) {
                var newSp = stockEntries[ei][0], cnt = stockEntries[ei][1];
                if (cnt <= 0 || newSp === oldSp) continue;
                var curCnt2 = currentSlots.filter(function(s) { return s.species === newSp; }).length;
                if (curCnt2 >= (maleLimit.get(newSp) || 0)) continue;
                var newMale = consumeMale(newSp); if (!newMale) continue;
                var trial = currentSlots.map(function(s) { return { species: s.species, locked: s.locked, lockedForIds: [], isShiny: s.isShiny, personality: s.personality, medals: s.medals, _displayIdx: s._displayIdx, _displayTotal: s._displayTotal }; });
                trial[si] = { species: newSp, locked: false, lockedForIds: [], isShiny: newMale.isShiny, personality: newMale.personality, medals: newMale.medals, _displayIdx: currentSlots[si]._displayIdx, _displayTotal: currentSlots[si]._displayTotal };
                var trialEval = evaluateSolution(trial);
                if (trialEval.score > currentEval.score) { releaseMale(oldSp, currentSlots[si].isShiny, oldPersonality, oldMedals); currentSlots = trial; currentEval = trialEval; improved = true; break; }
                else { releaseMale(newSp, newMale.isShiny, newMale.personality, newMale.medals); }
            }
            if (improved) break;
        }
    }

    while (currentSlots.length > 0 && currentEval.matched < currentSlots.length) {
        var worstIdx = -1, worstOrphans = Infinity, worstCover = Infinity;
        for (var wi = 0; wi < currentSlots.length; wi++) {
            if (currentSlots[wi].locked) continue;
            var comp = compatibleMap.get(currentSlots[wi].species);
            var cover = femaleInstances.filter(function(f) { return comp.has(f.species); }).length;
            var orphans = 0;
            femaleInstances.forEach(function(f) { if (!comp.has(f.species)) return; var hasOther = false; for (var j = 0; j < currentSlots.length; j++) { if (j !== wi && compatibleMap.get(currentSlots[j].species).has(f.species)) { hasOther = true; break; } } if (!hasOther) orphans++; });
            if (orphans < worstOrphans || (orphans === worstOrphans && cover < worstCover)) { worstOrphans = orphans; worstCover = cover; worstIdx = wi; }
        }
        if (worstIdx === -1) break;
        releaseMale(currentSlots[worstIdx].species, currentSlots[worstIdx].isShiny, currentSlots[worstIdx].personality, currentSlots[worstIdx].medals);
        currentSlots.splice(worstIdx, 1);
        currentEval = evaluateSolution(currentSlots);
    }

    var finalMaleSlots = currentSlots;
    var emptySlots = requiredMales - finalMaleSlots.length;
    calcUniquePairs(femaleInstances, finalMaleSlots);

    var coveredFemaleIds = new Set();
    finalMaleSlots.forEach(function(m) { var comp = compatibleMap.get(m.species); femaleInstances.forEach(function(f) { if (comp.has(f.species)) coveredFemaleIds.add(f.id); }); });
    var uncoveredFemales = femaleInstances.filter(function(f) { return !coveredFemaleIds.has(f.id); });

    var maleCoverDetails = finalMaleSlots.map(function(m) {
        var comp = compatibleMap.get(m.species);
        var covered = femaleInstances.filter(function(f) { return comp.has(f.species); });
        return { species: m.species, locked: m.locked, lockedForIds: m.lockedForIds, isShiny: m.isShiny, personality: m.personality, medals: m.medals, _displayIdx: m._displayIdx, _displayTotal: m._displayTotal, coveredNames: covered.map(function(f) { return petNames[f.species]; }), coveredIds: covered.map(function(f) { return { id: f.species, isShiny: f.isShiny, instanceId: f.id, _displayIdx: f._displayIdx, _displayTotal: f._displayTotal, personality: f.personality, medals: f.medals }; }) };
    });

    return { femaleInstances: femaleInstances, allMaleSlots: finalMaleSlots, emptySlots: emptySlots, uncoveredFemales: uncoveredFemales, maleCoverDetails: maleCoverDetails };
}

function renderNestMedalTags(medals) {
    if (!medals) return '';
    var html = '';
    var keys = Object.keys(medals);
    for (var k = 0; k < keys.length; k++) { var mid = medals[keys[k]]; if (mid) { var m = getMedalById(mid); if (m) html += (html ? '<br>' : '') + '<span class="nest-tag-medal">' + (m.icon || '') + m.name + '</span>'; } }
    return html;
}

function renderResult(result) {
    if (result.error) { globalMsg.innerHTML = '<div class="warning">' + result.error + '</div>'; resultArea.style.display = 'none'; placementArea.style.display = 'none'; placementBtn.style.display = 'none'; return; }
    globalMsg.innerHTML = ''; resultArea.style.display = 'block'; placementBtn.style.display = 'inline-flex';
    var femaleInstances = result.femaleInstances, allMaleSlots = result.allMaleSlots, emptySlots = result.emptySlots;
    var uncoveredFemales = result.uncoveredFemales, maleCoverDetails = result.maleCoverDetails;

    nestVisualDiv.innerHTML = '';
    var uncoveredIds = new Set(uncoveredFemales.map(function(f) { return f.id; }));

    femaleInstances.forEach(function(f) {
        var idx = f._displayIdx !== undefined ? f._displayIdx : 0;
        var total = f._displayTotal || 1;
        var div = document.createElement('div'); div.className = 'nest-item female';
        var attrHtml = '';
        if (f.personality) { var p = getPersonalityByName(f.personality); if (p) attrHtml += '<span class="nest-tag-pers">🎭' + p.name + '</span>'; }
        var mt = renderNestMedalTags(f.medals); if (mt) attrHtml += (attrHtml ? '<br>' : '') + mt;
        if (attrHtml) attrHtml = '<div class="nest-attr-layer">' + attrHtml + '</div>';
        div.innerHTML = '<span class="icon">♀️</span><span>' + getDisplayName(f.species, idx, total) + '</span>' + (attrHtml || '');
        if (f.isShiny) { var star = document.createElement('span'); star.className = 'nest-star-badge'; star.textContent = '⭐'; div.appendChild(star); }
        if (uncoveredIds.has(f.id)) { var overlay = document.createElement('span'); overlay.className = 'nest-uncovered-overlay'; var icon = document.createElement('span'); icon.className = 'nest-uncovered-icon'; icon.textContent = '⚠️'; overlay.appendChild(icon); div.appendChild(overlay); }
        nestVisualDiv.appendChild(div);
    });

    allMaleSlots.forEach(function(m, i) {
        var idx = m._displayIdx !== undefined ? m._displayIdx : i;
        var total = m._displayTotal || 1;
        var div = document.createElement('div'); div.className = 'nest-item male';
        var attrHtml = '';
        if (m.personality) { var mp = getPersonalityByName(m.personality); if (mp) attrHtml += '<span class="nest-tag-pers">🎭' + mp.name + '</span>'; }
        var mt2 = renderNestMedalTags(m.medals); if (mt2) attrHtml += (attrHtml ? '<br>' : '') + mt2;
        if (attrHtml) attrHtml = '<div class="nest-attr-layer">' + attrHtml + '</div>';
        div.innerHTML = '<span class="icon">' + (m.locked ? '🔒♂️' : '♂️') + '</span><span>' + getDisplayName(m.species, idx, total) + '</span>' + (attrHtml || '');
        if (m.isShiny) { var star = document.createElement('span'); star.className = 'nest-star-badge'; star.textContent = '⭐'; div.appendChild(star); }
        nestVisualDiv.appendChild(div);
    });

    for (var ei = 0; ei < emptySlots; ei++) { var ediv = document.createElement('div'); ediv.className = 'nest-item male nest-item-empty'; ediv.innerHTML = '<span class="icon">♂️</span><span>(空窝)</span>'; nestVisualDiv.appendChild(ediv); }

    maleDetailsDiv.innerHTML = '';
    maleCoverDetails.forEach(function(md, i) {
        var idx = md._displayIdx !== undefined ? md._displayIdx : i;
        var total = md._displayTotal || 1;
        var card = document.createElement('div'); card.className = 'male-card';
        var lockedNames = (md.lockedForIds || []).map(function(id) { var name = petNames[parseInt(id.split('-')[1])] || '?'; var fi = result.femaleInstances.find(function(f) { return f.id === id; }); if (fi && fi._displayTotal > 1) return name + CIRCLED_NUMS[fi._displayIdx]; return name; }).join('、');
        var lockBadge = lockedNames ? '<span class="lock-badge">🔒 唯一依赖·专属配对：' + lockedNames + '</span>' : '';
        var coveredEntries = (md.coveredIds || []).map(function(c) { var name = petNames[c.id] || '?'; if (c._displayTotal > 1) name = name + CIRCLED_NUMS[c._displayIdx]; return { name: name, isShiny: c.isShiny }; });
        var tags = coveredEntries.map(function(e) { return '<span class="tag">' + e.name + (e.isShiny ? '⭐' : '') + '</span>'; }).join(' ');
        var groups = eggGroups[md.species].map(function(g) { return groupNames[g] || g; }).join('/');
        var maleStar = md.isShiny ? '⭐' : '';
        var maleAttrHtml = '';
        if (md.personality) { var mp = getPersonalityByName(md.personality); if (mp) maleAttrHtml += '<span class="nest-tag-pers">🎭' + mp.name + '</span> '; }
        var mt3 = renderNestMedalTags(md.medals); if (mt3) maleAttrHtml += mt3 + ' ';
        card.innerHTML = '<div class="card-header"><strong>♂ ' + getDisplayName(md.species, idx, total) + maleStar + '</strong>' + maleAttrHtml + '<span class="replace-btn" data-male-index="' + i + '">🔄 查看可替换</span><span class="egg-groups">' + groups + '</span></div><div>(窝' + (femaleInstances.length + i + 1) + ') ' + lockBadge + '</div><div class="male-card-covered">可配雌性：' + (tags || '<span class="male-card-no-cov">无</span>') + '</div>';
        maleDetailsDiv.appendChild(card);
    });

    maleDetailsDiv.querySelectorAll('.replace-btn').forEach(function(btn) { btn.addEventListener('click', function(e) { e.stopPropagation(); openReplaceModal(parseInt(btn.dataset.maleIndex)); }); });

    var summary = '';
    if (uncoveredFemales.length > 0) summary += '<span class="summary-warn">⚠️ 以下雌性无法被覆盖：' + uncoveredFemales.map(function(f) { return petNames[f.species]; }).join('、') + '</span><br>';
    else summary += '<span class="summary-ok">✅ 所有雌性均已覆盖！</span><br>';
    if (emptySlots > 0) summary += '<span class="summary-info">📌 为防止雄性闲置，自动少放' + emptySlots + '只雄性。</span><br>';
    coverageSummaryDiv.innerHTML = summary;
}

function doGenerate() {
    if (nestFemales.length === 0) { globalMsg.innerHTML = '<div class="warning">🌸 请至少放入一只雌性到窝。</div>'; return; }
    if (nestFemales.length > getMaxFemales()) { globalMsg.innerHTML = '<div class="warning">雌性数量超过上限。</div>'; return; }
    var maleCount = inventory.filter(function(inst) { return inst.gender === 'male'; }).length;
    if (maleCount === 0) { globalMsg.innerHTML = '<div class="warning">♂️ 库存中没有雄性，请先管理仓库添加雄性。</div>'; return; }
    window._globalFemaleInstances = nestFemales;
    var result = computeRecommendation();
    lastResultData = result;
    renderResult(result);
    placementArea.style.display = 'none';
}

function exportToImage() {
    if (resultArea.style.display === 'none') return;
    html2canvas(resultContent, { backgroundColor: '#faf3e8', scale: 2 }).then(function(canvas) { var a = document.createElement('a'); a.download = '配窝方案.png'; a.href = canvas.toDataURL(); a.click(); });
}
