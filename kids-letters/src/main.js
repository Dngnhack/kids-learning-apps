// main.js (Letters) — app bootstrap + session loop. Ties SRS + storage + audio + rewards + game +
// trace + UI. No network calls anywhere; everything runs on-device (offline, zero-data, parent-gated).
// Stages: Trace (stroke geometry) + Picture-starts-with (emoji → letter) + the sound-based phonics
// stages (Letter↔Sound, Sound↔Letter, Blending) + a Mixed capstone. All phoneme audio routes through
// the phoneme seam (phoneme-audio.js): a recorded clip plays if present, else an interim TTS sound —
// the stage logic is identical either way, so swapping in real audio later needs no changes here.

import * as srs from '../../shared/srs.js';
import * as audio from '../../shared/audio.js';
import { speakLetterName, stopClips, playCheer } from '../../shared/clips.js';
import * as rewards from '../../shared/rewards.js';
import { makeStorage } from '../../shared/storage.js';
import { showParentGate } from '../../shared/parentGate.js';
import { buildQuestion, buildPhonemeQuestion, isCorrect, SOUND_MODES, pickMixedMode } from './game.js';
import { DECK_META, getCard, lettersForRange, lettersForRangeLimited, idsFor } from './decks/letters.js';
import { TRACEABLE } from './trace.js';
import * as phoneme from './phoneme-audio.js';
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

const REWARD_BEAT_MS = 300;   // small beat AFTER the cheer finishes before advancing (lets it land)
const CHEER_MAX_MS = 2600;    // hard cap: a failed/slow cheer clip can never hang the game

/** Resolve after the in-flight cheer Promise settles, but never wait longer than CHEER_MAX_MS so a
 *  failed/stalled clip can't freeze the lesson. Pass the Promise returned by playCheer (or null). */
function awaitCheer(cheerPromise) {
  const safe = Promise.resolve(cheerPromise).catch(() => {});
  return Promise.race([safe, new Promise((r) => setTimeout(r, CHEER_MAX_MS))]);
}

/** Play the full celebration, THEN (after the cheer's onended + a small beat) advance to the next
 *  question. Awaiting the cheer means the next prompt's stopClips/stopPhoneme no longer chops it
 *  mid-play. The max-timeout fallback inside awaitCheer guarantees we always advance. */
function celebrateThenAdvance(cheerPromise) {
  awaitCheer(cheerPromise).then(() => setTimeout(advance, REWARD_BEAT_MS));
}

/** Move to the next question (the single advance point). */
function advance() { pos += 1; nextQuestion(); }

/** The letter ids in play for the chosen activity + range. Trace is limited to letters we have
 *  geometry for; every other stage uses the whole range (each letter has a curated emoji + a sound
 *  via the phoneme seam). */
function activeLetters() {
  if (settings.mode === 'trace') return lettersForRangeLimited(settings.rangeKey, TRACEABLE);
  return lettersForRange(settings.rangeKey);
}

/** Home is the step-by-step WIZARD: Activity → Range → #Questions, then start. */
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
  pos = 0; stats = { total: 0, correct: 0 }; prevMixedMode = null;
  nextQuestion();
}

function quitToHome() { stopClips(); phoneme.stopPhoneme(); audio.stopSpeech(); home(); }
function addQuit() { ui.mountQuit(mount.querySelector('.screen'), quitToHome); }

let prevMixedMode = null;                            // last mixed per-question mode (avoid repeats)

/** The per-question mode: for 'mixed' pick one of the taught stage types; else the chosen mode. */
function questionMode() {
  if (settings.mode !== 'mixed') return settings.mode;
  prevMixedMode = pickMixedMode(prevMixedMode);
  return prevMixedMode;
}

