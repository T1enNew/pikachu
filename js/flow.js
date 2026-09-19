/* Game flow: start screen, win (stars, milestone, gift boxes), time-up, game over, help, saving, boot. */
const SAVE_KEY = 'noithu.save.v1';
const BEST_KEY = 'noithu.best';

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      level: S.level, score: S.levelStartScore, lives: S.lives, inv: S.inv,
    }));
  } catch (e) { /* storage blocked: progress lasts for this visit only */ }
}

function saveBest() {
  S.best = Math.max(S.best, S.score);
  try { localStorage.setItem(BEST_KEY, String(S.best)); } catch (e) { /* ignore */ }
}

function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!d || !(d.level >= 1) || !(d.lives >= 1)) return null;
    const inv = {};
    for (const p of POWERS) inv[p.id] = Math.max(0, Math.min(MAX_STOCK, Number(d.inv?.[p.id]) || 0));
    return { level: Math.floor(d.level), score: Math.max(0, Number(d.score) || 0), lives: Math.min(MAX_STOCK, Math.floor(d.lives)), inv };
  } catch (e) {
    return null;
  }
}

function resetGame() {
  Object.assign(S, { level: 1, score: 0, lives: MAX_STOCK, inv: { ...START_INV }, bestBefore: S.best });
}

/* Adds rewards up to the cap of 3; anything beyond turns into points. */
function grant(give) {
  let overflow = 0, points = 0;
  for (const [id, n] of Object.entries(give)) {
    if (id === 'points') { points += n; continue; }
    const have = id === 'life' ? S.lives : S.inv[id];
    const add = Math.min(n, MAX_STOCK - have);
    if (id === 'life') S.lives += add; else S.inv[id] += add;
    if (add > 0 && id !== 'life') UI.flashPower(id);
    overflow += n - add;
  }
  points += overflow * OVERFLOW_POINTS;
  S.score += points;
  UI.hud(S);
  refreshTray();
  return { overflow, points };
}

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';

