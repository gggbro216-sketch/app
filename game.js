// Морской бой — один файл, полная игра на Canvas.
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  layout();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- Звук (WebAudio, без файлов) ----------
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function beep(freq, dur, type, gain) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq;
  g.gain.value = gain == null ? 0.05 : gain;
  o.connect(g).connect(audioCtx.destination);
  const t = audioCtx.currentTime;
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur);
}
function sfxHit() { beep(180, 0.18, 'square', 0.06); setTimeout(() => beep(120, 0.2, 'square', 0.05), 70); }
function sfxMiss() { beep(520, 0.08, 'sine', 0.03); }
function sfxSink() { [140, 110, 80].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'triangle', 0.06), i * 110)); }
function sfxWin() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'sine', 0.05), i * 130)); }
function sfxLose() { [392, 330, 262].forEach((f, i) => setTimeout(() => beep(f, 0.28, 'sawtooth', 0.05), i * 160)); }

// ---------- Константы ----------
const GRID = 10;
const FLEET = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
const DIRS = { h: [1, 0], v: [0, 1] };
const C = {
  bg: '#0b1a2a', panel: '#122a44',
  water: '#0e3556', waterAlt: '#0c2e4b',
  line: '#1e4a6e', ship: '#8aa3bb', shipSunk: '#5b2a2a',
  hit: '#e8543f', miss: '#2e5f86',
  accent: '#3fa9f5', accent2: '#28c26a', danger: '#e8543f',
  text: '#e8f1f8', dim: '#8fa8bd',
  ghostOk: 'rgba(40,194,106,0.45)', ghostBad: 'rgba(232,84,63,0.45)'
};

const state = {
  screen: 'menu',         // menu | place | ready | battle | over
  msg: '',
  layout: null,
  dir: 'h',
  ships: [],
  remaining: [],
  grid: [],
  player: { grid: [], ships: [], shots: [] },
  enemy:  { grid: [], ships: [], shots: [] },
  turn: 'player',
  winner: null,
  hover: null,
  ai: { queue: [], lastHit: null },
  anim: { t: 0, from: null, to: null },
  stats: loadStats()
};

