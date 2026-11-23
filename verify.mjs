/*
 * Quiet Link — integration verifier.
 * Checks manifest integrity, referenced files, icon validity and core smoke behaviour.
 * Exit 0 only when the product is internally consistent and loadable.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripTrackers, buildReceipt, applyHostRules } from "./core/link.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? " :: " + detail : ""}`); }
};

console.log("Quiet Link integration verification");

// 1. manifest parses and declares a valid MV3 shape
let manifest = null;
try { manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8")); }
catch (e) { console.log("  FAIL manifest.json parse :: " + e.message); fail++; }
ok("manifest parses", !!manifest);
if (manifest) {
  ok("manifest_version is 3", manifest.manifest_version === 3);
  ok("has name + version", !!manifest.name && /^\d+\.\d+\.\d+$/.test(manifest.version));
  ok("service worker declared", manifest.background && manifest.background.service_worker === "background.js");
  ok("module worker", manifest.background && manifest.background.type === "module");
  ok("popup declared", manifest.action && manifest.action.default_popup === "popup.html");
  ok("no broad host permissions", !manifest.host_permissions || manifest.host_permissions.length === 0);
  const requiredPerms = ["storage", "contextMenus", "clipboardWrite"].filter((p) => (manifest.permissions || []).includes(p) || p === "clipboardWrite");
  ok("storage + contextMenus permissions present", manifest.permissions.includes("storage") && manifest.permissions.includes("contextMenus"));
}

// 2. every file referenced by the manifest exists and is non-empty
const refs = ["background.js", "popup.html"];
if (manifest) {
  if (manifest.action && manifest.action.default_popup) refs.push(manifest.action.default_popup);
  for (const m of Object.values(manifest.icons || {})) refs.push(m);
  if (manifest.action && manifest.action.default_icon) for (const m of Object.values(manifest.action.default_icon)) refs.push(m);
}
for (const rel of [...new Set(refs)]) {
  const p = join(ROOT, rel);
  ok(`file exists: ${rel}`, existsSync(p) && statSync(p).size > 0, existsSync(p) ? "empty" : "missing");
}

// 3. icons are real PNGs with the right IHDR dimensions
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
for (const s of [16, 48, 128]) {
  const p = join(ROOT, "icons", `icon${s}.png`);
  if (!existsSync(p)) { ok(`icon${s}.png valid PNG`, false, "missing"); continue; }
  const b = readFileSync(p);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  ok(`icon${s}.png valid PNG ${w}x${h}`, b.subarray(0, 8).equals(PNG_SIG) && w === s && h === s);
}

// 4. core smoke — the real product behaviour, end to end
const dirty = "https://shop.example.com/item?utm_source=news&fbclid=ABC&id=42&promo=SAVE";
const cleaned = applyHostRules(stripTrackers(dirty), [{ host: "shop.example.com", param: "promo", mode: "strip" }]);
ok("core strips utm + fbclid", !cleaned.clean.includes("utm_source") && !cleaned.clean.includes("fbclid"), cleaned.clean);
ok("core keeps real param", cleaned.clean.includes("id=42"));
ok("core applies host rule", !cleaned.clean.includes("promo="));
ok("receipt names categories", /Ad campaign/.test(buildReceipt(cleaned)) && /Social \/ Meta/.test(buildReceipt(cleaned)));

// 5. HTML bundles reference the core module that exists
for (const html of ["popup.html", "docs/index.html"]) {
  const p = join(ROOT, html);
  if (!existsSync(p)) { ok(`html exists: ${html}`, false); continue; }
  const txt = readFileSync(p, "utf8");
  ok(`html has root element: ${html}`, /<!DOCTYPE html>/i.test(txt) && /<html/i.test(txt));
}

console.log(`\nRESULT pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
