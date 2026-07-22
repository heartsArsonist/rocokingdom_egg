// ╔══════════════════════════════════════════════════════════════╗
// ║      十一~十七、精灵窝位置图生成（全部）                        ║
// ╚══════════════════════════════════════════════════════════════╝

// ── 十一、蛋组工具函数 ──

function calcEffectiveEggGroups(maleSpecies, femaleInstances) {
    var groups = eggGroups[maleSpecies];
    if (groups.length <= 1) return groups.slice();
    var maleSet = new Set(groups);
    function femaleHasSameGroups(fi) {
        var fg = eggGroups[fi.species] || [];
        if (fg.length !== maleSet.size) return false;
        return fg.every(function (g) { return maleSet.has(g); });
    }
    var active = [];
    for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        for (var fi = 0; fi < femaleInstances.length; fi++) {
            var fg = eggGroups[femaleInstances[fi].species];
            if (fg && fg.includes(g) && !femaleHasSameGroups(femaleInstances[fi])) { active.push(g); break; }
        }
    }
    return active.length > 0 ? active : groups.slice();
}

function eggGroupKey(groups) {
    return groups.slice().sort(function (a, b) { return a - b; }).join(',');
}

// ── 十二、网格封锁工具函数 ──

function clusterToBlockedIntCells(clusterCoords) {
    var blocked = new Set();
    for (var ci = 0; ci < clusterCoords.length; ci++) {
        var c = clusterCoords[ci];
        var fx = Math.round(c.x * 2), fy = Math.round(c.y * 2);
        for (var dfx = -1; dfx <= 1; dfx++) {
            for (var dfy = -1; dfy <= 1; dfy++) {
                var nfx = fx + dfx, nfy = fy + dfy;
                if (nfx % 2 === 0 && nfy % 2 === 0) {
                    var ix = nfx / 2, iy = nfy / 2;
                    if (ix >= 0 && ix < GRID_SIZE && iy >= 0 && iy < GRID_SIZE) blocked.add(iy * GRID_SIZE + ix);
                }
            }
        }
    }
    return blocked;
}

function clusterToBlockedFineCells(clusterCoords) {
    var blocked = new Set();
    for (var ci = 0; ci < clusterCoords.length; ci++) {
        var c = clusterCoords[ci];
        var fx = Math.round(c.x * 2), fy = Math.round(c.y * 2);
        for (var dfx = -1; dfx <= 1; dfx++) {
            for (var dfy = -1; dfy <= 1; dfy++) {
                var nfx = fx + dfx, nfy = fy + dfy;
                if (nfx >= 0 && nfx <= FINE_GRID && nfy >= 0 && nfy <= FINE_GRID) blocked.add(nfy * (FINE_GRID + 1) + nfx);
            }
        }
    }
    return blocked;
}

// ── 十三、精灵窝位置图生成主函数 ──

