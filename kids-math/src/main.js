// main.js (Math) — app bootstrap + session loop on the SHARED engine. No network calls.

import * as srs from '../../shared/srs.js';
import * as audio from '../../shared/audio.js';
import { makeStorage } from '../../shared/storage.js';
import { showParentGate } from '../../shared/parentGate.js';
import { buildQuestion, isCorrect, spoken } from './game.js';
import { DECK_META, idsForRange } from './decks/math.js';
import * as ui from './ui.js';

const SESSION_SIZE = 8;
const mount = /** @type {HTMLElement} */ (document.getElementById('app'));
const store = makeStorage('dl-kids-math');

let settings = store.loadSettings({ max: 10, mode: 'equation', audio: true });
audio.setEnabled(settings.audio !== false);
let progress = srs.reconcile(store.load() || srs.createProgress(DECK_META.ids), DECK_META.ids);

/** @type {string[]} */ let session = [];
let pos = 0, missed = false, startTime = 0;
let stats = { total: 0, correct: 0 };
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
const activeIds = () => idsForRange(settings.max);

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
  const q = buildQuestion(session[pos], { mode: settings.mode, max: settings.max });
  let ctrl;
  ctrl = ui.renderQuestion(mount, q, `${pos + 1} / ${session.length}`, {
    onAnswer: (picked, tile) => handleAnswer(q, picked, tile, ctrl),
    onHear: () => audio.speak(spoken(q)),
  });
  if (q.mode === 'hear') audio.speak(spoken(q));
}

function handleAnswer(q, picked, tile, ctrl) {
  audio.speak(String(picked)); // say-aloud the chosen answer
  if (isCorrect(q, picked)) {
    if (!missed) { srs.recordAnswer(progress, q.id, true, { responseMs: now() - startTime }); stats.correct += 1; }
    store.save(progress);
    ctrl.markCorrect(tile);
    audio.tone('good'); audio.cheer(); audio.encourage();
    setTimeout(() => { pos += 1; nextQuestion(); }, 1200);
  } else {
    if (!missed) { srs.recordAnswer(progress, q.id, false, { responseMs: now() - startTime }); store.save(progress); missed = true; }
    ctrl.markWrong(tile);
    audio.tone('soft'); audio.speak('Try again');
  }
}

function finishSession() {
  const accuracy = stats.total ? stats.correct / stats.total : 0;
  store.appendSession({ t: new Date().toISOString(), mode: settings.mode, max: settings.max, total: stats.total, correct: stats.correct, accuracy });
  audio.cheer(); audio.speak('All done! Great job!');
  ui.renderDone(mount, { onAgain: startSession, onHome: home });
}

function openParentGate() { showParentGate(ui.gateMount(mount), openParent, home); }
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
