import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("all static page templates load the first-party consent manager", async () => {
  for (const name of ["home", "archive", "article-page", "about"]) {
    const html = await readFile(path.join(root, "templates", name + ".html"), "utf8");
    assert.match(html, /analytics-consent\.js/);
    assert.doesNotMatch(html, /<script[^>]*src=["']https:\/\/www\.googletagmanager\.com/);
  }
});

test("the analytics script is consent gated and offers accept, reject, and reversal", async () => {
  const js = await readFile(path.join(root, "analytics-consent.js"), "utf8");
  assert.match(js, /G-HZTBGCK3YM/);
  assert.match(js, /data-consent="accepted"/);
  assert.match(js, /data-consent="rejected"/);
  assert.match(js, /Gérer les cookies/);
  assert.match(js, /if \(choice === "accepted"\) startAnalytics\(\)/);
  assert.match(js, /if \(!choice\) banner\.hidden = false/);
  assert.match(js, /window\.gtag\?\.\("consent", "update", \{ analytics_storage: "denied" \}\)/);
  assert.match(js, /document\.head\.appendChild\(tag\)/);
  assert.match(js, /analytics_storage: "denied"/);
  assert.match(js, /ad_storage: "denied"/);
});

test("build copies the first-party consent manager to dist", async () => {
  const build = await readFile(path.join(root, "scripts/build.js"), "utf8");
  assert.match(build, /"analytics-consent\.js"/);
  const about = await readFile(path.join(root, "templates/about.html"), "utf8");
  assert.match(about, /id="confidentialite"/);
});
