/*
 * Quiet Link — pure core logic.
 *
 * No DOM, no Chrome APIs, no network. Runs identically in Node (tests) and
 * inside the extension (ES module import). This is the single source of truth
 * for tracker detection, URL cleaning and receipt rendering.
 */

/** Exact-match tracking parameter names (lower-cased on construction so mixed-case registry entries stay matchable). */
export const KNOWN_TRACKERS = Object.freeze(
  new Set([
    // Google / analytics
    "gclid", "gclsrc", "dclid", "gbraid", "wbraid", "msclkid", "yclid",
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "utm_id", "utm_source_platform", "utm_creative_format", "utm_marketing_tactic",
    "ga_source", "ga_medium", "ga_campaign", "ga_term", "ga_content",
    // Facebook / Meta / Instagram
    "fbclid", "fb_action_ids", "fb_action_types", "fb_source", "igshid",
    "fb_ref", "fbc", "fbp", "ms", "mcc", "__cmsg",
    // Email / CRM
    "mc_cid", "mc_eid", "mc_tracking_code", "hsa_acc", "hsa_cam", "hsa_grp",
    "hsa_ad", "hsa_src", "hsa_tgt", "hsa_kw", "hsa_mt", "hsa_net", "hsa_ver",
    "_hsenc", "_hsmi", "hsCtaTracking", "vero_id", "vero_conversion",
    "mkt_tok", "elqTrackId", "elqTrack", "elqCampaignId",
    // Affiliate / referral
    "ref", "ref_src", "referrer", "aff_id", "affiliate_id", "aff", "partner",
    "tap_id", "traffic_source", "source", "medium", "campaign",
    // Other ad networks
    "twclid", "ttclid", "igshid", "s_kwcid", "ef_id", "s_kwcid", "ks_ref",
    "pd_rd_i", "pd_rd_r", "pd_rd_w", "pd_rd_wg", "psc", "tag", "th",
    "sc_cid", "sc_channel", "sc_campaign", "sc_content", "sc_medium", "sc_outbound",
    "wickedid", "wtrid", "vero_id", "mx_click_id", "bsft_uid", "bm_uid",
    // Session / debug leakage
    "_ga", "_gl", "_gid", "sid", "sessionid", "phpsessid", "jsessionid",
    "doing_wp_cron", "ver", "timestamp", "_t",
    ].map((k) => k.toLowerCase()))
);

/** Prefix matching for whole families of tracking params. */
export const TRACKER_PREFIXES = Object.freeze([
  "utm_", "pk_", "piwik_", "matomo_", "hsa_", "sc_", "ga_",
]);

/** Category labels used by the receipt. */
const CATEGORY_RULES = Object.freeze([
  { re: /^(utm_|ga_|pk_|piwik_|matomo_|gclid|gclsrc|dclid|gbraid|wbraid|msclkid|yclid|twclid|ttclid|s_kwcid|ef_id|sc_)/i, label: "Ad campaign" },
  { re: /^(fb|ig|ms|mcc|__cmsg|fbc|fbp)/i, label: "Social / Meta" },
  { re: /^(mc_|_hs|hsa_|hsCta|mkt_tok|elq|vero|bsft|bm_uid)/i, label: "Email / CRM" },
  { re: /^(ref|referrer|aff|partner|source|medium|campaign|tag|tap_id)/i, label: "Affiliate / referral" },
  { re: /^(_ga|_gl|_gid|sid|sessionid|phpsessid|jsessionid|doing_wp_cron)/i, label: "Session / debug" },
]);

export function classifyParam(key) {
  const k = String(key || "");
  for (const rule of CATEGORY_RULES) if (rule.re.test(k)) return rule.label;
  if (KNOWN_TRACKERS.has(k.toLowerCase())) return "Other tracker";
  return null;
}

/** Returns true when a single param name should be removed. */
export function isTracker(key, extra = []) {
  const k = String(key || "");
  const lower = k.toLowerCase();
  if (KNOWN_TRACKERS.has(lower)) return true;
  if (TRACKER_PREFIXES.some((p) => lower.startsWith(p))) return true;
  const extraSet = new Set((extra || []).map((x) => String(x).toLowerCase()));
  if (extraSet.has(lower)) return true;
  return extraSet.has("*");
}

/** Normalise user-pasted input into a URL string or return null. */
export function normaliseInput(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (/^www\./i.test(s) || /^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(s)) s = "https://" + s;
    else return null;
  }
  try {
    const u = new URL(s);
    if (!u.hostname) return null;
    return u;
  } catch {
    return null;
  }
}

/**
 * Strip trackers from a URL.
 * @param {string} raw input URL
 * @param {object} opts { extra: string[], keep: string[], stripHash: boolean, extraHash: string[] }
 * @returns {{ok:boolean,input:string,clean:string|null,host:string|null,removed:Array<{key,value,category}>,removedCount:number,error:string|null}}
 */