function generatePlacement() {
    if (!lastResultData || lastResultData.error) return;
    var res = lastResultData;
    reseedRandomFromResult(res);
    var originalFemaleInstances = res.femaleInstances;
    var uncoveredFemales = res.uncoveredFemales;

    var uncoveredIds = new Set(uncoveredFemales.map(function (f) { return f.id; }));
    var coveredFemaleInstances = originalFemaleInstances.filter(function (f) { return !uncoveredIds.has(f.id); });

    if (coveredFemaleInstances.length === 0) {
        globalMsg.innerHTML = '<div class="warning">没有雌性可被覆盖，无法生成位置图。</div>'; return;
    }

    var maleSlots = res.allMaleSlots;
    var males = maleSlots.map(function (sm, idx) { return { id: 'm-' + idx, species: sm.species, idx: idx }; });

    var maleCompatCount = new Array(males.length).fill(0);
    coveredFemaleInstances.forEach(function (fi) {
        males.forEach(function (m) { if (compatibleMap.get(m.species).has(fi.species)) maleCompatCount[m.idx]++; });
    });

    var maleUniqueCount = new Array(males.length).fill(0);
    coveredFemaleInstances.forEach(function (fi) {
        var compatibleMaleIndices = [];
        males.forEach(function (m) { if (compatibleMap.get(m.species).has(fi.species)) compatibleMaleIndices.push(m.idx); });
        if (compatibleMaleIndices.length === 1) maleUniqueCount[compatibleMaleIndices[0]]++;
    });

    var maleEffGroups = maleSlots.map(function (sm) { return calcEffectiveEggGroups(sm.species, coveredFemaleInstances); });
    maleSlots.forEach(function (sm, i) { sm.effGroupCount = maleEffGroups[i].length; });

    var groupToMales = new Map();
    maleSlots.forEach(function (_, mi) {
        var key = eggGroupKey(maleEffGroups[mi]);
        if (!groupToMales.has(key)) groupToMales.set(key, []);
        groupToMales.get(key).push(mi);
    });

    var clusterMaleSet = null, clusterFemaleSet = null;
    var clusterMaleCoords = null, clusterFemalePositions = null;

    // 第一轮：优先单蛋组
    var sortedGroupEntries = Array.from(groupToMales).sort(function (a, b) {
        var avgA = a[1].reduce(function (s, mi) { return s + maleSlots[mi].effGroupCount; }, 0) / a[1].length;
        var avgB = b[1].reduce(function (s, mi) { return s + maleSlots[mi].effGroupCount; }, 0) / b[1].length;
        return avgA - avgB;
    });
    for (var gi = 0; gi < sortedGroupEntries.length; gi++) {
        var key = sortedGroupEntries[gi][0], maleIndices = sortedGroupEntries[gi][1];
        var n = maleIndices.length;
        if (n !== 2 && n !== 3) continue;
        var compFemSet = new Set();
        for (var mi = 0; mi < maleIndices.length; mi++) {
            var comp = compatibleMap.get(maleSlots[maleIndices[mi]].species);
            coveredFemaleInstances.forEach(function (fi, fiIdx) { if (comp.has(fi.species)) compFemSet.add(fiIdx); });
        }
        var compCnt = compFemSet.size;
        if (n === 2 && compCnt === 4) {
            clusterMaleSet = new Set(maleIndices); clusterFemaleSet = compFemSet;
            clusterMaleCoords = [{ x: 0.5, y: 0 }, { x: -0.5, y: 0 }];
            clusterFemalePositions = [{ x: 1, y: -1 }, { x: 1.5, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 1 }];
            break;
        } else if (n === 2 && compCnt > 4) {
            clusterMaleSet = new Set(maleIndices); clusterFemaleSet = compFemSet;
            clusterMaleCoords = [{ x: 0.5, y: 0 }, { x: -0.5, y: 0 }];
            clusterFemalePositions = [{ x: 1, y: -1 }, { x: 1.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1.5, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }];
            break;
        } else if (n === 3 && compCnt >= 4) {
            clusterMaleSet = new Set(maleIndices); clusterFemaleSet = compFemSet;
            clusterMaleCoords = [{ x: 0.5, y: 0 }, { x: -0.5, y: 0 }, { x: 0, y: -1 }];
            clusterFemalePositions = [{ x: 1.5, y: 0 }, { x: 1, y: -1 }, { x: -1, y: -1 }, { x: -1.5, y: 0 }, { x: 0, y: -2 }, { x: 0.5, y: 1 }, { x: -0.5, y: 1 }];
            break;
        }
    }

    // 第二轮：孤独高覆盖雄性搜索
    if (clusterMaleSet === null) {
        for (var mi2 = 0; mi2 < maleSlots.length; mi2++) {
            if (maleCompatCount[mi2] < 4) continue;
            if (maleUniqueCount[mi2] > 0) continue;
            var myKey = eggGroupKey(maleEffGroups[mi2]);
            var peers = groupToMales.get(myKey) || [];
            if (peers.length > 1) continue;
            var candidates = [];
            for (var mj = 0; mj < maleSlots.length; mj++) {
                if (mj === mi2) continue;
                if (maleUniqueCount[mj] > 0) continue;
                if (!hasCommonGroup(maleEffGroups[mi2], maleEffGroups[mj])) continue;
                candidates.push(mj);
            }
            if (candidates.length >= 2) {
                var threeMales = [mi2, candidates[0], candidates[1]];
                var compFemSet3 = new Set();
                threeMales.forEach(function (mIdx) {
                    var comp = compatibleMap.get(maleSlots[mIdx].species);
                    coveredFemaleInstances.forEach(function (fi, fiIdx) { if (comp.has(fi.species)) compFemSet3.add(fiIdx); });
                });
                if (compFemSet3.size >= 4) {
                    clusterMaleSet = new Set(threeMales); clusterFemaleSet = compFemSet3;
                    clusterMaleCoords = [{ x: 0.5, y: 0 }, { x: -0.5, y: 0 }, { x: 0, y: -1 }];
                    clusterFemalePositions = [{ x: 1.5, y: 0 }, { x: 1, y: -1 }, { x: -1, y: -1 }, { x: -1.5, y: 0 }, { x: 0, y: -2 }, { x: 0.5, y: 1 }, { x: -0.5, y: 1 }];
                    break;
                }
            }
            if (candidates.length >= 1) {
                var twoMales = [mi2, candidates[0]];
                var compFemSet2 = new Set();
                twoMales.forEach(function (mIdx) {
                    var comp = compatibleMap.get(maleSlots[mIdx].species);
                    coveredFemaleInstances.forEach(function (fi, fiIdx) { if (comp.has(fi.species)) compFemSet2.add(fiIdx); });
                });
                if (compFemSet2.size >= 7) {
                    clusterMaleSet = new Set(twoMales); clusterFemaleSet = compFemSet2;
                    clusterMaleCoords = [{ x: 0.5, y: 0 }, { x: -0.5, y: 0 }];
                    clusterFemalePositions = [{ x: 1, y: -1 }, { x: 1.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1.5, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }];
                    break;
                } else if (compFemSet2.size <= 6) {
                    if (candidates.length >= 2) {
                        var threeMalesB = [mi2, candidates[0], candidates[1]];
                        var comp3 = new Set();
                        threeMalesB.forEach(function (mIdx) {
                            var comp = compatibleMap.get(maleSlots[mIdx].species);
                            coveredFemaleInstances.forEach(function (fi, fiIdx) { if (comp.has(fi.species)) comp3.add(fiIdx); });
                        });
                        if (comp3.size >= 4) {
                            clusterMaleSet = new Set(threeMalesB); clusterFemaleSet = comp3;
                            clusterMaleCoords = [{ x: 0.5, y: 0 }, { x: -0.5, y: 0 }, { x: 0, y: -1 }];
                            clusterFemalePositions = [{ x: 1.5, y: 0 }, { x: 1, y: -1 }, { x: -1, y: -1 }, { x: -1.5, y: 0 }, { x: 0, y: -2 }, { x: 0.5, y: 1 }, { x: -0.5, y: 1 }];
                            break;
                        }
                    }
                    clusterMaleSet = new Set(twoMales); clusterFemaleSet = compFemSet2;
                    clusterMaleCoords = [{ x: 0.5, y: 0 }, { x: -0.5, y: 0 }];
                    clusterFemalePositions = [{ x: 1, y: -1 }, { x: 1.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1.5, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }];
                    break;
                }
            }
        }
    }

    var isCluster = clusterMaleSet !== null;

    // 阶段一：聚合坐标固化
    var clusterShiftX = 0, clusterShiftY = 0, fixedFemalesFine = null;
    var preOccupiedFine = null;
    var clusterFixedMales = null;

    if (isCluster) {
        var clusterFemArr = Array.from(clusterFemaleSet);
        var clusterAllCoords = clusterMaleCoords.slice();
        for (var ci = 0; ci < Math.min(clusterFemArr.length, clusterFemalePositions.length); ci++) clusterAllCoords.push(clusterFemalePositions[ci]);
        var cMinX = Math.min.apply(null, clusterAllCoords.map(function (c) { return c.x; }));
        var cMinY = Math.min.apply(null, clusterAllCoords.map(function (c) { return c.y; }));
        clusterShiftX = cMinX < 0 ? Math.ceil(-cMinX) : 0;
        clusterShiftY = cMinY < 0 ? Math.ceil(-cMinY) : 0;
        var shiftedAll = clusterAllCoords.map(function (c) { return { x: c.x + clusterShiftX, y: c.y + clusterShiftY }; });
        preOccupiedFine = clusterToBlockedFineCells(shiftedAll);

        var cmArr = Array.from(clusterMaleSet);
        clusterFixedMales = cmArr.map(function (cmi, i) { return { idx: cmi, species: maleSlots[cmi].species, fineX: Math.round((clusterMaleCoords[i].x + clusterShiftX) * 2), fineY: Math.round((clusterMaleCoords[i].y + clusterShiftY) * 2), realX: clusterMaleCoords[i].x + clusterShiftX, realY: clusterMaleCoords[i].y + clusterShiftY }; });

        fixedFemalesFine = [];
        for (var fi2 = 0; fi2 < Math.min(clusterFemArr.length, clusterFemalePositions.length); fi2++) {
            fixedFemalesFine.push({ species: coveredFemaleInstances[clusterFemArr[fi2]].species, fineX: Math.round((clusterFemalePositions[fi2].x + clusterShiftX) * 2), fineY: Math.round((clusterFemalePositions[fi2].y + clusterShiftY) * 2) });
        }
    }

    // 构建子问题
    var subMales = isCluster ? males.filter(function (m) { return !clusterMaleSet.has(m.idx); }) : males;
    var subFemales = isCluster ? coveredFemaleInstances.filter(function (_, fi) { return !clusterFemaleSet.has(fi); }) : coveredFemaleInstances;

    var subMaleCompatCount = new Array(subMales.length).fill(0);
    subFemales.forEach(function (fi) { subMales.forEach(function (m) { if (compatibleMap.get(m.species).has(fi.species)) subMaleCompatCount[m.idx]++; }); });
    var subMaleUniqueCount = new Array(subMales.length).fill(0);
    subFemales.forEach(function (fi) {
        var compatMales = [];
        subMales.forEach(function (m) { if (compatibleMap.get(m.species).has(fi.species)) compatMales.push(m.idx); });
        if (compatMales.length === 1) subMaleUniqueCount[compatMales[0]]++;
    });

    var buildNearbyTargets = function (level, compatArr) { return subMales.map(function (_, mi) { return compatArr[mi] >= 4 ? Math.min(level, compatArr[mi]) : 0; }); };

    // ── 确定性放置函数 ──

        function tryDeterministicPlacement3Male() {
        if (!isCluster || clusterMaleSet.size !== 3) return null;
        var totalRemaining = subMales.length + subFemales.length;
        if (totalRemaining === 0) return { maleCoords: [], femaleCoords: [] };
        if (totalRemaining > 3) return null;
        var shiftX = clusterShiftX, shiftY = clusterShiftY;
        var clusterFemSpecies = new Set();
        clusterFemaleSet.forEach(function (fi) { clusterFemSpecies.add(coveredFemaleInstances[fi].species); });
        function hasCommonWithClusterFemales(mSpecies) {
            var found = false;
            clusterFemSpecies.forEach(function (fs) { if (compatibleMap.get(mSpecies).has(fs)) found = true; });
            return found;
        }
        var mCoords = new Array(subMales.length);
        var fCoords = new Array(subFemales.length);

        // ═══ subMales === 2：精确约束逻辑 ═══
        if (subMales.length === 2) {
            // 预判聚合雌性在 clusterFemalePositions[0]=(1.5,0) 和 [1]=(1,-1) 的物种
            // 复用合并阶段（第489行）的排序：与子问题雄性不兼容的排前面，拿到靠前槽位
            var clusterFemArrForCheck = Array.from(clusterFemaleSet).sort(function (a, b) {
                var aC = subMales.some(function (m) { return compatibleMap.get(m.species).has(coveredFemaleInstances[a].species); }) ? 1 : 0;
                var bC = subMales.some(function (m) { return compatibleMap.get(m.species).has(coveredFemaleInstances[b].species); }) ? 1 : 0;
                return aC - bC;
            });
            var cfPos0Species = (clusterFemArrForCheck.length > 0) ? coveredFemaleInstances[clusterFemArrForCheck[0]].species : null;
            var cfPos1Species = (clusterFemArrForCheck.length > 1) ? coveredFemaleInstances[clusterFemArrForCheck[1]].species : null;

            var allSlots = [
                { x: -0.5, y: 1 },   // slot 0
                { x: 0.5, y: 1 },    // slot 1
                { x: 0, y: 2 }       // slot 2
            ];
            var used = [false, false, false];

            // 判定唯一雄性
            var uniqueMaleIdx = -1;
            if (subMaleUniqueCount[0] > 0) uniqueMaleIdx = 0;
            if (subMaleUniqueCount[1] > 0) uniqueMaleIdx = (uniqueMaleIdx >= 0) ? -2 : 1; // -2 = 冲突，两只都唯一

            if (uniqueMaleIdx >= 0) {
                // 情况1：有唯一雄性 → 放 slot 1 (0.5, 1)，另一只放 slot 0 (-0.5, 1)
                mCoords[uniqueMaleIdx] = { x: allSlots[1].x + shiftX, y: allSlots[1].y + shiftY };
                used[1] = true;
                var otherMaleIdx = 1 - uniqueMaleIdx;
                mCoords[otherMaleIdx] = { x: allSlots[0].x + shiftX, y: allSlots[0].y + shiftY };
                used[0] = true;
            } else {
                // 情况2：两只都不是唯一 → 默认 slot 0 + slot 1
                mCoords[0] = { x: allSlots[0].x + shiftX, y: allSlots[0].y + shiftY };
                used[0] = true;
                mCoords[1] = { x: allSlots[1].x + shiftX, y: allSlots[1].y + shiftY };
                used[1] = true;

                // 判定 slot1 雄性是否跟 (1.5,0) 和 (1,-1) 两只聚类雌性都不兼容
                var slot1MaleSpecies = subMales[1].species;
                var compatWithPos0 = cfPos0Species !== null && compatibleMap.get(slot1MaleSpecies).has(cfPos0Species);
                var compatWithPos1 = cfPos1Species !== null && compatibleMap.get(slot1MaleSpecies).has(cfPos1Species);

                if (!compatWithPos0 && !compatWithPos1) {
                    // 移动雄性到 (-1.5, -2)，释放 slot 1
                    mCoords[1] = { x: -1.5 + shiftX, y: -2 + shiftY };
                    used[1] = false;
                    // 下方雌性放置循环会自动把 slot2 (0,2) 的雌性补到 slot1 (0.5,1)
                }
            }

            // 雌性填充剩余空槽
            var fi3 = 0;
            for (var s = 0; s < allSlots.length && fi3 < subFemales.length; s++) {
                if (!used[s]) {
                    fCoords[fi3] = { x: allSlots[s].x + shiftX, y: allSlots[s].y + shiftY };
                    used[s] = true;
                    fi3++;
                }
            }
            return { maleCoords: mCoords, femaleCoords: fCoords };
        }

        // ═══ subMales < 2：保持原有逻辑 ═══
        var maleIdxs = Array.from({ length: subMales.length }, function (_, i) { return i; }).sort(function (a, b) {
            var aC = hasCommonWithClusterFemales(subMales[a].species) ? 0 : 1;
            var bC = hasCommonWithClusterFemales(subMales[b].species) ? 0 : 1;
            return aC - bC;
        });
        var allSlots = [{ x: -0.5, y: 1 }, { x: 0.5, y: 1 }, { x: 0, y: 2 }];
        var used = [false, false, false];
        for (var i = 0; i < maleIdxs.length; i++) {
            var slotIdx = i;
            if (slotIdx < 2) { mCoords[maleIdxs[i]] = { x: allSlots[slotIdx].x + shiftX, y: allSlots[slotIdx].y + shiftY }; used[slotIdx] = true; }
        }
        var fi4 = 0;
        for (var s = 0; s < allSlots.length && fi4 < subFemales.length; s++) {
            if (!used[s]) { fCoords[fi4] = { x: allSlots[s].x + shiftX, y: allSlots[s].y + shiftY }; used[s] = true; fi4++; }
        }
        return { maleCoords: mCoords, femaleCoords: fCoords };
    }


    function tryDeterministicPlacement2Male() {
        if (!isCluster || clusterMaleSet.size !== 2) return null;
        if (subMales.length === 0 && subFemales.length === 0) return { maleCoords: [], femaleCoords: [] };
        var shiftX = clusterShiftX, shiftY = clusterShiftY;
        var clusterFemSpecies = new Set();
        clusterFemaleSet.forEach(function (fi) { clusterFemSpecies.add(coveredFemaleInstances[fi].species); });
        function hasCommonWithClusterFemales(mSpecies) {
            var found = false;
            clusterFemSpecies.forEach(function (fs) { if (compatibleMap.get(mSpecies).has(fs)) found = true; });
            return found;
        }
        var uniqueDepMales = [];
        subMales.forEach(function (m, mi) { if (subMaleUniqueCount[mi] > 0) uniqueDepMales.push({ mi: mi, count: subMaleUniqueCount[mi], species: m.species }); });
        uniqueDepMales.sort(function (a, b) { return b.count - a.count; });

        if (uniqueDepMales.length > 0) {
            var udm = uniqueDepMales[0];
            var maleHasCommon = hasCommonWithClusterFemales(udm.species);
            var depFemales = [], otherFemales = [];
            subFemales.forEach(function (fi, fiIdx) {
                var compatSubMales = [];
                subMales.forEach(function (m, mi) { if (compatibleMap.get(m.species).has(fi.species)) compatSubMales.push(mi); });
                if (compatSubMales.length === 1 && compatSubMales[0] === udm.mi) depFemales.push(fiIdx);
                else otherFemales.push(fiIdx);
            });
            var otherMales = [];
            subMales.forEach(function (m, mi) { if (mi !== udm.mi) otherMales.push(mi); });
            var depCount = depFemales.length;

            if (depCount >= 1 && depCount <= 2) {
                var mCoords = new Array(subMales.length);
                var fCoords = new Array(subFemales.length);
                var femaleSlots;
                if (maleHasCommon) { mCoords[udm.mi] = { x: -0.5 + shiftX, y: -1 + shiftY }; femaleSlots = [{ x: -0.5, y: -2 }, { x: -1.5, y: -1 }, { x: -1.5, y: 0 }]; }
                else { mCoords[udm.mi] = { x: 0 + shiftX, y: -1 + shiftY }; femaleSlots = [{ x: 0, y: -2 }, { x: -1, y: -1 }, { x: -1.5, y: 0 }]; }
                var allFemOrder = depFemales.concat(otherFemales);
                if (allFemOrder.length > femaleSlots.length) return null;
                for (var afi = 0; afi < allFemOrder.length; afi++) { fCoords[allFemOrder[afi]] = { x: femaleSlots[afi].x + shiftX, y: femaleSlots[afi].y + shiftY }; }
                if (otherMales.length > 0) {
                    var occupied = new Set();
                    occupied.add((mCoords[udm.mi].x - shiftX) + ',' + (mCoords[udm.mi].y - shiftY));
                    allFemOrder.forEach(function (fiIdx) { if (fCoords[fiIdx]) occupied.add((fCoords[fiIdx].x - shiftX) + ',' + (fCoords[fiIdx].y - shiftY)); });
                    var extraSlots = [{ x: -1.5, y: 0 }, { x: 1, y: 1 }];
                    var avail = extraSlots.filter(function (s) { return !occupied.has(s.x + ',' + s.y); });
                    if (otherMales.length > avail.length) return null;
                    for (var oi = 0; oi < otherMales.length; oi++) { mCoords[otherMales[oi]] = { x: avail[oi].x + shiftX, y: avail[oi].y + shiftY }; }
                }
                return { maleCoords: mCoords, femaleCoords: fCoords };
            }

            if (depCount === 3) {
                if (otherMales.length > 0) return null;
                if (otherFemales.length > 0) return null;
                var mCoords3 = new Array(subMales.length);
                var fCoords3 = new Array(subFemales.length);
                mCoords3[udm.mi] = { x: -1.5 + shiftX, y: 0 + shiftY };
                var slots3 = [{ x: -1.5, y: -1 }, { x: -2.5, y: 0 }, { x: -2, y: 1 }];
                for (var i3 = 0; i3 < 3; i3++) fCoords3[depFemales[i3]] = { x: slots3[i3].x + shiftX, y: slots3[i3].y + shiftY };
                return { maleCoords: mCoords3, femaleCoords: fCoords3 };
            }
            return null;
        }

        if (subMales.length === 1 && subFemales.length === 0) {
            var mCoords1 = new Array(1);
            mCoords1[0] = { x: -2.5 + shiftX, y: 0 + shiftY };
            return { maleCoords: mCoords1, femaleCoords: [] };
        }

        if (subMales.length + subFemales.length > 5) return null;
        var mCoordsC3 = new Array(subMales.length);
        var fCoordsC3 = new Array(subFemales.length);
        if (subMales.length === 3 && subFemales.length === 0) {
            malePlaceSlots = [{ x: -0.5, y: -1 }, { x: -1.5, y: 0 }, { x: 2, y: 1 }];
        } else {
            malePlaceSlots = [{ x: -0.5, y: -1 }, { x: -1.5, y: 0 }, { x: 1, y: 1 }];
        }
        var femalePlaceSlots = [{ x: -1.5, y: -1 }, { x: -1, y: -2 }, { x: -2, y: -2 }, { x: 0, y: -2 }, { x: -2.5, y: -1 }, { x: -0.5, y: -2.5 }];

        var sortedMaleIdxs = Array.from({ length: subMales.length }, function (_, i) { return i; }).sort(function (a, b) {
            return (hasCommonWithClusterFemales(subMales[a].species) ? 0 : 1) - (hasCommonWithClusterFemales(subMales[b].species) ? 0 : 1);
        });
        for (var si3 = 0; si3 < sortedMaleIdxs.length; si3++) { mCoordsC3[sortedMaleIdxs[si3]] = { x: malePlaceSlots[si3].x + shiftX, y: malePlaceSlots[si3].y + shiftY }; }
        for (var fiC3 = 0; fiC3 < subFemales.length && fiC3 < femalePlaceSlots.length; fiC3++) { fCoordsC3[fiC3] = { x: femalePlaceSlots[fiC3].x + shiftX, y: femalePlaceSlots[fiC3].y + shiftY }; }

        return { maleCoords: mCoordsC3, femaleCoords: fCoordsC3 };
    }

    // ── 阶段二：求解器 ──
    var best = null, bestArea = Infinity, found = 0;
    var strategyList = [{ strict: true, level: 3 }, { strict: true, level: 2 }, { strict: false, level: 3 }, { strict: false, level: 2 }];
    var solveAttempts = (subMales.length + subFemales.length) > 7 ? 3 : 1;

    if (isCluster) {
        if (clusterMaleSet.size === 2) { var detPl = tryDeterministicPlacement2Male(); if (detPl) { best = detPl; bestArea = 0; found = 999; } }
        if (!best && clusterMaleSet.size === 3) { var detPl3 = tryDeterministicPlacement3Male(); if (detPl3) { best = detPl3; bestArea = 0; found = 999; } }

        if (!best) {
            // 聚合模式细网格求解
            var maleHasUniqueDep = new Array(subMales.length).fill(false);
            subFemales.forEach(function (fi) {
                var fMales = [];
                subMales.forEach(function (m) { if (compatibleMap.get(m.species).has(fi.species)) fMales.push(m.idx); });
                if (fMales.length === 1) maleHasUniqueDep[fMales[0]] = true;
            });

            var createFemalesSubFine = function (strictMode, femList, compatArr, uniqueArr) {
                return femList.map(function (fi, idx) {
                    var fMales = [];
                    subMales.forEach(function (m) { if (compatibleMap.get(m.species).has(fi.species)) fMales.push(m.idx); });
                    if (fMales.length === 0) return null;
                    var stepLimit = Math.min(fMales.length, 2);
                    var isUniqueDep = (fMales.length === 1);
                    var constraints = fMales.map(function (mi) {
                        var minDist = 2, maxDist, maxDistLoose;
                        if (isUniqueDep) { maxDist = 2; maxDistLoose = undefined; }
                        else if (maleHasUniqueDep[mi]) { maxDist = 4; maxDistLoose = undefined; }
                        else { maxDist = 2; maxDistLoose = 4; }
                        if (compatArr[mi] >= 4) { maxDist = Math.max(maxDist, 8); if (maxDistLoose !== undefined) maxDistLoose = Math.max(maxDistLoose, 8); }
                        if (uniqueArr[mi] > 0 && !isUniqueDep) minDist = Math.max(minDist, 4);
                        var c = { maleIdx: mi, minDist: minDist, maxDist: maxDist, isFixed: false };
                        if (maxDistLoose !== undefined) c.maxDistLoose = maxDistLoose;
                        return c;
                    });
                    if (clusterFixedMales) {
                        clusterFixedMales.forEach(function (fm) {
                            if (compatibleMap.get(fm.species).has(fi.species)) constraints.push({ isFixed: true, fixedX: fm.fineX, fixedY: fm.fineY, minDist: 2, maxDist: 8 });
                        });
                    }
                    return { id: fi.id, species: fi.species, males: fMales, stepLimit: stepLimit, constraints: constraints, idx: idx, isShiny: fi.isShiny };
                }).filter(function (f) { return f !== null; });
            };

            // 多策略尝试（完整封锁）
            for (var si4 = 0; si4 < strategyList.length; si4++) {
                var strategy = strategyList[si4];
                var targets = buildNearbyTargets(strategy.level, subMaleCompatCount);
                var fem = createFemalesSubFine(strategy.strict, subFemales, subMaleCompatCount, subMaleUniqueCount);
                for (var t = 0; t < 200 && found < solveAttempts; t++) {
                    var pl = solvePlacementFine(fem, subMales, targets, subMaleCompatCount, subMaleUniqueCount, preOccupiedFine, fixedFemalesFine);
                    if (pl) { found++; var minX = GRID_SIZE, maxX = 0, minY = GRID_SIZE, maxY = 0; pl.maleCoords.forEach(function (c) { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y); }); pl.femaleCoords.forEach(function (c) { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y); }); var area = (maxX - minX + 1) * (maxY - minY + 1); if (area < bestArea) { bestArea = area; best = pl; } }
                }
                if (best) break;
            }

            // fallback：最小封锁
            if (!best && preOccupiedFine) {
                var minimalOccupied = new Set();
                clusterFixedMales.forEach(function (fm) { for (var dfx = -1; dfx <= 1; dfx++) for (var dfy = -1; dfy <= 1; dfy++) { var nfx = fm.fineX + dfx, nfy = fm.fineY + dfy; if (nfx >= 0 && nfx <= FINE_GRID && nfy >= 0 && nfy <= FINE_GRID) minimalOccupied.add(nfy * (FINE_GRID + 1) + nfx); } });
                if (fixedFemalesFine) { fixedFemalesFine.forEach(function (ff) { for (var dfx = -1; dfx <= 1; dfx++) for (var dfy = -1; dfy <= 1; dfy++) { var nfx = ff.fineX + dfx, nfy = ff.fineY + dfy; if (nfx >= 0 && nfx <= FINE_GRID && nfy >= 0 && nfy <= FINE_GRID) minimalOccupied.add(nfy * (FINE_GRID + 1) + nfx); } }); }
                for (var si5 = 0; si5 < strategyList.length; si5++) {
                    var strat = strategyList[si5];
                    var tgt = buildNearbyTargets(strat.level, subMaleCompatCount);
                    var femM = createFemalesSubFine(strat.strict, subFemales, subMaleCompatCount, subMaleUniqueCount);
                    for (var t2 = 0; t2 < 200 && found < solveAttempts; t2++) {
                        var plM = solvePlacementFine(femM, subMales, tgt, subMaleCompatCount, subMaleUniqueCount, minimalOccupied, fixedFemalesFine);
                        if (plM) { found++; var mnX = GRID_SIZE, mxX = 0, mnY = GRID_SIZE, mxY = 0; plM.maleCoords.forEach(function (c) { mnX = Math.min(mnX, c.x); mxX = Math.max(mxX, c.x); mnY = Math.min(mnY, c.y); mxY = Math.max(mxY, c.y); }); plM.femaleCoords.forEach(function (c) { mnX = Math.min(mnX, c.x); mxX = Math.max(mxX, c.x); mnY = Math.min(mnY, c.y); mxY = Math.max(mxY, c.y); }); var ar = (mxX - mnX + 1) * (mxY - mnY + 1); if (ar < bestArea) { bestArea = ar; best = plM; } }
                    }
                    if (best) break;
                }
            }
        }
    } else {
        // 非聚合模式：整数格求解
        var createFemalesSub = function (strictMode, femList, compatArr, uniqueArr) {
            return femList.map(function (fi, idx) {
                var fMales = []; subMales.forEach(function (m) { if (compatibleMap.get(m.species).has(fi.species)) fMales.push(m.idx); });
                if (fMales.length === 0) return null;
                var stepLimit = Math.min(fMales.length, 2);
                var constraints = fMales.map(function (mi) {
                    var minDist = 1, maxDist = stepLimit;
                    var isUniqueDep = (fMales.length === 1 && fMales[0] === mi);
                    if (isUniqueDep) maxDist = Math.max(maxDist, 2);
                    else if (compatArr[mi] >= 4) maxDist = Math.max(maxDist, 4);
                    if (uniqueArr[mi] > 0 && !isUniqueDep) minDist = Math.max(minDist, 2);
                    return { maleIdx: mi, minDist: minDist, maxDist: maxDist };
                });
                return { id: fi.id, species: fi.species, males: fMales, stepLimit: stepLimit, constraints: constraints, idx: idx, isShiny: fi.isShiny };
            }).filter(function (f) { return f !== null; });
        };

        for (var si6 = 0; si6 < strategyList.length; si6++) {
            var stratN = strategyList[si6];
            var tgtN = buildNearbyTargets(stratN.level, subMaleCompatCount);
            var femN = createFemalesSub(stratN.strict, subFemales, subMaleCompatCount, subMaleUniqueCount);
            for (var t3 = 0; t3 < 200 && found < solveAttempts; t3++) {
                var plN = solvePlacement(femN, subMales, tgtN, subMaleCompatCount, subMaleUniqueCount, null);
                if (plN) { plN = compactPlacement(plN); found++; var nX = GRID_SIZE, xX = 0, nY = GRID_SIZE, xY = 0; plN.maleCoords.forEach(function (c) { nX = Math.min(nX, c.x); xX = Math.max(xX, c.x); nY = Math.min(nY, c.y); xY = Math.max(xY, c.y); }); plN.femaleCoords.forEach(function (c) { nX = Math.min(nX, c.x); xX = Math.max(xX, c.x); nY = Math.min(nY, c.y); xY = Math.max(xY, c.y); }); var arN = (xX - nX + 1) * (xY - nY + 1); if (arN < bestArea) { bestArea = arN; best = plN; } }
            }
            if (best) break;
        }
    }

    if (!best && subMales.length + subFemales.length === 0) best = { maleCoords: [], femaleCoords: [] };
    else if (!best) return;

    // 合并聚合坐标与子问题坐标
    if (isCluster) {
        var mergedMaleCoords = new Array(males.length);
        subMales.forEach(function (m, i) { mergedMaleCoords[m.idx] = best.maleCoords[i]; });
        clusterFixedMales.forEach(function (fm) { mergedMaleCoords[fm.idx] = { x: fm.realX, y: fm.realY }; });
        var mergedFemaleCoords = new Array(coveredFemaleInstances.length);
        subFemales.forEach(function (_, i) { var origIdx = coveredFemaleInstances.indexOf(subFemales[i]); mergedFemaleCoords[origIdx] = best.femaleCoords[i]; });
        var clusterFemArrSorted = Array.from(clusterFemaleSet).sort(function (a, b) {
            var aC = subMales.some(function (m) { return compatibleMap.get(m.species).has(coveredFemaleInstances[a].species); }) ? 1 : 0;
            var bC = subMales.some(function (m) { return compatibleMap.get(m.species).has(coveredFemaleInstances[b].species); }) ? 1 : 0;
            return aC - bC;
        });
        clusterFemArrSorted.forEach(function (fi, i) { if (i < clusterFemalePositions.length) mergedFemaleCoords[fi] = { x: clusterFemalePositions[i].x + clusterShiftX, y: clusterFemalePositions[i].y + clusterShiftY }; });
        best = compactPlacement({ maleCoords: mergedMaleCoords, femaleCoords: mergedFemaleCoords });
    }

    best = centerPlacement(best);
    currentPlacement = { maleCoords: best.maleCoords, femaleCoords: best.femaleCoords, maleSlots: maleSlots, femaleInstances: coveredFemaleInstances };
    originalPlacement = { maleCoords: best.maleCoords.map(function (c) { return { x: c.x, y: c.y }; }), femaleCoords: best.femaleCoords.map(function (c) { return { x: c.x, y: c.y }; }) };
    placementArea.style.display = 'block';
    renderSVG();
}

