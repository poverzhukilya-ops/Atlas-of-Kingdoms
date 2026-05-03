// --------------------------------------------------------------
// 1. ДАННЫЕ КОРОЛЕВСТВ
// --------------------------------------------------------------
let kingdoms = [
    { id: 1, name: "Nova Corp",        population: 1245678, avatar: "N", color: "#e63946", channel: "novacorp" },
    { id: 2, name: "Stellar Alliance", population: 980000,  avatar: "S", color: "#457b9d", channel: "stellar" },
    { id: 3, name: "Crimson Dynasty",  population: 850000,  avatar: "C", color: "#f4a261", channel: "crimson" },
    { id: 4, name: "Hewa Marn",        population: 720000,  avatar: "H", color: "#2a9d8f", channel: "hewamarn" },
    { id: 5, name: "Astraea Republic", population: 610000,  avatar: "A", color: "#9c89b8", channel: "astraea" },
    { id: 6, name: "Umlea Dynasty",    population: 480000,  avatar: "U", color: "#e9c46a", channel: "umlea" },
    { id: 7, name: "MyKingdom",        population: 320000,  avatar: "M", color: "#6c91b2", channel: "mykingdom" },
    { id: 8, name: "Tikahan",          population: 210000,  avatar: "T", color: "#e76f51", channel: "tikahan" }
];
 
function computeTerritoryPercent() {
    const totalPop = kingdoms.reduce((s, k) => s + k.population, 0);
    kingdoms.forEach(k => { k.territory = (k.population / totalPop) * 100; });
    return totalPop;
}
let totalCitizens = computeTerritoryPercent();
 