function nextQuestion() {
  if (pos >= session.length) return finishSession();
  missed = false; stats.total += 1; startTime = now();
  const id = session[pos];
  const card = getCard(id);
  const progressText = `${pos + 1} / ${session.length}`;
  const mode = questionMode();

  if (mode === 'trace') {
    ui.renderTrace(mount, card.letter, progressText, { onComplete: () => onTraceDone(id) });
    addQuit();
    speakLetterName(card.letter);                     // letter NAME via bundled clip (primary)
    return;
  }

  if (mode === 'picture') {
    const q = buildQuestion(id, { pool: curRangeLetters, n: PIC_CHOICES });
    const ctrl = ui.renderPicture(mount, q, progressText, {
      onSubmit: (picked) => handleAnswer(q, picked, ctrl),
      onHear: (qq) => speakObject(qq),
    });
    addQuit();
    speakObject(q);                                    // "Apple. Which letter does it start with?"
    return;
  }

  // sound-based stage (letterSound / soundLetter / phonics) — audio via the phoneme seam.
  const q = buildPhonemeQuestion(mode, id, { pool: curRangeLetters, n: PIC_CHOICES });
  const ctrl = ui.renderSound(mount, q, progressText, {
    onSubmit: (picked) => handleAnswer(q, picked, ctrl),
    onHear: (letter) => phoneme.playPhoneme(letter),  // letterSound: play a candidate option's sound
    onHearPrompt: (qq) => playPrompt(qq),             // replay the prompt sound(s)
  });
  addQuit();
  playPrompt(q);
}

/** Play the prompt audio for a sound stage (always through the seam — clip or interim TTS). */
function playPrompt(q) {
  if (q.mode === 'phonics') {
    // blend: each sound in order, paced, then the whole (TTS-accurate) word.
    q.sounds.forEach((l, i) => setTimeout(() => phoneme.playPhoneme(l), i * 750));
    setTimeout(() => audio.speak(q.word), q.sounds.length * 750 + 250);
  } else {
    // letterSound + soundLetter both play the target letter's SOUND.
    phoneme.playPhoneme(q.play || q.letter);
  }
}

/** Say the object NAME (accurate TTS) + the prompt. NO phonemes — picture uses the object name. */
function speakObject(q) { audio.speak(`${q.word}. Which letter?`); }

function handleAnswer(q, picked, ctrl) {
  if (isCorrect(q, picked)) {
    if (!missed) { srs.recordAnswer(progress, q.id, true, { responseMs: now() - startTime }); stats.correct += 1; }
    store.save(progress);
    ctrl.markCorrect();
    if (q.mode === 'picture') audio.speak(`${q.name} for ${q.word}`); // "S for sun" — phrase, TTS
    else if (q.mode === 'phonics') audio.speak(q.word);               // confirm the blended word — TTS
    else speakLetterName(q.name);                                     // letter NAME confirm via bundled clip
    celebrateThenAdvance(rewardCorrect());   // play the FULL cheer, then beat, then advance
  } else {
    if (!missed) { srs.recordAnswer(progress, q.id, false, { responseMs: now() - startTime }); store.save(progress); missed = true; }
    ctrl.markWrongRetry();
    audio.tone('soft'); audio.speak('Try again');      // gentle + encouraging; child can retry
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
    // Big moment: synthesized fireworks + the badge announcement (TTS). No clip cheer here — the badge
    // name is the spoken reward, so we don't pile a second voice on top.
    ui.celebrate(screen, true); audio.fireworks(); audio.speak(`New badge! ${badge.name}`);
    return Promise.resolve();
  }
  ui.celebrate(screen, false);
  // ONE random ORIGINAL cheer clip (our voice). Delayed so the just-spoken letter/word CONFIRMATION
  // (speakLetterName / audio.speak, see handleAnswer) finishes first — sequence, not jumble. We RETURN
  // the cheer's Promise (resolves on its onended) so the caller waits for the FULL cheer before
  // advancing; the old fire-and-forget let the next question's stopClips/stopPhoneme chop it mid-play.
  // Graceful skip if the clip fails — the WebAudio chime above already celebrated.
  return new Promise((resolve) => {
    setTimeout(() => { playCheer().then(resolve, resolve); }, 900);
  });
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
