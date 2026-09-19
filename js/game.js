/* Core play: state, board view, selection and matching, timer, power-ups, input. */
const START_INV = { hint: 2, shuffle: 1, time: 1, bolt: 0 };

const S = {
  level: 1, score: 0, levelStartScore: 0, best: 0, lives: MAX_STOCK,
  inv: { ...START_INV },
  cfg: null, grid: null, species: [],
  pos: new Map(), els: new Map(),
  timeLeft: 0, timeMax: 1,
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

function startLevel(run = true) {
  const cfg = Logic.levelConfig(S.level);
  // Phones held upright get a tall board instead of a wide one.
  if (window.innerWidth < 700 && window.innerHeight > window.innerWidth && cfg.cols > cfg.rows) {
    [cfg.rows, cfg.cols] = [cfg.cols, cfg.rows];
  }
  const { grid, species } = Logic.generate(cfg);
  Object.assign(S, {
    cfg, grid, species,
    timeLeft: cfg.time, timeMax: cfg.time,
    selected: null, hint: null, combo: 0, lastMatch: 0,
    busy: false, levelStartScore: S.score, running: run,
  });
  setPaused(false);
  buildBoard();
  UI.chips(cfg);
  UI.hud(S);
  UI.track(S.level);
  UI.timer(S.timeLeft, S.timeMax);
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
    b.innerHTML = `<span class="face">${S.species[t.type]}</span>`;
    b.addEventListener('animationend', (e) => {
      if (e.animationName === 'tileIn') b.classList.remove('enter');
    });
    board.appendChild(b);
    S.els.set(t.id, b);
  });
  syncPositions();
}

/* Fit the board (plus the empty ring that paths may use) into the space left on screen. */
function layout() {
  if (!S.cfg) return;
  const { rows, cols } = S.cfg;
  const cs = getComputedStyle(boardWrap);
  const frameX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const frameY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) * 2;
  const innerW = boardWrap.clientWidth - frameX;
  const docTop = boardWrap.getBoundingClientRect().top + window.scrollY;
  const reserve = window.innerWidth <= 680 ? 128 : 20;
  const innerH = Math.max(220, window.innerHeight - docTop - reserve - frameY);
  const ratio = 1.2;
  const w = Math.max(18, Math.floor(Math.min(innerW / (cols + 1.1), innerH / ((rows + 1.1) * ratio), 70)));
  const h = Math.round(w * ratio);
  Object.assign(S, { tw: w, th: h, padX: Math.round(w * 0.55), padY: Math.round(h * 0.55) });
  board.style.width = `${cols * w + 2 * S.padX}px`;
  board.style.height = `${rows * h + 2 * S.padY}px`;
  board.style.setProperty('--tw', `${w - 3}px`);
  board.style.setProperty('--th', `${h - 5}px`);
  board.style.setProperty('--fs', `${Math.round(w * 0.6)}px`);
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

function center(r, c) {
  return [S.padX + (c - 1) * S.tw + S.tw / 2, S.padY + (r - 1) * S.th + S.th / 2 - 1];
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
  S.combo = now - S.lastMatch < 3500 ? S.combo + 1 : 1;
  S.lastMatch = now;
  S.score += 10 + (S.combo - 1) * 5;
  if (S.combo >= 2) UI.combo(S.combo);
  if (zap) Sound.zap(); else Sound.match(S.combo);
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
    S.timeLeft -= dt;
    if (S.timeLeft <= 0) {
      S.timeLeft = 0;
      S.running = false;
      deselect();
      clearHint();
      refreshTray();
      Flow.timeUp();
    }
  }
  if (S.cfg) UI.timer(S.timeLeft, S.timeMax);
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

function toggleSound() {
  const on = Sound.toggle();
  $('#btnSound').setAttribute('aria-pressed', String(on));
  UI.toast(on ? 'Đã bật âm thanh' : 'Đã tắt âm thanh', 1400);
}

/* ---------- Input ---------- */
board.addEventListener('click', (e) => {
  const b = e.target.closest('.tile');
  if (b) onTile(Number(b.dataset.id));
});

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

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(layout, 120);
});