// ---------- Сохранение статистики ----------
function loadStats() {
  try {
    const raw = localStorage.getItem('seabattle_stats');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { games: 0, wins: 0, shots: 0, hits: 0 };
}
function saveStats() {
  try { localStorage.setItem('seabattle_stats', JSON.stringify(state.stats)); } catch (e) {}
}

// ---------- Раскладка ----------
function layout() {
  const pad = 12, gap = 10;
  const side = W > H ? 'cols' : 'rows';
  const top = 88;
  // Нижняя панель: текст-статус (18) + кнопка (48) + отступ + вторая кнопка (40) + зазор.
  const btnH = 48, altH = 40, msgH = 40, vgap = 8;
  const bottom = msgH + btnH + vgap + altH + vgap + altH + 20;
  const availH = H - top - bottom;
  const availW = W - pad * 2;
  let cell, bw, bh, p1, p2;

  if (side === 'rows') {
    cell = Math.floor(Math.min(availW / GRID, (availH - gap) / 2 / GRID));
    bw = bh = cell * GRID;
    const totalH = bh * 2 + gap;
    const startY = top + Math.max(0, (availH - totalH) / 2);
    p1 = { x: (W - bw) / 2, y: startY };
    p2 = { x: (W - bw) / 2, y: startY + bh + gap };
  } else {
    cell = Math.floor(Math.min((availW - gap) / 2 / GRID, availH / GRID));
    bw = bh = cell * GRID;
    const totalW = bw * 2 + gap;
    const startX = (W - totalW) / 2;
    const y = top + Math.max(0, (availH - bh) / 2);
    p1 = { x: startX, y };
    p2 = { x: startX + bw + gap, y };
  }

  const mainY = H - msgH - btnH;
  const altY = mainY - vgap - altH;
  const autoY = altY - vgap - altH;
  state.layout = {
    side, cell,
    boards: [
      { x: p1.x, y: p1.y, w: bw, h: bh },
      { x: p2.x, y: p2.y, w: bw, h: bh }
    ],
    mainBtn: { x: W / 2 - 105, y: mainY, w: 210, h: btnH },
    altBtn:  { x: W / 2 - 105, y: altY,  w: 210, h: altH },
    autoBtn: { x: W / 2 - 105, y: autoY, w: 210, h: altH }
  };
}

// ---------- Утилиты ----------
function emptyGrid() { return Array.from({ length: GRID }, () => Array(GRID).fill(0)); }
function emptyShots() { return Array.from({ length: GRID }, () => Array(GRID).fill(0)); }
function cellAt(board, px, py) {
  const { cell } = state.layout;
  const x = Math.floor((px - board.x) / cell);
  const y = Math.floor((py - board.y) / cell);
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return null;
  return { x, y };
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function insideRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

// ---------- Расстановка ----------
function canPlace(grid, x, y, len, dir) {
  const [dx, dy] = DIRS[dir];
  const ex = x + dx * (len - 1), ey = y + dy * (len - 1);
  if (x < 0 || y < 0 || ex >= GRID || ey >= GRID) return false;
  for (let cy = y - 1; cy <= ey + 1; cy++)
    for (let cx = x - 1; cx <= ex + 1; cx++) {
      if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) continue;
      if (grid[cy][cx] === 1) return false;
    }
  return true;
}
function putShip(grid, s) {
  const [dx, dy] = DIRS[s.dir];
  for (let i = 0; i < s.len; i++) grid[s.y + dy * i][s.x + dx * i] = 1;
}
function buildGrid(ships) {
  const g = emptyGrid();
  ships.forEach(s => putShip(g, s));
  return g;
}
function randomPlacement() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const ships = [];
    const grid = emptyGrid();
    let ok = true;
    for (const len of FLEET) {
      let done = false;
      for (let t = 0; t < 500 && !done; t++) {
        const dir = Math.random() < 0.5 ? 'h' : 'v';
        const x = Math.floor(Math.random() * GRID);
        const y = Math.floor(Math.random() * GRID);
        if (canPlace(grid, x, y, len, dir)) {
          const s = { x, y, len, dir };
          putShip(grid, s);
          ships.push(s);
          done = true;
        }
      }
      if (!done) { ok = false; break; }
    }
    if (ok) return { ships, grid };
  }
  return { ships: [], grid: emptyGrid() };
}

function currentLen() { return state.remaining.length ? state.remaining[0] : 0; }

function startPlacement() {
  state.screen = 'place';
  state.dir = 'h';
  state.ships = [];
  state.grid = emptyGrid();
  state.remaining = FLEET.slice();
  state.hover = null;
  state.msg = 'Ставим ' + state.remaining[0] + '-палубный';
}
function tryPlace(x, y) {
  const len = currentLen();
  if (!len) return;
  if (!canPlace(state.grid, x, y, len, state.dir)) {
    state.msg = 'Здесь не помещается';
    beep(160, 0.08, 'sine', 0.04);
    return;
  }
  beep(440, 0.06, 'sine', 0.04);
  const s = { x, y, len, dir: state.dir };
  putShip(state.grid, s);
  state.ships.push(s);
  state.remaining.shift();
  if (!state.remaining.length) {
    state.screen = 'ready';
    state.msg = 'Флот готов — жми «В бой»';
  } else {
    state.msg = 'Осталось: ' + state.remaining.join(' ');
  }
}
function undoPlacement() {
  const s = state.ships.pop();
  if (!s) return;
  const [dx, dy] = DIRS[s.dir];
  for (let i = 0; i < s.len; i++) state.grid[s.y + dy * i][s.x + dx * i] = 0;
  state.remaining.unshift(s.len);
  state.screen = 'place';
  state.msg = 'Осталось: ' + state.remaining.join(' ');
}
function autoPlace() {
  const r = randomPlacement();
  state.ships = r.ships;
  state.grid = r.grid;
  state.remaining = [];
  state.screen = 'ready';
  state.msg = 'Флот расставлен — жми «В бой»';
}

