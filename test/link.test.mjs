import test from "node:test";
import assert from "node:assert/strict";
import {
  KNOWN_TRACKERS, TRACKER_PREFIXES, classifyParam, isTracker, normaliseInput,
  stripTrackers, buildReceipt, aggregate, validateRule, applyHostRules,
} from "../core/link.js";

test("tracker registry is populated and frozen", () => {
  assert.ok(KNOWN_TRACKERS.size >= 40);
  assert.ok(Object.isFrozen(KNOWN_TRACKERS));
  assert.ok(TRACKER_PREFIXES.includes("utm_"));
});

test("classifyParam labels known families", () => {
  assert.equal(classifyParam("utm_source"), "Ad campaign");
  assert.equal(classifyParam("fbclid"), "Social / Meta");
  assert.equal(classifyParam("mc_eid"), "Email / CRM");
  assert.equal(classifyParam("ref"), "Affiliate / referral");
  assert.equal(classifyParam("_ga"), "Session / debug");
  assert.equal(classifyParam("q"), null);
});

test("isTracker matches exact, prefix, extra and wildcard", () => {
  assert.equal(isTracker("fbclid"), true);
  assert.equal(isTracker("UTM_SOURCE"), true);
  assert.equal(isTracker("utm_customthing"), true);
  assert.equal(isTracker("pk_campaign"), true);
  assert.equal(isTracker("q"), false);
  assert.equal(isTracker("q", ["q"]), true);
  assert.equal(isTracker("anything", ["*"]), true);
});

test("normaliseInput adds scheme, rejects junk", () => {
  assert.equal(normaliseInput("example.com/a?b=1").host, "example.com");
  assert.equal(normaliseInput("  https://Example.COM/x  ").host, "example.com");
  assert.equal(normaliseInput("not a url at all"), null);
  assert.equal(normaliseInput(""), null);
  assert.equal(normaliseInput(123), null);
});

test("stripTrackers removes utm + fbclid, keeps real params", () => {
  const r = stripTrackers("https://shop.example.com/item?utm_source=news&fbclid=ABC123&id=42&color=red");
  assert.equal(r.ok, true);
  assert.equal(r.host, "shop.example.com");
  assert.equal(r.removedCount, 2);
  assert.equal(r.clean, "https://shop.example.com/item?id=42&color=red");
});

test("stripTrackers returns zero removals for clean link", () => {
  const r = stripTrackers("https://example.com/page?a=1&b=2");
  assert.equal(r.ok, true);
  assert.equal(r.removedCount, 0);
  assert.equal(r.clean, "https://example.com/page?a=1&b=2");
});

test("stripTrackers honours keep list", () => {
  const r = stripTrackers("https://example.com/?utm_source=a&utm_medium=b", { keep: ["utm_source"] });
  assert.equal(r.removedCount, 1);
  assert.equal(r.clean, "https://example.com/?utm_source=a");
});

test("stripTrackers honours extra list", () => {
  const r = stripTrackers("https://example.com/?q=search&id=7", { extra: ["q"] });
  assert.equal(r.removedCount, 1);
  assert.equal(r.clean, "https://example.com/?id=7");
});

test("stripTrackers handles invalid URL", () => {
  const r = stripTrackers("garbage not url");
  assert.equal(r.ok, false);
  assert.equal(r.error, "invalid_url");
  assert.equal(r.clean, null);
});

test("stripTrackers strips tracking hash fragment", () => {
  const r = stripTrackers("https://example.com/article#utm_source=twitter");
  assert.equal(r.ok, true);
  assert.equal(r.removedCount, 1);
  assert.equal(r.clean, "https://example.com/article");
});

test("stripTrackers leaves meaningful hash intact", () => {
  const r = stripTrackers("https://example.com/docs#section-2");
  assert.equal(r.removedCount, 0);
  assert.equal(r.clean, "https://example.com/docs#section-2");
});

test("stripTrackers removes all utm params in a large query", () => {
  const url = "https://news.example.com/x?utm_source=s&utm_medium=m&utm_campaign=c&utm_term=t&utm_content=co&id=99";
  const r = stripTrackers(url);
  assert.equal(r.removedCount, 5);
  assert.equal(r.clean, "https://news.example.com/x?id=99");
});

test("buildReceipt renders counts, categories and clean link", () => {
  const r = stripTrackers("https://shop.example.com/i?utm_source=news&fbclid=XYZ&id=1");
  const receipt = buildReceipt(r);
  assert.match(receipt, /removed 2 trackers/);
  assert.match(receipt, /Ad campaign: utm_source/);
  assert.match(receipt, /Social \/ Meta: fbclid/);
  assert.match(receipt, /https:\/\/shop.example.com\/i\?id=1/);
});

test("buildReceipt handles clean and invalid links", () => {
  assert.match(buildReceipt(stripTrackers("https://example.com/?a=1")), /no trackers found/);
  assert.match(buildReceipt(stripTrackers("bad input")), /nothing to report/);
});

test("aggregate sums categories and hosts", () => {
  const a = stripTrackers("https://a.com/?utm_source=x");
  const b = stripTrackers("https://a.com/?fbclid=y");
  const c = stripTrackers("https://b.com/?clean=1");
  const s = aggregate([a, b, c, { ok: false }]);
  assert.equal(s.links, 3);
  assert.equal(s.trackers, 2);
  assert.equal(s.byHost["a.com"], 2);
  assert.equal(s.byCategory["Ad campaign"], 1);
  assert.equal(s.byCategory["Social / Meta"], 1);
});

test("validateRule accepts good rules and rejects bad", () => {
  assert.equal(validateRule({ host: "example.com", param: "promo", mode: "strip" }).ok, true);
  assert.equal(validateRule({ host: "*.example.com", param: "utm_*" }).ok, true);
  assert.equal(validateRule({ host: "", param: "x" }).ok, false);
  assert.equal(validateRule({ host: "x.com", param: "" }).ok, false);
  assert.equal(validateRule(null).ok, false);
  assert.equal(validateRule({ host: "bad host!", param: "x" }).ok, false);
});

test("applyHostRules strips host-specific promo param", () => {
  const r = stripTrackers("https://shop.example.com/?id=1&promo=SUMMER");
  const out = applyHostRules(r, [{ host: "shop.example.com", param: "promo", mode: "strip" }]);
  assert.equal(out.removedCount, 1);
  assert.equal(out.clean, "https://shop.example.com/?id=1");
});

test("applyHostRules supports wildcard host and prefix param", () => {
  const r = stripTrackers("https://deep.sub.example.com/?keep=1&promo_code=X&promo_id=Y");
  const out = applyHostRules(r, [{ host: "*.example.com", param: "promo_*", mode: "strip" }]);
  assert.equal(out.removedCount, 2);
  assert.equal(out.clean, "https://deep.sub.example.com/?keep=1");
});

test("applyHostRules ignores rules for other hosts", () => {
  const r = stripTrackers("https://other.com/?promo=X");
  const out = applyHostRules(r, [{ host: "example.com", param: "promo", mode: "strip" }]);
  assert.equal(out.removedCount, 0);
  assert.equal(out.clean, "https://other.com/?promo=X");
});
