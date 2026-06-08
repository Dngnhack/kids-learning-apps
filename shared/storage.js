// storage.js — SHARED on-device persistence factory (localStorage ONLY). Each app calls
// makeStorage('<app-key>') to get its own namespaced store. Collects NO personal information
// and NEVER transmits anything off the device. All of it is user-erasable. Used by all apps.

const HISTORY_MAX = 30;

function readJSON(key) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (_e) { return null; } }
function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (_e) { /* ignore */ } }

/** @param {string} appKey e.g. 'dl-kids-numbers' or 'dl-kids-math' */
export function makeStorage(appKey) {
  const KEY = `${appKey}:v1`;
  const KEY_SETTINGS = `${appKey}:settings:v1`;
  const KEY_HISTORY = `${appKey}:history:v1`;
  const KEY_REWARDS = `${appKey}:rewards:v1`;
  return {
    load() { return readJSON(KEY); },
    save(progress) { writeJSON(KEY, progress); },
    loadSettings(defaults = { rangeKey: '10', mode: '', audio: true }) { return readJSON(KEY_SETTINGS) || defaults; },
    saveSettings(s) { writeJSON(KEY_SETTINGS, s); },
    appendSession(entry) {
      const h = readJSON(KEY_HISTORY) || [];
      h.push(entry);
      while (h.length > HISTORY_MAX) h.shift();
      writeJSON(KEY_HISTORY, h);
    },
    getHistory() { return readJSON(KEY_HISTORY) || []; },
    // Gamification rewards — on-device only, a high-water mark (never decreases), erasable.
    loadRewards() { return readJSON(KEY_REWARDS) || { peak: 0 }; },
    saveRewards(r) { writeJSON(KEY_REWARDS, r); },
    reset() { for (const k of [KEY, KEY_HISTORY, KEY_REWARDS]) { try { localStorage.removeItem(k); } catch (_e) { /* ignore */ } } },
  };
}
