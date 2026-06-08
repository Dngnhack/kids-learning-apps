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

const SESSION_SIZE = 8;
const BIG_SAMPLE = 28;
const mount = /** @type {HTMLElement} */ (document.getElementById('app'));
const store = makeStorage('dl-kids-numbers');

let settings = store.loadSettings({ rangeKey: '10', mode: 'count', audio: true });
if (!settings.rangeKey && settings.max) settings.rangeKey = String(settings.max); // migrate old saves
audio.setEnabled(settings.audio !== false);
let progress = srs.reconcile(store.load() || srs.createProgress(DECK_META.ids), DECK_META.ids);

/** @type {string[]} */ let session = [];
let pos = 0, missed = false, startTime = 0;
let stats = { total: 0, correct: 0 };

const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
const rangeMax = () => Number(settings.rangeKey) || 10;

/** Effective max for the CURRENT mode (count caps objects; trace is single-digit). */
function effMax() {
  if (settings.mode === 'trace') return Math.min(rangeMax(), 9);
  if (settings.mode === 'count') return Math.min(rangeMax(), COUNT_CAP);
  return rangeMax();
}

function activeIds() {
  const max = effMax();
  if (settings.mode === 'count' || settings.mode === 'trace') return idsForRange(max);
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
  session = srs.pickSession(progress, ids, SESSION_SIZE);
  pos = 0; stats = { total: 0, correct: 0 };
  nextQuestion();
}

function nextQuestion() {
  if (pos >= session.length) return finishSession();
  missed = false; stats.total += 1; startTime = now();
  const id = session[pos];

  if (settings.mode === 'trace') {
    const value = getCard(id).value;
    ui.renderTrace(mount, value, traceDigit(value), `${pos + 1} / ${session.length}`, { onComplete: () => onTraceDone(id) });
    audio.speak('Trace the ' + value);
    return;
  }
  const q = buildQuestion(id, { mode: settings.mode, max: effMax() });
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

/** Celebrate a correct answer; if it unlocked a sticker/badge, make it extra special. */
function rewardCorrect() {
  const prevPeak = store.loadRewards().peak || 0;
  const r = rewards.update(store, progress);
  const earned = rewards.newlyEarned(prevPeak, r.peak);
  audio.tone('good'); audio.cheer(); audio.encourage();
  const screen = mount.querySelector('.screen') || mount;
  if (earned.sticker || earned.badge) {
    ui.celebrate(screen, true); audio.fireworks();
    audio.speak(earned.badge ? `New badge! ${earned.badge.name}` : 'You earned a sticker!');
  } else {
    ui.celebrate(screen, false);
  }
}

function finishSession() {
  const accuracy = stats.total ? stats.correct / stats.total : 0;
  store.appendSession({ t: new Date().toISOString(), mode: settings.mode, max: rangeMax(), total: stats.total, correct: stats.correct, accuracy });
  audio.fireworks(); audio.speak('All done! Great job!');
  ui.renderDone(mount, { onAgain: startSession, onHome: home, onRewards: openRewards });
}

function openRewards() { ui.renderRewards(mount, rewards.model(store), { onBack: home }); }

function openParentGate() {
  const g = ui.gateMount(mount);
  showParentGate(g, openParent, home);
}

function openParent() {
  const ids = DECK_META.ids; // stable base deck (0..100) for a meaningful progress denominator
  ui.renderParent(mount, { summary: srs.summary(progress, ids), history: store.getHistory(), audioEnabled: audio.isEnabled() }, {
    onReset: () => { store.reset(); progress = srs.createProgress(DECK_META.ids); openParent(); },
    onToggleAudio: () => { const on = !audio.isEnabled(); audio.setEnabled(on); settings.audio = on; store.saveSettings(settings); openParent(); },
    onBack: home,
  });
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline cache is optional */ });
}

home();