// ── 十四、位图后处理工具 ──

function compactPlacement(pl) {
    if (!pl || (pl.maleCoords.length === 0 && pl.femaleCoords.length === 0)) return pl;
    var all = pl.maleCoords.concat(pl.femaleCoords);
    var minX = Math.min.apply(null, all.map(function (c) { return c.x; }));
    var minY = Math.min.apply(null, all.map(function (c) { return c.y; }));
    return { maleCoords: pl.maleCoords.map(function (c) { return { x: c.x - minX, y: c.y - minY }; }), femaleCoords: pl.femaleCoords.map(function (c) { return { x: c.x - minX, y: c.y - minY }; }) };
}

function centerPlacement(pl) {
    if (!pl || (pl.maleCoords.length === 0 && pl.femaleCoords.length === 0)) return pl;
    var all = pl.maleCoords.concat(pl.femaleCoords);
    var minX = Math.min.apply(null, all.map(function (c) { return c.x; }));
    var maxX = Math.max.apply(null, all.map(function (c) { return c.x; }));
    var minY = Math.min.apply(null, all.map(function (c) { return c.y; }));
    var maxY = Math.max.apply(null, all.map(function (c) { return c.y; }));
    var w = maxX - minX + 1, h = maxY - minY + 1;
    var offX = Math.round((GRID_SIZE - w + 1) / 2) - minX, offY = Math.round((GRID_SIZE - h + 1) / 2) - minY;
    return { maleCoords: pl.maleCoords.map(function (c) { return { x: c.x + offX, y: c.y + offY }; }), femaleCoords: pl.femaleCoords.map(function (c) { return { x: c.x + offX, y: c.y + offY }; }) };
}

