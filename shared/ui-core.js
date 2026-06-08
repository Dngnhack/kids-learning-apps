// ui-core.js — shared generic DOM rendering used by all kids' apps: home
// (level + mode pickers + rewards button), select-then-submit answer panel, celebrations,
// gentle retry, done, parent scorecard, rewards shelf, gate mount.
// App-specific QUESTION screens live in each app's own ui.js. Reduced-motion + mute respected.

export function el(tag, attrs = {}, text = '') {
  const n = document.createElement(tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text) n.textContent = text;
  return n;
}

/** Celebratory particle burst. big = full-screen finale; otherwise a medium correct-answer pop. */
export function celebrate(host, big = false) {
  const set = ['⭐', '🎉', '✨', '🌟', '💫', '🎊', '🌈', '💥', '🎈'];
  const layer = el('div', { class: 'fx' + (big ? ' fx-full' : ''), 'aria-hidden': 'true' });
  const screen = (host && host.closest && host.closest('.screen')) || host || document.body;
  screen.append(layer);
  const n = big ? 22 : 9;
  for (let i = 0; i < n; i++) {
    const p = el('div', { class: 'spark' }, set[i % set.length]);
    p.style.left = Math.round(5 + (i * 90 / n)) + '%';
    p.style.setProperty('--dx', (((i % 5) - 2) * 16) + 'px');
    p.style.setProperty('--rise', (big ? 60 + (i % 4) * 14 : 40) + 'vh');
    p.style.animationDelay = ((i % 6) * 0.05).toFixed(2) + 's';
    layer.append(p);
  }
  setTimeout(() => layer.remove(), big ? 1900 : 1100);
}

/** A gentle, encouraging "try again" chip (never red/✗). */
export function gentleRetry(host) {
  const prev = host.querySelector('.retry-chip'); if (prev) prev.remove();
  const chip = el('div', { class: 'retry-chip', 'aria-hidden': 'true' });
  chip.append(el('span', { class: 'retry-face' }, '🙂'), el('span', {}, ' Try again!'));
  host.append(chip);
  setTimeout(() => chip.remove(), 1500);
}

/**
 * Select-then-submit answer panel (replaces double-tap). Tap an option to SELECT it; the Check
 * button enables once something is chosen; Check verifies. mode 'audio' tiles speak on select.
 * Returns { node, controller }. controller.markCorrect() / markWrongRetry() drive feedback.
 */
export function answerPanel(choices, { mode = 'numeral', onSubmit, onHear }) {
  const wrap = el('div', { class: 'answer' });
  const grid = el('div', { class: 'choices' });
  const isAudio = mode === 'audio';
  const tiles = [];
  let selected = null, selectedTile = null, locked = false;

  const submit = el('button', { class: 'btn submit-btn', 'aria-label': 'Check the answer' }, '✓  Check');
  submit.disabled = true;

  choices.forEach((c, i) => {
    const b = el('button',
      { class: (isAudio ? 'tile atile' : 'tile') + ' t' + (i % 5), 'aria-label': isAudio ? 'hear an option' : String(c) },
      isAudio ? '🔊' : String(c));
    b.addEventListener('click', () => {
      if (locked) return;
      tiles.forEach((t) => t.classList.remove('sel'));
      b.classList.add('sel'); selected = c; selectedTile = b;
      submit.disabled = false; submit.classList.add('ready');
      if (isAudio && onHear) onHear(c);
    });
    tiles.push(b); grid.append(b);
  });

  submit.addEventListener('click', () => { if (selected === null || locked) return; onSubmit(selected); });

  const controller = {
    selected: () => selected,
    markCorrect() {
      locked = true;
      if (selectedTile) selectedTile.classList.add('correct');
      tiles.forEach((t) => (t.disabled = true));
      submit.disabled = true; submit.classList.remove('ready');
    },
    markWrongRetry() {
      if (selectedTile) {
        const w = selectedTile; w.classList.add('wrong');
        setTimeout(() => w.classList.remove('wrong', 'sel'), 600);
      }
      selected = null; selectedTile = null;
      submit.disabled = true; submit.classList.remove('ready');
      gentleRetry(wrap);
    },
  };
  wrap.append(grid, submit);
  return { node: wrap, controller };
}

/** Home: mascot + title + level chips + mode picker + start + rewards + grown-ups. */
export function renderHome(mount, { title, mascot, state, ranges, modes, pickLabel = 'How high?' }, handlers) {
  const { onStart, onParent, onPickRange, onPickMode, onRewards } = handlers;
  mount.innerHTML = '';
  const wrap = el('div', { class: 'screen home' });
  wrap.append(el('div', { class: 'mascot bob', 'aria-hidden': 'true' }, mascot), el('h1', { class: 'title' }, title));

  wrap.append(el('div', { class: 'pick-label' }, pickLabel));
  const rwrap = el('div', { class: 'chips' });
  for (const r of ranges) {
    const b = el('button', { class: 'chip' + (r.key === state.rangeKey ? ' on' : '') }, r.label);
    b.addEventListener('click', () => onPickRange(r));
    rwrap.append(b);
  }
  wrap.append(rwrap);

  wrap.append(el('div', { class: 'pick-label' }, 'Pick a game'));
  const mwrap = el('div', { class: 'mode-grid' });
  modes.forEach((m, i) => {
    const b = el('button', { class: 'mode-tile m' + (i % 4) + (m.id === state.mode ? ' on' : '') });
    b.append(el('span', { class: 'mode-emoji', 'aria-hidden': 'true' }, m.emoji), el('span', { class: 'mode-name' }, m.label));
    b.setAttribute('aria-label', m.label + ': ' + m.desc);
    b.addEventListener('click', () => onPickMode(m.id));
    mwrap.append(b);
  });
  wrap.append(mwrap);

  const start = el('button', { class: 'btn btn-big', 'aria-label': 'Start' }, '▶  Start');
  start.addEventListener('click', onStart);
  wrap.append(start);

  const row = el('div', { class: 'home-row' });
  const stars = el('button', { class: 'btn btn-ghost', 'aria-label': 'My stars and stickers' }, '🏆  My Stars');
  stars.addEventListener('click', onRewards);
  const parent = el('button', { class: 'btn btn-ghost', 'aria-label': 'For grown-ups' }, '⚙  Grown-ups');
  parent.addEventListener('click', onParent);
  row.append(stars, parent);
  wrap.append(row);
  mount.append(wrap);
}

