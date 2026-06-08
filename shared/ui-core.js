// ui-core.js — shared generic DOM rendering used by all kids' apps: home
// (difficulty + mode pickers), answer tiles, reward burst, done, parent scorecard, gate mount.
// App-specific QUESTION screens live in each app's own ui.js (they render different content).
// Reduced-motion + mute respected (caller passes audio state; CSS handles prefers-reduced-motion).

export function el(tag, attrs = {}, text = '') {
  const n = document.createElement(tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text) n.textContent = text;
  return n;
}

/** Celebratory burst (5 emojis). */
export function burst(wrap) {
  const set = ['⭐', '🎉', '✨', '🌟', '💫'];
  for (let i = 0; i < 5; i++) {
    const b = el('div', { class: 'burst', 'aria-hidden': 'true' }, set[i]);
    b.style.left = 20 + i * 15 + '%';
    wrap.append(b); setTimeout(() => b.remove(), 1000);
  }
}

/** Numeral answer tiles (tap = answer). Shared by Numbers + Math. */
export function numeralTiles(choices, onAnswer) {
  const wrap = el('div', { class: 'choices' });
  for (const c of choices) {
    const b = el('button', { class: 'tile', 'aria-label': String(c) }, String(c));
    b.addEventListener('click', () => onAnswer(c, b));
    wrap.append(b);
  }
  return wrap;
}

/** Audio answer tiles: first tap = hear + select; second tap on selected = pick (answer). */
export function audioTiles(choices, onAnswer, onHear) {
  const wrap = el('div', { class: 'choices' });
  for (const c of choices) {
    const b = el('button', { class: 'atile', 'aria-label': 'hear an option' }, '🔊');
    b.addEventListener('click', () => {
      if (b.classList.contains('sel')) { onAnswer(c, b); return; }
      wrap.querySelectorAll('.atile').forEach((t) => t.classList.remove('sel'));
      b.classList.add('sel'); onHear(c);
    });
    wrap.append(b);
  }
  return wrap;
}

/** Controller for answer feedback (works for .tile and .atile). */
export function answerController(wrap) {
  const tiles = Array.from(wrap.querySelectorAll('.tile, .atile'));
  return {
    markCorrect(tile) { tile.classList.add('correct'); tiles.forEach((t) => (t.disabled = true)); burst(wrap); },
    markWrong(tile) { tile.classList.add('wrong'); setTimeout(() => tile.classList.remove('wrong'), 500); },
  };
}

/** Home: title + difficulty ranges + mode picker + start + grown-ups. */
export function renderHome(mount, { title, mascot, state, ranges, modes }, { onStart, onParent, onPickRange, onPickMode }) {
  mount.innerHTML = '';
  const wrap = el('div', { class: 'screen home' });
  wrap.append(el('div', { class: 'mascot', 'aria-hidden': 'true' }, mascot), el('h1', { class: 'title' }, title));

  wrap.append(el('div', { class: 'pick-label' }, 'How high?'));
  const rwrap = el('div', { class: 'chips' });
  for (const r of ranges) {
    const b = el('button', { class: 'chip' + (r.max === state.max ? ' on' : '') }, r.label);
    b.addEventListener('click', () => onPickRange(r.max));
    rwrap.append(b);
  }
  wrap.append(rwrap);

  wrap.append(el('div', { class: 'pick-label' }, 'Pick a game'));
  const mwrap = el('div', { class: 'mode-grid' });
  for (const m of modes) {
    const b = el('button', { class: 'mode-tile' + (m.id === state.mode ? ' on' : '') });
    b.append(el('span', { class: 'mode-emoji', 'aria-hidden': 'true' }, m.emoji), el('span', { class: 'mode-name' }, m.label));
    b.setAttribute('aria-label', m.label + ': ' + m.desc);
    b.addEventListener('click', () => onPickMode(m.id));
    mwrap.append(b);
  }
  wrap.append(mwrap);

  const start = el('button', { class: 'btn btn-big', 'aria-label': 'Start' }, '▶  Start');
  start.addEventListener('click', onStart);
  const parent = el('button', { class: 'btn btn-ghost btn-corner', 'aria-label': 'For grown-ups' }, '⚙  Grown-ups');
  parent.addEventListener('click', onParent);
  wrap.append(start, parent);
  mount.append(wrap);
}

export function renderDone(mount, { onAgain, onHome }) {
  mount.innerHTML = '';
  const wrap = el('div', { class: 'screen done' });
  wrap.append(el('div', { class: 'mascot', 'aria-hidden': 'true' }, '🌟'), el('h1', { class: 'title' }, 'All done!'), el('p', { class: 'subtitle' }, 'Great job!'));
  const again = el('button', { class: 'btn btn-big' }, '↻  Play again');
  again.addEventListener('click', onAgain);
  const home = el('button', { class: 'btn btn-ghost' }, '⌂  Home');
  home.addEventListener('click', onHome);
  wrap.append(again, home); mount.append(wrap);
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
