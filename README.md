# Kids' Learning Apps

Two small, free, offline-first learning apps for young children, by **Digital Legends LLC**.

- **DL Numbers — Count & Learn** (`/kids-numbers/`): count, hear, match, and **trace** digits (connect-the-dots with a numbered start + direction arrows) — ranges from 5 up to 1000, plus a Mixed mode.
- **DL Math — Add & Subtract** (`/kids-math/`): addition and subtraction with single-, double-, and triple-digit levels, plus listen, count, and Mixed modes.

## Built for trust
- **No ads. No tracking. No data collection.** Nothing is sent anywhere.
- **Works offline** (installable web app / PWA).
- **No microphone, camera, location, or accounts.**
- **Progress + rewards are stored on your device only** and can be erased anytime (Grown-ups → Reset progress).
- **Parent-gated** settings and scorecard.

## Learning-tied, kid-friendly rewards (no dark patterns)
- A **lesson** is 10 problems; finish one to earn a **collectible sticker**.
- **Badges** for mastering numbers/facts; a **progress map** of milestones.
- **Positive-only day streaks**: we celebrate coming back and keep earned streak badges forever — **no guilt, no "don't break the streak", no timers**. Missing a day never punishes.
- Respects your device's **reduced-motion** and **sound** preferences.

See each app's `PRIVACY_POLICY.md` for details.

## Run locally
Static files — no build step. Serve this folder's root over HTTP and open `index.html`:

```
npx --yes http-server . -p 8080 -o
```

Then visit `/kids-numbers/` or `/kids-math/`. (Service workers + ES modules require `http://`, not `file://`.)

## Hosting (GitHub Pages)
This folder sits at a repository root: the landing `index.html`, the two app folders, and the shared engine (`/shared/`) all resolve from the root. Enabling GitHub Pages on the default branch root serves the landing + both apps.

© Digital Legends LLC
