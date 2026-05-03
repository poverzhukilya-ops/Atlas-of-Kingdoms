// --------------------------------------------------------------
// 1. ДАННЫЕ КОРОЛЕВСТВ (население + визуальные параметры)
// --------------------------------------------------------------
let kingdoms = [
    { id: 1, name: "Nova Corp",      population: 1245678, avatar: "N", color: "#e63946", channel: "novacorp" },
    { id: 2, name: "Stellar Alliance",population: 980000,  avatar: "S", color: "#457b9d", channel: "stellar" },
    { id: 3, name: "Crimson Dynasty", population: 850000,  avatar: "C", color: "#f4a261", channel: "crimson" },
    { id: 4, name: "Hewa Marn",      population: 720000,  avatar: "H", color: "#2a9d8f", channel: "hewamarn" },
    { id: 5, name: "Astraea Republic",population: 610000,  avatar: "A", color: "#9c89b8", channel: "astraea" },
    { id: 6, name: "Umlea Dynasty",   population: 480000,  avatar: "U", color: "#e9c46a", channel: "umlea" },
    { id: 7, name: "MyKingdom",       population: 320000,  avatar: "M", color: "#6c91b2", channel: "mykingdom" },
    { id: 8, name: "Tikahan",         population: 210000,  avatar: "T", color: "#e76f51", channel: "tikahan" }
];

// Вычисляем проценты территории на основе населения
function computeTerritoryPercent() {
    const totalPop = kingdoms.reduce((s, k) => s + k.population, 0);
    kingdoms.forEach(k => {
        k.territory = (k.population / totalPop) * 100;
    });
    return totalPop;
}
let totalCitizens = computeTerritoryPercent();

// --------------------------------------------------------------
// 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ КАРТЫ
// --------------------------------------------------------------
let selectedKingdomId = null;
let tileGrid = [];
let tileSize = 20;
let gridW, gridH;
let regionCenters = {};

const canvas = document.getElementById('worldMap');
const ctx = canvas.getContext('2d');
let W, H;

// --------------------------------------------------------------
// 3. ГЕНЕРАЦИЯ ТЕРРИТОРИЙ (один раз при загрузке)
// --------------------------------------------------------------
function generateTileRegions() {
    gridW = Math.floor(W / tileSize);
    gridH = Math.floor(H / tileSize);
    const totalTiles = gridW * gridH;

    // Целевое количество тайлов для каждого королевства строго по проценту
    let targetTiles = kingdoms.map(k => Math.floor((k.territory / 100) * totalTiles));
    let sum = targetTiles.reduce((a, b) => a + b, 0);
    // Остаток отдаём самому большому по населению
    const maxIdx = kingdoms.reduce((iMax, k, i, arr) => k.population > arr[iMax].population ? i : iMax, 0);
    targetTiles[maxIdx] += totalTiles - sum;

    // Небольшая отладка в консоль (можно убрать)
    console.table(kingdoms.map((k, i) => ({
        name: k.name,
        expectedPercent: k.territory.toFixed(1),
        targetTiles: targetTiles[i],
        realPercent: ((targetTiles[i] / totalTiles) * 100).toFixed(1)
    })));

    let grid = Array.from({ length: gridH }, () => Array(gridW).fill(-1));
    let seeds = [];

    // Размещаем семена (начальные точки) случайно, но без пересечений
    for (let idx = 0; idx < kingdoms.length; idx++) {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 2000) {
            let x = Math.floor(Math.random() * gridW);
            let y = Math.floor(Math.random() * gridH);
            if (grid[y][x] === -1) {
                grid[y][x] = idx;
                seeds.push({ x, y, idx, remaining: targetTiles[idx] - 1 });
                placed = true;
            }
            attempts++;
        }
        // fallback – ищем любую свободную клетку
        if (!placed) {
            for (let y = 0; y < gridH; y++) {
                let found = false;
                for (let x = 0; x < gridW; x++) {
                    if (grid[y][x] === -1) {
                        grid[y][x] = idx;
                        seeds.push({ x, y, idx, remaining: targetTiles[idx] - 1 });
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        }
    }

    function getNeighbors(x, y) {
        let n = [];
        if (x > 0)       n.push({ x: x-1, y });
        if (x < gridW-1) n.push({ x: x+1, y });
        if (y > 0)       n.push({ x, y: y-1 });
        if (y < gridH-1) n.push({ x, y: y+1 });
        return n;
    }

    let queue = [...seeds];
    let totalPlaced = seeds.length;

    while (totalPlaced < totalTiles && queue.length > 0) {
        let ri = Math.floor(Math.random() * queue.length);
        let cur = queue[ri];
        let nb = getNeighbors(cur.x, cur.y);
        // случайный порядок соседей
        for (let i = nb.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [nb[i], nb[j]] = [nb[j], nb[i]];
        }
        let claimed = false;
        for (let cell of nb) {
            if (grid[cell.y][cell.x] === -1 && cur.remaining > 0) {
                grid[cell.y][cell.x] = cur.idx;
                cur.remaining--;
                totalPlaced++;
                queue.push({ x: cell.x, y: cell.y, idx: cur.idx, remaining: cur.remaining });
                claimed = true;
                break;
            }
        }
        if (!claimed) queue.splice(ri, 1);
    }

    // Если остались незаполненные клетки – заливаем ближайшим семенем (по евклидову расстоянию)
    for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
            if (grid[y][x] !== -1) continue;
            let best = 0, bestD = Infinity;
            for (let s of seeds) {
                let d = Math.hypot(x - s.x, y - s.y);
                if (d < bestD) { bestD = d; best = s.idx; }
            }
            grid[y][x] = best;
        }
    }
    return grid;
}

