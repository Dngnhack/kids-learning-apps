// ui.js (Letters) — letters-specific question + trace screens. Generic UI (wizard, select-then-
// submit answer panel, celebrations, rewards shelf, done, parent scorecard, album, gate) all come
// from the SHARED ui-core (no duplication), exactly like Numbers.

import { RANGES, lettersForRange, lettersForRangeLimited } from './decks/letters.js';
import { visibleActivities } from './game.js';
import { LETTER_STROKES, TRACEABLE, TRACE_BOX, denseStrokes, createTracer, nearestOnPath } from './trace.js';
import * as core from '../../shared/ui-core.js';

export const renderDone = core.renderDone;
export const renderParent = core.renderParent;
export const renderRewards = core.renderRewards;
export const renderAlbum = core.renderAlbum;
export const gateMount = core.gateMount;
export const celebrate = core.celebrate;
export const mountQuit = core.mountQuit;

export const LESSON_COUNTS = [5, 10, 15, 20];

/**
 * CONTEXT-AWARE options for the wizard. Given the chosen activity return the ranges +
 * question-counts that make sense:
 *   • trace   — only ranges that contain letters we have stroke geometry for. Every phonics group +
 *               "All letters" is offered, but the trace itself only uses the supported letters (the
 *               range is intersected at session time). We keep all ranges visible so the picker is
 *               consistent; each one has ≥1 traceable letter (Group 1 is fully covered).
 *   • letterSound / soundLetter / phonics / picture / mixed — all ranges (every letter has a sound
 *               via the phoneme seam + a curated emoji object).
 * Counts: standard lesson lengths; srs.pickSession guarantees EXACTLY N even for a small letter set.
 */
export function optionsFor(activity) {
  let ranges = RANGES;
  if (activity === 'trace') {
    // keep only ranges that have at least one traceable letter (all current ranges do, but be safe)
    ranges = RANGES.filter((r) => lettersForRangeLimited(r.key, TRACEABLE).length > 0);
  }
  return { ranges: ranges.map((r) => ({ key: r.key, label: r.label })), counts: LESSON_COUNTS };
}

export function renderWizard(mount, defaults, handlers) {
  // the scaffolded SSP progression, GATED by the PD-002 sound-stage flag: until the phoneme audio is
  // verified the wizard shows only trace + picture (visibleActivities); the sound stages' code stays.
  const activities = visibleActivities();
  // a remembered default that points at a HIDDEN stage must not silently start that stage
  const d = { ...(defaults || {}) };
  if (d.activity && !activities.some((a) => a.id === d.activity)) delete d.activity;
  core.renderWizard(mount, {
    title: 'Letters — Read & Trace', mascot: '🔤', activities, optionsFor, pickLabel: 'Which letters?', defaults: d,
  }, handlers);
}

/**
 * PICTURE STARTS-WITH question screen. Shows a big EMOJI object; the child picks the LETTER it starts
 * with from 3-4 large buttons (shared select-then-submit + gentle retry). Voice (wired in main) says
 * the object NAME + the letter NAME — accurate TTS, NO phonemes this phase.
 */
export function renderPicture(mount, q, progressText, { onSubmit, onHear }) {
  mount.innerHTML = '';
  const wrap = core.el('div', { class: 'screen play letters-pic' });
  wrap.append(core.el('div', { class: 'progress-dots', 'aria-hidden': 'true' }, progressText));
  wrap.append(core.el('h2', { class: 'prompt' }, 'Which letter does it start with?'));

  // the picture, big + tappable to hear the object name again
  const pic = core.el('button', { class: 'pic-object', 'aria-label': `Hear: ${q.word}` }, q.emoji);
  pic.addEventListener('click', () => onHear && onHear(q));
  wrap.append(pic);
  wrap.append(core.el('div', { class: 'hint' }, q.word));

  // letter choices as big UPPERCASE buttons (numeral mode renders the text directly)
  const choices = q.choices.map((l) => l.toUpperCase());
  const panel = core.answerPanel(choices, {
    mode: 'numeral',
    onSubmit: (picked) => onSubmit(String(picked).toLowerCase()),
  });
  wrap.append(panel.node);
  mount.append(wrap);
  return panel.controller;
}

