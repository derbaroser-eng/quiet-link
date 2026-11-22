# Quiet Link — DESIGN (chrome-extension / ext-1)

One-line pitch: **Close the tab, keep the thread.** Quiet Link strips tracking junk from any
link and shows a shareable receipt of exactly what was watching you.

## The painful daily problem
Every link shared in chat, email or social carries invisible baggage: `fbclid`, `gclid`,
five `utm_*` fields, a Mailchimp ID, sometimes a session token in the hash. It makes URLs
ugly, leaks browsing relationships to third parties, and nobody can see it happening. Existing
"URL cleaner" extensions are either dead, require broad `<all_urls>` host permissions, or
silently change links with no explanation.

## The hook that makes a stranger share it
The **surveillance receipt**. After cleaning, Quiet Link doesn't just hand back a tidy URL —
it prints a small, honest card: *"Removed 4 trackers from one link · Ad campaign: utm_source,
utm_campaign · Social/Meta: fbclid."* That card is genuinely surprising the first time and
people paste it into group chats. Every share is free distribution. No branding that says
"agent", "bot" or "factory" — it reads like a privacy tool a friend made.

## Three-minute onboarding
1. Install. Right-click any link → "Copy clean link (remove trackers)".
2. Or click the icon, paste a URL, press Enter. Clean URL is copied automatically.
3. Badge on the toolbar quietly counts total trackers removed. Tap it to see the tally.

## Monetization surface (money out = 0)
- Chrome Web Store listing is free; the extension itself is free (donation-supported).
- Donation / "Quiet Link Pro for teams" path lives on the external GitHub Pages landing page
  using the existing inbound-only Stripe payment link rail — never inside the store.
- No ads, no paid APIs, no analytics, no network calls at all.

## Feature list (built, plain JS, no dependencies, no downloads)
- 60+ exact tracker names + 7 prefix families (utm_, pk_, piwik_, matomo_, hsa_, sc_, ga_).
- Category-labelled removal receipt (Ad campaign / Social / Email-CRM / Affiliate / Session).
- Tracking hash-fragment and long share-ID removal, with meaningful anchors preserved.
- Keep-list and custom-extra-list per clean operation.
- Host-specific rules with `*.example.com` wildcards and `promo_*` prefix params.
- Local rolling stats (last 500 results) and toolbar badge count.
- Background context menus for link, page and receipt.
- Pure ES-module core, shared by background worker, popup and Node tests — 19 unit tests.

## Architecture
- `core/link.js` — pure functions; single source of truth; no DOM, no chrome APIs.
- `background.js` — MV3 service worker; context menus, storage, badge, clipboard.
- `popup.html` / `popup.js` — clean UI, rules editor, stats.
- `icons/` — generated locally from `gen_icons.py` (stdlib zlib), no external assets.
- `test/link.test.mjs` — Node built-in test runner; `npm test` → 19/19 pass.

## Growth loop
Receipt is copy-pasteable → pasted into chats → recipients install → badge count spreads.
Landing page carries a "see how much you're leaking" framing with the same core running
client-side in a live demo box, so the web page sells the exact behavior the extension gives.
