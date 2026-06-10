// main.js — app bootstrap + session loop across modes. Ties SRS + storage + audio + rewards +
// game + trace + UI. No network calls anywhere. Everything runs on-device.

import * as srs from '../../shared/srs.js';
import * as audio from '../../shared/audio.js';
import { speakNumber } from '../../shared/number-speech.js';
import { stopClips, playCheer } from '../../shared/clips.js';
import * as rewards from '../../shared/rewards.js';
import { makeStorage } from '../../shared/storage.js';
import { showParentGate } from '../../shared/parentGate.js';
import { buildQuestion, isCorrect } from './game.js';
import { DECK_META, idsForRange, sampleIds, getCard, COUNT_CAP, ENUM_CAP } from './decks/numbers.js';
import { traceDigits } from './trace.js';
import * as ui from './ui.js';

const DEFAULT_LESSON = 10; // a "lesson" defaults to 10 problems (parent-settable)
const LESSON_CHOICES = [5, 10, 15, 20];
const sessionSize = () => LESSON_CHOICES.includes(settings.lessonLength) ? settings.lessonLength : DEFAULT_LESSON;
const BIG_SAMPLE = 28;
const mount = /** @type {HTMLElement} */ (document.getElementById('app'));
const store = makeStorage('dl-kids-numbers');

let settings = store.loadSettings({ rangeKey: '10', mode: 'trace', audio: true, lessonLength: DEFAULT_LESSON });
if (!settings.rangeKey && settings.max) settings.rangeKey = String(settings.max); // migrate old saves
audio.setEnabled(settings.audio !== false);
let progress = srs.reconcile(store.load() || srs.createProgress(DECK_META.ids), DECK_META.ids);

/** @type {string[]} */ let session = [];
let pos = 0, missed = false, startTime = 0;
let stats = { total: 0, correct: 0 };

const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
const rangeMax = () => Number(settings.rangeKey) || 10;

const REWARD_BEAT_MS = 300;   // small beat AFTER the cheer finishes before advancing (lets it land)
const CHEER_MAX_MS = 2600;    // hard cap: a failed/slow cheer clip can never hang the game

/** Resolve after the in-flight cheer Promise settles, but never wait longer than CHEER_MAX_MS so a
 *  failed/stalled clip can't freeze the lesson. Pass the Promise returned by playCheer (or null). */
function awaitCheer(cheerPromise) {
  const safe = Promise.resolve(cheerPromise).catch(() => {});
  return Promise.race([safe, new Promise((r) => setTimeout(r, CHEER_MAX_MS))]);
}

/** Play the full celebration, THEN (after the cheer's onended + a small beat) advance to the next
 *  question. Awaiting the cheer means the next prompt's stopClips no longer chops it mid-play. The
 *  max-timeout fallback inside awaitCheer guarantees we always advance even if the clip fails. */
function celebrateThenAdvance(cheerPromise) {
  awaitCheer(cheerPromise).then(() => setTimeout(advance, REWARD_BEAT_MS));
}

/** Move to the next question (the single advance point). */
function advance() { pos += 1; nextQuestion(); }

/** Resolve the concrete mode for a question — 'mixed' picks a random AVAILABLE mode for this value
 * (auto-excludes count-objects above the cap, and keeps trace to sensible low numbers). */
function concreteMode(value) {
  if (settings.mode !== 'mixed') return settings.mode;
  const opts = ['hear', 'matchAudio'];
  if (value <= COUNT_CAP) opts.push('count');
  opts.push('trace'); // trace any value now — multi-digit numbers trace one box per digit (trace.js)
  return opts[Math.floor(Math.random() * opts.length)];
}

function activeIds() {
  const max = rangeMax();
  // Trace now supports multi-digit numbers (one box per digit), so it spans the full enumerable
  // range like recognition does — sampled above ENUM_CAP so we never enumerate 1000 SRS items.
  if (settings.mode === 'trace') return max <= ENUM_CAP ? idsForRange(max) : sampleIds(max, BIG_SAMPLE);
  if (settings.mode === 'count') return idsForRange(Math.min(max, COUNT_CAP));
  // recognition OR mixed: span the full range (sampled if big); per-question mode excludes count/trace by value
  if (max <= ENUM_CAP) return idsForRange(max);
  return sampleIds(max, BIG_SAMPLE);
}

/** Home is now the step-by-step WIZARD: Activity → Range → #Questions, then start. */
function home() {
  ui.renderWizard(mount, { activity: settings.mode, rangeKey: settings.rangeKey, count: sessionSize() }, {
    onStart: startSession,
    onParent: openParentGate,
    onRewards: openRewards,
  });
}

/** Begin a lesson with the wizard's choice (activity/range/count). Persists the picks so the wizard
 *  re-opens pre-selected. The count fix (srs.pickSession) guarantees EXACTLY `count` problems. */
function startSession(choice) {
  if (choice) {
    settings.mode = choice.activity;
    settings.rangeKey = choice.rangeKey;
    settings.lessonLength = choice.count;
    store.saveSettings(settings);
  }
  const ids = activeIds();
  srs.reconcile(progress, ids);
  session = srs.pickSession(progress, ids, sessionSize());
  pos = 0; stats = { total: 0, correct: 0 };
  nextQuestion();
}

/** Abandon the current lesson: stop any speech and return to the home screen (Fix 7 — Quit). */
function quitToHome() { stopClips(); audio.stopSpeech(); home(); }
/** Add the shared in-lesson Home/Quit control to whatever play/trace screen is mounted. */
function addQuit() { ui.mountQuit(mount.querySelector('.screen'), quitToHome); }