/**
 * PHASE 2 SOUND STAGES — one renderer for letterSound / soundLetter / phonics. AUDIO-AGNOSTIC: this
 * only draws the screen + wires callbacks; main.js plays sounds via the phoneme seam, so it doesn't
 * matter whether a recorded clip or interim TTS produces the sound.
 *
 *   • letterSound — show the big LETTER; answer tiles are AUDIO tiles (🔊). Tapping a tile plays that
 *                   letter's SOUND (onHear receives the letter); the child picks the tile whose sound
 *                   matches the shown letter, then Check. (= "which sound does this letter make")
 *   • soundLetter — show a "🔊 Hear it" button that plays the target SOUND (onHearPrompt); answer tiles
 *                   are LETTER buttons; the child picks the matching letter.
 *   • phonics     — show a "🔊 Hear the sounds" button that plays the word's sounds in order then the
 *                   blended word (onHearPrompt); answer tiles are LETTER buttons; pick the target letter.
 *
 * @param {object} q the question from buildPhonemeQuestion
 * @param {{ onSubmit, onHear, onHearPrompt }} handlers
 *   onHear(letter) — play one option's sound (audio tiles); onHearPrompt(q) — replay the prompt audio.
 */
export function renderSound(mount, q, progressText, { onSubmit, onHear, onHearPrompt }) {
  mount.innerHTML = '';
  const wrap = core.el('div', { class: 'screen play letters-sound' });
  wrap.append(core.el('div', { class: 'progress-dots', 'aria-hidden': 'true' }, progressText));

  if (q.mode === 'letterSound') {
    wrap.append(core.el('h2', { class: 'prompt' }, 'Which sound does it make?'));
    // big tappable letter — tap to hear its OWN sound again (uses the seam via onHearPrompt)
    const big = core.el('button', { class: 'big-numeral letter-shown', 'aria-label': `Hear the ${q.name} sound` }, q.letter.toUpperCase());
    big.addEventListener('click', () => onHearPrompt && onHearPrompt(q));
    wrap.append(big);
    wrap.append(core.el('div', { class: 'hint' }, 'Tap a 🔊 to hear it · pick one · Check'));
    // AUDIO tiles: each plays a candidate letter's SOUND; the child finds the matching one.
    const panel = core.answerPanel(q.choices, {
      mode: 'audio',
      onSubmit: (picked) => onSubmit(String(picked).toLowerCase()),
      onHear: (letter) => onHear && onHear(String(letter).toLowerCase()),
    });
    wrap.append(panel.node);
    mount.append(wrap);
    return panel.controller;
  }

  // soundLetter + phonics: a HEAR button plays the prompt sound(s); answers are LETTER buttons.
  const isPhonics = q.mode === 'phonics';
  wrap.append(core.el('h2', { class: 'prompt' }, isPhonics ? 'Blend the sounds — which letter?' : 'Which letter makes this sound?'));
  const hear = core.el('button', { class: 'hear-btn', 'aria-label': isPhonics ? 'Hear the sounds again' : 'Hear the sound again' }, isPhonics ? '🔊  Hear the sounds' : '🔊  Hear it');
  hear.addEventListener('click', () => onHearPrompt && onHearPrompt(q));
  wrap.append(hear);
  if (isPhonics) wrap.append(core.el('div', { class: 'hint' }, 'Listen, then pick the letter'));

  const choices = q.choices.map((l) => l.toUpperCase());
  const panel = core.answerPanel(choices, {
    mode: 'numeral',
    onSubmit: (picked) => onSubmit(String(picked).toLowerCase()),
  });
  wrap.append(panel.node);
  mount.append(wrap);
  return panel.controller;
}

