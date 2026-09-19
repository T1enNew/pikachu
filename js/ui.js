/* DOM rendering: HUD, timer, difficulty chips, power tray, reward track, toast, combo, modal. */
const $ = (sel) => document.querySelector(sel);

const UI = (() => {
  const el = {
    level: $('#levelVal'), score: $('#scoreVal'), best: $('#bestVal'), lives: $('#livesVal'),
    timer: $('#timer'), timerFill: $('#timerFill'), timerText: $('#timerText'),
    chips: $('#levelInfo'), tray: $('#tray'), track: $('#track'),
    toast: $('#toast'), modal: $('#modal'), card: $('#modalCard'), combo: $('#combo'),
  };
  const fmt = (n) => Math.round(n).toLocaleString('vi-VN');
  const restart = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

  function hud(S) {
    el.level.textContent = S.level;
    el.score.textContent = fmt(S.score);
    el.best.textContent = fmt(Math.max(S.best, S.score));
    lives(S.lives);
  }

  function lives(n, hit) {
    el.lives.innerHTML = Array.from({ length: MAX_STOCK }, (_, i) =>
      ICONS.life.replace('<svg', `<svg class="${i < n ? 'full' : 'empty'}" aria-hidden="true"`)).join('');
    el.lives.setAttribute('aria-label', `${n} trên ${MAX_STOCK} mạng`);
    if (hit) restart(el.lives, 'hit');
  }

  let shownSeconds = -1;
  function timer(left, max) {
    const f = Math.max(0, Math.min(1, left / max));
    el.timerFill.style.transform = `scaleX(${f})`;
    el.timer.classList.toggle('low', f < 0.2 && left > 0);
    const s = Math.ceil(Math.max(0, left));
    if (s !== shownSeconds) { shownSeconds = s; el.timerText.textContent = `${s}s`; }
  }

  function chips(cfg) {
    const g = Logic.GRAVITY[cfg.gravity];
    el.chips.innerHTML = [
      `Màn <b>${cfg.level}</b>`,
      `Bàn <b>${cfg.rows}×${cfg.cols}</b>`,
      `<b>${cfg.types}</b> loài thú`,
      `<span class="arrow" aria-hidden="true">${g.arrow}</span> <b>${g.name}</b>`,
      `<b>${cfg.time}</b> giây`,
    ].map((h) => `<li>${h}</li>`).join('');
  }

  function buildTray(onUse) {
    el.tray.innerHTML = POWERS.map((p) => `
      <button class="power" type="button" id="pw-${p.id}" data-power="${p.id}" title="${p.name}: ${p.desc} (phím ${p.key})">
        <span class="power-icon" aria-hidden="true">${ICONS[p.id]}</span>
        <span class="power-name">${p.name}</span>
        <span class="power-meta"><span class="pips"></span><kbd>${p.key}</kbd></span>
      </button>`).join('');
    el.tray.addEventListener('click', (e) => {
      const b = e.target.closest('[data-power]');
      if (b) onUse(b.dataset.power);
    });
  }

  function tray(inv, usable) {
    for (const p of POWERS) {
      const b = document.getElementById(`pw-${p.id}`);
      const n = inv[p.id] || 0;
      b.querySelector('.pips').innerHTML = Array.from({ length: MAX_STOCK }, (_, i) =>
        `<i class="pip${i < n ? ' on' : ''}"></i>`).join('');
      b.disabled = n === 0 || !usable;
      b.setAttribute('aria-label', `${p.name}, còn ${n} trên ${MAX_STOCK}. ${p.desc}. Phím ${p.key}`);
    }
  }

  function flashPower(id) {
    const b = document.getElementById(`pw-${id}`);
    if (b) restart(b, 'flash');
  }

  /* Shows the two most recent milestones and the next ones, so progress reads as a path. */
  function track(level) {
    const all = MILESTONES.slice();
    for (let l = 25; l <= level + 25; l += 5) all.push(milestoneFor(l));
    const nextIdx = all.findIndex((m) => m.level >= level);
    const start = Math.max(0, nextIdx - 2);
    el.track.innerHTML = all.slice(start, start + 6).map((m, i) => {
      const state = m.level < level ? 'done' : start + i === nextIdx ? 'next' : '';
      return `<li class="${state}">
        <span class="dot">${m.level}</span>
        <div><div class="m-name">Qua màn ${m.level} · ${m.title}</div><div class="m-give">${describeGive(m.give)}</div></div>
      </li>`;
    }).join('');
  }

  let toastTimer;
  function toast(msg, ms = 2400) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function combo(n) {
    el.combo.textContent = `Combo ×${n}`;
    restart(el.combo, 'show');
  }

  function openModal(html) {
    el.card.innerHTML = html;
    el.modal.hidden = false;
    const f = el.card.querySelector('[data-autofocus]') || el.card.querySelector('button:not(:disabled)');
    if (f) f.focus({ preventScroll: true });
    return el.card;
  }
  function closeModal() {
    el.modal.hidden = true;
    el.card.innerHTML = '';
  }
  const isModalOpen = () => !el.modal.hidden;

  /* Keep Tab inside the open dialog. */
  el.modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...el.card.querySelectorAll('button:not(:disabled)')];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });

  return { fmt, hud, lives, timer, chips, buildTray, tray, flashPower, track, toast, combo, openModal, closeModal, isModalOpen };
})();
