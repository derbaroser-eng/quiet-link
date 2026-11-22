# Quiet Link

Strip tracking parameters from any link and see exactly what was watching. Fully client-side
Manifest V3 Chrome extension — nothing leaves your browser.

## Why
Every shared link carries invisible baggage: `fbclid`, `gclid`, `utm_*`, Mailchimp IDs,
sometimes session tokens in the hash. Quiet Link removes them and prints an honest receipt
of what it found. No account, no analytics, no network calls.

## Install (developer mode)
1. Open `chrome://extensions` and enable **Developer mode**.
2. **Load unpacked** → select this directory (`chrome-ext/`).
3. Right-click any link → **Copy clean link (remove trackers)**, or click the toolbar icon.

## Use
- Toolbar popup: paste a URL, press Enter. The clean URL is copied to clipboard.
- **Use current tab** button cleans the page you are on.
- **Rules** tab: one rule per line, `host param` (e.g. `shop.example.com promo_code`,
  `*.news.com ref`). Wildcards and `prefix_*` params supported.
- Toolbar badge counts the total trackers removed. **Reset stats** clears the local tally.

## Sell / rebrand
- `DESIGN.md` — product design, hook, monetization surface.
- `site/index.html` — public landing page with a live, in-browser demo of the same core.
- Rebrand by editing `manifest.json` (name/description) and the `ACCENT` colour in
  `popup.html` CSS.

## Tests
```
npm test          # node --test -> 19/19 pass
node verify.mjs   # manifest + files + core smoke integration -> exit 0
```

## Files
- `core/link.js` — pure tracker-stripping + receipt logic (no DOM/chrome/network).
- `background.js` — MV3 service worker: context menus, local storage, badge, clipboard.
- `popup.html`, `popup.js` — popup UI + rules editor.
- `gen_icons.py` — regenerates `icons/*.png` with Python stdlib only.
- `test/link.test.mjs` — unit tests.

## Privacy
All data stays in `chrome.storage.local`. The extension declares no host permissions and makes
zero network requests. Money path, if used, is an inbound-only donation link on the landing
page — never inside the extension.
