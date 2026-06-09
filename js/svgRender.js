// ╔══════════════════════════════════════════════════════════════╗
// ║          十八、SVG 渲染（位置图 + 连线 + 拖动）                 ║
// ╚══════════════════════════════════════════════════════════════╝

// ── SVG 颜色常量 ──
var SVG_COLORS = {
    gridLine: '#d4b68c',
    connectionLine: '#4a8',
    femaleFill: 'rgba(248,200,200,0.8)',
    femaleStroke: '#d89b9b',
    femaleText: '#8b3a3a',
    maleFill: 'rgba(200,220,240,0.8)',
    maleStroke: '#7a9bcb',
    maleText: '#2c3e50',
    persTagBg: '#2d6a4f',
    medalTagBg: '#c7851a',
    tagText: '#fff',
    starColor: '#e6a317',
    exportBg: '#faf3e8'
};

function renderSVG() {
    svgContainer.innerHTML = '';
    var scale = 60;
    var width = GRID_SIZE * scale;
    var height = GRID_SIZE * scale;
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.style.width = '100%'; svg.style.height = 'auto';
    svg.style.touchAction = 'none'; svg.style.userSelect = 'none'; svg.style.webkitUserSelect = 'none';

    // 细网格线
    for (var i = 0; i <= FINE_GRID; i++) {
        var pos = i * (scale / 2);
        var lh = document.createElementNS(svgNS, 'line');
        lh.setAttribute('x1', 0); lh.setAttribute('y1', pos); lh.setAttribute('x2', width); lh.setAttribute('y2', pos);
        lh.setAttribute('stroke', SVG_COLORS.gridLine); lh.setAttribute('stroke-width', '1'); svg.appendChild(lh);
        var lv = document.createElementNS(svgNS, 'line');
        lv.setAttribute('x1', pos); lv.setAttribute('y1', 0); lv.setAttribute('x2', pos); lv.setAttribute('y2', height);
        lv.setAttribute('stroke', SVG_COLORS.gridLine); lv.setAttribute('stroke-width', '1'); svg.appendChild(lv);
    }

    var linesGroup = document.createElementNS(svgNS, 'g'); svg.appendChild(linesGroup);
    var squaresGroup = document.createElementNS(svgNS, 'g'); svg.appendChild(squaresGroup);

    function toCenterX(x) { return x * scale; }
    function toCenterY(y) { return y * scale; }

    function drawLines() {
        linesGroup.innerHTML = '';
        var mc = currentPlacement.maleCoords, fc = currentPlacement.femaleCoords;
        var ms = currentPlacement.maleSlots, fi = currentPlacement.femaleInstances;
        mc.forEach(function (mc2, mi) {
            var comp = compatibleMap.get(ms[mi].species);
            fc.forEach(function (fc2, fi2) {
                if (!comp.has(fi[fi2].species)) return;
                var dx = Math.abs(mc2.x - fc2.x), dy = Math.abs(mc2.y - fc2.y);
                if (dx + dy > 2.5 || Math.max(dx, dy) > 2) return;
                var line = document.createElementNS(svgNS, 'line');
                line.setAttribute('x1', toCenterX(mc2.x)); line.setAttribute('y1', toCenterY(mc2.y));
                line.setAttribute('x2', toCenterX(fc2.x)); line.setAttribute('y2', toCenterY(fc2.y));
                line.setAttribute('stroke', SVG_COLORS.connectionLine); line.setAttribute('stroke-width', '2.5'); line.setAttribute('opacity', '0.7');
                linesGroup.appendChild(line);
            });
        });
    }

    function drawSquares() {
        squaresGroup.innerHTML = '';
        var mc = currentPlacement.maleCoords, fc = currentPlacement.femaleCoords;
        var ms = currentPlacement.maleSlots, fi = currentPlacement.femaleInstances;
        var rectWidth = scale - 4, rectHeight = scale - 4;
        function measureTextWidth(text, fontSize) {
            var tmp = document.createElementNS(svgNS, 'svg');
            tmp.style.position = 'absolute'; tmp.style.visibility = 'hidden';
            var t = document.createElementNS(svgNS, 'text');
            t.setAttribute('font-size', fontSize);
            t.textContent = text;
            tmp.appendChild(t);
            document.body.appendChild(tmp);
            var w = t.getComputedTextLength();
            document.body.removeChild(tmp);
            return w;
        }
        function createAttrLabel(text, x, y, bgColor, textColor, fontSize) {
            fontSize = fontSize || '8.5';
            var tw = measureTextWidth(text, fontSize);
            var padH = 5, padV = 2, lineH = 12;
            var r = document.createElementNS(svgNS, 'rect');
            r.setAttribute('x', x); r.setAttribute('y', y);
            r.setAttribute('width', tw + padH * 2); r.setAttribute('height', lineH);
            r.setAttribute('fill', bgColor); r.setAttribute('rx', '3'); r.setAttribute('ry', '3');
            r.setAttribute('pointer-events', 'none');
            squaresGroup.appendChild(r);
            var t = document.createElementNS(svgNS, 'text');
            t.setAttribute('x', x + padH); t.setAttribute('y', y + lineH - padV);
            t.setAttribute('fill', textColor); t.setAttribute('font-size', fontSize);
            t.setAttribute('font-weight', '500');
            t.textContent = text;
            t.setAttribute('pointer-events', 'none'); t.style.userSelect = 'none';
            squaresGroup.appendChild(t);
            return lineH + 2;
        }

        fc.forEach(function (coord, i) {
            var f = fi[i]; if (!f) return;
            var idx = f._displayIdx !== undefined ? f._displayIdx : i;
            var total = f._displayTotal || fi.filter(function (ff) { return ff.species === f.species; }).length || 1;
            var cx = toCenterX(coord.x), cy = toCenterY(coord.y);

            var rect = document.createElementNS(svgNS, 'rect');
            rect.setAttribute('x', cx - rectWidth / 2); rect.setAttribute('y', cy - rectHeight / 2);
            rect.setAttribute('width', rectWidth); rect.setAttribute('height', rectHeight);
            rect.setAttribute('fill', SVG_COLORS.femaleFill); rect.setAttribute('stroke', SVG_COLORS.femaleStroke);
            rect.setAttribute('stroke-width', '2'); rect.setAttribute('rx', '6');
            rect.classList.add('female-square'); rect.dataset.type = 'female'; rect.dataset.index = i;
            squaresGroup.appendChild(rect);

            var iconT = document.createElementNS(svgNS, 'text');
            iconT.setAttribute('x', cx); iconT.setAttribute('y', cy);
            iconT.setAttribute('text-anchor', 'middle'); iconT.setAttribute('fill', SVG_COLORS.femaleText); iconT.setAttribute('font-size', '14');
            iconT.textContent = '♀️'; iconT.setAttribute('pointer-events', 'none'); iconT.style.userSelect = 'none';
            squaresGroup.appendChild(iconT);

            var nameT = document.createElementNS(svgNS, 'text');
            nameT.setAttribute('x', cx); nameT.setAttribute('y', cy + 24);
            nameT.setAttribute('text-anchor', 'middle'); nameT.setAttribute('fill', SVG_COLORS.femaleText); nameT.setAttribute('font-size', '10');
            nameT.textContent = getDisplayName(f.species, idx, total);
            nameT.setAttribute('pointer-events', 'none'); nameT.style.userSelect = 'none';
            squaresGroup.appendChild(nameT);

            // 性格 & 奖牌 — 左上角独立图层
            var tagX = cx - rectWidth / 2 + 2;
            var tagY = cy - rectHeight / 2 + 3;
            if (f.personality) {
                var ap = getPersonalityByName(f.personality);
                if (ap) { tagY += createAttrLabel('🎭' + ap.name, tagX, tagY, SVG_COLORS.persTagBg, SVG_COLORS.tagText, '8.5'); }
            }
            if (f.medals) {
                var medalKeys = Object.keys(f.medals);
                for (var mk = 0; mk < medalKeys.length; mk++) {
                    var am = getMedalById(f.medals[medalKeys[mk]]);
                    if (am) { tagY += createAttrLabel((am.icon || '') + am.name, tagX, tagY, SVG_COLORS.medalTagBg, SVG_COLORS.tagText, '8.5'); }
                }
            }

            if (f.isShiny) {
                var star = document.createElementNS(svgNS, 'text');
                star.setAttribute('x', cx + rectWidth / 2 - 8); star.setAttribute('y', cy - rectHeight / 2 + 14);
                star.setAttribute('text-anchor', 'middle'); star.setAttribute('fill', SVG_COLORS.starColor); star.setAttribute('font-size', '14'); star.setAttribute('font-weight', 'bold');
                star.textContent = '⭐'; star.setAttribute('pointer-events', 'none');
                squaresGroup.appendChild(star);
            }
        });

        mc.forEach(function (coord, i) {
            var m = ms[i]; if (!m) return;
            var idx = m._displayIdx !== undefined ? m._displayIdx : i;
            var total = m._displayTotal || ms.filter(function (mm) { return mm.species === m.species; }).length || 1;
            var cx = toCenterX(coord.x), cy = toCenterY(coord.y);

            var rect = document.createElementNS(svgNS, 'rect');
            rect.setAttribute('x', cx - rectWidth / 2); rect.setAttribute('y', cy - rectHeight / 2);
            rect.setAttribute('width', rectWidth); rect.setAttribute('height', rectHeight);
            rect.setAttribute('fill', SVG_COLORS.maleFill); rect.setAttribute('stroke', SVG_COLORS.maleStroke);
            rect.setAttribute('stroke-width', '2'); rect.setAttribute('rx', '6');
            rect.classList.add('male-square'); rect.dataset.type = 'male'; rect.dataset.index = i;
            squaresGroup.appendChild(rect);

            var iconT = document.createElementNS(svgNS, 'text');
            iconT.setAttribute('x', cx); iconT.setAttribute('y', cy);
            iconT.setAttribute('text-anchor', 'middle'); iconT.setAttribute('fill', SVG_COLORS.maleText); iconT.setAttribute('font-size', '14');
            iconT.textContent = m.locked ? '🔒♂️' : '♂️'; iconT.setAttribute('pointer-events', 'none'); iconT.style.userSelect = 'none';
            squaresGroup.appendChild(iconT);

            var nameT = document.createElementNS(svgNS, 'text');
            nameT.setAttribute('x', cx); nameT.setAttribute('y', cy + 24);
            nameT.setAttribute('text-anchor', 'middle'); nameT.setAttribute('fill', SVG_COLORS.maleText); nameT.setAttribute('font-size', '10');
            nameT.textContent = getDisplayName(m.species, idx, total);
            nameT.setAttribute('pointer-events', 'none'); nameT.style.userSelect = 'none';
            squaresGroup.appendChild(nameT);

            // 性格 & 奖牌 — 左上角
            var tagX = cx - rectWidth / 2 + 2;
            var tagY = cy - rectHeight / 2 + 3;
            if (m.personality) {
                var mp2 = getPersonalityByName(m.personality);
                if (mp2) { tagY += createAttrLabel('🎭' + mp2.name, tagX, tagY, SVG_COLORS.persTagBg, SVG_COLORS.tagText, '8.5'); }
            }
            if (m.medals) {
                var medalKeys = Object.keys(m.medals);
                for (var mk = 0; mk < medalKeys.length; mk++) {
                    var mm2 = getMedalById(m.medals[medalKeys[mk]]);
                    if (mm2) { tagY += createAttrLabel((mm2.icon || '') + mm2.name, tagX, tagY, SVG_COLORS.medalTagBg, SVG_COLORS.tagText, '8.5'); }
                }
            }

            if (m.isShiny) {
                var star = document.createElementNS(svgNS, 'text');
                star.setAttribute('x', cx + rectWidth / 2 - 8); star.setAttribute('y', cy - rectHeight / 2 + 14);
                star.setAttribute('text-anchor', 'middle'); star.setAttribute('fill', SVG_COLORS.starColor); star.setAttribute('font-size', '14'); star.setAttribute('font-weight', 'bold');
                star.textContent = '⭐'; star.setAttribute('pointer-events', 'none');
                squaresGroup.appendChild(star);
            }
        });

        attachDragEvents();
    }

    function attachDragEvents() {
        var draggableElements = svg.querySelectorAll('.female-square, .male-square');
        var dragTarget = null, originalCoord = null, startClientX = 0, startClientY = 0;

        function onStart(e, type, index) {
            e.preventDefault();
            var clientX = e.touches ? e.touches[0].clientX : e.clientX;
            var clientY = e.touches ? e.touches[0].clientY : e.clientY;
            dragTarget = { type: type, index: index };
            var points = type === 'female' ? currentPlacement.femaleCoords : currentPlacement.maleCoords;
            originalCoord = { x: points[index].x, y: points[index].y };
            startClientX = clientX; startClientY = clientY;
            svg.querySelectorAll('.female-square, .male-square').forEach(function (sq) { sq.classList.remove('dragging'); });
            var sel = type === 'female' ? '.female-square[data-index="' + index + '"]' : '.male-square[data-index="' + index + '"]';
            var el = svg.querySelector(sel); if (el) el.classList.add('dragging');
            window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onEnd);
            window.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', onEnd);
        }

        function onMove(e) {
            if (!dragTarget) return;
            e.preventDefault();
            var clientX = e.touches ? e.touches[0].clientX : e.clientX;
            var clientY = e.touches ? e.touches[0].clientY : e.clientY;
            var svgRect = svg.getBoundingClientRect();
            var scaleX = svgRect.width / width, scaleY = svgRect.height / height;
            var dx = (clientX - startClientX) / (scale * scaleX);
            var dy = (clientY - startClientY) / (scale * scaleY);
            var gridDX = Math.round(dx * 2) / 2, gridDY = Math.round(dy * 2) / 2;
            var desiredX = originalCoord.x + gridDX, desiredY = originalCoord.y + gridDY;
            desiredX = Math.max(0.5, Math.min(GRID_SIZE - 0.5, desiredX));
            desiredY = Math.max(0.5, Math.min(GRID_SIZE - 0.5, desiredY));
            var allCoords = currentPlacement.maleCoords.concat(currentPlacement.femaleCoords);
            var targetGlobalIndex = dragTarget.type === 'female' ? currentPlacement.maleCoords.length + dragTarget.index : dragTarget.index;
            var baseOccupied = new Set();
            allCoords.forEach(function (p, i) {
                if (i !== targetGlobalIndex) { var fx = Math.round(p.x * 2), fy = Math.round(p.y * 2); baseOccupied.add(fy * (FINE_GRID + 1) + fx); }
            });
            var occupiedSet = new Set(baseOccupied);
            var NEIGHBORS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
            baseOccupied.forEach(function (key) {
                var fy = Math.floor(key / (FINE_GRID + 1)), fx = key % (FINE_GRID + 1);
                NEIGHBORS.forEach(function (nd) { var nfx = fx + nd[0], nfy = fy + nd[1]; if (nfx >= 0 && nfx <= FINE_GRID && nfy >= 0 && nfy <= FINE_GRID) occupiedSet.add(nfy * (FINE_GRID + 1) + nfx); });
            });
            var freePos = findNearestFreePositionHalf(desiredX, desiredY, occupiedSet);
            if (freePos) {
                var points = dragTarget.type === 'female' ? currentPlacement.femaleCoords : currentPlacement.maleCoords;
                points[dragTarget.index] = { x: freePos.x, y: freePos.y };
                if (freePos.x !== desiredX || freePos.y !== desiredY) { originalCoord = { x: freePos.x, y: freePos.y }; startClientX = clientX; startClientY = clientY; }
                drawSquares(); drawLines();
            }
        }

        function onEnd() {
            if (dragTarget) svg.querySelectorAll('.female-square, .male-square').forEach(function (sq) { sq.classList.remove('dragging'); });
            dragTarget = null;
            window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd);
        }

        draggableElements.forEach(function (el) {
            el.addEventListener('mousedown', function (e) { onStart(e, el.dataset.type, parseInt(el.dataset.index)); });
            el.addEventListener('touchstart', function (e) { onStart(e, el.dataset.type, parseInt(el.dataset.index)); }, { passive: false });
        });
    }

    drawSquares(); drawLines();
    svgContainer.appendChild(svg);
}

function exportPlacementImage() {
    if (placementArea.style.display === 'none') return;
    html2canvas(svgContainer, { backgroundColor: SVG_COLORS.exportBg, scale: 2 }).then(function (canvas) {
        var a = document.createElement('a'); a.download = '配窝位置图.png'; a.href = canvas.toDataURL(); a.click();
    });
}