// ── 十五、非聚合模式求解器（整数网格）──

function solvePlacement(females, males, maleNearbyTargets, maleCompatCount, maleUniqueCount, preOccupied) {
    var M = males.length;
    var GS = GRID_SIZE;

    function canStillMeetTargets(placedFemales, remainingFemales, maleCoords, malesArr, targets) {
        for (var mi = 0; mi < malesArr.length; mi++) {
            var target = targets[mi];
            if (target > 0) {
                var currentNearby = 0;
                for (var pi = 0; pi < placedFemales.length; pi++) {
                    var dist = Math.abs(placedFemales[pi].coord.x - maleCoords[mi].x) + Math.abs(placedFemales[pi].coord.y - maleCoords[mi].y);
                    if (dist <= 2 && compatibleMap.get(malesArr[mi].species).has(placedFemales[pi].species)) currentNearby++;
                }
                var potentialMax = 0;
                for (var ri = 0; ri < remainingFemales.length; ri++) { if (compatibleMap.get(malesArr[mi].species).has(remainingFemales[ri].species)) potentialMax++; }
                if (currentNearby + potentialMax < target) return false;
            }
        }
        return true;
    }

    function tryPlace(sorted, start, occupied, maleCoords) {
        if (start >= sorted.length) return true;
        var f = sorted[start];
        var cand = [];
        for (var y = 0; y < GS; y++) {
            for (var x = 0; x < GS; x++) {
                var key = y * GS + x;
                if (occupied.has(key)) continue;
                var ok = true;
                for (var ci = 0; ci < f.constraints.length; ci++) {
                    var c = f.constraints[ci];
                    var dist = Math.abs(x - maleCoords[c.maleIdx].x) + Math.abs(y - maleCoords[c.maleIdx].y);
                    if (dist < c.minDist || dist > c.maxDist) { ok = false; break; }
                }
                if (ok) cand.push({ x: x, y: y });
            }
        }
        if (cand.length === 0) return false;
        cand.sort(function (a, b) {
            var dA = f.constraints.reduce(function (s, c) { return s + Math.abs(a.x - maleCoords[c.maleIdx].x) + Math.abs(a.y - maleCoords[c.maleIdx].y); }, 0);
            var dB = f.constraints.reduce(function (s, c) { return s + Math.abs(b.x - maleCoords[c.maleIdx].x) + Math.abs(b.y - maleCoords[c.maleIdx].y); }, 0);
            return dA - dB;
        });
        for (var pi = 0; pi < cand.length; pi++) {
            var p = cand[pi];
            var key = p.y * GS + p.x; occupied.add(key); f.coord = p;
            var placed = sorted.slice(0, start + 1), remaining = sorted.slice(start + 1);
            if (canStillMeetTargets(placed, remaining, maleCoords, males, maleNearbyTargets) && tryPlace(sorted, start + 1, occupied, maleCoords)) return true;
            occupied.delete(key);
        }
        return false;
    }

    var useCenterBias = (M <= 2);
    var centerPositions = [];
    for (var cy = 2; cy <= 4; cy++) for (var cx = 2; cx <= 4; cx++) centerPositions.push({ x: cx, y: cy });

    for (var att = 0; att < 3000; att++) {
        var maleCoords = new Array(M);
        var occupied = preOccupied ? new Set(preOccupied) : new Set();
        var fail = false;
        var indices = Array.from({ length: M }, function (_, i) { return i; }).sort(function (a, b) {
            var aU = maleUniqueCount[a] > 0, bU = maleUniqueCount[b] > 0;
            if (aU !== bU) return aU ? 1 : -1;
            if (aU) return maleCompatCount[b] - maleCompatCount[a];
            return maleCompatCount[a] - maleCompatCount[b];
        });
        for (var ii = 0; ii < indices.length; ii++) {
            var mi = indices[ii];
            var x, y, tries = 0;
            if (useCenterBias && (maleUniqueCount[mi] > 0 || maleCompatCount[mi] >= 4)) {
                var availableCenters = centerPositions.filter(function (p) { return !occupied.has(p.y * GS + p.x); });
                if (availableCenters.length > 0) { var rand = Math.floor(myRandom() * availableCenters.length); x = availableCenters[rand].x; y = availableCenters[rand].y; }
                else { do { x = Math.floor(myRandom() * GS); y = Math.floor(myRandom() * GS); tries++; } while (occupied.has(y * GS + x) && tries < 100); }
            } else { do { x = Math.floor(myRandom() * GS); y = Math.floor(myRandom() * GS); tries++; } while (occupied.has(y * GS + x) && tries < 100); }
            if (tries >= 100) { fail = true; break; }
            occupied.add(y * GS + x); maleCoords[mi] = { x: x, y: y };
        }
        if (fail) continue;
        var malePositionOrder = new Array(M); indices.forEach(function (mi, pos) { malePositionOrder[mi] = pos; });
        var sorted = females.slice().sort(function (a, b) {
            var aU = a.males.length === 1, bU = b.males.length === 1;
            if (aU !== bU) return aU ? 1 : -1;
            if (aU) return malePositionOrder[a.males[0]] - malePositionOrder[b.males[0]];
            if (a.stepLimit !== b.stepLimit) return a.stepLimit - b.stepLimit;
            if (a.males.length !== b.males.length) return a.males.length - b.males.length;
            var minA = Math.min.apply(null, a.males.map(function (mi) { return maleCompatCount[mi]; }));
            var minB = Math.min.apply(null, b.males.map(function (mi) { return maleCompatCount[mi]; }));
            return minA - minB;
        });
        var occCopy = new Set(occupied);
        if (tryPlace(sorted, 0, occCopy, maleCoords)) {
            sorted.forEach(function (f) { var orig = females.find(function (e) { return e.id === f.id; }); if (orig) orig.coord = f.coord; });
            return { maleCoords: maleCoords, femaleCoords: females.map(function (f) { return f.coord; }) };
        }
    }
    return null;
}

