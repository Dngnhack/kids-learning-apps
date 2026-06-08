// parentGate.js — SHARED parental gate (Google Play Families requirement) shown before the
// Parent area / settings. Uses a question a young child is unlikely to answer. Used by all apps.

/**
 * @param {HTMLElement} mount @param {() => void} onPass @param {() => void} onCancel
 */
export function showParentGate(mount, onPass, onCancel) {
  const a = 4 + Math.floor(Math.random() * 5);
  const b = 3 + Math.floor(Math.random() * 5);
  const answer = a + b;
  mount.innerHTML = `
    <div class="gate">
      <h2>Grown-ups only</h2>
      <p>To continue, please solve:</p>
      <p class="gate-q">${a} + ${b} = ?</p>
      <input class="gate-input" type="number" inputmode="numeric" aria-label="answer" />
      <div class="gate-actions">
        <button class="btn btn-ghost" data-act="cancel">Back</button>
        <button class="btn" data-act="ok">Continue</button>
      </div>
      <p class="gate-msg" aria-live="polite"></p>
    </div>`;
  const input = /** @type {HTMLInputElement} */ (mount.querySelector('.gate-input'));
  const msg = /** @type {HTMLElement} */ (mount.querySelector('.gate-msg'));
  mount.querySelector('[data-act="cancel"]').addEventListener('click', onCancel);
  mount.querySelector('[data-act="ok"]').addEventListener('click', () => {
    if (Number(input.value) === answer) onPass();
    else { msg.textContent = 'Not quite — try again.'; input.value = ''; input.focus(); }
  });
  input.focus();
}