// Пересчёт центров регионов (для подписей)
function recalcCenters() {
    const raw = {};
    for (let k of kingdoms) raw[k.id] = { sumX: 0, sumY: 0, count: 0 };
    for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
            const k = kingdoms[tileGrid[y][x]];
            raw[k.id].sumX += x * tileSize + tileSize / 2;
            raw[k.id].sumY += y * tileSize + tileSize / 2;
            raw[k.id].count++;
        }
    }
    regionCenters = {};
    for (let k of kingdoms) {
        if (raw[k.id].count > 0) {
            regionCenters[k.id] = {
                cx: raw[k.id].sumX / raw[k.id].count,
                cy: raw[k.id].sumY / raw[k.id].count
            };
        }
    }
}

// --------------------------------------------------------------
// 4. ОТРИСОВКА КАРТЫ (без перегенерации!)
// --------------------------------------------------------------
function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawMap() {
    if (!ctx || !tileGrid.length) return;

    // 1. Заливка тайлов
    for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
            ctx.fillStyle = kingdoms[tileGrid[y][x]].color;
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
    }

    // 2. Границы между разными королевствами (чёрные линии)
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
            const cur = tileGrid[y][x];
            if (x + 1 < gridW && tileGrid[y][x+1] !== cur) {
                const px = (x+1) * tileSize;
                ctx.moveTo(px, y * tileSize);
                ctx.lineTo(px, (y+1) * tileSize);
            }
            if (y + 1 < gridH && tileGrid[y+1][x] !== cur) {
                const py = (y+1) * tileSize;
                ctx.moveTo(x * tileSize, py);
                ctx.lineTo((x+1) * tileSize, py);
            }
        }
    }
    ctx.stroke();

    // 3. Жёлтый контур выбранного королевства
    if (selectedKingdomId !== null) {
        const selIdx = kingdoms.findIndex(k => k.id === selectedKingdomId);
        ctx.save();
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 3.5;
        ctx.shadowColor = "rgba(255,215,0,0.6)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                if (tileGrid[y][x] !== selIdx) continue;
                if (x === 0       || tileGrid[y][x-1] !== selIdx) { ctx.moveTo(x*tileSize,     y*tileSize);     ctx.lineTo(x*tileSize,     (y+1)*tileSize); }
                if (x === gridW-1 || tileGrid[y][x+1] !== selIdx) { ctx.moveTo((x+1)*tileSize, y*tileSize);     ctx.lineTo((x+1)*tileSize, (y+1)*tileSize); }
                if (y === 0       || tileGrid[y-1][x] !== selIdx) { ctx.moveTo(x*tileSize,     y*tileSize);     ctx.lineTo((x+1)*tileSize, y*tileSize); }
                if (y === gridH-1 || tileGrid[y+1][x] !== selIdx) { ctx.moveTo(x*tileSize,     (y+1)*tileSize); ctx.lineTo((x+1)*tileSize, (y+1)*tileSize); }
            }
        }
        ctx.stroke();
        ctx.restore();
    }

    // 4. Подписи (аватарка, имя, процент) в центре региона
    for (let k of kingdoms) {
        const rc = regionCenters[k.id];
        if (!rc) continue;
        const { cx, cy } = rc;
        const pct = k.territory;

        ctx.save();
        ctx.textAlign = "center";
        ctx.shadowBlur = 0;

        if (pct >= 10) {
            // Большая территория – аватарка, название, процент
            const R = 28;
            const avatarCY = cy - 42;
            ctx.beginPath();
            ctx.arc(cx, avatarCY, R, 0, Math.PI * 2);
            ctx.fillStyle = k.color;
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.5)";
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.font = `${R * 1.2}px 'Inter', sans-serif`;
            ctx.fillStyle = "#fff";
            ctx.fillText(k.avatar, cx, avatarCY + 4);

            // Название в плашке
            ctx.font = "bold 13px 'Inter'";
            const nameW = ctx.measureText(k.name).width + 20;
            const nameH = 24;
            const nameX = cx - nameW/2;
            const nameY = avatarCY + R + 4;
            roundRect(nameX, nameY, nameW, nameH, 12);
            ctx.fillStyle = "rgba(10,12,20,0.85)";
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.fillText(k.name, cx, nameY + nameH - 7);

            // Процент
            ctx.font = "bold 14px 'Inter'";
            const pctText = `${pct.toFixed(1)}%`;
            const pctW = ctx.measureText(pctText).width + 16;
            const pctH = 22;
            const pctX = cx - pctW/2;
            const pctY = nameY + nameH + 4;
            roundRect(pctX, pctY, pctW, pctH, 12);
            ctx.fillStyle = "#ffd966";
            ctx.fill();
            ctx.fillStyle = "#0a0c15";
            ctx.fillText(pctText, cx, pctY + pctH - 6);
        } 
        else if (pct >= 5) {
            // Средняя – только аватарка и процент
            const R = 20;
            const avatarCY = cy - 14;
            ctx.beginPath();
            ctx.arc(cx, avatarCY, R, 0, Math.PI * 2);
            ctx.fillStyle = k.color;
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.4)";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.font = `${R * 1.2}px 'Inter'`;
            ctx.fillStyle = "#fff";
            ctx.fillText(k.avatar, cx, avatarCY + 3);

            ctx.font = "bold 12px 'Inter'";
            const pctText = `${pct.toFixed(0)}%`;
            const pctW = ctx.measureText(pctText).width + 12;
            const pctH = 18;
            const pctX = cx - pctW/2;
            const pctY = avatarCY + R + 4;
            roundRect(pctX, pctY, pctW, pctH, 10);
            ctx.fillStyle = "#ffd966";
            ctx.fill();
            ctx.fillStyle = "#0a0c15";
            ctx.fillText(pctText, cx, pctY + pctH - 5);
        }
        else if (pct >= 2) {
            // Маленькая – только процент
            ctx.font = "bold 11px 'Inter'";
            const pctText = `${pct.toFixed(0)}%`;
            const pctW = ctx.measureText(pctText).width + 10;
            const pctH = 16;
            const pctX = cx - pctW/2;
            const pctY = cy - 6;
            roundRect(pctX, pctY, pctW, pctH, 8);
            ctx.fillStyle = "#ffd966cc";
            ctx.fill();
            ctx.fillStyle = "#0a0c15";
            ctx.fillText(pctText, cx, pctY + pctH - 4);
        }
        ctx.restore();
    }
}

