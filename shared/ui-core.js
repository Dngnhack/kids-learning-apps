// ui-core.js — SHARED generic DOM rendering used by all kids' apps (shared core): home
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

/**
 * SHARED in-lesson Home/Quit control. Mounts a small ⌂ button (top-right) onto a play/trace screen.
 * Tapping it shows a child-safe confirm — "Quit lesson? Progress will be lost — Quit / Keep playing".
 * Quit → onQuit() (the app stops audio + returns home); Keep playing → just dismisses the dialog and
 * resumes. Re-usable across BOTH apps so the behaviour + copy stay identical. Returns the button node.
 * @param {HTMLElement} screen the .screen wrapper of the current lesson question/trace
 * @param {() => void} onQuit called when the child confirms Quit (app handles stopSpeech + home)
 */
// A crisp, universally-recognizable HOUSE icon (the classic Material "home" silhouette). Inline SVG so
// it renders IDENTICALLY on every phone/browser — unlike the old "⌂" glyph, which showed as a tiny,
// unclear, or missing character on many mobile devices (kids couldn't tell it was "go home").
const HOME_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';

export function mountQuit(screen, onQuit) {
  if (!screen) return null;
  // ONE clear "go back to the game chooser" control on every play/trace screen: a large, high-contrast,
  // top-corner HOME button with a house icon kids understand. Tapping it asks a tiny child-safe confirm
  // first (so a stray tap mid-trace can't drop the lesson), then returns to the game-type selector.
  const btn = el('button', { class: 'quit-btn', 'aria-label': 'Home — go back to the games', title: 'Home' });
  btn.innerHTML = HOME_SVG + '<span class="quit-btn-label">Home</span>';
  btn.addEventListener('click', () => showQuitConfirm(screen, onQuit));
  screen.append(btn);
  return btn;
}

/** The "Go back to the games?" confirm overlay (Back to games / Keep playing). Reframed from the old
 *  "Quit lesson? Progress will be lost" — it's a NAVIGATION choice, and learning is saved per answer
 *  (only the current lesson is left), so the copy is clearer + reassuring rather than discouraging. */
