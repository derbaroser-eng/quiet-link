/*
 * Quiet Link — background service worker (Manifest V3).
 * Owns context menus, local stats and host rules. All storage is local;
 * no network, no analytics, no external calls.
 */
import { stripTrackers, buildReceipt, applyHostRules, aggregate } from "./core/link.js";

const MENU = { CLEAN_LINK: "ql-clean-link", CLEAN_PAGE: "ql-clean-page", COPY_RAW: "ql-copy-raw" };

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU.CLEAN_LINK, title: "Copy clean link (remove trackers)", contexts: ["link"] });
  chrome.contextMenus.create({ id: MENU.CLEAN_PAGE, title: "Copy clean URL for this page", contexts: ["page", "frame"] });
  chrome.contextMenus.create({ id: MENU.COPY_RAW, title: "Show tracker receipt for this page", contexts: ["page"] });
  chrome.storage.local.get({ stats: null, rules: [] }, (data) => {
    if (!data.stats) chrome.storage.local.set({ stats: { results: [] } });
    if (!Array.isArray(data.rules)) chrome.storage.local.set({ rules: [] });
  });
});

async function persistResult(result) {
  const data = await chrome.storage.local.get({ stats: { results: [] } });
  const stats = data.stats || { results: [] };
  if (!Array.isArray(stats.results)) stats.results = [];
  stats.results.push({ at: Date.now(), host: result.host, removedCount: result.removedCount, removed: result.removed });
  if (stats.results.length > 500) stats.results = stats.results.slice(-500);
  await chrome.storage.local.set({ stats });
  const total = aggregate(stats.results.map((r) => ({ ok: true, host: r.host, removed: r.removed, removedCount: r.removedCount })));
  chrome.action.setBadgeText({ text: String(total.trackers || "") });
  chrome.action.setBadgeBackgroundColor({ color: "#6C5CE7" });
}

async function cleanAndCopy(raw, sendResponse) {
  const { rules = [] } = await chrome.storage.local.get({ rules: [] });
  let result = stripTrackers(raw);
  if (result.ok) result = applyHostRules(result, rules);
  if (!result.ok) { if (sendResponse) sendResponse({ ok: false, error: result.error }); return; }
  try {
    await navigator.clipboard.writeText(result.clean);
    await persistResult(result);
    if (sendResponse) sendResponse({ ok: true, clean: result.clean, receipt: buildReceipt(result) });
  } catch (e) {
    if (sendResponse) sendResponse({ ok: false, error: "clipboard_denied" });
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU.CLEAN_LINK && info.linkUrl) cleanAndCopy(info.linkUrl);
  else if (info.menuItemId === MENU.CLEAN_PAGE && tab && tab.url) cleanAndCopy(tab.url);
  else if (info.menuItemId === MENU.COPY_RAW && tab && tab.url) {
    (async () => {
      const { rules = [] } = await chrome.storage.local.get({ rules: [] });
      let result = stripTrackers(tab.url);
      if (result.ok) result = applyHostRules(result, rules);
      await persistResult(result);
      chrome.notifications.create({
        type: "basic", iconUrl: "icons/icon48.png",
        title: result.removedCount ? `Removed ${result.removedCount} tracker(s)` : "Link already clean",
        message: buildReceipt(result).slice(0, 280),
      });
    })();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "clean") { cleanAndCopy(msg.url, sendResponse); return true; }
  if (msg.type === "stats") {
    chrome.storage.local.get({ stats: { results: [] } }, (data) => {
      const rows = (data.stats && data.stats.results) || [];
      sendResponse(aggregate(rows.map((r) => ({ ok: true, host: r.host, removed: r.removed, removedCount: r.removedCount }))));
    });
    return true;
  }
  if (msg.type === "getRules") {
    chrome.storage.local.get({ rules: [] }, (d) => sendResponse(d.rules || []));
    return true;
  }
  if (msg.type === "saveRules") {
    chrome.storage.local.set({ rules: msg.rules || [] }, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "resetStats") {
    chrome.storage.local.set({ stats: { results: [] } }, () => { chrome.action.setBadgeText({ text: "" }); sendResponse({ ok: true }); });
    return true;
  }
  return false;
});
