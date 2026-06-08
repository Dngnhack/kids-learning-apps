// main.js — app bootstrap + session loop across modes. Ties SRS + storage + audio + game +
// trace + UI. No network calls anywhere. Everything runs on-device.

import * as srs from '../../shared/srs.js';
import * as audio from '../../shared/audio.js';
import { makeStorage } from '../../shared/storage.js';
import { showParentGate } from '../../shared/parentGate.js';
import { buildQuestion, isCorrect } from './game.js';
import { DECK_META, idsForRange, getCard } from './decks/numbers.js';
import { traceDigit } from './trace.js';
import * as ui from './ui.js';

const SESSION_SIZE = 8;
const mount = /** @type {HTMLElement} */ (document.getElementById('app'));
const store = makeStorage('dl-kids-numbers');

let settings = store.loadSettings({ max: 10, mode: 'count', audio: true });
audio.setEnabled(settings.audio !== false);
let progress = srs.reconcile(store.load() || srs.createProgress(DECK_META.ids), DECK_META.ids);

/** @type {string[]} */ let session = [];
let pos = 0, missed = false, startTime = 0;
let stats = { total: 0, correct: 0 };

const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

function activeIds() {
  let ids = idsForRange(settings.max);
  if (settings.mode === 'trace') ids = ids.filter((id) => (getCard(id) || { value: 0 }).value <= 9); // single-digit shapes
  return ids;
}

function home() {
  ui.renderHome(mount, { max: settings.max, mode: settings.mode }, {
    onStart: startSession,
    onParent: openParentGate,
    onPickRange: (max) => { settings.max = max; store.saveSettings(settings); home(); },
    onPickMode: (mode) => { settings.mode = mode; store.saveSettings(settings); home(); },
  });
}

function startSession() {
  session = srs.pickSession(progress, activeIds(), SESSION_SIZE);
  pos = 0; stats = { total: 0, correct: 0 };
  nextQuestion();
}

function nextQuestion() {
  if (pos >= session.length) return finishSession();
  missed = false; stats.total += 1; startTime = now();
  const id = session[pos];

  if (settings.mode === 'trace') {
    const value = (getCard(id) || { value: 1 }).value;
    ui.renderTrace(mount, value, traceDigit(value), `${pos + 1} / ${session.length}`, { onComplete: () => onTraceDone(id) });
    audio.speak('Trace the ' + value);
    return;
  }
  const q = buildQuestion(id, { mode: settings.mode, max: settings.max });
  let ctrl;
  ctrl = ui.renderQuestion(mount, q, `${pos + 1} / ${session.length}`, {
    onAnswer: (picked, tile) => handleAnswer(q, picked, tile, ctrl),
    onHear: (n) => audio.speak(String(n)),
  });
  if (q.mode === 'hear') audio.speak(String(q.value));
  else if (q.mode === 'count') audio.speak('How many?');
}

function handleAnswer(q, picked, tile, ctrl) {
  if (q.mode !== 'matchAudio') audio.speak(String(picked)); // "say the number" on tap
  if (isCorrect(q, picked)) {
    if (!missed) { srs.recordAnswer(progress, q.id, true, { responseMs: now() - startTime }); stats.correct += 1; }
    store.save(progress);
    ctrl.markCorrect(tile);
    reward(q.word);
    setTimeout(() => { pos += 1; nextQuestion(); }, 1200);
  } else {
    if (!missed) { srs.recordAnswer(progress, q.id, false, { responseMs: now() - startTime }); store.save(progress); missed = true; }
    ctrl.markWrong(tile);
    audio.tone('soft'); audio.speak('Try again');
  }
}

function onTraceDone(id) {
  if (!missed) { srs.recordAnswer(progress, id, true, { responseMs: now() - startTime }); stats.correct += 1; }
  store.save(progress);
  reward((getCard(id) || { word: '' }).word);
  setTimeout(() => { pos += 1; nextQuestion(); }, 1200);
}

function reward(word) {
  audio.tone('good'); audio.cheer();
  audio.encourage();
}

function finishSession() {
  const accuracy = stats.total ? stats.correct / stats.total : 0;
  store.appendSession({ t: new Date().toISOString(), mode: settings.mode, max: settings.max, total: stats.total, correct: stats.correct, accuracy });
  audio.cheer(); audio.speak('All done! Great job!');
  ui.renderDone(mount, { onAgain: startSession, onHome: home });
}

function openParentGate() {
  const g = ui.gateMount(mount);
  showParentGate(g, openParent, home);
}

function openParent() {
  const ids = activeIds();
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
