// main.js — app bootstrap + session loop across modes. Ties SRS + storage + audio + rewards +
// game + trace + UI. No network calls anywhere. Everything runs on-device.

import * as srs from '../../shared/srs.js';
import * as audio from '../../shared/audio.js';
import * as rewards from '../../shared/rewards.js';
import { makeStorage } from '../../shared/storage.js';
import { showParentGate } from '../../shared/parentGate.js';
import { buildQuestion, isCorrect } from './game.js';
import { DECK_META, idsForRange, sampleIds, getCard, COUNT_CAP, ENUM_CAP } from './decks/numbers.js';
import { traceDigit } from './trace.js';
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

/** Resolve the concrete mode for a question — 'mixed' picks a random AVAILABLE mode for this value
 * (auto-excludes count-objects above the cap, and keeps trace to sensible low numbers). */
function concreteMode(value) {
  if (settings.mode !== 'mixed') return settings.mode;
  const opts = ['hear', 'matchAudio'];
  if (value <= COUNT_CAP) opts.push('count');
  if (value <= 20) opts.push('trace');
  return opts[Math.floor(Math.random() * opts.length)];
}

function activeIds() {
  const max = rangeMax();
  if (settings.mode === 'trace') return idsForRange(Math.min(max, 9));
  if (settings.mode === 'count') return idsForRange(Math.min(max, COUNT_CAP));
  // recognition OR mixed: span the full range (sampled if big); per-question mode excludes count/trace by value
  if (max <= ENUM_CAP) return idsForRange(max);
  return sampleIds(max, BIG_SAMPLE);
}

function home() {
  ui.renderHome(mount, { rangeKey: settings.rangeKey, mode: settings.mode }, {
    onStart: startSession,
    onParent: openParentGate,
    onRewards: openRewards,
    onPickRange: (r) => { settings.rangeKey = r.key; store.saveSettings(settings); home(); },
    onPickMode: (mode) => { settings.mode = mode; store.saveSettings(settings); home(); },
  });
}

function startSession() {
  const ids = activeIds();
  srs.reconcile(progress, ids);
  session = srs.pickSession(progress, ids, sessionSize());
  pos = 0; stats = { total: 0, correct: 0 };
  nextQuestion();
}

function nextQuestion() {
  if (pos >= session.length) return finishSession();
  missed = false; stats.total += 1; startTime = now();
  const id = session[pos];
  const value = getCard(id).value;
  const mode = concreteMode(value);

  if (mode === 'trace') {
    ui.renderTrace(mount, value, traceDigit(value), `${pos + 1} / ${session.length}`, { onComplete: () => onTraceDone(id) });
    audio.speak('Trace the ' + value);
    return;
  }
  const qMax = mode === 'count' ? Math.min(rangeMax(), COUNT_CAP) : rangeMax();
  const q = buildQuestion(id, { mode, max: qMax });
  const ctrl = ui.renderQuestion(mount, q, `${pos + 1} / ${session.length}`, {
    onSubmit: (picked) => handleAnswer(q, picked, ctrl),
    onHear: (n) => audio.speak(String(n)),
  });
  if (q.mode === 'hear') audio.speak(String(q.value));
  else if (q.mode === 'count') audio.speak('How many?');
}

function handleAnswer(q, picked, ctrl) {
  if (q.mode !== 'matchAudio') audio.speak(String(picked)); // say the chosen number
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

function onTraceDone(id) {
  if (!missed) { srs.recordAnswer(progress, id, true, { responseMs: now() - startTime }); stats.correct += 1; }
  store.save(progress);
  rewardCorrect();
  setTimeout(() => { pos += 1; nextQuestion(); }, 1250);
}

/** Celebrate a correct answer; a newly-crossed mastery BADGE makes it extra special. */
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
  store.appendSession({ t: new Date().toISOString(), mode: settings.mode, max: rangeMax(), total: stats.total, correct: stats.correct, accuracy });
  const lesson = rewards.completeLesson(store);          // end-of-lesson sticker
  const day = rewards.recordDay(store);                  // positive-only day streak
  audio.fireworks(); audio.speak('Lesson complete! Great job!');
  ui.renderDone(mount, { onAgain: startSession, onHome: home, onRewards: openRewards,
    lesson: { sticker: lesson.sticker, newSticker: lesson.newSticker, streak: day.streak, streakBadge: day.newStreakBadge } });
}

function openRewards() { ui.renderRewards(mount, rewards.model(store), { onBack: home }); }

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