// --------------------------------------------------------------
// 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
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
// 3. ГЕНЕРАЦИЯ ТЕРРИТОРИЙ
// --------------------------------------------------------------
function generateTileRegions() {
    gridW = Math.floor(W / tileSize);
    gridH = Math.floor(H / tileSize);
    const totalTiles = gridW * gridH;
 
    let targetTiles = kingdoms.map(k => Math.floor((k.territory / 100) * totalTiles));
    let sum = targetTiles.reduce((a, b) => a + b, 0);
    const maxIdx = kingdoms.reduce((iMax, k, i, arr) => k.population > arr[iMax].population ? i : iMax, 0);
    targetTiles[maxIdx] += totalTiles - sum;
 
    let grid = Array.from({ length: gridH }, () => Array(gridW).fill(-1));
    let seeds = [];
 
    for (let idx = 0; idx < kingdoms.length; idx++) {
        let placed = false, attempts = 0;
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
        if (!placed) {
            for (let y = 0; y < gridH; y++) {
                let found = false;
                for (let x = 0; x < gridW; x++) {
                    if (grid[y][x] === -1) {
                        grid[y][x] = idx;
                        seeds.push({ x, y, idx, remaining: targetTiles[idx] - 1 });
                        found = true; break;
                    }
                }
                if (found) break;
            }
        }
    }
 
    function getNeighbors(x, y) {
        let n = [];
        if (x > 0) n.push({ x: x-1, y });
        if (x < gridW-1) n.push({ x: x+1, y });
        if (y > 0) n.push({ x, y: y-1 });
        if (y < gridH-1) n.push({ x, y: y+1 });
        return n;
    }
 
    let queue = [...seeds];
    let totalPlaced = seeds.length;
 
    while (totalPlaced < totalTiles && queue.length > 0) {
        let ri = Math.floor(Math.random() * queue.length);
        let cur = queue[ri];
        let nb = getNeighbors(cur.x, cur.y);
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
                claimed = true; break;
            }
        }
        if (!claimed) queue.splice(ri, 1);
    }
 
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
// 4. ОТРИСОВКА КАРТЫ
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
 
    // 2. Границы
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 1.5;
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
 
    // 3. Жёлтый контур выбранного
    if (selectedKingdomId !== null) {
        const selIdx = kingdoms.findIndex(k => k.id === selectedKingdomId);
        ctx.save();
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 3.5;
        ctx.shadowColor = "rgba(255,215,0,0.7)";
        ctx.shadowBlur = 10;
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
 
    // 4. Адаптивные подписи на карте
    // ≥15% → аватарка + название + кол-во жителей
    // 8–14% → аватарка + название
    // <8% → только аватарка (если >= 2%, иначе ничего)
    for (let k of kingdoms) {
        const rc = regionCenters[k.id];
        if (!rc) continue;
        const { cx, cy } = rc;
        const pct = k.territory;
 
        ctx.save();
        ctx.textAlign = "center";
        ctx.shadowBlur = 0;
 
        if (pct >= 15) {
            // БОЛЬШАЯ — аватарка + название + население
            const R = 30;
            const avatarCY = cy - 46;
 
            // Тень под аватаркой
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(cx, avatarCY, R, 0, Math.PI * 2);
            ctx.fillStyle = k.color;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "rgba(255,255,255,0.55)";
            ctx.lineWidth = 2.5;
            ctx.stroke();
 
            ctx.font = `bold ${Math.round(R * 1.15)}px 'Inter', sans-serif`;
            ctx.fillStyle = "#fff";
            ctx.fillText(k.avatar, cx, avatarCY + 5);
 
            // Название
            ctx.font = "bold 13px 'Inter'";
            const nameW = ctx.measureText(k.name).width + 22;
            const nameH = 24;
            const nameX = cx - nameW / 2;
            const nameY = avatarCY + R + 5;
            ctx.shadowColor = "rgba(0,0,0,0.4)";
            ctx.shadowBlur = 4;
            roundRect(nameX, nameY, nameW, nameH, 12);
            ctx.fillStyle = "rgba(10,12,20,0.88)";
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = "#ffffff";
            ctx.fillText(k.name, cx, nameY + nameH - 7);
 
            // Население
            ctx.font = "600 12px 'Inter'";
            const popText = `👥 ${(k.population / 1000).toFixed(0)}k`;
            const popW = ctx.measureText(popText).width + 18;
            const popH = 20;
            const popX = cx - popW / 2;
            const popY = nameY + nameH + 4;
            roundRect(popX, popY, popW, popH, 10);
            ctx.fillStyle = "rgba(10,12,20,0.75)";
            ctx.fill();
            ctx.fillStyle = "#c8d8ff";
            ctx.fillText(popText, cx, popY + popH - 5);
 
        } else if (pct >= 8) {
            // СРЕДНЯЯ — аватарка + название
            const R = 22;
            const avatarCY = cy - 16;
 
            ctx.shadowColor = "rgba(0,0,0,0.45)";
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(cx, avatarCY, R, 0, Math.PI * 2);
            ctx.fillStyle = k.color;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "rgba(255,255,255,0.45)";
            ctx.lineWidth = 2;
            ctx.stroke();
 
            ctx.font = `bold ${Math.round(R * 1.1)}px 'Inter'`;
            ctx.fillStyle = "#fff";
            ctx.fillText(k.avatar, cx, avatarCY + 4);
 
            ctx.font = "bold 12px 'Inter'";
            const nameW = ctx.measureText(k.name).width + 18;
            const nameH = 21;
            const nameX = cx - nameW / 2;
            const nameY = avatarCY + R + 5;
            roundRect(nameX, nameY, nameW, nameH, 10);
            ctx.fillStyle = "rgba(10,12,20,0.85)";
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.fillText(k.name, cx, nameY + nameH - 6);
 
        } else if (pct >= 2) {
            // МАЛАЯ — только аватарка
            const R = 16;
            const avatarCY = cy;
 
            ctx.shadowColor = "rgba(0,0,0,0.4)";
            ctx.shadowBlur = 5;
            ctx.beginPath();
            ctx.arc(cx, avatarCY, R, 0, Math.PI * 2);
            ctx.fillStyle = k.color;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "rgba(255,255,255,0.4)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
 
            ctx.font = `bold ${Math.round(R * 1.1)}px 'Inter'`;
            ctx.fillStyle = "#fff";
            ctx.fillText(k.avatar, cx, avatarCY + 4);
        }
 
        ctx.restore();
    }
}
 
// --------------------------------------------------------------
// 5. МОДАЛЬНОЕ ОКНО
// --------------------------------------------------------------
let modalEl = null;
 
function ensureModal() {
    if (modalEl) return;
    modalEl = document.createElement('div');
    modalEl.id = 'kingdomModal';
    document.body.appendChild(modalEl);
}
 