// --------------------------------------------------------------
// 5. ПОПАП (всплывающая карточка)
// --------------------------------------------------------------
let popupEl = null;

function ensurePopup() {
    if (popupEl) return;
    popupEl = document.createElement('div');
    popupEl.id = 'kingdomPopup';
    document.body.appendChild(popupEl);

    document.addEventListener('click', (e) => {
        if (!popupEl) return;
        if (popupEl.style.display === 'none') return;
        if (popupEl.contains(e.target)) return;
        if (e.target === canvas || e.target.closest('.kingdom-item')) return;
        hidePopup();
    });
}

function showPopup(kingdom) {
    ensurePopup();
    const rc = regionCenters[kingdom.id];
    if (!rc) return;

    popupEl.innerHTML = `
        <button class="popup-close" id="popupCloseBtn">×</button>
        <div style="display:flex; align-items:center; gap:14px; margin-bottom:12px;">
            <div style="width:48px; height:48px; background:${kingdom.color}; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:bold;">${kingdom.avatar}</div>
            <div>
                <div style="font-weight:800; font-size:16px;">${kingdom.name}</div>
                <div style="font-size:13px; color:#ffd966;">📊 ${kingdom.territory.toFixed(1)}% территории</div>
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:12px; background:rgba(0,0,0,0.3); border-radius:20px; padding:8px 12px;">
            <span>👥 Население</span>
            <span style="font-weight:700;">${kingdom.population.toLocaleString()}</span>
        </div>
        <a href="https://t.me/${kingdom.channel}" target="_blank" style="display:block; text-align:center; background:linear-gradient(135deg,#ffd966,#e6a017); color:#0a0c15; font-weight:800; padding:10px; border-radius:40px; text-decoration:none;">📢 @${kingdom.channel}</a>
    `;
    popupEl.style.display = 'block';

    const closeBtn = document.getElementById('popupCloseBtn');
    if (closeBtn) closeBtn.onclick = () => hidePopup();

    // Позиционируем попап относительно центра региона
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    const sx = rect.left + rc.cx * scaleX;
    const sy = rect.top + rc.cy * scaleY;

    let left = sx + 15;
    let top = sy - (popupEl.offsetHeight || 140) / 2;
    if (left + (popupEl.offsetWidth || 240) > window.innerWidth - 10) left = sx - (popupEl.offsetWidth || 240) - 15;
    if (top < 10) top = 10;
    if (top + (popupEl.offsetHeight || 140) > window.innerHeight - 10) top = window.innerHeight - (popupEl.offsetHeight || 140) - 10;

    popupEl.style.left = `${left}px`;
    popupEl.style.top = `${top}px`;
}

