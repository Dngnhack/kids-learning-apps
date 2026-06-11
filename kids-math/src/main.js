// main.js (Math) — app bootstrap + session loop on the SHARED engine. No network calls.

import * as srs from '../../shared/srs.js';
import * as audio from '../../shared/audio.js';
import { speakNumber } from '../../shared/number-speech.js';
import * as rewards from '../../shared/rewards.js';
import { makeStorage } from '../../shared/storage.js';
import { showParentGate } from '../../shared/parentGate.js';
import { buildQuestion, isCorrect, spoken } from './game.js';
import { DECK_META, sampleIds, getLevel } from './decks/math.js';
import * as ui from './ui.js';

const DEFAULT_LESSON = 10; // a "lesson" defaults to 10 problems (parent-settable)
const LESSON_CHOICES = [5, 10, 15, 20];
const sessionSize = () => LESSON_CHOICES.includes(settings.lessonLength) ? settings.lessonLength : DEFAULT_LESSON;
const POOL = 28;
const mount = /** @type {HTMLElement} */ (document.getElementById('app'));
const store = makeStorage('dl-kids-math');

let settings = store.loadSettings({ rangeKey: 'a1', mode: 'objects', audio: true, lessonLength: DEFAULT_LESSON });
audio.setEnabled(settings.audio !== false);
let progress = srs.reconcile(store.load() || srs.createProgress(DECK_META.ids), DECK_META.ids);

/** @type {string[]} */ let session = [];
let pos = 0, missed = false, startTime = 0;
let stats = { total: 0, correct: 0 };
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

/** Facts for the session. Count/objects mode clamps to 1-digit (so objects are renderable);
 * other modes (incl. mixed) sample the selected tier. */
function sessionIds() {
  if (settings.mode === 'objects') { const L = getLevel(settings.rangeKey); return sampleIds(L.op === '-' ? 's1' : 'a1', POOL); }
  return sampleIds(settings.rangeKey, POOL);
}

/** Resolve the concrete mode for a question — 'mixed' picks a random AVAILABLE mode for this fact
 * (objects only when both operands are countable, ≤9). */
function concreteMode(q) {
  if (settings.mode !== 'mixed') return settings.mode;
  const opts = ['equation', 'hear'];
  if (q.a <= 9 && q.b <= 9) opts.push('objects');
  return opts[Math.floor(Math.random() * opts.length)];
}

/** Home is now the step-by-step WIZARD ( / AC1): Activity → Level → #Questions, then start. */
function home() {
  ui.renderWizard(mount, { activity: settings.mode, rangeKey: settings.rangeKey, count: sessionSize() }, {
    onStart: startSession,
    onParent: openParentGate,
    onRewards: openRewards,
  });
}

/** Begin a lesson with the wizard's choice (activity/level/count). Persists the picks so the wizard
 *  re-opens pre-selected. The count fix (srs.pickSession) guarantees EXACTLY `count` problems. */
function startSession(choice) {
  if (choice) {
    settings.mode = choice.activity;
    settings.rangeKey = choice.rangeKey;
    settings.lessonLength = choice.count;
    store.saveSettings(settings);
  }
  const ids = sessionIds();
  srs.reconcile(progress, ids);
  session = srs.pickSession(progress, ids, sessionSize());
  pos = 0; stats = { total: 0, correct: 0 };
  nextQuestion();
}

/** Abandon the current lesson: stop any speech and return to the home screen (Fix 7 — Quit). */
function quitToHome() { audio.stopSpeech(); home(); }

function nextQuestion() {
  if (pos >= session.length) return finishSession();
  missed = false; stats.total += 1; startTime = now();
  const q = buildQuestion(session[pos], { mode: settings.mode });
  q.mode = concreteMode(q); // resolve 'mixed' per question
  const ctrl = ui.renderQuestion(mount, q, `${pos + 1} / ${session.length}`, {
    onSubmit: (picked) => handleAnswer(q, picked, ctrl),
    onHear: () => audio.speak(spoken(q)),
  });
  ui.mountQuit(mount.querySelector('.screen'), quitToHome); // shared in-lesson Home/Quit control (Fix 7)
  if (q.mode === 'hear') audio.speak(spoken(q));
}

function handleAnswer(q, picked, ctrl) {
  speakNumber(Number(picked)); // say the chosen number via the bundled-clip seam (single whole-number clip when available, else gapless blocks, else TTS)
  if (isCorrect(q, picked)) {
    if (!missed) { srs.recordAnswer(progress, q.id, true, { responseMs: now() - startTime }); stats.correct += 1; }
    store.save(progress);
    ctrl.markCorrect();
    rewardCorrect();
    setTimeout(() => { pos += 1; nextQuestion(); }, 1250);
  } else {
    if (!missed) { srs.recordAnswer(progress, q.id, false, { responseMs: now() - startTime }); store.save(progress); missed = true; }
    ctrl.markWrongRetry();
    audio.tone('soft'); audio.speak('Try again'); // gentle + encouraging; child can retry
  }
}

function rewardCorrect() {
  const prevPeak = store.loadRewards().peak || 0;
  const r = rewards.update(store, progress);
  const badge = rewards.newBadge(prevPeak, r.peak);
  audio.tone('good'); audio.cheer(); audio.encourage();
  const screen = mount.querySelector('.screen') || mount;
  if (badge) { ui.celebrate(screen, true); audio.fireworks(); audio.speak(`New badge! ${badge.name}`); }
  else { ui.celebrate(screen, false); }
}

function finishSession() {
  const accuracy = stats.total ? stats.correct / stats.total : 0;
  store.appendSession({ t: new Date().toISOString(), mode: settings.mode, level: settings.rangeKey, total: stats.total, correct: stats.correct, accuracy });
  const lesson = rewards.completeLesson(store);          // end-of-lesson sticker
  const day = rewards.recordDay(store);                  // positive-only day streak
  audio.fireworks(); audio.speak('Lesson complete! Great job!');
  ui.renderDone(mount, { onAgain: () => startSession(), onHome: home, onRewards: openRewards,
    lesson: { sticker: lesson.sticker, newSticker: lesson.newSticker, streak: day.streak, streakBadge: day.newStreakBadge } });
}

function openRewards() { ui.renderRewards(mount, rewards.model(store), { onBack: home, onAlbum: openAlbum }); }
function openAlbum() { ui.renderAlbum(mount, rewards.model(store), { onBack: openRewards }); }

function openParentGate() { showParentGate(ui.gateMount(mount), openParent, home); }
function openParent() {
  const ids = DECK_META.ids; // stable 1-digit core for a meaningful progress denominator
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