// ── 十六、聚合模式求解器（细网格）──

function solvePlacementFine(females, freeMales, maleNearbyTargets, maleCompatCount, maleUniqueCount, preOccupied, fixedFemalesFine) {
    var M = freeMales.length;
    var GRID = FINE_GRID;
    var gridMin = 1, gridMax = FINE_GRID - 1;
    var keyStride = FINE_GRID + 1;
    var nearbyRange = 4;
    var chebyshevBlockR = 1;

    function isOccupied(occupied, gx, gy) { return occupied.has(gy * keyStride + gx); }
    function blockChebyshev(occupied, gx, gy, r) { for (var dfx = -r; dfx <= r; dfx++) for (var dfy = -r; dfy <= r; dfy++) { var nx = gx + dfx, ny = gy + dfy; if (nx >= gridMin && nx <= gridMax && ny >= gridMin && ny <= gridMax) occupied.add(ny * keyStride + nx); } }
    function unblockChebyshev(occupied, gx, gy, r) { for (var dfx = -r; dfx <= r; dfx++) for (var dfy = -r; dfy <= r; dfy++) { var nx = gx + dfx, ny = gy + dfy; if (nx >= gridMin && nx <= gridMax && ny >= gridMin && ny <= gridMax) occupied.delete(ny * keyStride + nx); } }

    function getFixedFemaleCandidates(occupied, mSpecies, range) {
        if (!fixedFemalesFine || fixedFemalesFine.length === 0) return null;
        var cands = [];
        for (var fi = 0; fi < fixedFemalesFine.length; fi++) {
            var ff = fixedFemalesFine[fi];
            if (!compatibleMap.get(mSpecies).has(ff.species)) continue;
            for (var dfx = -range; dfx <= range; dfx++) {
                var remain = range - Math.abs(dfx);
                for (var dfy = -remain; dfy <= remain; dfy++) {
                    var nx = ff.fineX + dfx, ny = ff.fineY + dfy;
                    if (nx >= gridMin && nx <= gridMax && ny >= gridMin && ny <= gridMax && !isOccupied(occupied, nx, ny)) cands.push({ x: nx, y: ny });
                }
            }
        }
        return cands.length > 0 ? cands : null;
    }

    function canStillMeetTargets(placedFemales, remainingFemales, maleCoords, malesArr, targets) {
        for (var mi = 0; mi < malesArr.length; mi++) {
            var target = targets[mi];
            if (target > 0) {
                var curNear = 0;
                for (var pi = 0; pi < placedFemales.length; pi++) {
                    var dist = Math.abs(placedFemales[pi].coord.x - maleCoords[mi].x) + Math.abs(placedFemales[pi].coord.y - maleCoords[mi].y);
                    if (dist <= nearbyRange && compatibleMap.get(malesArr[mi].species).has(placedFemales[pi].species)) curNear++;
                }
                var potMax = 0;
                for (var ri = 0; ri < remainingFemales.length; ri++) { if (compatibleMap.get(malesArr[mi].species).has(remainingFemales[ri].species)) potMax++; }
                if (curNear + potMax < target) return false;
            }
        }
        return true;
    }

    function getCandidatesForFemale(f, maleCoords, occupied, useLoose) {
        var cand = [];
        for (var gy = gridMin; gy <= gridMax; gy++) {
            for (var gx = gridMin; gx <= gridMax; gx++) {
                if (isOccupied(occupied, gx, gy)) continue;
                var ok = true;
                for (var ci = 0; ci < f.constraints.length; ci++) {
                    var c = f.constraints[ci];
                    var mx = c.isFixed ? c.fixedX : maleCoords[c.maleIdx].x;
                    var my = c.isFixed ? c.fixedY : maleCoords[c.maleIdx].y;
                    var dist = Math.abs(gx - mx) + Math.abs(gy - my);
                    var maxD = (useLoose && c.maxDistLoose !== undefined) ? c.maxDistLoose : c.maxDist;
                    if (dist < c.minDist || dist > maxD) { ok = false; break; }
                }
                if (ok) cand.push({ x: gx, y: gy });
            }
        }
        return cand;
    }

    function tryPlace(sorted, start, occupied, maleCoords) {
        if (start >= sorted.length) return true;
        var f = sorted[start];
        var cand = getCandidatesForFemale(f, maleCoords, occupied, false);
        if (cand.length === 0 && f.constraints.some(function (c) { return c.maxDistLoose !== undefined; })) cand = getCandidatesForFemale(f, maleCoords, occupied, true);
        if (cand.length === 0) return false;
        cand.sort(function (a, b) {
            var dA = f.constraints.reduce(function (s, c) { var mx = c.isFixed ? c.fixedX : maleCoords[c.maleIdx].x; var my = c.isFixed ? c.fixedY : maleCoords[c.maleIdx].y; return s + Math.abs(a.x - mx) + Math.abs(a.y - my); }, 0);
            var dB = f.constraints.reduce(function (s, c) { var mx = c.isFixed ? c.fixedX : maleCoords[c.maleIdx].x; var my = c.isFixed ? c.fixedY : maleCoords[c.maleIdx].y; return s + Math.abs(b.x - mx) + Math.abs(b.y - my); }, 0);
            return dA - dB;
        });
        for (var pi = 0; pi < cand.length; pi++) {
            var p = cand[pi];
            blockChebyshev(occupied, p.x, p.y, chebyshevBlockR); f.coord = p;
            var placed = sorted.slice(0, start + 1), remaining = sorted.slice(start + 1);
            if (canStillMeetTargets(placed, remaining, maleCoords, freeMales, maleNearbyTargets) && tryPlace(sorted, start + 1, occupied, maleCoords)) return true;
            unblockChebyshev(occupied, p.x, p.y, chebyshevBlockR);
        }
        return false;
    }

    var useCenterBias = (M <= 2);
    var centerPositions = [];
    for (var gy = 2; gy <= FINE_GRID - 2; gy++) for (var gx = 2; gx <= FINE_GRID - 2; gx++) centerPositions.push({ x: gx, y: gy });

    for (var att = 0; att < 3000; att++) {
        var maleCoords = new Array(M);
        var occupied = preOccupied ? new Set(preOccupied) : new Set();
        var fail = false;
        var indices = Array.from({ length: M }, function (_, i) { return i; }).sort(function (a, b) {
            var aU = maleUniqueCount[a] > 0, bU = maleUniqueCount[b] > 0;
            if (aU !== bU) return aU ? 1 : -1;
            if (aU) return maleCompatCount[b] - maleCompatCount[a];
            return maleCompatCount[a] - maleCompatCount[b];
        });
        for (var ii = 0; ii < indices.length; ii++) {
            var mi = indices[ii];
            var mSpecies = freeMales[mi].species;
            var gx, gy, tries = 0, placed = false;
            var hasCompatFixedFemale = fixedFemalesFine && fixedFemalesFine.some(function (ff) { return compatibleMap.get(mSpecies).has(ff.species); });
            if (hasCompatFixedFemale) {
                var range = 4;
                while (range <= 6 && !placed) {
                    var biasCands = getFixedFemaleCandidates(occupied, mSpecies, range);
                    if (biasCands && biasCands.length > 0) {
                        var dedup = new Map(); biasCands.forEach(function (c) { dedup.set(c.y * keyStride + c.x, c); });
                        var uniq = Array.from(dedup.values());
                        var rand = Math.floor(myRandom() * Math.min(uniq.length, 30));
                        gx = uniq[rand].x; gy = uniq[rand].y; placed = true;
                    } else range += 2;
                }
                if (!placed) { fail = true; break; }
            } else if (useCenterBias && (maleUniqueCount[mi] > 0 || maleCompatCount[mi] >= 4)) {
                var availCenter = centerPositions.filter(function (p) { return !isOccupied(occupied, p.x, p.y); });
                if (availCenter.length > 0) { var rand2 = Math.floor(myRandom() * availCenter.length); gx = availCenter[rand2].x; gy = availCenter[rand2].y; placed = true; }
            }
            if (!placed) {
                do { gx = 1 + Math.floor(myRandom() * (FINE_GRID - 1)); gy = 1 + Math.floor(myRandom() * (FINE_GRID - 1)); tries++; } while (isOccupied(occupied, gx, gy) && tries < 200);
                if (tries >= 200) { fail = true; break; }
            }
            blockChebyshev(occupied, gx, gy, chebyshevBlockR);
            maleCoords[mi] = { x: gx, y: gy };
        }
        if (fail) continue;
        var malePositionOrder = new Array(M); indices.forEach(function (mi, pos) { malePositionOrder[mi] = pos; });
        var sorted = females.slice().sort(function (a, b) {
            var aU = a.males.length === 1, bU = b.males.length === 1;
            if (aU !== bU) return aU ? 1 : -1;
            if (aU) return malePositionOrder[a.males[0]] - malePositionOrder[b.males[0]];
            if (a.stepLimit !== b.stepLimit) return a.stepLimit - b.stepLimit;
            if (a.males.length !== b.males.length) return a.males.length - b.males.length;
            var minA = Math.min.apply(null, a.males.map(function (mi) { return maleCompatCount[mi]; }));
            var minB = Math.min.apply(null, b.males.map(function (mi) { return maleCompatCount[mi]; }));
            return minA - minB;
        });
        var occCopy = new Set(occupied);
        if (tryPlace(sorted, 0, occCopy, maleCoords)) {
            sorted.forEach(function (f) { var orig = females.find(function (e) { return e.id === f.id; }); if (orig) orig.coord = f.coord; });
            return { maleCoords: maleCoords.map(function (c) { return { x: c.x / 2, y: c.y / 2 }; }), femaleCoords: females.map(function (f) { return { x: f.coord.x / 2, y: f.coord.y / 2 }; }) };
        }
    }
    return null;
}