// ---------- Бой ----------
function startBattle() {
  state.player.grid = buildGrid(state.ships);
  state.player.ships = state.ships.slice();
  state.player.shots = emptyShots();
  const e = randomPlacement();
  state.enemy.grid = e.grid;
  state.enemy.ships = e.ships;
  state.enemy.shots = emptyShots();
  state.ai = { queue: [], lastHit: null };
  state.turn = 'player';
  state.screen = 'battle';
  state.msg = 'Твой ход';
  state.stats.games++;
  state.stats.shots = 0;
  state.stats.hits = 0;
  saveStats();
}

function shipAt(ships, x, y) {
  for (const s of ships) {
    const [dx, dy] = DIRS[s.dir];
    for (let i = 0; i < s.len; i++) {
      if (s.x + dx * i === x && s.y + dy * i === y) return s;
    }
  }
  return null;
}
function isSunk(s, shots) {
  const [dx, dy] = DIRS[s.dir];
  for (let i = 0; i < s.len; i++) {
    if (shots[s.y + dy * i][s.x + dx * i] !== 2) return false;
  }
  return true;
}
function markSunk(s, shots) {
  const [dx, dy] = DIRS[s.dir];
  const ex = s.x + dx * (s.len - 1), ey = s.y + dy * (s.len - 1);
  for (let cy = s.y - 1; cy <= ey + 1; cy++)
    for (let cx = s.x - 1; cx <= ex + 1; cx++) {
      if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) continue;
      if (shots[cy][cx] === 0) shots[cy][cx] = 1;
    }
}
function allSunk(side) {
  return side.ships.every(s => isSunk(s, side.shots));
}

function fireAtPlayer(x, y) {
  if (state.player.shots[y][x] !== 0) return false;
  const s = shipAt(state.player.ships, x, y);
  if (s) {
    state.player.shots[y][x] = 2;
    if (isSunk(s, state.player.shots)) { markSunk(s, state.player.shots); sfxSink(); } else { sfxHit(); }
    return true;
  }
  state.player.shots[y][x] = 1;
  sfxMiss();
  return false;
}

function playerFire(x, y) {
  if (state.screen !== 'battle' || state.turn !== 'player') return;
  if (state.enemy.shots[y][x] !== 0) { state.msg = 'Сюда уже стреляли'; return; }
  const s = shipAt(state.enemy.ships, x, y);
  if (s) {
    state.enemy.shots[y][x] = 2;
    state.stats.hits++;
    if (isSunk(s, state.enemy.shots)) {
      markSunk(s, state.enemy.shots);
      state.msg = 'Корабль потоплен!';
      sfxSink();
    } else {
      state.msg = 'Попадание!';
      sfxHit();
    }
    if (allSunk(state.enemy)) return endGame('player');
  } else {
    state.enemy.shots[y][x] = 1;
    state.msg = 'Мимо...';
    sfxMiss();
    state.turn = 'ai';
  }
  state.stats.shots++;
  saveStats();
}

// ---------- ИИ противника ----------
function chooseEnemyShot() {
  // Добиваем из очереди, иначе стреляем случайно по «шахматке».
  while (state.ai.queue.length) {
    const p = state.ai.queue.shift();
    if (state.player.shots[p.y][p.x] === 0) return p;
  }
  const cells = [];
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      if (state.player.shots[y][x] === 0 && (x + y) % 2 === 0) cells.push({ x, y });
    }
  if (!cells.length) {
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (state.player.shots[y][x] === 0) cells.push({ x, y });
  }
  return cells[Math.floor(Math.random() * cells.length)];
}
function pushAround(x, y) {
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < GRID && ny < GRID && state.player.shots[ny][nx] === 0) {
      state.ai.queue.push({ x: nx, y: ny });
    }
  });
}

