# Kids' Learning Apps

Two small, free, offline-first learning apps for young children, by **Digital Legends LLC**.

- **DL Numbers — Count & Learn** (`/kids-numbers/`): count objects, hear numbers, match, and trace digits 0–20.
- **DL Math — Add & Subtract** (`/kids-math/`): addition and subtraction facts, with listen and count modes.

## Built for trust
- **No ads. No tracking. No data collection.** Nothing is sent anywhere.
- **Works offline** (installable web app / PWA).
- **No microphone, camera, location, or accounts.**
- **Progress is stored on your device only** and can be erased anytime (Grown-ups → Reset progress).
- **Parent-gated** settings and scorecard.

See each app's `PRIVACY_POLICY.md` for details.

## Run locally
These are static files — no build step. Serve this folder's root over HTTP and open `index.html`:

```
npx --yes http-server . -p 8080 -o
```

Then visit `/kids-numbers/` or `/kids-math/`. (Service workers and ES-module imports require `http://`, not `file://`.)

## Hosting (GitHub Pages)
This folder is structured to sit at a repository root: the landing `index.html`, the two app folders, and the shared engine (`/shared/`) all resolve from the root. Enabling GitHub Pages on the default branch root serves the landing page and both apps directly.

© Digital Legends LLC