/** Trace mode (LOWERCASE letters) — reuses the SAME strict multi-box guided-tracing engine as Numbers
 *  (in-order only, rainbow trail strictly on the path, completes ONLY at the final checkpoint). The
 *  only differences from the Numbers renderer: geometry comes from LETTER_STROKES (keyed by character)
 *  and a letter "value" is a single character (one box). @param {string} letter the lowercase letter. */
export function renderTrace(mount, letter, progressText, { onComplete }) {
  mount.innerHTML = '';
  const wrap = core.el('div', { class: 'screen play trace' });
  wrap.append(core.el('div', { class: 'progress-dots', 'aria-hidden': 'true' }, progressText));
  wrap.append(core.el('h2', { class: 'prompt' }, 'Trace the ' + letter.toUpperCase()));

  const row = core.el('div', { class: 'trace-row' });
  wrap.append(row);
  const HINT_LINE = 'Stay on the line — follow the arrows!';
  const HINT_LIFT = 'Lift your finger — then start at the next green dot!';
  const hint = core.el('div', { class: 'trace-hint', 'aria-hidden': 'true' }, HINT_LINE);
  hint.style.display = 'none'; wrap.append(hint);
  mount.append(wrap);

  let hintTimer = null;
  const box = makeTraceBox(letter, () => { clearTimeout(hintTimer); hint.remove(); core.celebrate(wrap); onComplete(); });
  const showCue = () => { clearTimeout(hintTimer); if (box.started() && !box.done()) { hint.textContent = HINT_LINE; hint.style.display = ''; } };
  const showLiftCue = () => { clearTimeout(hintTimer); hint.textContent = HINT_LIFT; hint.style.display = ''; }; // stroke finished — teach the lift
  const clearCue = () => { hint.style.display = 'none'; clearTimeout(hintTimer); hintTimer = setTimeout(showCue, 2400); };

  row.append(box.node);
  box.activate();
  hintTimer = setTimeout(showCue, 2400);

  /** One traceable letter box. onDone() fires when the letter's final checkpoint is reached.
   *  (Faithful port of Numbers' makeTraceBox — single box, keyed by character.) Tracing is
   *  PER-STROKE (trace v5): the tracer REQUIRES a finger lift between strokes of multi-stroke
   *  letters (t f k i j …) and rejects a continuous scribble across strokes. */
  function makeTraceBox(ch, onDone) {
    const SVGNS = 'http://www.w3.org/2000/svg';
    const mk = (t) => document.createElementNS(SVGNS, t);
    const uid = `L-${ch}`;
    const vstrokes = LETTER_STROKES[ch] || LETTER_STROKES.i;
    const dstrokes = denseStrokes(ch);
    const tracer = createTracer(ch);   // per-stroke, lift-enforcing engine
    const points = tracer.points;
    const starts = tracer.starts;
    const multi = vstrokes.length > 1;

    const stage = core.el('div', { class: 'trace-stage locked' });
    const svg = mk('svg');
    svg.setAttribute('viewBox', `0 0 ${TRACE_BOX.w} ${TRACE_BOX.h}`); svg.setAttribute('class', 'trace-svg');

    // RAINBOW gradient — gradientUnits MUST be userSpaceOnUse: with the default objectBoundingBox
    // units, a perfectly STRAIGHT stroke (t's crossbar, m/i/l's lines, x's would-be verticals) has a
    // ZERO-AREA bounding box, and per the SVG spec the gradient paint then renders NOTHING — those
    // strokes' rainbow trails were invisible (the "stroke 2+ never colors" bug). User-space coords
    // spanning the glyph box paint EVERY stroke, straight or curved, with one consistent rainbow.
    const defs = mk('defs');
    const grad = mk('linearGradient'); grad.setAttribute('id', `rainbow-${uid}`);
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
    grad.setAttribute('x2', String(TRACE_BOX.w)); grad.setAttribute('y2', String(TRACE_BOX.h));
    [['0', '#e11d48'], ['.2', '#f59e0b'], ['.4', '#eab308'], ['.6', '#16a34a'], ['.8', '#2563eb'], ['1', '#7c3aed']]
      .forEach(([o, c]) => { const st = mk('stop'); st.setAttribute('offset', o); st.setAttribute('stop-color', c); grad.append(st); });
    defs.append(grad); svg.append(defs);

    for (const s of vstrokes) { const t = mk('polyline'); t.setAttribute('points', s.map((p) => p.join(',')).join(' ')); t.setAttribute('class', 'trace-track'); svg.append(t); }
    for (const s of vstrokes) { const o = mk('polyline'); o.setAttribute('points', s.map((p) => p.join(',')).join(' ')); o.setAttribute('class', 'trace-outline'); svg.append(o); }

    // RAINBOW trails — ONE polyline PER STROKE (never a false connector between strokes).
    const trails = dstrokes.map(() => {
      const t = mk('polyline'); t.setAttribute('class', 'trace-trail'); t.setAttribute('points', '');
      t.setAttribute('stroke', `url(#rainbow-${uid})`); svg.append(t); return t;
    });

    const arrows = [];
    dstrokes.forEach((s, si) => {
      const base = starts[si];
      for (let i = 0; i < s.length - 1; i += 2) {
        const [ax, ay] = s[i], [bx, by] = s[i + 1];
        const ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const a = mk('polygon'); a.setAttribute('points', '-5,-3.5 5,0 -5,3.5'); a.setAttribute('class', 'trace-arrow');
        a.setAttribute('transform', `translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${ang.toFixed(0)})`);
        svg.append(a); arrows.push({ el: a, t: base + i + 1 });
      }
    });
    const dots = points.map((p) => { const c = mk('circle'); c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', '5'); c.setAttribute('class', 'cp'); svg.append(c); return c; });
    // numbered START marker(s) — only the CURRENT stroke's marker is shown (sequential reveal —
    // see markNext): circle+stem letters (a d g q) share a start corner and would stack their
    // dots, and the child should see exactly one "put your finger HERE" dot at a time.
    const startMarks = starts.map((si, k) => {
      const [sx, sy] = points[si];
      const g = mk('circle'); g.setAttribute('cx', sx); g.setAttribute('cy', sy); g.setAttribute('r', '11'); g.setAttribute('class', 'cp-start'); svg.append(g);
      let n = null;
      if (multi) { n = mk('text'); n.setAttribute('x', sx); n.setAttribute('y', sy + 4); n.setAttribute('text-anchor', 'middle'); n.setAttribute('class', 'cp-start-num'); n.textContent = String(k + 1); svg.append(n); }
      return { dot: g, num: n };
    });
    stage.append(svg);

    const TOL = 16;
    const SAMPLE = 6;                 // interpolation step (box units) between successive move samples
    let live = false, finished = false, last = null; // last = previous normalized point while down
    const norm = (e) => {
      const r = svg.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return [((cx - r.left) / r.width) * TRACE_BOX.w, ((cy - r.top) / r.height) * TRACE_BOX.h];
    };
    // Each stroke's trail is ALWAYS its reached on-path slice — never raw finger input → it can
    // never draw outside the line, never out of order, and never bridges two strokes.
    const drawTrails = () => {
      const idx = tracer.idx();
      trails.forEach((t, si) => {
        const from = starts[si], to = Math.min(idx + 1, tracer.ends[si]);
        t.setAttribute('points', idx > from ? points.slice(from, to).map((p) => p.join(',')).join(' ') : '');
      });
    };
    const markNext = () => {
      const idx = tracer.idx();
      dots.forEach((d, i) => { d.classList.toggle('next', i === idx); d.classList.toggle('hit', i < idx); });
      arrows.forEach((a) => a.el.classList.toggle('lit', a.t >= idx && a.t < idx + 4));
      // sequential start-dot reveal: show ONLY the stroke the child should start next
      // (during the lift gate that is the UPCOMING stroke — guides the finger to its start dot)
      const cur = tracer.needsLift() ? tracer.strokeIndex() + 1 : tracer.strokeIndex();
      startMarks.forEach((m, k) => {
        const show = k === cur && !tracer.complete();
        m.dot.style.display = show ? '' : 'none';
        if (m.num) m.num.style.display = show ? '' : 'none';
      });
    };

    // feed ONE normalized sample to the tracer, folding the result into the accumulator
    const feed = (acc, x, y, isDown) => {
      const r = isDown ? tracer.down(x, y) : tracer.move(x, y);
      acc.moved = acc.moved || r.moved; acc.rejected = acc.rejected || r.rejected;
    };
    const handle = (e, isDown) => {
      if (!live) return;
      if (e.cancelable) e.preventDefault();                          // never scroll/zoom/select mid-trace
      // MOBILE SMOOTHNESS: a fast finger delivers batched/coalesced samples and can JUMP further than
      // a checkpoint's tolerance in one event — which made the trace feel "stuck" mid-stroke. Process
      // every coalesced sample AND interpolate between successive samples so no checkpoint is skipped.
      const co = (!isDown && e.getCoalescedEvents) ? e.getCoalescedEvents() : null;
      const samples = (co && co.length) ? co : [e];
      const acc = { moved: false, rejected: false };
      let x = 0, y = 0;
      for (const ev of samples) {
        [x, y] = norm(ev);
        if (!isDown && last) {
          const steps = Math.min(24, Math.floor(Math.hypot(x - last[0], y - last[1]) / SAMPLE));
          for (let k = 1; k < steps; k++) feed(acc, last[0] + ((x - last[0]) * k) / steps, last[1] + ((y - last[1]) * k) / steps, false);
        }
        feed(acc, x, y, isDown);
        last = [x, y];
      }
      if (acc.moved) { drawTrails(); markNext(); clearCue(); }
      else if (acc.rejected) { showLiftCue(); }                      // stroke done, finger still down → must LIFT
      else if (tracer.isDown() && nearestOnPath(ch, x, y).dist > TOL) { showCue(); }
      if (tracer.complete()) {
        finished = true; live = false;
        svg.removeEventListener('pointermove', onMove); svg.removeEventListener('pointerdown', onDown);
        svg.removeEventListener('pointerup', onUp); svg.removeEventListener('pointercancel', onUp);
        onDone();
      }
    };
    const onDown = (e) => {
      last = null;
      // pointer CAPTURE: keep receiving moves even when the finger drifts past the box edge —
      // without it the old pointerleave handler faked a LIFT mid-stroke (a real phone hiccup:
      // the trace suddenly demanded a restart at the next start dot).
      if (svg.setPointerCapture && e.pointerId != null) { try { svg.setPointerCapture(e.pointerId); } catch { /* not supported */ } }
      handle(e, true);
    };
    const onMove = (e) => handle(e, false);
    const onUp = () => { last = null; if (!live) return; const lifted = tracer.needsLift(); tracer.up(); if (lifted) clearCue(); markNext(); }; // the LIFT arms the next stroke

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    // NOTE: no pointerleave→up — with pointer capture a finger drifting off the box no longer
    // counts as a lift (that false lift broke multi-stroke tracing feel on phones).
    // belt-and-braces for older mobile browsers that ignore touch-action: block native scrolling
    svg.addEventListener('touchmove', (e) => { if (live && e.cancelable) e.preventDefault(); }, { passive: false });

    return {
      node: stage,
      activate() { live = true; stage.classList.remove('locked'); stage.classList.add('current'); markNext(); },
      lock(done) { live = false; stage.classList.remove('current'); stage.classList.toggle('done', !!done); },
      started: () => tracer.idx() > 0,
      done: () => finished,
    };
  }
}