let aiTimer = 0;
function updateAI(dt) {
  if (state.screen !== 'battle' || state.turn !== 'ai') return;
  aiTimer += dt;
  if (aiTimer < 0.7) return;
  aiTimer = 0;
  const p = chooseEnemyShot();
  if (!p) return;
  const hit = fireAtPlayer(p.x, p.y);
  if (hit) {
    pushAround(p.x, p.y);
    state.msg = 'Враг попал!';
    if (allSunk(state.player)) return endGame('ai');
  } else {
    state.msg = 'Враг промахнулся — твой ход';
    state.turn = 'player';
  }
}

function endGame(winner) {
  state.screen = 'over';
  state.winner = winner;
  if (winner === 'player') { state.stats.wins++; sfxWin(); } else { sfxLose(); }
  saveStats();
  state.msg = winner === 'player' ? 'Победа!' : 'Поражение';
}

// ---------- Отрисовка ----------
function drawBoard(board, grid, shots, revealShips) {
  const { cell } = state.layout;
  ctx.fillStyle = C.panel;
  roundRect(board.x - 4, board.y - 4, board.w + 8, board.h + 8, 8);
  ctx.fill();

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const px = board.x + x * cell;
      const py = board.y + y * cell;
      ctx.fillStyle = (x + y) % 2 === 0 ? C.water : C.waterAlt;
      ctx.fillRect(px, py, cell, cell);
      if (grid[y][x] === 1 && revealShips) {
        ctx.fillStyle = C.ship;
        ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
      }
      const s = shots[y][x];
      if (s === 1) {
        ctx.fillStyle = C.miss;
        ctx.beginPath();
        ctx.arc(px + cell / 2, py + cell / 2, cell * 0.13, 0, Math.PI * 2);
        ctx.fill();
      } else if (s === 2) {
        ctx.fillStyle = C.hit;
        ctx.beginPath();
        ctx.arc(px + cell / 2, py + cell / 2, cell * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID; i++) {
    const px = board.x + i * cell, py = board.y + i * cell;
    ctx.beginPath(); ctx.moveTo(px, board.y); ctx.lineTo(px, board.y + board.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(board.x, py); ctx.lineTo(board.x + board.w, py); ctx.stroke();
  }
}
function drawGhost() {
  if (!state.hover || (state.screen !== 'place')) return;
  const board = state.layout.boards[0];
  const { cell } = state.layout;
  const len = currentLen();
  if (!len) return;
  const [dx, dy] = DIRS[state.dir];
  const ok = canPlace(state.grid, state.hover.x, state.hover.y, len, state.dir);
  for (let i = 0; i < len; i++) {
    const x = state.hover.x + dx * i, y = state.hover.y + dy * i;
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) break;
    ctx.fillStyle = ok ? C.ghostOk : C.ghostBad;
    ctx.fillRect(board.x + x * cell + 2, board.y + y * cell + 2, cell - 4, cell - 4);
  }
}
function drawBtn(rect, label, color) {
  ctx.fillStyle = color || C.accent;
  roundRect(rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}
function draw() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  if (!state.layout) return;
  const L = state.layout;

  ctx.fillStyle = C.text;
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Морской бой', W / 2, 38);

  if (state.screen === 'menu') {
    ctx.fillStyle = C.dim;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('Потопи весь флот противника', W / 2, H / 2 - 50);
    ctx.fillText('Флот: 4 + 3 + 3 + 2 + 2 + 2 + 1+1+1+1', W / 2, H / 2 - 24);
    ctx.fillText('Побед: ' + state.stats.wins + ' · Игр: ' + state.stats.games, W / 2, H / 2 + 10);
    drawBtn(L.mainBtn, 'Играть');
    return;
  }

  const [b1, b2] = L.boards;
  const revealEnemy = state.screen === 'over';
  drawBoard(b1, state.player.grid, state.player.shots, true);
  drawBoard(b2, state.enemy.grid, state.enemy.shots, revealEnemy);

  ctx.fillStyle = C.dim;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(L.side === 'rows' ? 'Ваше поле' : 'Вы', b1.x + b1.w / 2, b1.y - 14);
  ctx.fillText(L.side === 'rows' ? 'Противник' : 'Враг', b2.x + b2.w / 2, b2.y - 14);

  if (state.screen === 'place' || state.screen === 'ready') {
    drawGhost();
    ctx.fillStyle = C.text;
    ctx.font = '600 15px system-ui, sans-serif';
    if (state.screen === 'place') {
      ctx.fillText('Ставим ' + currentLen() + '-палубный · ' + (state.dir === 'h' ? '—' : '|'), W / 2, L.autoBtn.y - 22);
      drawBtn(L.autoBtn, 'Авто-расстановка', C.accent2);
      drawBtn(L.altBtn, 'Повернуть ' + (state.dir === 'h' ? '↕' : '↔'), '#2a4763');
      drawBtn(L.mainBtn, 'Отменить', '#40566b');
    } else {
      ctx.fillText('Флот готов', W / 2, L.autoBtn.y - 22);
      drawBtn(L.altBtn, 'Расставить заново', '#2a4763');
      drawBtn(L.mainBtn, 'В бой!', C.accent2);
    }
  } else if (state.screen === 'battle') {
    ctx.fillStyle = state.turn === 'player' ? C.text : C.dim;
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(state.turn === 'player' ? 'Твой ход' : 'Ход противника...', W / 2, H - 100);
  } else if (state.screen === 'over') {
    ctx.fillStyle = state.winner === 'player' ? C.accent2 : C.danger;
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText(state.winner === 'player' ? 'Победа!' : 'Поражение', W / 2, H - 130);
    drawBtn(L.mainBtn, 'Ещё раз');
  }

  if (state.msg) {
    ctx.fillStyle = C.dim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(state.msg, W / 2, H - 18);
  }
}

// ---------- Цикл ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  updateAI(dt);
  draw();
  requestAnimationFrame(frame);
}

