/* Power-ups, reward milestones, gift boxes and sound. Every item is capped at MAX_STOCK. */
const MAX_STOCK = 3;

const ICONS = {
  hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-4 11.6c.7.6 1 1.3 1 2.1v.3h6v-.3c0-.8.3-1.5 1-2.1a6.5 6.5 0 0 0-4-11.6z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  time: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.6 2.2M9.5 2.5h5M12 2.5V6"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 1.5 4 13.8h6.8L9.5 22.5 20 9.7h-7z"/></svg>',
  life: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.4-4.6-9.8-9.3C.6 8.3 2.6 4 6.6 4c2.3 0 4 1.3 5.4 3.2C13.4 5.3 15.1 4 17.4 4c4 0 6 4.3 4.4 7.7C19.4 16.4 12 21 12 21z"/></svg>',
  points: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>',
  chest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 10h18v10H3zM3 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4M10 10v4h4v-4"/></svg>',
};

const POWERS = [
  { id: 'hint',    name: 'Gợi ý',    key: 'H', desc: 'Sáng lên một cặp nối được' },
  { id: 'shuffle', name: 'Xáo trộn', key: 'S', desc: 'Xếp lại vị trí mọi quân' },
  { id: 'time',    name: 'Thêm giờ', key: 'T', desc: 'Cộng thêm 20 giây' },
  { id: 'bolt',    name: 'Sét đánh', key: 'B', desc: 'Tự xoá ngay một cặp' },
];

const ITEM_NAMES = { hint: 'Gợi ý', shuffle: 'Xáo trộn', time: 'Thêm giờ', bolt: 'Sét đánh', life: 'Mạng', points: 'Điểm' };
const OVERFLOW_POINTS = 150;

/* Fixed milestones on the reward track; beyond level 20 every 5th level is a gold chest. */
const MILESTONES = [
  { level: 2,  title: 'Quà khởi động', give: { hint: 1 } },
  { level: 3,  title: 'Tia sét đầu tiên', give: { bolt: 1 } },
  { level: 5,  title: 'Túi dụng cụ', give: { time: 1, shuffle: 1 } },
  { level: 7,  title: 'Tim hồi phục', give: { life: 1, hint: 1 } },
  { level: 10, title: 'Rương vàng', give: { hint: 1, shuffle: 1, time: 1, bolt: 1 } },
  { level: 13, title: 'Bão sét', give: { bolt: 2 } },
  { level: 16, title: 'Cứu viện', give: { life: 1, time: 2 } },
  { level: 20, title: 'Rương kim cương', give: { hint: 3, shuffle: 3, time: 3, bolt: 3, life: 3 } },
];

function milestoneFor(level) {
  const fixed = MILESTONES.find((m) => m.level === level);
  if (fixed) return fixed;
  if (level > 20 && level % 5 === 0) return { level, title: 'Rương vàng', give: { hint: 1, shuffle: 1, time: 1, bolt: 1 } };
  return null;
}

function describeGive(give) {
  return Object.entries(give).map(([id, n]) => `+${n} ${ITEM_NAMES[id]}`).join(' · ');
}

/* Weighted draw for one gift box; later levels lean slightly toward stronger items. */
function rollGift(level) {
  const table = [
    ['hint', 30], ['time', 22], ['shuffle', 20],
    ['bolt', 12 + Math.min(level, 10)], ['life', 6], ['points', 10],
  ];
  const total = table.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  const [id] = table.find(([, w]) => (roll -= w) < 0) || table[0];
  if (id === 'points') return { id, amount: 200 + level * 60 };
  if (id === 'life') return { id, amount: 1 };
  return { id, amount: Math.random() < 0.22 ? 2 : 1 };
}

const Sound = (() => {
  let ctx = null;
  let on = true;
  try { on = localStorage.getItem('noithu.sound') !== 'off'; } catch (e) { /* storage blocked */ }

  /* Mobile browsers only start audio inside a real tap, so wake the context on the first one. */
  const unlockEvents = ['pointerup', 'touchend', 'keydown'];
  function unlock() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      if (ctx.state === 'running') unlockEvents.forEach((ev) => window.removeEventListener(ev, unlock));
    } catch (e) { /* audio unavailable */ }
  }
  unlockEvents.forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));

  function tone(freq, dur, type = 'sine', gain = 0.06, delay = 0) {
    if (!on) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) { /* audio unavailable */ }
  }

  return {
    get on() { return on; },
    toggle() {
      on = !on;
      try { localStorage.setItem('noithu.sound', on ? 'on' : 'off'); } catch (e) { /* ignore */ }
      return on;
    },
    select() { tone(620, 0.05, 'triangle', 0.05); },
    match(combo = 1) {
      const base = 760 + Math.min(combo, 8) * 60;
      tone(base, 0.07, 'square', 0.035);
      tone(base * 1.5, 0.1, 'square', 0.03, 0.06);
    },
    miss() { tone(170, 0.14, 'sawtooth', 0.04); },
    power() { [520, 780, 1040].forEach((f, i) => tone(f, 0.09, 'triangle', 0.05, i * 0.05)); },
    zap() { tone(1400, 0.05, 'sawtooth', 0.04); tone(300, 0.2, 'square', 0.03, 0.04); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, i * 0.11)); },
    gift() { [880, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'sine', 0.06, i * 0.07)); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.22, 'triangle', 0.06, i * 0.16)); },
  };
})();
