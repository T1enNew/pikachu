/* Board logic: level difficulty, generation, path finding (<= 2 turns), gravity, shuffle. */
const Logic = (() => {
  const SPECIES = [
    '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮',
    '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦉', '🦇', '🐺',
    '🐗', '🐴', '🦄', '🐝', '🐞', '🦋', '🐌', '🐢', '🐍', '🐙',
    '🦀', '🐠', '🐬', '🐳', '🦈', '🦒', '🦓', '🦔', '🦩', '🦜',
  ];

  const GRAVITY = {
    none:  { name: 'Đứng yên',           arrow: '•' },
    down:  { name: 'Dồn xuống',          arrow: '↓' },
    up:    { name: 'Dồn lên',            arrow: '↑' },
    left:  { name: 'Dồn trái',           arrow: '←' },
    right: { name: 'Dồn phải',           arrow: '→' },
    inV:   { name: 'Ép vào giữa (dọc)',  arrow: '⇅' },
    outV:  { name: 'Tách ra (dọc)',      arrow: '↕' },
    inH:   { name: 'Ép vào giữa (ngang)', arrow: '⇄' },
    outH:  { name: 'Tách ra (ngang)',    arrow: '↔' },
  };
  const GRAVITY_ORDER = ['none', 'none', 'down', 'left', 'up', 'right', 'inV', 'outH', 'inH', 'outV'];
  const SIZES = [[5, 8], [6, 8], [6, 10], [7, 10], [7, 12], [8, 12], [8, 14], [9, 14], [9, 16], [10, 16]];

  /* Each win moves one step up: bigger board, more species, less time per pair, tiles that shift. */
  function levelConfig(level) {
    const [rows, cols] = SIZES[Math.min(level, SIZES.length) - 1];
    const pairs = (rows * cols) / 2;
    const types = Math.min(SPECIES.length, 9 + level * 2);
    const perPair = Math.max(3, 6 - (level - 1) * 0.35);
    const gravity = level <= GRAVITY_ORDER.length
      ? GRAVITY_ORDER[level - 1]
      : GRAVITY_ORDER[2 + ((level - 1) % (GRAVITY_ORDER.length - 2))];
    return { level, rows, cols, pairs, types, time: Math.round(pairs * perPair), gravity };
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* The grid carries an empty ring around the tiles so paths may run outside the board. */
  let uid = 0;
  function generate(cfg) {
    const grid = Array.from({ length: cfg.rows + 2 }, () => Array(cfg.cols + 2).fill(null));
    const species = shuffleArray(SPECIES.slice()).slice(0, cfg.types);
    const faces = [];
    for (let p = 0; p < cfg.pairs; p++) faces.push(p % cfg.types, p % cfg.types);
    shuffleArray(faces);
    let k = 0;
    for (let r = 1; r <= cfg.rows; r++) {
      for (let c = 1; c <= cfg.cols; c++) grid[r][c] = { id: ++uid, type: faces[k++] };
    }
    if (!findMove(grid)) shuffleBoard(grid);
    return { grid, species };
  }

  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  /* Breadth-first by straight segments: a cell first reached in segment k needs k turns. */
  function findPath(grid, a, b) {
    const R = grid.length, C = grid[0].length;
    const key = (r, c) => r * C + c;
    const parent = new Map([[key(a.r, a.c), null]]);
    const trace = (p) => {
      const out = [];
      for (let q = p; q; q = parent.get(key(q.r, q.c))) out.unshift(q);
      return out;
    };
    let frontier = [a];
    for (let seg = 0; seg < 3; seg++) {
      const next = [];
      for (const p of frontier) {
        for (const [dr, dc] of DIRS) {
          let r = p.r + dr, c = p.c + dc;
          while (r >= 0 && r < R && c >= 0 && c < C) {
            if (r === b.r && c === b.c) return trace(p).concat([{ r, c }]);
            if (grid[r][c]) break;
            const k = key(r, c);
            if (!parent.has(k)) {
              parent.set(k, p);
              next.push({ r, c });
            }
            r += dr;
            c += dc;
          }
        }
      }
      frontier = next;
    }
    return null;
  }

  function findMove(grid) {
    const groups = new Map();
    for (let r = 1; r < grid.length - 1; r++) {
      for (let c = 1; c < grid[0].length - 1; c++) {
        const t = grid[r][c];
        if (!t) continue;
        if (!groups.has(t.type)) groups.set(t.type, []);
        groups.get(t.type).push({ r, c });
      }
    }
    for (const list of shuffleArray([...groups.values()])) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const path = findPath(grid, list[i], list[j]);
          if (path) return { a: list[i], b: list[j], path };
        }
      }
    }
    return null;
  }

  /* Keeps tile ids so the view can slide each tile to its new spot. */
  function shuffleBoard(grid) {
    const spots = [], tiles = [];
    for (let r = 1; r < grid.length - 1; r++) {
      for (let c = 1; c < grid[0].length - 1; c++) {
        if (grid[r][c]) { spots.push([r, c]); tiles.push(grid[r][c]); }
      }
    }
    if (tiles.length < 2) return false;
    for (let tries = 0; tries < 200; tries++) {
      shuffleArray(tiles);
      spots.forEach(([r, c], i) => { grid[r][c] = tiles[i]; });
      if (findMove(grid)) return true;
    }
    return false;
  }

  function compact(line, toEnd) {
    const tiles = line.filter(Boolean);
    const gaps = Array(line.length - tiles.length).fill(null);
    return toEnd ? gaps.concat(tiles) : tiles.concat(gaps);
  }

  function applyGravity(grid, mode) {
    if (mode === 'none') return;
    const rows = grid.length - 2, cols = grid[0].length - 2;
    const vertical = mode === 'down' || mode === 'up' || mode === 'inV' || mode === 'outV';
    const outer = vertical ? cols : rows;
    const len = vertical ? rows : cols;
    const half = Math.floor(len / 2);
    for (let i = 1; i <= outer; i++) {
      const at = (j) => (vertical ? [j, i] : [i, j]);
      const fill = (from, to, toEnd) => {
        const line = [];
        for (let j = from; j <= to; j++) { const [r, c] = at(j); line.push(grid[r][c]); }
        compact(line, toEnd).forEach((t, k) => { const [r, c] = at(from + k); grid[r][c] = t; });
      };
      switch (mode) {
        case 'down': case 'right': fill(1, len, true); break;
        case 'up': case 'left': fill(1, len, false); break;
        case 'inV': case 'inH': fill(1, half, true); fill(half + 1, len, false); break;
        case 'outV': case 'outH': fill(1, half, false); fill(half + 1, len, true); break;
      }
    }
  }

  function remaining(grid) {
    let n = 0;
    for (const row of grid) for (const t of row) if (t) n++;
    return n;
  }

  return { SPECIES, GRAVITY, levelConfig, generate, findPath, findMove, shuffleBoard, applyGravity, remaining, shuffleArray };
})();