// ---------- Ввод ----------
function toLocal(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function onTap(p) {
  const L = state.layout;
  if (!L) return;
  if (insideRect(p, L.mainBtn)) {
    if (state.screen === 'menu') startPlacement();
    else if (state.screen === 'place') undoPlacement();
    else if (state.screen === 'ready') startBattle();
    else if (state.screen === 'over') startPlacement();
    return;
  }
  if (state.screen === 'place') {
    if (insideRect(p, L.autoBtn)) { autoPlace(); return; }
    if (insideRect(p, L.altBtn)) { state.dir = state.dir === 'h' ? 'v' : 'h'; return; }
    const c = cellAt(L.boards[0], p.x, p.y);
    if (c) tryPlace(c.x, c.y);
    return;
  }
  if (state.screen === 'ready') {
    if (insideRect(p, L.altBtn)) { startPlacement(); return; }
    return;
  }
  if (state.screen === 'battle' && state.turn === 'player') {
    const c = cellAt(L.boards[1], p.x, p.y);
    if (c) playerFire(c.x, c.y);
  }
}
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  initAudio();
  const p = toLocal(e);
  if (state.screen === 'place') state.hover = cellAt(state.layout.boards[0], p.x, p.y);
  onTap(p);
});
canvas.addEventListener('pointermove', (e) => {
  if (state.screen !== 'place') return;
  state.hover = cellAt(state.layout.boards[0], toLocal(e).x, toLocal(e).y);
});
canvas.addEventListener('pointerleave', () => { state.hover = null; });

// ---------- Старт ----------
function init() {
  state.player.grid = emptyGrid();
  state.player.shots = emptyShots();
  state.enemy.grid = emptyGrid();
  state.enemy.shots = emptyShots();
  resize();
  requestAnimationFrame(frame);
}
init();