function nextQuestion() {
  if (pos >= session.length) return finishSession();
  missed = false; stats.total += 1; startTime = now();
  const id = session[pos];
  const value = getCard(id).value;
  const mode = concreteMode(value);

  if (mode === 'trace') {
    ui.renderTrace(mount, value, traceDigits(value), `${pos + 1} / ${session.length}`, { onComplete: () => onTraceDone(id) });
    addQuit();
    speakNumber(value);                                // bundled clip (primary) — says the target number
    return;
  }
  const qMax = mode === 'count' ? Math.min(rangeMax(), COUNT_CAP) : rangeMax();
  const q = buildQuestion(id, { mode, max: qMax });
  const ctrl = ui.renderQuestion(mount, q, `${pos + 1} / ${session.length}`, {
    onSubmit: (picked) => handleAnswer(q, picked, ctrl),
    onHear: (n) => speakNumber(Number(n)),             // bundled clip (primary)
  });
  addQuit();
  if (q.mode === 'hear') speakNumber(Number(q.value));
  else if (q.mode === 'count') audio.speak('How many?'); // short phrase — no clip; TTS fallback
}

function handleAnswer(q, picked, ctrl) {
  if (q.mode !== 'matchAudio') speakNumber(Number(picked)); // say the chosen number (bundled clip)
  if (isCorrect(q, picked)) {
    if (!missed) { srs.recordAnswer(progress, q.id, true, { responseMs: now() - startTime }); stats.correct += 1; }
    store.save(progress);
    ctrl.markCorrect();
    celebrateThenAdvance(rewardCorrect());   // play the FULL cheer, then beat, then advance
  } else {
    if (!missed) { srs.recordAnswer(progress, q.id, false, { responseMs: now() - startTime }); store.save(progress); missed = true; }
    ctrl.markWrongRetry();
    audio.tone('soft'); audio.speak('Try again'); // gentle + encouraging; child can retry
  }
}

function onTraceDone(id) {
  if (!missed) { srs.recordAnswer(progress, id, true, { responseMs: now() - startTime }); stats.correct += 1; }
  store.save(progress);
  celebrateThenAdvance(rewardCorrect());     // trace completion: full cheer, then beat, then advance
}

/** Celebrate a correct answer; a newly-crossed mastery BADGE makes it extra special.
 *  Returns a Promise that resolves when the celebration's CHEER clip has FINISHED (its onended), so
 *  the caller can advance only AFTER the cheer fully plays — the fix for the "congrats gets chopped"
 *  bug. Resolves immediately for the badge path (no clip cheer there — the badge name is the voice). */
function rewardCorrect() {
  const prevPeak = store.loadRewards().peak || 0;
  const r = rewards.update(store, progress);
  const badge = rewards.newBadge(prevPeak, r.peak);
  // Synthesized WebAudio reward chime (separate path) — fires immediately, always.
  audio.tone('good'); audio.cheer();
  const screen = mount.querySelector('.screen') || mount;
  if (badge) {
    // Big moment: keep the synthesized fireworks + the badge announcement (TTS). No clip cheer here —
    // the badge name is the spoken reward, so we don't pile a second voice on top.
    ui.celebrate(screen, true); audio.fireworks(); audio.speak(`New badge! ${badge.name}`);
    return Promise.resolve();
  }
  ui.celebrate(screen, false);
  // ONE random ORIGINAL cheer clip (our voice). Delayed so the just-spoken number CONFIRMATION clip
  // (speakNumber, same single-clip player) gets to finish first — sequence, not jumble. We RETURN the
  // cheer's Promise (resolves on its onended) so the caller waits for the FULL cheer before advancing;
  // the old fire-and-forget let the next question's stopClips chop the cheer mid-play. Graceful skip if
  // the clip fails — the WebAudio chime above already celebrated.
  return new Promise((resolve) => {
    setTimeout(() => { playCheer().then(resolve, resolve); }, 900);
  });
}

function finishSession() {
  const accuracy = stats.total ? stats.correct / stats.total : 0;
  store.appendSession({ t: new Date().toISOString(), mode: settings.mode, max: rangeMax(), total: stats.total, correct: stats.correct, accuracy });
  const lesson = rewards.completeLesson(store);          // end-of-lesson sticker
  const day = rewards.recordDay(store);                  // positive-only day streak
  audio.fireworks(); audio.speak('Lesson complete! Great job!');
  ui.renderDone(mount, { onAgain: () => startSession(), onHome: home, onRewards: openRewards,
    lesson: { sticker: lesson.sticker, newSticker: lesson.newSticker, streak: day.streak, streakBadge: day.newStreakBadge } });
}

function openRewards() { ui.renderRewards(mount, rewards.model(store), { onBack: home, onAlbum: openAlbum }); }
function openAlbum() { ui.renderAlbum(mount, rewards.model(store), { onBack: openRewards }); }

function openParentGate() {
  const g = ui.gateMount(mount);
  showParentGate(g, openParent, home);
}

function openParent() {
  const ids = DECK_META.ids; // stable base deck (0..100) for a meaningful progress denominator
  ui.renderParent(mount, { summary: srs.summary(progress, ids), history: store.getHistory(), audioEnabled: audio.isEnabled(), lessonLength: sessionSize(), lessonChoices: LESSON_CHOICES }, {
    onReset: () => { store.reset(); progress = srs.createProgress(DECK_META.ids); openParent(); },
    onToggleAudio: () => { const on = !audio.isEnabled(); audio.setEnabled(on); settings.audio = on; store.saveSettings(settings); openParent(); },
    onSetLessonLength: (n) => { settings.lessonLength = n; store.saveSettings(settings); openParent(); },
    onBack: home,
  });
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline cache is optional */ });
}

home();
