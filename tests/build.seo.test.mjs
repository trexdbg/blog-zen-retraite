import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { keyTakeaways, relatedArticles, structuredDate } from "../scripts/build.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (file, args, options) => new Promise((resolve, reject) => execFile(file, args, options, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr })));

test("structured dates make Actions timestamps explicitly UTC while preserving offsets", () => {
  assert.equal(structuredDate("2026-10-04T07:56:44"), "2026-10-04T07:56:44Z");
  assert.equal(structuredDate("2026-10-04T09:56:44+02:00"), "2026-10-04T09:56:44+02:00");
  assert.equal(structuredDate("2026-10-04"), "2026-10-04");
  assert.equal(structuredDate("2026-99-99T07:56:44"), null);
  assert.equal(structuredDate("2026-02-30T07:56:44"), null);
  assert.equal(structuredDate("October 5, 2026"), null);
  assert.equal(structuredDate("2026-10-04T07:56:44+25:00"), null);
});

test("related articles require a shared topic inside the same family", () => {
  const article = { id: "photos", theme: "numerique_pratique", subtheme: "gestion des photos", title: "Sauvegarder ses photos" };
  const candidates = [
    { id: "photo-albums", theme: "numerique_pratique", subtheme: "albums photos", title: "Classer ses photos de famille", created_at: "2026-10-03T10:00:00Z" },
    { id: "lecture", theme: "numerique_pratique", subtheme: "lecture optique", title: "Lire confortablement sur écran", created_at: "2026-10-04T10:00:00Z" },
    { id: "photos", theme: "numerique_pratique", subtheme: "gestion des photos", title: "Sauvegarder ses photos", created_at: "2026-10-05T10:00:00Z" },
    { id: "other", theme: "maison", subtheme: "photos", title: "Cadres photos", created_at: "2026-10-05T10:00:00Z" },
  ];
  assert.deepEqual(relatedArticles(article, candidates).map((item) => item.id), ["photo-albums"]);
});

test("generic retirement terms alone do not create a related link", () => {
  const article = { id: "budget", theme: "finances", subtheme: "budget", title: "Conseils simples pour la retraite en 2026" };
  const candidate = { id: "comfort", theme: "finances", subtheme: "confort", title: "Nos idées pour les seniors et leur vie après la retraite en 2026", created_at: "2026-10-04T10:00:00Z" };
  assert.deepEqual(relatedArticles(article, [candidate]), []);
});

test("key takeaways only render valid editorial metadata", () => {
  assert.deepEqual(keyTakeaways({ key_takeaways: ["Première idée.", "Deuxième idée."] }), ["Première idée.", "Deuxième idée."]);
  assert.deepEqual(keyTakeaways({ key_takeaways: ["Une seule idée."] }), []);
  assert.deepEqual(keyTakeaways({ key_takeaways: ["Une idée.", 42] }), []);
});

test("static build preserves every archived article and adds the about page to the sitemap", async () => {
  await run(process.execPath, ["scripts/build.js"], { cwd: rootDir });
  const articlesDir = path.join(rootDir, "data", "articles");
  const articleFiles = (await readdir(articlesDir)).filter((file) => file.endsWith(".json") && file !== "index.json");
  const articleIds = new Set(await Promise.all(articleFiles.map(async (file) => JSON.parse(await readFile(path.join(articlesDir, file), "utf8")).id)));
  const homeIds = new Set(JSON.parse(await readFile(path.join(articlesDir, "index.json"), "utf8")));
  const expectedArchiveIds = new Set([...articleIds].filter((id) => !homeIds.has(id)));
  const [archive, sitemap] = await Promise.all([
    readFile(path.join(rootDir, "dist", "archive.html"), "utf8"),
    readFile(path.join(rootDir, "dist", "sitemap.xml"), "utf8"),
  ]);
  const archiveData = archive.match(/<script id="zr-archive-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(archiveData);
  const archiveEntries = JSON.parse(archiveData[1]).entries;
  assert.deepEqual(new Set(archiveEntries.map((entry) => entry.id)), expectedArchiveIds);
  const sitemapLocs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  assert.equal(sitemapLocs.size, articleIds.size + 3);
  assert.match(sitemap, /https:\/\/zen-retraite\.fr\/a-propos\.html/);
  for (const id of articleIds) assert.ok(sitemapLocs.has(`https://zen-retraite.fr/articles/${id}/`), `missing article URL: ${id}`);
  assert.match(sitemap, /<loc>https:\/\/zen-retraite\.fr\/a-propos\.html<\/loc>\s*<lastmod>2026-10-05<\/lastmod>/);
  const photoId = "2026-10-04_07-56_gestion-des-photos_photos-souvenirs-famille";
  const source = JSON.parse(await readFile(path.join(articlesDir, `${photoId}.json`), "utf8"));
  const article = await readFile(path.join(rootDir, "dist", "articles", photoId, "index.html"), "utf8");
  const jsonLd = article.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(jsonLd);
  assert.equal(JSON.parse(jsonLd[1]).datePublished, structuredDate(source.created_at));
  assert.equal(JSON.parse(jsonLd[1]).dateModified, structuredDate(source.updated_at) || structuredDate(source.created_at));
  if (structuredDate(source.updated_at)) assert.match(article, /Mis à jour le/);
});
