/* Core play: state, board view, selection and matching, timer, power-ups, input. */
const START_INV = { hint: 2, shuffle: 1, time: 1, bolt: 0 };

const S = {
  level: 1, score: 0, levelStartScore: 0, best: 0, lives: MAX_STOCK,
  inv: { ...START_INV },
  cfg: null, grid: null, species: [],
  pos: new Map(), els: new Map(),
  timeLeft: 0, timeMax: 1, freeze: 0,
  running: false, paused: false, busy: false,
  selected: null, hint: null, combo: 0, lastMatch: 0, noPathTips: 0,
  tw: 40, th: 48, padX: 22, padY: 26,
};

const board = $('#board');
const boardWrap = $('#boardWrap');
const linkLayer = $('#linkLayer');

function eachTile(fn) {
  for (let r = 1; r < S.grid.length - 1; r++) {
    for (let c = 1; c < S.grid[0].length - 1; c++) if (S.grid[r][c]) fn(S.grid[r][c], r, c);
  }
}

function refreshTray() { UI.tray(S.inv, S.running && !S.paused); }

/* Short vibration on phones that support it; follows the sound switch. */
function buzz(pattern) {
  if (!Sound.on || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (e) { /* not allowed */ }
}

function startLevel(run = true) {
  const cfg = Logic.levelConfig(S.level);
  const { grid, species } = Logic.generate(cfg);
  Object.assign(S, {
    cfg, grid, species,
    timeLeft: cfg.time, timeMax: cfg.time, freeze: 0,
    selected: null, hint: null, combo: 0, lastMatch: 0,
    busy: false, levelStartScore: S.score, running: run,
  });
  setPaused(false);
  buildBoard();
  UI.chips(cfg);
  UI.hud(S);
  UI.track(S.level);
  UI.timer(S.timeLeft, S.timeMax, false);
  UI.comboPill(0);
  refreshTray();
  lastTick = performance.now();
  save();
}

function buildBoard() {
  S.els.forEach((node) => node.remove());
  S.els.clear();
  linkLayer.innerHTML = '';
  layout();
  eachTile((t, r, c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile enter';
    b.dataset.id = t.id;
    b.style.setProperty('--d', `${(r + c) * 18}ms`);
    b.style.setProperty('--hue', Math.round((t.type * 137.508) % 360)); // each species gets its own pastel
    b.innerHTML = `<span class="face">${S.species[t.type]}</span>`;
    b.addEventListener('animationend', (e) => {
      if (e.animationName === 'tileIn') b.classList.remove('enter');
    });
    board.appendChild(b);
    S.els.set(t.id, b);
  });
  syncPositions();
}

/* Turn the board a quarter so its long side runs along the long side of the play area.
   Paths are symmetric, so every pair that could connect still can. */
function orient(innerW, innerH) {
  const { rows, cols } = S.cfg;
  if (rows === cols || (innerH > innerW) === (rows > cols)) return;
  const g = S.grid;
  S.grid = g[0].map((_, c) => g.map((row) => row[c]));
  [S.cfg.rows, S.cfg.cols] = [cols, rows];
  UI.chips(S.cfg);
}

/* Fit the board (plus the empty ring that paths may use) into the play area. */
function layout() {
  if (!S.cfg) return;
  const cs = getComputedStyle(boardWrap);
  const innerW = boardWrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const innerH = boardWrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  if (innerW < 50 || innerH < 50) return;
  orient(innerW, innerH);
  const { rows, cols } = S.cfg;
  const compact = Math.min(innerW, innerH) < 480;
  const ratio = compact ? 1.12 : 1.2;
  const ring = compact ? 0.34 : 0.5; // share of a tile kept free around the board for outside paths
  const w = Math.max(16, Math.floor(Math.min(innerW / (cols + 2 * ring), innerH / ((rows + 2 * ring) * ratio), 88)));
  const h = Math.round(w * ratio);
  Object.assign(S, { tw: w, th: h, padX: Math.max(6, Math.round(w * ring)), padY: Math.max(6, Math.round(h * ring)) });
  board.style.width = `${cols * w + 2 * S.padX}px`;
  board.style.height = `${rows * h + 2 * S.padY}px`;
  board.style.setProperty('--tw', `${w - (compact ? 2 : 3)}px`);
  board.style.setProperty('--th', `${h - (compact ? 4 : 5)}px`);
  board.style.setProperty('--fs', `${Math.round(w * (compact ? 0.68 : 0.6))}px`);
  syncPositions();
}

function syncPositions() {
  S.pos.clear();
  eachTile((t, r, c) => {
    S.pos.set(t.id, { r, c });
    const node = S.els.get(t.id);
    if (node) node.style.transform = `translate(${S.padX + (c - 1) * S.tw + 1.5}px, ${S.padY + (r - 1) * S.th + 1}px)`;
  });
}

/* Cells on the outer ring sit in the middle of the margin, so lines stay inside the board. */
function center(r, c) {
  const { rows, cols } = S.cfg;
  const x = c === 0 ? S.padX / 2 : c === cols + 1 ? S.padX * 1.5 + cols * S.tw : S.padX + (c - 0.5) * S.tw;
  const y = r === 0 ? S.padY / 2 : r === rows + 1 ? S.padY * 1.5 + rows * S.th : S.padY + (r - 0.5) * S.th - 1;
  return [x, y];
}

function drawLink(path, zap) {
  const pts = path.map(({ r, c }) => center(r, c).map((v) => v.toFixed(1)).join(',')).join(' ');
  linkLayer.classList.toggle('zap', !!zap);
  linkLayer.innerHTML = `<polyline class="link-glow" pathLength="1" points="${pts}"/><polyline class="link-core" pathLength="1" points="${pts}"/>`;
}

/* ---------- Selection + matching ---------- */
function select(id) {
  deselect();
  S.selected = id;
  S.els.get(id)?.classList.add('sel');
  Sound.select();
}

function deselect() {
  if (S.selected != null) S.els.get(S.selected)?.classList.remove('sel');
  S.selected = null;
}

function shake(...ids) {
  ids.forEach((id) => {
    const node = S.els.get(id);
    if (!node) return;
    node.classList.remove('bad');
    void node.offsetWidth;
    node.classList.add('bad');
    setTimeout(() => node.classList.remove('bad'), 340);
  });
}

function clearHint() {
  (S.hint || []).forEach((id) => S.els.get(id)?.classList.remove('hint'));
  S.hint = null;
}

function onTile(id) {
  if (!S.running || S.paused || S.busy || !S.pos.has(id)) return;
  if (S.selected == null) return select(id);
  if (S.selected === id) return deselect();
  const a = S.pos.get(S.selected), b = S.pos.get(id);
  if (S.grid[a.r][a.c].type !== S.grid[b.r][b.c].type) {
    shake(S.selected);
    return select(id);
  }
  const path = Logic.findPath(S.grid, a, b);
  if (!path) {
    Sound.miss();
    buzz([25, 40, 25]);
    shake(S.selected, id);
    deselect();
    if (S.noPathTips++ < 2) UI.toast('Không nối được: đường nối chỉ được rẽ tối đa 2 lần và không cắt qua quân khác');
    return;
  }
  doMatch(a, b, path, false);
}

function doMatch(a, b, path, zap) {
  const pair = [S.grid[a.r][a.c], S.grid[b.r][b.c]];
  S.busy = true;
  deselect();
  clearHint();
  drawLink(path, zap);
  S.grid[a.r][a.c] = null;
  S.grid[b.r][b.c] = null;
  pair.forEach((t) => S.els.get(t.id).classList.add('gone'));

  const now = performance.now();
  S.combo = now - S.lastMatch < COMBO_WINDOW ? S.combo + 1 : 1;
  S.lastMatch = now;
  S.score += 10 + (S.combo - 1) * 5;
  const freeze = freezeFor(S.combo);
  if (freeze > S.freeze) {
    S.freeze = freeze;
    Sound.freeze();
    UI.flash();
  }
  UI.comboPill(S.combo);
  if (S.combo >= 2) UI.combo(S.combo, freeze);
  if (zap) Sound.zap(); else Sound.match(S.combo);
  buzz(zap ? 40 : 12);
  UI.hud(S);

  const cleared = Logic.remaining(S.grid) === 0;
  if (cleared) { S.running = false; refreshTray(); } // freeze the clock the moment the last pair goes

  setTimeout(() => {
    pair.forEach((t) => { S.els.get(t.id)?.remove(); S.els.delete(t.id); });
    linkLayer.innerHTML = '';
    S.busy = false;
    if (cleared) return Flow.win();
    Logic.applyGravity(S.grid, S.cfg.gravity);
    syncPositions();
    if (!Logic.findMove(S.grid)) {
      Logic.shuffleBoard(S.grid);
      syncPositions();
      UI.toast('Hết nước đi, bàn đã được xáo lại miễn phí');
    }
  }, 260);
}

/* ---------- Power-ups ---------- */
function usePower(id) {
  if (!S.running || S.paused || S.busy || UI.isModalOpen()) return;
  if (!S.inv[id]) {
    UI.toast(`Hết ${ITEM_NAMES[id]}. Thắng màn để mở hộp quà nhận thêm`);
    return;
  }
  const move = id === 'hint' || id === 'bolt' ? Logic.findMove(S.grid) : null;
  switch (id) {
    case 'hint':
      if (!move) return;
      clearHint();
      S.hint = [move.a, move.b].map((p) => S.grid[p.r][p.c].id);
      S.hint.forEach((tid) => S.els.get(tid).classList.add('hint'));
      break;
    case 'shuffle':
      deselect();
      clearHint();
      Logic.shuffleBoard(S.grid);
      syncPositions();
      break;
    case 'time':
      if (S.timeLeft > S.timeMax - 2) {
        UI.toast('Đồng hồ còn gần đầy, hãy để dành Thêm giờ cho lúc gấp');
        return;
      }
      S.timeLeft = Math.min(S.timeMax, S.timeLeft + 20);
      break;
    case 'bolt':
      if (!move) return;
      doMatch(move.a, move.b, move.path, true);
      break;
  }
  S.inv[id]--;
  if (id !== 'bolt') Sound.power();
  refreshTray();
  save();
}

/* ---------- Timer ---------- */
let lastTick = performance.now();
function tick(now) {
  const dt = Math.min(0.25, (now - lastTick) / 1000);
  lastTick = now;
  if (S.running && !S.paused && !UI.isModalOpen()) {
    if (S.freeze > 0) S.freeze = Math.max(0, S.freeze - dt); // combo reward: the clock stands still
    else S.timeLeft -= dt;
    if (S.timeLeft <= 0) {
      S.timeLeft = 0;
      S.running = false;
      deselect();
      clearHint();
      refreshTray();
      Flow.timeUp();
    }
  }
  if (S.cfg) UI.timer(S.timeLeft, S.timeMax, S.freeze > 0);
  requestAnimationFrame(tick);
}

function setPaused(p) {
  if (p && !S.running) return;
  S.paused = p;
  $('#pauseCover').hidden = !p;
  board.classList.toggle('paused', p);
  $('#btnPause').setAttribute('aria-label', p ? 'Chơi tiếp' : 'Tạm dừng');
  refreshTray();
  if (p) $('#btnResume').focus({ preventScroll: true });
}

function showSoundState() {
  $('#btnSound').setAttribute('aria-pressed', String(Sound.on));
  $('#btnPauseSound').textContent = `Âm thanh: ${Sound.on ? 'Bật' : 'Tắt'}`;
}

function toggleSound() {
  const on = Sound.toggle();
  showSoundState();
  UI.toast(on ? 'Đã bật âm thanh và rung' : 'Đã tắt âm thanh và rung', 1400);
}

/* ---------- Input ---------- */
/* Touch and mouse act on press for instant feedback; keyboard (Enter/Space) arrives as a click with detail 0. */
board.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const b = e.target.closest('.tile');
  if (!b) return;
  e.preventDefault();
  onTile(Number(b.dataset.id));
});
board.addEventListener('click', (e) => {
  const b = e.target.closest('.tile');
  if (b && e.detail === 0) onTile(Number(b.dataset.id));
});
board.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || UI.isModalOpen()) return;
  const k = e.key.toLowerCase();
  const powers = { h: 'hint', s: 'shuffle', t: 'time', b: 'bolt' };
  if (powers[k]) { usePower(powers[k]); e.preventDefault(); }
  else if (k === 'p' || k === 'escape') setPaused(!S.paused);
  else if (k === 'm') toggleSound();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.running && !UI.isModalOpen()) setPaused(true);
});

/* Re-fit whenever the play area changes: rotation, browser bars sliding, fonts arriving. */
let resizeTimer;
const refit = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(layout, 80);
};
if (window.ResizeObserver) new ResizeObserver(refit).observe(boardWrap);
else window.addEventListener('resize', refit);