// ── 十七、半格坐标的最近空闲搜索 ──
/** 用方案数据的字符串哈希生成独立随机种子，隔离外部影响 */
var _randState = 0;
function reseedRandomFromResult(res) {
    var str = '';
    res.femaleInstances.forEach(function(f) { str += f.species + '|' + f.id + ','; });
    res.allMaleSlots.forEach(function(m) { str += m.species + '|' + (m.isShiny ? 1 : 0) + ','; });
    // 简单字符串哈希 → 32 位种子
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        var ch = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + ch;
        hash |= 0;
    }
    _randState = Math.abs(hash) || 1;
}

/** 替代 myRandom()，使用独立的线性同余生成器 */
function myRandom() {
    _randState = (_randState * 1664525 + 1013904223) | 0;
    return (_randState >>> 0) / 4294967296;
}

function findNearestFreePositionHalf(desiredX, desiredY, occupiedSet) {
    var fineX = Math.round(desiredX * 2), fineY = Math.round(desiredY * 2);
    var fineKey = fineY * (FINE_GRID + 1) + fineX;
    if (!occupiedSet.has(fineKey)) return { x: fineX / 2, y: fineY / 2 };
    var maxFineDist = 8;
    var queue = [{ fx: fineX, fy: fineY, dist: 0 }];
    var visited = new Set(); visited.add(fineKey);
    var dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (var head = 0; head < queue.length; head++) {
        var cur = queue[head];
        if (cur.dist >= maxFineDist) continue;
        for (var di = 0; di < dirs.length; di++) {
            var dx = dirs[di][0], dy = dirs[di][1];
            var nfx = cur.fx + dx, nfy = cur.fy + dy;
            if (nfx < 1 || nfx > FINE_GRID - 1 || nfy < 1 || nfy > FINE_GRID - 1) continue;
            var nk = nfy * (FINE_GRID + 1) + nfx;
            if (visited.has(nk)) continue;
            visited.add(nk);
            if (!occupiedSet.has(nk)) return { x: nfx / 2, y: nfy / 2 };
            queue.push({ fx: nfx, fy: nfy, dist: cur.dist + 1 });
        }
    }
    return null;
}