function showQuitConfirm(screen, onQuit) {
  if (screen.querySelector('.quit-confirm')) return;       // already open — don't stack
  const overlay = el('div', { class: 'quit-confirm', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Go back to the games?' });
  const card = el('div', { class: 'quit-card' });
  card.append(el('div', { class: 'quit-title' }, 'Go back to the games?'));
  card.append(el('div', { class: 'quit-msg' }, 'Your stars are saved.'));
  const actions = el('div', { class: 'quit-actions' });
  const quit = el('button', { class: 'btn btn-ghost quit-yes' }, '🏠  Back to games');
  const keep = el('button', { class: 'btn quit-keep' }, '▶  Keep playing');
  quit.addEventListener('click', () => { overlay.remove(); onQuit(); });
  keep.addEventListener('click', () => overlay.remove());   // resume — nothing else changes
  actions.append(keep, quit);
  card.append(actions);
  overlay.append(card);
  screen.append(overlay);
  keep.focus();
}

/**
 * SHARED step-by-step selection WIZARD ( / AC1+AC2) — replaces the all-at-once start menu.
 * Three sequential screens: ACTIVITY (game/mode) → RANGE → # QUESTIONS. Each screen fades/slides OUT
 * on a pick and the next slides IN; a Back button steps to the previous screen; after screen 3 the
 * lesson starts via onStart(choice). Reduced-motion is respected (the CSS disables the transforms).
 *
 * CONTEXT-AWARE (AC2): the Range + #Questions options shown are produced by the app's optionsFor(activityId)
 * callback → { ranges:[{key,label}], counts:[Number] } so only options valid for the chosen activity appear.
 *
 * My Stars / Grown-ups stay reachable from a small header on every wizard screen (AC1 keeps them).
 *
 * @param {HTMLElement} mount
 * @param {{ title, mascot, activities:Array<{id,label,emoji,desc}>, optionsFor:(id)=>{ranges,counts},
 *           pickLabel?, defaults?:{activity,rangeKey,count} }} cfg
 * @param {{ onStart:(c:{activity,rangeKey,count})=>void, onParent:()=>void, onRewards:()=>void }} handlers
 */
export function renderWizard(mount, cfg, handlers) {
  const { title, mascot, activities, optionsFor, pickLabel = 'How high?', defaults = {} } = cfg;
  const { onStart, onParent, onRewards } = handlers;
  mount.innerHTML = '';
  const root = el('div', { class: 'wizard' });
  mount.append(root);

  // running choice — seeded from saved defaults so the picker shows the last-used as "on"
  const choice = { activity: defaults.activity || (activities[0] && activities[0].id), rangeKey: defaults.rangeKey, count: defaults.count };
  let step = 0;                 // 0 = activity, 1 = range, 2 = count
  let cur = null;               // the currently-mounted .screen (for OUT transition)

  // small persistent header: title + My Stars + Grown-ups (AC1 — entry points stay reachable)
  function header(showBack) {
    const h = el('div', { class: 'wiz-head' });
    const left = el('div', { class: 'wiz-head-left' });
    if (showBack) { const b = el('button', { class: 'btn btn-ghost wiz-back', 'aria-label': 'Go back a step' }, '‹  Back'); b.addEventListener('click', () => go(step - 1)); left.append(b); }
    const right = el('div', { class: 'wiz-head-right' });
    const stars = el('button', { class: 'btn btn-ghost wiz-mini', 'aria-label': 'My stars and stickers' }, '🏆');
    stars.addEventListener('click', onRewards);
    const parent = el('button', { class: 'btn btn-ghost wiz-mini', 'aria-label': 'For grown-ups' }, '⚙');
    parent.addEventListener('click', onParent);
    right.append(stars, parent);
    h.append(left, right);
    return h;
  }

  // step dots (1·2·3) so a parent can see where they are
  function dots() {
    const d = el('div', { class: 'wiz-dots', 'aria-hidden': 'true' });
    for (let i = 0; i < 3; i++) d.append(el('span', { class: 'wiz-dot' + (i === step ? ' on' : (i < step ? ' done' : '')) }));
    return d;
  }

  /** Transition: slide the current screen OUT (dir −1 back / +1 forward), then mount the next IN.
   *  Robust to RAPID taps: any leftover/transitioning screens are swept first so we never accumulate
   *  orphans (only `cur` ever survives between steps; the immediate `old` animates out then removes). */
  function go(next) {
    if (next < 0) return;
    if (next > 2) return onStart({ activity: choice.activity, rangeKey: choice.rangeKey, count: choice.count });
    const dir = next > step ? 1 : -1;
    const old = cur;
    // sweep any stale screens left mid-transition by a faster-than-animation tap (keep only `old`)
    root.querySelectorAll('.wiz-screen').forEach((s) => { if (s !== old) s.remove(); });
    step = next;
    const fresh = build();
    fresh.classList.add(dir > 0 ? 'wiz-in-next' : 'wiz-in-prev');
    root.append(fresh);
    cur = fresh;
    // next frame → run the IN transition; OUT the old one
    requestAnimationFrame(() => {
      fresh.classList.remove('wiz-in-next', 'wiz-in-prev');
      if (old) { old.classList.add(dir > 0 ? 'wiz-out-prev' : 'wiz-out-next'); setTimeout(() => { if (old !== cur) old.remove(); }, 360); }
    });
  }

  /** Build the .screen for the current `step`. */
  function build() {
    const wrap = el('div', { class: 'screen wiz-screen' });
    wrap.append(header(step > 0));
    wrap.append(dots());

    if (step === 0) {
      wrap.append(el('div', { class: 'mascot bob', 'aria-hidden': 'true' }, mascot), el('h1', { class: 'title sm' }, title));
      wrap.append(el('div', { class: 'pick-label' }, 'Pick a game'));
      const grid = el('div', { class: 'mode-grid' });
      activities.forEach((m, i) => {
        // LOCKED activities (e.g. "coming soon" stages) render greyed with a 🔒 and do NOT advance the
        // wizard — the progression stays visible without enabling an unfinished stage. Additive: apps
        // that pass no `locked` flag (Numbers/Math) are unaffected.
        const locked = !!m.locked;
        const b = el('button', { class: 'mode-tile m' + (i % 4) + (m.id === choice.activity && !locked ? ' on' : '') + (locked ? ' locked' : '') });
        b.append(el('span', { class: 'mode-emoji', 'aria-hidden': 'true' }, locked ? '🔒' : m.emoji), el('span', { class: 'mode-name' }, m.label));
        b.setAttribute('aria-label', m.label + ': ' + m.desc + (locked ? ' (coming soon)' : ''));
        if (locked) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
        else b.addEventListener('click', () => { choice.activity = m.id; reconcileOptions(); go(1); });
        grid.append(b);
      });
      wrap.append(grid);
    } else if (step === 1) {
      const { ranges } = optionsFor(choice.activity);
      wrap.append(el('h2', { class: 'title sm wiz-q' }, pickLabel));
      const rwrap = el('div', { class: 'chips wiz-chips' });
      for (const r of ranges) {
        const b = el('button', { class: 'chip big-chip' + (r.key === choice.rangeKey ? ' on' : '') }, r.label);
        b.addEventListener('click', () => { choice.rangeKey = r.key; go(2); });
        rwrap.append(b);
      }
      wrap.append(rwrap);
    } else {
      const { counts } = optionsFor(choice.activity);
      wrap.append(el('h2', { class: 'title sm wiz-q' }, 'How many questions?'));
      const cwrap = el('div', { class: 'chips wiz-chips' });
      for (const n of counts) {
        const b = el('button', { class: 'chip big-chip' + (n === choice.count ? ' on' : '') }, String(n));
        b.addEventListener('click', () => { choice.count = n; go(3); });
        cwrap.append(b);
      }
      wrap.append(cwrap);
      const start = el('button', { class: 'btn btn-big wiz-start', 'aria-label': 'Start the lesson' }, '▶  Start');
      start.addEventListener('click', () => go(3));
      wrap.append(start);
    }
    return wrap;
  }

  /** When the activity changes, ensure the carried rangeKey/count are still valid for it (AC2). */
  function reconcileOptions() {
    const { ranges, counts } = optionsFor(choice.activity);
    if (!ranges.some((r) => r.key === choice.rangeKey)) choice.rangeKey = ranges[0] && ranges[0].key;
    if (!counts.includes(choice.count)) choice.count = counts.includes(10) ? 10 : counts[0];
  }

  reconcileOptions();
  cur = build();
  root.append(cur);
}

/** Home: mascot + title + level chips + mode picker + lesson-length picker + start + rewards +
 *  grown-ups. The RANGE and LESSON-LENGTH pickers are surfaced right here (post-mode flow, Fix 4):
 *  after picking a game the child/parent can set how high the numbers go AND how many questions a
 *  lesson is — no need to dig into the grown-ups area. lessonChoices/lessonLength/onPickLength are
 *  optional; when omitted the length picker is hidden (back-compat). */
export function renderHome(mount, { title, mascot, state, ranges, modes, pickLabel = 'How high?', lessonChoices, lessonLength }, handlers) {
  const { onStart, onParent, onPickRange, onPickMode, onPickLength, onRewards } = handlers;
  mount.innerHTML = '';
  const wrap = el('div', { class: 'screen home' });
  wrap.append(el('div', { class: 'mascot bob', 'aria-hidden': 'true' }, mascot), el('h1', { class: 'title' }, title));

  wrap.append(el('div', { class: 'pick-label' }, pickLabel));
  const rwrap = el('div', { class: 'chips' });
  for (const r of ranges) {
    const b = el('button', { class: 'chip' + (r.key === state.rangeKey ? ' on' : ''), 'aria-pressed': String(r.key === state.rangeKey) }, r.label);
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

  // Lesson length (how many questions) — surfaced in the home flow so it's pickable without the gate.
  if (onPickLength && lessonChoices && lessonChoices.length) {
    wrap.append(el('div', { class: 'pick-label' }, 'How many questions?'));
    const lwrap = el('div', { class: 'chips' });
    for (const n of lessonChoices) {
      const b = el('button', { class: 'chip' + (n === lessonLength ? ' on' : ''), 'aria-pressed': String(n === lessonLength) }, String(n));
      b.addEventListener('click', () => onPickLength(n));
      lwrap.append(b);
    }
    wrap.append(lwrap);
  }

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

export function renderDone(mount, { onAgain, onHome, onRewards, lesson }) {
  mount.innerHTML = '';
  const wrap = el('div', { class: 'screen done' });
  wrap.append(el('div', { class: 'mascot bob', 'aria-hidden': 'true' }, '🌟'), el('h1', { class: 'title' }, 'Lesson complete!'), el('p', { class: 'subtitle' }, 'Great job!'));
  if (lesson && lesson.sticker) {
    const s = el('div', { class: 'lesson-sticker' });
    s.append(el('div', { class: 'big-sticker', 'aria-hidden': 'true' }, lesson.sticker), el('div', { class: 'hint' }, lesson.newSticker ? 'New sticker earned!' : 'Sticker earned!'));
    wrap.append(s);
  }
  // POSITIVE-ONLY streak: celebrate returning; never guilt a miss.
  if (lesson && lesson.streak >= 2) wrap.append(el('div', { class: 'streak-line' }, `🔆 ${lesson.streak}-day streak — yay, you came back!`));
  if (lesson && lesson.streakBadge) wrap.append(el('div', { class: 'streak-line' }, `${lesson.streakBadge.icon} New badge: ${lesson.streakBadge.name}!`));
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
export function renderRewards(mount, r, { onBack, onAlbum }) {
  mount.innerHTML = '';
  const wrap = el('div', { class: 'screen rewards' });
  wrap.append(el('div', { class: 'mascot', 'aria-hidden': 'true' }, '🦊'));
  wrap.append(el('h2', { class: 'title sm' }, 'My Stars'));
  wrap.append(el('div', { class: 'star-count' }, `📚 ${r.lessons} lessons · ⭐ ${r.mastered} learned`));
  if (r.streakBest >= 2 || r.streakCur >= 2) wrap.append(el('div', { class: 'streak-line' }, `🔆 Best streak: ${r.streakBest} days${r.streakCur >= 2 ? ` · now ${r.streakCur} in a row!` : ''}`));
  // day-streak badges (positive-only)
  if (r.streakBadges && r.streakBadges.some((b) => b.got)) {
    wrap.append(el('div', { class: 'sc-sub' }, 'Day-streak badges'));
    const sb = el('div', { class: 'streak-badges' });
    for (const b of r.streakBadges) { const n = el('div', { class: 'sbadge' + (b.got ? ' got' : ''), title: b.name }, b.got ? b.icon : '🔒'); sb.append(n); }
    wrap.append(sb);
  }

  // progress map (worlds) — lit when the badge milestone is reached
  const map = el('div', { class: 'progress-map' });
  r.badges.forEach((b, i) => {
    if (i) map.append(el('div', { class: 'map-link' + (b.got ? ' on' : '') }));
    const node = el('div', { class: 'map-node' + (b.got ? ' on' : ''), title: `${b.name} (${b.need})` }, b.got ? b.icon : '🔒');
    map.append(node);
  });
  wrap.append(map);

  wrap.append(el('div', { class: 'sc-title' }, 'Sticker collection'));
  const earned = r.stickers.filter((s) => s.got).length;
  wrap.append(el('div', { class: 'hint' }, `${earned} of ${r.stickers.length} stickers earned`));
  // a small PREVIEW row of the most-recently-earned stickers (the full book is its own screen)
  const grid = el('div', { class: 'sticker-grid' });
  const preview = r.stickers.slice(0, 18);
  for (const s of preview) grid.append(el('div', { class: 'sticker' + (s.got ? ' got' : '') }, s.got ? s.icon : '❔'));
  wrap.append(grid);
  if (r.nextStickerAt != null) wrap.append(el('div', { class: 'hint' }, 'Finish a lesson to earn the next sticker!'));

  // Sticker-book / album entry point (AC5) — only when the app wires onAlbum.
  if (onAlbum) {
    const album = el('button', { class: 'btn', 'aria-label': 'Open my sticker book' }, '📖  Sticker Book');
    album.addEventListener('click', onAlbum);
    wrap.append(album);
  }

  const back = el('button', { class: 'btn btn-ghost' }, '⌂  Back');
  back.addEventListener('click', onBack);
  wrap.append(back); mount.append(wrap);
}

/**
 * SHARED STICKER ALBUM / photo-book screen. A persistent collectible book: every
 * sticker slot is shown — FILLED (earned, in colour) or EMPTY (a dashed "not yet" slot) — and fills
 * over time as lessons are finished. Pageable when the collection is large (a fixed page size keeps
 * a phone tidy). Reads the existing local rewards store via the passed model (zero new data, survives
 * reload because the rewards record is high-water + persisted). Reachable from the rewards shelf.
 * @param {HTMLElement} mount
 * @param {{ stickers:Array<{icon,got}> }} r  the rewards model (same one renderRewards uses)
 * @param {{ onBack:()=>void }} handlers
 */
const ALBUM_PAGE = 24;            // stickers per album page (4 cols × 6 rows on a phone)
export function renderAlbum(mount, r, { onBack }) {
  mount.innerHTML = '';
  const wrap = el('div', { class: 'screen album' });
  const stickers = r.stickers;
  const earned = stickers.filter((s) => s.got).length;
  const pages = Math.max(1, Math.ceil(stickers.length / ALBUM_PAGE));
  // open on the page holding the next-to-earn sticker so progress feels front-and-centre
  let page = Math.min(pages - 1, Math.floor(earned / ALBUM_PAGE));

  wrap.append(el('div', { class: 'mascot', 'aria-hidden': 'true' }, '📖'));
  wrap.append(el('h2', { class: 'title sm' }, 'My Sticker Book'));
  wrap.append(el('div', { class: 'star-count album-count' }, `⭐ ${earned} / ${stickers.length} collected`));

  const grid = el('div', { class: 'album-grid' });
  wrap.append(grid);

  const nav = el('div', { class: 'album-nav' });
  const prev = el('button', { class: 'btn btn-ghost', 'aria-label': 'Previous page' }, '‹');
  const label = el('div', { class: 'album-page-label' });
  const next = el('button', { class: 'btn btn-ghost', 'aria-label': 'Next page' }, '›');
  prev.addEventListener('click', () => { if (page > 0) { page--; draw(); } });
  next.addEventListener('click', () => { if (page < pages - 1) { page++; draw(); } });
  nav.append(prev, label, next);
  if (pages > 1) wrap.append(nav);

  function draw() {
    grid.innerHTML = '';
    const start = page * ALBUM_PAGE;
    for (let i = start; i < Math.min(start + ALBUM_PAGE, stickers.length); i++) {
      const s = stickers[i];
      const slot = el('div', { class: 'album-slot' + (s.got ? ' got' : ' empty') });
      slot.append(el('div', { class: 'album-sticker', 'aria-label': s.got ? 'collected sticker' : 'empty slot' }, s.got ? s.icon : '☆'));
      slot.append(el('div', { class: 'album-num', 'aria-hidden': 'true' }, String(i + 1)));
      grid.append(slot);
    }
    label.textContent = `Page ${page + 1} of ${pages}`;
    prev.disabled = page === 0; next.disabled = page === pages - 1;
  }
  draw();

  const back = el('button', { class: 'btn' }, '⌂  Back');
  back.addEventListener('click', onBack);
  wrap.append(back); mount.append(wrap);
}

/** Parent area (behind the gate): scorecard + settings. On-device only. */
export function renderParent(mount, data, { onReset, onToggleAudio, onSetLessonLength, onBack }) {
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

  // Lesson length (parent-settable; default 10) — how many problems per lesson before the reward.
  if (onSetLessonLength && data.lessonChoices) {
    wrap.append(el('div', { class: 'sc-sub' }, 'Lesson length (problems per lesson)'));
    const ll = el('div', { class: 'chips' });
    data.lessonChoices.forEach((n) => {
      const b = el('button', { class: 'chip' + (n === data.lessonLength ? ' on' : ''), 'aria-pressed': String(n === data.lessonLength) }, String(n));
      b.addEventListener('click', () => onSetLessonLength(n));
      ll.append(b);
    });
    wrap.append(ll);
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
