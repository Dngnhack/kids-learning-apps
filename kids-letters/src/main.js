// main.js (Letters) — app bootstrap + session loop. Ties SRS + storage + audio + rewards + game +
// trace + UI. No network calls anywhere; everything runs on-device (offline, zero-data, parent-gated).
// PHASE 1 only: Picture-starts-with (emoji → letter, letter-NAME audio) + Letter Trace (lowercase
// stroke geometry). Phoneme stages (Letter↔Sound, Phonics, Mixed) are Phase 2 and shown locked.

import * as srs from '../../shared/srs.js';
import * as audio from '../../shared/audio.js';
import * as rewards from '../../shared/rewards.js';
import { makeStorage } from '../../shared/storage.js';
import { showParentGate } from '../../shared/parentGate.js';
import { buildQuestion, isCorrect } from './game.js';
import { DECK_META, getCard, lettersForRange, lettersForRangeLimited, idsFor } from './decks/letters.js';
import { TRACEABLE } from './trace.js';
import * as ui from './ui.js';

const DEFAULT_LESSON = 10;                       // a "lesson" defaults to 10 problems (parent-settable)
const LESSON_CHOICES = [5, 10, 15, 20];
const sessionSize = () => LESSON_CHOICES.includes(settings.lessonLength) ? settings.lessonLength : DEFAULT_LESSON;
const PIC_CHOICES = 4;                            // picture game shows 4 large letter buttons (3-4 per spec)
const mount = /** @type {HTMLElement} */ (document.getElementById('app'));
const store = makeStorage('dl-kids-letters');

let settings = store.loadSettings({ rangeKey: 'g1', mode: 'trace', audio: true, lessonLength: DEFAULT_LESSON });
audio.setEnabled(settings.audio !== false);
let progress = srs.reconcile(store.load() || srs.createProgress(DECK_META.ids), DECK_META.ids);

/** @type {string[]} */ let session = [];
let pos = 0, missed = false, startTime = 0;
let stats = { total: 0, correct: 0 };
let curRangeLetters = [];                         // the active range's letters (picture distractor pool)

const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

/** The letter ids in play for the chosen activity + range. Trace is limited to letters we have
 *  geometry for; picture uses the whole range (every letter has a curated emoji). */
function activeLetters() {
  if (settings.mode === 'trace') return lettersForRangeLimited(settings.rangeKey, TRACEABLE);
  return lettersForRange(settings.rangeKey);
}

/** Home is the step-by-step WIZARD ( / AC1): Activity → Range → #Questions, then start. */
function home() {
  ui.renderWizard(mount, { activity: settings.mode, rangeKey: settings.rangeKey, count: sessionSize() }, {
    onStart: startSession,
    onParent: openParentGate,
    onRewards: openRewards,
  });
}

/** Begin a lesson with the wizard's choice (activity/range/count). Persists picks so the wizard
 *  re-opens pre-selected. srs.pickSession guarantees EXACTLY `count` problems even for a small set. */
function startSession(choice) {
  if (choice) {
    settings.mode = choice.activity;
    settings.rangeKey = choice.rangeKey;
    settings.lessonLength = choice.count;
    store.saveSettings(settings);
  }
  curRangeLetters = lettersForRange(settings.rangeKey);
  const letters = activeLetters();
  const ids = idsFor(letters);
  srs.reconcile(progress, ids);
  session = srs.pickSession(progress, ids, sessionSize());
  pos = 0; stats = { total: 0, correct: 0 };
  nextQuestion();
}

function quitToHome() { audio.stopSpeech(); home(); }
function addQuit() { ui.mountQuit(mount.querySelector('.screen'), quitToHome); }

function nextQuestion() {
  if (pos >= session.length) return finishSession();
  missed = false; stats.total += 1; startTime = now();
  const id = session[pos];
  const card = getCard(id);

  if (settings.mode === 'trace') {
    ui.renderTrace(mount, card.letter, `${pos + 1} / ${session.length}`, { onComplete: () => onTraceDone(id) });
    addQuit();
    audio.speak('Trace the ' + card.name);            // letter NAME — accurate TTS
    return;
  }

  // picture starts-with
  const q = buildQuestion(id, { pool: curRangeLetters, n: PIC_CHOICES });
  const ctrl = ui.renderPicture(mount, q, `${pos + 1} / ${session.length}`, {
    onSubmit: (picked) => handleAnswer(q, picked, ctrl),
    onHear: (qq) => speakObject(qq),
  });
  addQuit();
  speakObject(q);                                      // "Apple. Which letter does it start with?"
}

/** Say the object NAME (accurate TTS) + the prompt. NO phonemes — Phase 2 only. */
function speakObject(q) { audio.speak(`${q.word}. Which letter?`); }

function handleAnswer(q, picked, ctrl) {
  const pickedCard = getCard('L' + picked);
  if (isCorrect(q, picked)) {
    if (!missed) { srs.recordAnswer(progress, q.id, true, { responseMs: now() - startTime }); stats.correct += 1; }
    store.save(progress);
    ctrl.markCorrect();
    audio.speak(`${q.name} for ${q.word}`);            // "S for sun" — letter NAME + object NAME, accurate
    rewardCorrect();
    setTimeout(() => { pos += 1; nextQuestion(); }, 1400);
  } else {
    if (!missed) { srs.recordAnswer(progress, q.id, false, { responseMs: now() - startTime }); store.save(progress); missed = true; }
    ctrl.markWrongRetry();
    audio.tone('soft'); audio.speak('Try again');      // gentle + encouraging; child can retry
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
  store.appendSession({ t: new Date().toISOString(), mode: settings.mode, range: settings.rangeKey, total: stats.total, correct: stats.correct, accuracy });
  const lesson = rewards.completeLesson(store);
  const day = rewards.recordDay(store);
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
  const ids = DECK_META.ids; // stable base deck (a..z) for a meaningful progress denominator
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