function showModal(kingdom) {
    ensureModal();
 
    // Ранг по населению
    const sorted = [...kingdoms].sort((a, b) => b.population - a.population);
    const rank = sorted.findIndex(k => k.id === kingdom.id) + 1;
    const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
 
    modalEl.innerHTML = `
        <div class="modal-overlay" id="modalOverlay">
            <div class="modal-card" id="modalCard">
                <button class="modal-close" id="modalCloseBtn">×</button>
 
                <div class="modal-avatar-wrap">
                    <div class="modal-avatar-circle" style="background: radial-gradient(145deg, ${kingdom.color}dd, ${kingdom.color}88);">
                        <span class="modal-avatar-letter">${kingdom.avatar}</span>
                    </div>
                    <div class="modal-rank-badge">${rankLabel}</div>
                </div>
 
                <h2 class="modal-kingdom-name">${kingdom.name}</h2>
 
                <div class="modal-stats-grid">
                    <div class="modal-stat-cell">
                        <div class="stat-icon">👥</div>
                        <div class="stat-value">${kingdom.population.toLocaleString()}</div>
                        <div class="stat-label">Citizens</div>
                    </div>
                    <div class="modal-stat-cell">
                        <div class="stat-icon">🗺️</div>
                        <div class="stat-value">${kingdom.territory.toFixed(1)}%</div>
                        <div class="stat-label">Territory</div>
                    </div>
                </div>
 
                <a href="https://t.me/${kingdom.channel}" target="_blank" class="modal-tg-link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z" fill="#fff"/>
                    </svg>
                    @${kingdom.channel}
                </a>
            </div>
        </div>
    `;
    modalEl.style.display = 'block';
 
    // Анимация появления
    requestAnimationFrame(() => {
        const card = document.getElementById('modalCard');
        if (card) card.classList.add('modal-card--visible');
    });
 
    document.getElementById('modalCloseBtn').onclick = hideModal;
    document.getElementById('modalOverlay').onclick = (e) => {
        if (e.target.id === 'modalOverlay') hideModal();
    };
}
 
function hideModal() {
    if (!modalEl) return;
    const card = document.getElementById('modalCard');
    if (card) {
        card.classList.remove('modal-card--visible');
        card.classList.add('modal-card--hiding');
    }
    setTimeout(() => {
        if (modalEl) modalEl.style.display = 'none';
    }, 200);
    selectedKingdomId = null;
    drawMap();
    highlightActiveKingdomInRanking(null);
}
 
// Escape закрывает модалку
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideModal();
});
 
// --------------------------------------------------------------
// 6. РЕЙТИНГ
// --------------------------------------------------------------
function renderLeaderboard() {
    const container = document.getElementById('kingdomList');
    const sorted = [...kingdoms].sort((a, b) => b.population - a.population);
 
    container.innerHTML = sorted.map((k, idx) => {
        const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
        return `
        <div class="kingdom-item" data-id="${k.id}">
            <div class="rank-number">${rankEmoji || `#${idx+1}`}</div>
            <div class="kingdom-avatar" style="background: linear-gradient(145deg, ${k.color}cc, ${k.color}55);">${k.avatar}</div>
            <div class="kingdom-info">
                <div class="kingdom-name">${k.name}</div>
                <div class="kingdom-stats">👥 ${(k.population / 1000).toFixed(0)}k residents</div>
            </div>
            <div class="percent-value">${k.territory.toFixed(1)}%</div>
        </div>
    `}).join('');
 
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
        card.classList.toggle('active', kingdomId === id);
    });
}
 
// --------------------------------------------------------------
// 7. ВЫБОР КОРОЛЕВСТВА
// --------------------------------------------------------------
function selectKingdom(kingdom) {
    selectedKingdomId = kingdom.id;
    drawMap();
    showModal(kingdom);
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
    if (kingdom) selectKingdom(kingdom);
    else hideModal();
}
 
// --------------------------------------------------------------
// 8. ИНИЦИАЛИЗАЦИЯ
// --------------------------------------------------------------
function updateTotalCitizensDisplay() {
    const total = kingdoms.reduce((s, k) => s + k.population, 0);
    document.getElementById('totalCitizens').innerText =
        `${total.toLocaleString()} total citizens • territory = % of population`;
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
        hideModal();
        initMapAndDraw();
    });
}
 
window.addEventListener('DOMContentLoaded', init);
 
