/* Quiet Link — popup controller. Uses only the pure core + chrome.storage. */
import { stripTrackers, buildReceipt, applyHostRules } from "./core/link.js";

const $ = (id) => document.getElementById(id);
let lastClean = "";

function show(result) {
  if (!result.ok) {
    $("receipt").textContent = "That doesn't look like a valid link.";
    $("out").style.display = "block";
    return;
  }
  lastClean = result.clean;
  $("cleanurl").textContent = result.clean;
  $("receipt").textContent = buildReceipt(result);
  $("out").style.display = "block";
}

async function clean(raw) {
  const { rules = [] } = await chrome.storage.local.get({ rules: [] });
  let result = stripTrackers(raw);
  if (result.ok) result = applyHostRules(result, rules);
  show(result);
  try { if (result.ok) await navigator.clipboard.writeText(result.clean); } catch { /* popup clipboard may be blocked; Copy button remains */ }
}

$("clean").addEventListener("click", () => clean($("url").value));
$("url").addEventListener("keydown", (e) => { if (e.key === "Enter") clean($("url").value); });
$("clearpage").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) { $("url").value = tab.url; clean(tab.url); }
});
$("copy").addEventListener("click", async () => {
  if (!lastClean) return;
  try { await navigator.clipboard.writeText(lastClean); $("copy").textContent = "Copied ✓"; setTimeout(() => ($("copy").textContent = "Copy again"), 1200); } catch { /* noop */ }
});

function switchTab(name) {
  for (const n of ["clean", "rules"]) {
    $("tab-" + n).classList.toggle("active", n === name);
    $("view-" + n).classList.toggle("active", n === name);
  }
}
$("tab-clean").addEventListener("click", () => switchTab("clean"));
$("tab-rules").addEventListener("click", async () => {
  switchTab("rules");
  const rules = await chrome.storage.local.get({ rules: [] });
  $("rules").value = (rules.rules || []).map((r) => `${r.host} ${r.param}`).join("\n");
});
$("saverules").addEventListener("click", async () => {
  const lines = $("rules").value.split("\n").map((s) => s.trim()).filter(Boolean);
  const rules = lines.map((line) => {
    const [host, param] = line.split(/\s+/);
    return { host, param: param || "", mode: "strip" };
  });
  await chrome.storage.local.set({ rules });
  $("saverules").textContent = "Saved ✓"; setTimeout(() => ($("saverules").textContent = "Save rules"), 1200);
});
$("reset").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "resetStats" });
  $("reset").textContent = "Reset ✓"; $("total").textContent = "0"; setTimeout(() => ($("reset").textContent = "Reset stats"), 1200);
});

chrome.runtime.sendMessage({ type: "stats" }, (stats) => {
  if (stats && typeof stats.trackers === "number") $("total").textContent = String(stats.trackers);
});
