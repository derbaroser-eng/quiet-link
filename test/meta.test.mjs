import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFileSync(join(ROOT, p), "utf8");

test("package.json describes Quiet Link, not a different product", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.name, /^quiet-link/);
  assert.match(pkg.description, /Quiet Link/i);
  assert.doesNotMatch(pkg.description, /Stash/i);
});

test("README landing-page path matches the shipped docs/index.html", () => {
  const readme = read("README.md");
  assert.match(readme, /docs\/index\.html/);
  assert.doesNotMatch(readme, /site\/index\.html/);
});