export function stripTrackers(raw, opts = {}) {
  const out = {
    ok: false, input: typeof raw === "string" ? raw : "", clean: null, host: null,
    removed: [], removedCount: 0, error: null,
  };
  const u = normaliseInput(raw);
  if (!u) { out.error = "invalid_url"; return out; }
  out.host = u.hostname;
  const extra = Array.isArray(opts.extra) ? opts.extra : [];
  const keep = new Set((Array.isArray(opts.keep) ? opts.keep : []).map((x) => String(x).toLowerCase()));
  const extraHash = (Array.isArray(opts.extraHash) ? opts.extraHash : ["utm_", "fbclid", "gclid"])
    .map((x) => String(x).toLowerCase());

  const removed = [];
  for (const [key, value] of Array.from(u.searchParams.entries())) {
    const lower = key.toLowerCase();
    if (!keep.has(lower) && isTracker(key, extra)) {
      removed.push({ key, value, category: classifyParam(key) || "Custom" });
      u.searchParams.delete(key);
    }
  }
  // Hash fragments used as trackers (e.g. #utm_source=... or #.abc123 share IDs)
  if (opts.stripHash !== false && u.hash) {
    const frag = u.hash.replace(/^#/, "");
    const fragKey = frag.split("=")[0].toLowerCase();
    const looksLikeTracker = /^[a-z_][a-z0-9_]*=/.test(frag) &&
      extraHash.some((h) => fragKey === h || (h.endsWith("_") && fragKey.startsWith(h)));
    const isPureShareId = /^[A-Za-z0-9_-]{16,}$/.test(frag);
    if (looksLikeTracker || isPureShareId) {
      removed.push({ key: "#hash", value: frag, category: "Fragment tracker" });
      u.hash = "";
    }
  }
  // Normalise: drop trailing '?' or '#' left behind
  let clean = u.toString();
  clean = clean.replace(/\?$/, "").replace(/#$/, "");
  out.ok = true;
  out.clean = clean;
  out.removed = removed;
  out.removedCount = removed.length;
  return out;
}

/** Render a human-readable, shareable "surveillance receipt". */
export function buildReceipt(result, opts = {}) {
  if (!result || !result.ok) return "Quiet Link: nothing to report.";
  if (!result.removedCount) return "Quiet Link: clean link — no trackers found.";
  const brand = opts.brand || "Quiet Link";
  const lines = [`${brand} removed ${result.removedCount} tracker${result.removedCount === 1 ? "" : "s"} from one link:`];
  const byCat = new Map();
  for (const r of result.removed) {
    const cat = r.category || "Other tracker";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(r.key);
  }
  for (const [cat, keys] of byCat) lines.push(`  ${cat}: ${keys.join(", ")}`);
  lines.push(`Clean link: ${result.clean}`);
  lines.push(`— ${brand}: the internet remembers less when you share this.`);
  return lines.join("\n");
}

/** Aggregate stats across many cleaning results (for the local dashboard). */
export function aggregate(results) {
  const stats = { links: 0, trackers: 0, byCategory: {}, byHost: {} };
  for (const r of Array.isArray(results) ? results : []) {
    if (!r || !r.ok) continue;
    stats.links += 1;
    stats.trackers += r.removedCount;
    for (const item of r.removed) {
      const cat = item.category || "Other tracker";
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    }
    if (r.host) stats.byHost[r.host] = (stats.byHost[r.host] || 0) + r.removedCount;
  }
  return stats;
}

/** Validate a custom rule object; returns {ok, error, rule}. */
export function validateRule(rule) {
  if (!rule || typeof rule !== "object") return { ok: false, error: "rule must be an object", rule: null };
  const host = String(rule.host || "").trim().toLowerCase();
  const param = String(rule.param || "").trim().toLowerCase();
  if (!host) return { ok: false, error: "host is required", rule: null };
  if (!/^[a-z0-9.*-]+$/.test(host)) return { ok: false, error: "invalid host", rule: null };
  if (!param || !/^[a-z0-9_*.-]+$/.test(param)) return { ok: false, error: "invalid param", rule: null };
  return { ok: true, error: null, rule: { host, param, mode: rule.mode === "keep" ? "keep" : "strip" } };
}

/** Apply host-specific custom rules on top of the global cleaning result. */
export function applyHostRules(result, rules = []) {
  if (!result || !result.ok) return result;
  const host = result.host || "";
  const hostMatches = (pattern, h) => {
    if (pattern === "*") return true;
    if (pattern.startsWith("*.")) {
      const base = pattern.slice(2);
      return h === base || h.endsWith("." + base);
    }
    return h === pattern;
  };
  const applicable = rules
    .map(validateRule)
    .filter((v) => v.ok && hostMatches(v.rule.host, host));
  if (!applicable.length) return result;
  const strip = new Set(applicable.filter((v) => v.rule.mode === "strip").map((v) => v.rule.param));
  if (!strip.size) return result;
  const u = new URL(result.clean);
  const added = [];
  for (const [key, value] of Array.from(u.searchParams.entries())) {
    const lower = key.toLowerCase();
    const match = Array.from(strip).some((p) => (p.endsWith("*") ? lower.startsWith(p.slice(0, -1)) : lower === p));
    if (match) {
      added.push({ key, value, category: "Host rule" });
      u.searchParams.delete(key);
    }
  }
  let clean = u.toString().replace(/\?$/, "").replace(/#$/, "");
  return { ...result, clean, removed: result.removed.concat(added), removedCount: result.removedCount + added.length };
}