const Flow = (() => {
  function showStart(hasSave) {
    const card = UI.openModal(`
      <p class="m-eyebrow">Game nối thú cổ điển</p>
      <h2 class="m-title" id="modalTitle">Nối Thú Sấm Sét</h2>
      <p class="m-text">Chọn hai quân giống nhau và nối chúng bằng đường gấp khúc tối đa 3 đoạn. Mỗi màn thắng, bàn to hơn, nhiều loài hơn, ít giờ hơn, và bạn được mở một hộp quà.</p>
      <div class="m-actions">
        ${hasSave ? `<button class="btn btn-primary" data-act="continue" data-autofocus>Chơi tiếp màn ${S.level}</button>` : ''}
        <button class="btn ${hasSave ? 'btn-ghost' : 'btn-primary'}" data-act="new" ${hasSave ? '' : 'data-autofocus'}>${hasSave ? 'Chơi mới' : 'Bắt đầu'}</button>
        <button class="btn btn-ghost" data-act="help">Cách chơi</button>
      </div>`);
    card.querySelector('.m-actions').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'continue') { UI.closeModal(); S.running = true; refreshTray(); }
      if (act === 'new') { resetGame(); UI.closeModal(); startLevel(); }
      if (act === 'help') help(() => showStart(hasSave));
    });
  }

  function help(onClose) {
    const card = UI.openModal(`
      <p class="m-eyebrow">Cách chơi</p>
      <h2 class="m-title" id="modalTitle">Nối nhanh, nối gọn</h2>
      <ol class="rules">
        <li><b>Chọn 2 quân giống nhau.</b> Nối được khi đường giữa chúng rẽ tối đa 2 lần và không cắt qua quân khác. Đường được phép vòng ra ngoài mép bàn.</li>
        <li><b>Xoá sạch bàn trước khi hết giờ.</b> Nối liên tiếp trong 3,5 giây để ăn combo cộng điểm. Từ <b>Combo ×3</b>, đồng hồ đứng lại 1,5 giây, combo càng dài càng lâu (tối đa 4 giây).</li>
        <li><b>Mỗi lần thắng, độ khó tăng:</b> bàn lớn hơn, nhiều loài hơn, ít giây hơn cho mỗi cặp. Từ màn 3, quân tự dồn theo hướng sau mỗi lần nối.</li>
        <li><b>Thắng màn</b> được chọn 1 trong 3 hộp quà. Qua các <b>mốc thưởng</b> nhận thêm quà cố định.</li>
        <li><b>Mỗi vật phẩm giữ tối đa 3 lượt</b>, kể cả mạng. Quà vượt mức đổi thành ${OVERFLOW_POINTS} điểm.</li>
      </ol>
      <div class="m-section keys-section">
        <p class="m-label">Phím tắt</p>
        <div class="keys">
          <kbd>H</kbd><span>Gợi ý: sáng lên một cặp nối được</span>
          <kbd>S</kbd><span>Xáo trộn: xếp lại vị trí mọi quân</span>
          <kbd>T</kbd><span>Thêm giờ: cộng 20 giây</span>
          <kbd>B</kbd><span>Sét đánh: tự xoá một cặp</span>
          <kbd>P</kbd><span>Tạm dừng / chơi tiếp</span>
          <kbd>M</kbd><span>Bật / tắt âm thanh</span>
        </div>
      </div>
      <div class="m-actions"><button class="btn btn-primary" data-autofocus>Đã hiểu</button></div>`);
    card.querySelector('.m-actions button').addEventListener('click', () => {
      UI.closeModal();
      if (onClose) onClose();
    });
  }

  function showTrack() {
    const card = UI.openModal(`
      <p class="m-eyebrow">Đang ở màn ${S.level}</p>
      <h2 class="m-title" id="modalTitle">Mốc thưởng</h2>
      <p class="m-text">Qua các màn dưới đây để nhận quà cố định, ngoài hộp quà sau mỗi màn thắng.</p>
      <ol class="track">${UI.trackHTML(S.level)}</ol>
      <div class="m-section">
        <p class="m-label">Kho của bạn · tối đa ${MAX_STOCK} mỗi loại</p>
        <div class="inv-row">
          ${POWERS.map((p) => `<div><span>${p.name}</span><span class="pips">${Array.from({ length: MAX_STOCK }, (_, i) =>
            `<i class="pip${i < S.inv[p.id] ? ' on' : ''}"></i>`).join('')}</span></div>`).join('')}
        </div>
      </div>
      <div class="m-actions"><button class="btn btn-primary" data-autofocus>Đóng</button></div>`);
    card.querySelector('.m-actions button').addEventListener('click', UI.closeModal);
  }

  function win() {
    Sound.win();
    UI.flash();
    UI.comboPill(0);
    refreshTray();
    const frac = S.timeLeft / S.timeMax;
    const stars = frac >= 0.5 ? 3 : frac >= 0.25 ? 2 : 1;
    const matchPoints = S.score - S.levelStartScore;
    const secs = Math.floor(S.timeLeft);
    const timeBonus = secs * 5;
    const clearBonus = S.level * 100;
    S.score += timeBonus + clearBonus;

    const ms = milestoneFor(S.level);
    const msResult = ms ? grant(ms.give) : null;
    const gifts = [rollGift(S.level), rollGift(S.level), rollGift(S.level)];
    const now = S.cfg;
    const next = Logic.levelConfig(S.level + 1);
    saveBest();
    UI.hud(S);

    const titles = { 3: 'Tuyệt đỉnh!', 2: 'Rất tốt!', 1: 'Qua màn!' };
    const up = (a, b) => (b > a ? '<span class="up">▲</span> ' : '');
    const card = UI.openModal(`
      <p class="m-eyebrow">Hoàn thành màn ${S.level}</p>
      <h2 class="m-title" id="modalTitle">${titles[stars]}</h2>
      <div class="stars" aria-label="${stars} trên 3 sao">${[1, 2, 3].map((i) => STAR.replace('<svg', `<svg class="${i <= stars ? 'on' : ''}"`)).join('')}</div>
      <div class="m-section">
        <dl class="tally">
          <dt>Điểm nối thú</dt><dd>+${UI.fmt(matchPoints)}</dd>
          <dt>Thời gian còn lại (${secs}s × 5)</dt><dd>+${UI.fmt(timeBonus)}</dd>
          <dt>Thưởng qua màn</dt><dd>+${UI.fmt(clearBonus)}</dd>
          <dt class="total">Tổng điểm</dt><dd class="total">${UI.fmt(S.score)}</dd>
        </dl>
      </div>
      ${ms ? `<div class="m-section milestone-card">
        <span class="mc-icon" aria-hidden="true">${ICONS.chest}</span>
        <div><b>Đạt mốc thưởng: ${ms.title}</b><span>${describeGive(ms.give)}${msResult.overflow ? ` · phần vượt mức 3 đổi thành ${UI.fmt(msResult.points)} điểm` : ''}</span></div>
      </div>` : ''}
      <div class="m-section">
        <p class="m-label">Chọn 1 hộp quà</p>
        <div class="gifts ready" id="gifts">
          ${gifts.map((g, i) => `<button class="gift" type="button" data-i="${i}" aria-label="Hộp quà ${i + 1}">
            <span class="gift-inner">
              <span class="gi-icon ${g.id}">${ICONS[g.id]}</span>
              <b>+${UI.fmt(g.amount)} ${ITEM_NAMES[g.id]}</b>
              <small></small>
            </span>
          </button>`).join('')}
        </div>
        <p class="gift-note" id="giftNote" aria-live="polite">Mỗi hộp chứa một phần quà ngẫu nhiên.</p>
      </div>
      <div class="m-section">
        <p class="m-label">Màn ${S.level + 1} khó hơn</p>
        <ul class="preview">
          <li>${up(now.rows * now.cols, next.rows * next.cols)}Bàn <b>${next.rows}×${next.cols}</b></li>
          <li>${up(now.types, next.types)}<b>${next.types}</b> loài</li>
          <li>${Logic.GRAVITY[next.gravity].arrow} <b>${Logic.GRAVITY[next.gravity].name}</b></li>
          <li><b>${(next.time / next.pairs).toFixed(1)}</b> giây mỗi cặp</li>
        </ul>
      </div>
      <div class="m-actions">
        <button class="btn btn-primary" id="btnNext" disabled>Mở một hộp quà trước</button>
      </div>`);

    const box = card.querySelector('#gifts');
    const nextBtn = card.querySelector('#btnNext');
    box.querySelector('.gift').focus({ preventScroll: true });
    box.addEventListener('click', (e) => {
      const pick = e.target.closest('.gift');
      if (!pick || nextBtn.disabled === false) return;
      const g = gifts[Number(pick.dataset.i)];
      const res = grant({ [g.id]: g.amount });
      Sound.gift();
      box.classList.remove('ready');
      box.querySelectorAll('.gift').forEach((b) => {
        const mine = b === pick;
        b.classList.add('open', mine ? 'picked' : 'missed');
        b.querySelector('small').textContent = mine ? 'Của bạn' : 'Bỏ lỡ';
        b.disabled = true;
      });
      card.querySelector('#giftNote').textContent = res.overflow
        ? `Kho ${ITEM_NAMES[g.id]} đã đủ 3 lượt, phần dư đổi thành ${UI.fmt(res.points)} điểm.`
        : `Đã nhận +${UI.fmt(g.amount)} ${ITEM_NAMES[g.id]}.`;
      nextBtn.disabled = false;
      nextBtn.textContent = `Chơi màn ${S.level + 1}`;
      nextBtn.focus({ preventScroll: true });
      saveBest();
    });
    nextBtn.addEventListener('click', () => {
      S.level++;
      UI.closeModal();
      startLevel();
    });
  }

  function timeUp() {
    Sound.lose();
    if (S.inv.time <= 0) return loseLife();
    const left = Logic.remaining(S.grid) / 2;
    const card = UI.openModal(`
      <p class="m-eyebrow">Hết giờ · Màn ${S.level}</p>
      <h2 class="m-title" id="modalTitle">Suýt nữa thôi!</h2>
      <p class="m-text">Còn ${left} cặp chưa nối. Dùng 1 Thêm giờ để chơi tiếp với 20 giây, hoặc chơi lại màn và mất 1 mạng.</p>
      <div class="m-actions">
        <button class="btn btn-primary" data-act="rescue" data-autofocus>Dùng Thêm giờ (còn ${S.inv.time})</button>
        <button class="btn btn-ghost" data-act="retry">Chơi lại, mất 1 mạng</button>
      </div>`);
    card.querySelector('.m-actions').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'rescue') {
        S.inv.time--;
        S.timeLeft = 20;
        S.running = true;
        UI.closeModal();
        refreshTray();
        UI.flashPower('time');
        save();
      }
      if (act === 'retry') loseLife();
    });
  }

  function loseLife() {
    S.lives--;
    UI.lives(S.lives, true);
    if (S.lives <= 0) return gameOver();
    S.score = S.levelStartScore;
    save();
    const card = UI.openModal(`
      <p class="m-eyebrow">Mất 1 mạng</p>
      <h2 class="m-title" id="modalTitle">Thử lại màn ${S.level}</h2>
      <p class="m-text">Còn ${S.lives} mạng. Bàn sẽ được xếp mới, điểm của lượt vừa rồi không được tính. Vật phẩm đã dùng không được hoàn lại.</p>
      <div class="m-actions"><button class="btn btn-primary" data-autofocus>Chơi lại</button></div>`);
    card.querySelector('.m-actions button').addEventListener('click', () => {
      UI.closeModal();
      startLevel();
    });
  }

  function gameOver() {
    const record = S.score > 0 && S.score > (S.bestBefore || 0);
    saveBest();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    const card = UI.openModal(`
      <p class="m-eyebrow">Kết thúc</p>
      <h2 class="m-title" id="modalTitle">${record ? 'Kỷ lục mới!' : 'Hết mạng rồi'}</h2>
      <p class="m-text">${record ? 'Bạn vừa lập kỷ lục cao nhất trên máy này.' : 'Lần sau thử để dành Thêm giờ cho những giây cuối nhé.'}</p>
      <div class="m-section">
        <dl class="tally">
          <dt>Màn đạt được</dt><dd>${S.level}</dd>
          <dt>Kỷ lục</dt><dd>${UI.fmt(S.best)}</dd>
          <dt class="total">Tổng điểm</dt><dd class="total">${UI.fmt(S.score)}</dd>
        </dl>
      </div>
      <div class="m-actions"><button class="btn btn-primary" data-autofocus>Chơi lại từ màn 1</button></div>`);
    card.querySelector('.m-actions button').addEventListener('click', () => {
      resetGame();
      UI.closeModal();
      startLevel();
    });
  }

  function boot() {
    UI.buildTray(usePower);
    $('#btnPause').addEventListener('click', () => setPaused(!S.paused));
    $('#btnResume').addEventListener('click', () => setPaused(false));
    $('#btnSound').addEventListener('click', toggleSound);
    $('#btnPauseSound').addEventListener('click', toggleSound);
    showSoundState();
    $('#btnHelp').addEventListener('click', () => { if (!UI.isModalOpen()) help(); });
    $('#btnPauseHelp').addEventListener('click', () => help());
    $('#btnTrack').addEventListener('click', () => { if (!UI.isModalOpen()) showTrack(); });

    try { S.best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { S.best = 0; }
    S.bestBefore = S.best;
    const saved = loadSave();
    if (saved) Object.assign(S, saved);
    startLevel(false); // board sits ready behind the start screen
    showStart(!!saved && (saved.level > 1 || saved.score > 0));
    requestAnimationFrame(tick);
  }

  return { boot, win, timeUp, help };
})();

Flow.boot();