export function renderDone(mount, { onAgain, onHome, onRewards }) {
  mount.innerHTML = '';
  const wrap = el('div', { class: 'screen done' });
  wrap.append(el('div', { class: 'mascot bob', 'aria-hidden': 'true' }, '🌟'), el('h1', { class: 'title' }, 'All done!'), el('p', { class: 'subtitle' }, 'Great job!'));
  const again = el('button', { class: 'btn btn-big' }, '↻  Play again');
  again.addEventListener('click', onAgain);
  const row = el('div', { class: 'home-row' });
  const stars = el('button', { class: 'btn btn-ghost' }, '🏆  My Stars');
  stars.addEventListener('click', onRewards);
  const home = el('button', { class: 'btn btn-ghost' }, '⌂  Home');
  home.addEventListener('click', onHome);
  row.append(stars, home);
  wrap.append(again, row); mount.append(wrap);
  celebrate(wrap, true);
}

/** Rewards shelf (on-device profile): stars, sticker collection, badges, progress map. */
export function renderRewards(mount, r, { onBack }) {
  mount.innerHTML = '';
  const wrap = el('div', { class: 'screen rewards' });
  wrap.append(el('div', { class: 'mascot', 'aria-hidden': 'true' }, '🦊'));
  wrap.append(el('h2', { class: 'title sm' }, 'My Stars'));
  wrap.append(el('div', { class: 'star-count' }, `⭐ ${r.mastered} learned`));

  // progress map (worlds) — lit when the badge milestone is reached
  const map = el('div', { class: 'progress-map' });
  r.badges.forEach((b, i) => {
    if (i) map.append(el('div', { class: 'map-link' + (b.got ? ' on' : '') }));
    const node = el('div', { class: 'map-node' + (b.got ? ' on' : ''), title: `${b.name} (${b.need})` }, b.got ? b.icon : '🔒');
    map.append(node);
  });
  wrap.append(map);

  wrap.append(el('div', { class: 'sc-title' }, 'Sticker collection'));
  const grid = el('div', { class: 'sticker-grid' });
  for (const s of r.stickers) grid.append(el('div', { class: 'sticker' + (s.got ? ' got' : '') }, s.got ? s.icon : '❔'));
  wrap.append(grid);
  if (r.nextStickerAt != null) wrap.append(el('div', { class: 'hint' }, `Learn ${r.nextStickerAt - r.mastered} more to earn the next sticker!`));

  const back = el('button', { class: 'btn' }, '⌂  Back');
  back.addEventListener('click', onBack);
  wrap.append(back); mount.append(wrap);
}

/** Parent area (behind the gate): scorecard + settings. On-device only. */
export function renderParent(mount, data, { onReset, onToggleAudio, onBack }) {
  mount.innerHTML = '';
  const wrap = el('div', { class: 'screen parent' });
  wrap.append(el('h2', {}, 'For grown-ups'));
  wrap.append(el('p', { class: 'parent-note' }, 'This app collects no data and shows no ads. Everything below is stored only on this device.'));
  wrap.append(el('div', { class: 'sc-title' }, 'Progress'));
  const s = el('div', { class: 'parent-stats' });
  const stat = (l, n, t) => el('div', { class: 'stat ' + t }, `${l}: ${n}`);
  s.append(stat('Got it', data.summary.known, 'green'), stat('Getting it', data.summary.familiar, 'blue'), stat('Learning', data.summary.learning, 'amber'), stat('of', data.summary.total, 'muted'));
  wrap.append(s);

  if (data.history.length) {
    const last = data.history[data.history.length - 1];
    wrap.append(el('div', { class: 'sc-line' }, `Last session: ${last.correct}/${last.total} correct (${Math.round(last.accuracy * 100)}%)`));
    const trend = el('div', { class: 'trend' });
    for (const h of data.history.slice(-8)) {
      const bar = el('div', { class: 'tbar' }); bar.style.height = (10 + Math.round(h.accuracy * 46)) + 'px';
      bar.setAttribute('title', `${Math.round(h.accuracy * 100)}%`); trend.append(bar);
    }
    wrap.append(el('div', { class: 'sc-sub' }, 'Recent sessions'), trend);
  } else {
    wrap.append(el('div', { class: 'sc-sub' }, 'Play a session to see progress here.'));
  }

  const audioBtn = el('button', { class: 'btn btn-ghost' }, data.audioEnabled ? '🔊  Sound: On' : '🔇  Sound: Off');
  audioBtn.addEventListener('click', onToggleAudio);
  const resetBtn = el('button', { class: 'btn btn-ghost' }, '↺  Reset progress');
  resetBtn.addEventListener('click', onReset);
  const back = el('button', { class: 'btn' }, 'Done');
  back.addEventListener('click', onBack);
  wrap.append(audioBtn, resetBtn, back);
  mount.append(wrap);
}

export function gateMount(mount) {
  mount.innerHTML = '';
  const w = el('div', { class: 'screen' });
  mount.append(w);
  return w;
}