function hidePopup() {
    if (popupEl) popupEl.style.display = 'none';
    selectedKingdomId = null;
    drawMap();
    highlightActiveKingdomInRanking(null);
}

// --------------------------------------------------------------
// 6. РЕЙТИНГ (leaderboard)
// --------------------------------------------------------------
function renderLeaderboard() {
    const container = document.getElementById('kingdomList');
    const sorted = [...kingdoms].sort((a, b) => b.population - a.population);
    container.innerHTML = sorted.map((k, idx) => `
        <div class="kingdom-item" data-id="${k.id}">
            <div class="rank-number">#${idx+1}</div>
            <div class="kingdom-avatar" style="background: linear-gradient(145deg, ${k.color}cc, ${k.color}66);">${k.avatar}</div>
            <div class="kingdom-info">
                <div class="kingdom-name">${k.name}</div>
                <div class="kingdom-stats">👥 ${(k.population / 1000).toFixed(0)}k residents</div>
            </div>
            <div class="percent-value">${k.territory.toFixed(1)}%</div>
        </div>
    `).join('');

    // Добавляем обработчики кликов
    document.querySelectorAll('.kingdom-item').forEach(card => {
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(card.dataset.id);
            const kingdom = kingdoms.find(k => k.id === id);
            if (kingdom) selectKingdom(kingdom);
        });
    });
}

function highlightActiveKingdomInRanking(kingdomId) {
    document.querySelectorAll('.kingdom-item').forEach(card => {
        const id = parseInt(card.dataset.id);
        if (kingdomId === id) card.classList.add('active');
        else card.classList.remove('active');
    });
}

// --------------------------------------------------------------
// 7. ВЫБОР КОРОЛЕВСТВА (синхронизация карты, рейтинга и попапа)
// --------------------------------------------------------------
function selectKingdom(kingdom) {
    selectedKingdomId = kingdom.id;
    drawMap();                     // подсветка на карте
    showPopup(kingdom);            // попап
    highlightActiveKingdomInRanking(kingdom.id);
}

function findKingdomByClick(mouseX, mouseY) {
    const tx = Math.floor(mouseX / tileSize);
    const ty = Math.floor(mouseY / tileSize);
    if (tx >= 0 && tx < gridW && ty >= 0 && ty < gridH) {
        return kingdoms[tileGrid[ty][tx]];
    }
    return null;
}

function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = Math.min(W, Math.max(0, (e.clientX - rect.left) * scaleX));
    const my = Math.min(H, Math.max(0, (e.clientY - rect.top) * scaleY));
    const kingdom = findKingdomByClick(mx, my);
    if (kingdom) {
        selectKingdom(kingdom);
    } else {
        hidePopup();
    }
}

// --------------------------------------------------------------
// 8. ИНИЦИАЛИЗАЦИЯ (один раз при загрузке и при ресайзе)
// --------------------------------------------------------------
function updateTotalCitizensDisplay() {
    const total = kingdoms.reduce((s, k) => s + k.population, 0);
    document.getElementById('totalCitizens').innerText = `${total.toLocaleString()} total citizens • territory = % of population`;
}

function initMapAndDraw() {
    const container = document.querySelector('.map-container');
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    W = canvas.width;
    H = canvas.height;
    tileGrid = generateTileRegions();
    recalcCenters();
    drawMap();
}

function init() {
    updateTotalCitizensDisplay();
    renderLeaderboard();
    initMapAndDraw();

    canvas.addEventListener('click', handleCanvasClick);
    document.getElementById('createBtn').addEventListener('click', () => {
        alert("🏗️ Создание королевства через Telegram бота (будет в следующей версии)");
    });
    window.addEventListener('resize', () => {
        hidePopup();
        initMapAndDraw();
        highlightActiveKingdomInRanking(selectedKingdomId);
        if (selectedKingdomId) {
            const k = kingdoms.find(k => k.id === selectedKingdomId);
            if (k) showPopup(k);
        }
    });
}

// Запуск после загрузки DOM
window.addEventListener('DOMContentLoaded', init);