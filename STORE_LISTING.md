# Quiet Link — store listing copy (v1.0.0)

Human voice. No mention of tooling, automation or how it was made.

## Name
Quiet Link — see what trackers hide in a link

## Short summary (128/132 chars)
See exactly which trackers hide in a link, strip them in one click, and keep a receipt you can paste anywhere. Nothing leaves your browser.

## Description
Every link you share carries a passenger list you never agreed to. `fbclid`. Five `utm_` fields. A Mailchimp ID. Sometimes a session token riding in the fragment. Quiet Link pulls all of that out and shows you exactly what it found — then hands back a clean link and a short receipt you can paste into a chat to show someone what they were about to click.

It works the way a privacy tool should:

- Right-click any link, page or selection and choose "Copy clean link".
- Or click the toolbar icon, paste a URL, hit Enter. The clean link goes straight to your clipboard.
- A small badge counts the trackers you have stopped, so the tally is always visible.
- The receipt names each category — Ad campaign, Social / Meta, Email / CRM, Affiliate, Session — so the cleanup is understandable, not magic.

For shops and newsletters that add their own tracking parameter, the Rules tab lets you write one rule per line: `shop.example.com promo_code`. Wildcards (`*.news.com ref`) and prefix families (`promo_*`) work too. Only the hosts you name are touched.

Quiet Link asks for no host permissions and makes no network requests. There is no account, no sync, no analytics and no telemetry. Everything — the keep list, your rules, your running tally — lives in `chrome.storage.local` on your machine. The whole thing is plain JavaScript you can read in five minutes.

If you want to support it, the landing page has an optional tip jar. The extension itself will never ask you for money.

## Category
Privacy & Security (primary) · Productivity (secondary)

## Keywords
tracker remover, clean URL, utm stripper, fbclid removal, privacy, link cleaner, referral strip, surveillance receipt

## Screenshots required (1280 x 800)
1. Popup cleaning `shop.example.com/item?utm_source=news&fbclid=ABC&id=42` — clean link + receipt side by side.
2. The receipt close-up, categories colour-labelled.
3. Rules editor with two wildcard rules entered.
4. Toolbar badge showing an accumulated tally.
5. Landing-page live demo with the same core running in-browser.

## Data practices (store form)
- Single-purpose: remove tracking parameters from links.
- No data collected, transmitted or stored off-device.
- Permissions: `storage`, `contextMenus`, `clipboardWrite`. Zero host permissions.
- Privacy policy: on the landing page, plain language, no tracking of its own.

## What's new — 1.0.0
First release. 60+ named trackers, 7 prefix families, labelled receipts, host rules with wildcards, local tally.
