// ui.js (Letters) — letters-specific question + trace screens. Generic UI (wizard, select-then-
// submit answer panel, celebrations, rewards shelf, done, parent scorecard, album, gate) all come
// from the SHARED ui-core (no duplication), exactly like Numbers.

import { RANGES, lettersForRange, lettersForRangeLimited } from './decks/letters.js';
import { ACTIVITIES, LOCKED_ACTIVITIES } from './game.js';
import { LETTER_STROKES, TRACEABLE, TRACE_BOX, denseStrokes, checkpoints, strokeStarts, advance, isComplete, nearestOnPath } from './trace.js';
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
 * CONTEXT-AWARE options for the wizard ( / AC2). Given the chosen activity return the ranges +
 * question-counts that make sense:
 *   • trace   — only ranges that contain letters we have stroke geometry for. Every phonics group +
 *               "All letters" is offered, but the trace itself only uses the supported letters (the
 *               range is intersected at session time). We keep all ranges visible so the picker is
 *               consistent; each one has ≥1 traceable letter (Group 1 is fully covered).
 *   • picture — all ranges (every letter has a curated emoji object).
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
  // Phase-1 active activities + Phase-2 stages shown LOCKED ("coming soon") so the full SSP
  // progression is visible but no phoneme stage is enabled with inaccurate TTS audio.
  const activities = [...ACTIVITIES, ...LOCKED_ACTIVITIES.map((a) => ({ ...a, locked: true }))];
  core.renderWizard(mount, {
    title: 'Letters — Read & Trace', mascot: '🔤', activities, optionsFor, pickLabel: 'Which letters?', defaults,
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
  const hint = core.el('div', { class: 'trace-hint', 'aria-hidden': 'true' }, 'Stay on the line — follow the arrows!');
  hint.style.display = 'none'; wrap.append(hint);
  mount.append(wrap);

  let hintTimer = null;
  const box = makeTraceBox(letter, () => { clearTimeout(hintTimer); hint.remove(); core.celebrate(wrap); onComplete(); });
  const showCue = () => { clearTimeout(hintTimer); if (box.started() && !box.done()) hint.style.display = ''; };
  const clearCue = () => { hint.style.display = 'none'; clearTimeout(hintTimer); hintTimer = setTimeout(showCue, 2400); };

  row.append(box.node);
  box.activate();
  hintTimer = setTimeout(showCue, 2400);

  /** One traceable letter box. onDone() fires when the letter's final checkpoint is reached.
   *  (Faithful port of Numbers' makeTraceBox — single box, keyed by character.) */
  function makeTraceBox(ch, onDone) {
    const SVGNS = 'http://www.w3.org/2000/svg';
    const mk = (t) => document.createElementNS(SVGNS, t);
    const uid = `L-${ch}`;
    const vstrokes = LETTER_STROKES[ch] || LETTER_STROKES.i;
    const dstrokes = denseStrokes(ch);
    const points = checkpoints(ch);
    const starts = strokeStarts(ch);
    const multi = vstrokes.length > 1;

    const stage = core.el('div', { class: 'trace-stage locked' });
    const svg = mk('svg');
    svg.setAttribute('viewBox', `0 0 ${TRACE_BOX.w} ${TRACE_BOX.h}`); svg.setAttribute('class', 'trace-svg');

    const defs = mk('defs');
    const grad = mk('linearGradient'); grad.setAttribute('id', `rainbow-${uid}`);
    grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0'); grad.setAttribute('x2', '1'); grad.setAttribute('y2', '1');
    [['0', '#e11d48'], ['.2', '#f59e0b'], ['.4', '#eab308'], ['.6', '#16a34a'], ['.8', '#2563eb'], ['1', '#7c3aed']]
      .forEach(([o, c]) => { const st = mk('stop'); st.setAttribute('offset', o); st.setAttribute('stop-color', c); grad.append(st); });
    defs.append(grad); svg.append(defs);

    for (const s of vstrokes) { const t = mk('polyline'); t.setAttribute('points', s.map((p) => p.join(',')).join(' ')); t.setAttribute('class', 'trace-track'); svg.append(t); }
    for (const s of vstrokes) { const o = mk('polyline'); o.setAttribute('points', s.map((p) => p.join(',')).join(' ')); o.setAttribute('class', 'trace-outline'); svg.append(o); }

    const trail = mk('polyline'); trail.setAttribute('class', 'trace-trail'); trail.setAttribute('points', '');
    trail.setAttribute('stroke', `url(#rainbow-${uid})`); svg.append(trail);

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
    starts.forEach((si, k) => {
      const [sx, sy] = points[si];
      const g = mk('circle'); g.setAttribute('cx', sx); g.setAttribute('cy', sy); g.setAttribute('r', '11'); g.setAttribute('class', 'cp-start'); svg.append(g);
      if (multi) { const n = mk('text'); n.setAttribute('x', sx); n.setAttribute('y', sy + 4); n.setAttribute('text-anchor', 'middle'); n.setAttribute('class', 'cp-start-num'); n.textContent = String(k + 1); svg.append(n); }
    });
    stage.append(svg);

    const TOL = 16;
    let idx = 0, live = false, finished = false;
    const norm = (e) => {
      const r = svg.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return [((cx - r.left) / r.width) * TRACE_BOX.w, ((cy - r.top) / r.height) * TRACE_BOX.h];
    };
    const drawTrail = () => trail.setAttribute('points', points.slice(0, idx + 1).map((p) => p.join(',')).join(' '));
    const markNext = () => { dots.forEach((d, i) => d.classList.toggle('next', i === idx)); arrows.forEach((a) => a.el.classList.toggle('lit', a.t >= idx && a.t < idx + 4)); };

    const move = (e) => {
      if (!live) return;
      const [x, y] = norm(e);
      const onPath = nearestOnPath(ch, x, y).dist <= TOL;
      let moved = false, ni = advance(points, idx, x, y);
      while (ni !== idx) { idx = ni; if (dots[idx - 1]) dots[idx - 1].classList.add('hit'); moved = true; ni = advance(points, idx, x, y); }
      if (moved) { drawTrail(); markNext(); clearCue(); }
      else if (!onPath) { showCue(); }
      if (isComplete(points, idx)) {
        finished = true; live = false;
        svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerdown', move);
        onDone();
      }
    };

    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointermove', move);

    return {
      node: stage,
      activate() { live = true; stage.classList.remove('locked'); stage.classList.add('current'); markNext(); },
      lock(done) { live = false; stage.classList.remove('current'); stage.classList.toggle('done', !!done); },
      started: () => idx > 0,
      done: () => finished,
    };
  }
}
